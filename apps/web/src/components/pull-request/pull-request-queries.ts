import { api } from "@sphynx/backend/convex/_generated/api";
import type {
  CreateReviewComment,
  PendingReview,
  ReviewThread,
  SubmitReview,
} from "@sphynx/schema/pull-request-comments";
import type {
  Conversation,
  ConversationComment,
} from "@sphynx/schema/pull-request-conversation";
import type {
  PullRequestFile,
  PullRequestRef,
  PullRequestSummary,
} from "@sphynx/schema/pull-requests";
import {
  type QueryClient,
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useAction } from "convex/react";
import { useCallback, useMemo, useRef } from "react";
import { toast } from "sonner";
import {
  clearAccessBlock,
  recordAccessBlock,
} from "@/components/pull-request/access-block-store";
import { seededSummary } from "@/components/pull-request/summary-seed";
import { isAccessBlocked } from "@/lib/access-block";
import { trackEvent } from "@/lib/analytics";
import { useSession } from "@/lib/auth-client";
import { isPermanentReadError } from "@/lib/auth-error";
import { limitConcurrency } from "@/lib/concurrency-limit";
import { convexQueryClient } from "@/lib/convex";
import { keys } from "@/lib/query/keys";

type SummaryAction = (ref: PullRequestRef) => Promise<PullRequestSummary>;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Retry transient failures for longer than TanStack's default three attempts,
 * because the recoverable ones self-heal within seconds: a Convex "Server Error"
 * mid-reconnect, a momentary GitHub blip, and — the common one on the PR page —
 * the `"Unauthenticated"` that a read throws when it fires before the Convex
 * socket has finished authenticating on a fresh load. That auth race is exactly
 * why the header used to stick in its skeleton; it is transient, so it retries.
 * Only genuine access/not-found/rate-limit errors stop, surfacing an error card.
 */
function retryTransient(failureCount: number, error: unknown): boolean {
  if (isPermanentReadError(error)) {
    return false;
  }
  return failureCount < 6;
}

/**
 * The first two retries fire fast (150ms, 400ms) so the auth-not-ready race
 * clears the instant the socket authenticates, rather than making the header sit
 * a full second before its first retry. Later attempts back off to spare a
 * genuinely struggling backend.
 */
const RETRY_DELAY = (attempt: number) =>
  attempt < 2
    ? 150 * 2 ** attempt + 100
    : Math.min(1000 * 2 ** attempt, 15_000);

/**
 * Surfaces a failed write, and remembers it when GitHub refused because the
 * app cannot reach the repository, so the page can explain why.
 */
function reportMutationError(
  ref: PullRequestRef,
  title: string,
  error: unknown
) {
  if (isAccessBlocked(error)) {
    recordAccessBlock(ref, String(error));
  }
  toast.error(title, {
    description: "Can't reach the server. Please try again.",
  });
}

function pullRequestQuery(
  ref: PullRequestRef,
  getSummary: SummaryAction,
  placeholder?: PullRequestSummary
) {
  return queryOptions({
    queryKey: keys.pullSummary(ref),
    queryFn: async () => {
      const summary = await getSummary(ref);
      clearAccessBlock(ref);
      return summary;
    },
    placeholderData: placeholder,
    retry: retryTransient,
    retryDelay: RETRY_DELAY,
  });
}

/**
 * Warm the summary before navigation — called on hover/focus of a dashboard
 * row so the fetch is often in flight or done by the time the user opens the
 * PR. The Convex action is invoked directly, off the React tree.
 */
export function prefetchPullRequest(
  queryClient: QueryClient,
  ref: PullRequestRef
) {
  return queryClient.prefetchQuery({
    queryKey: keys.pullSummary(ref),
    queryFn: () =>
      convexQueryClient.convexClient.action(
        api.github.prActions.getSummary,
        ref
      ),
  });
}

export function usePullRequest(ref: PullRequestRef) {
  const queryClient = useQueryClient();
  const getSummary = useAction(api.github.prActions.getSummary);
  const getPatches = useAction(api.github.prActions.getPatches);
  const placeholder = useMemo(
    () => seededSummary(queryClient, ref),
    [queryClient, ref]
  );
  const pullRequest = useQuery(pullRequestQuery(ref, getSummary, placeholder));
  const patches = useQuery({
    queryKey: keys.pullPatches(ref),
    queryFn: () => getPatches(ref),
    staleTime: Number.POSITIVE_INFINITY,
    retry: retryTransient,
    retryDelay: RETRY_DELAY,
  });
  return { pullRequest, patches };
}

export type FileContentsAction = (args: {
  owner: string;
  repo: string;
  number: number;
  path: string;
  sha: string;
}) => Promise<string | null>;

/**
 * Query options for one file's content at a sha. Content-addressed, so cached
 * indefinitely. The bound action is passed in so `useQueries` callers can build
 * one options object per file without a hook per item.
 */
export function fileContentsQuery(
  getFileContents: FileContentsAction,
  ref: PullRequestRef,
  sha: string,
  path: string | undefined
) {
  return queryOptions({
    queryKey: keys.pullFileContents(ref, sha, path),
    queryFn: () => getFileContents({ ...ref, path: path ?? "", sha }),
    enabled: Boolean(path && sha),
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
  });
}

/**
 * A single process-wide, concurrency-limited binding of the file-contents
 * action. Both the expanded-file and import-graph hooks fetch one file per
 * changed path; on a large PR that is dozens of actions at once, which overruns
 * Convex's per-client in-flight-action cap and stalls the whole websocket. One
 * shared limiter drains them a few at a time so the header and diffs stay live.
 */
const boundedFileContents: FileContentsAction = limitConcurrency(
  (args) =>
    convexQueryClient.convexClient.action(
      api.github.prActions.getFileContentsAction,
      args
    ),
  5
);

export function useFileContentsAction(): FileContentsAction {
  return boundedFileContents;
}

export function useFileContents(
  ref: PullRequestRef,
  sha: string,
  path: string | undefined
) {
  const getFileContents = useFileContentsAction();
  const query = useQuery(fileContentsQuery(getFileContents, ref, sha, path));
  return query.data ?? null;
}

/**
 * Tracks the head the reviewer is looking at. The live head push was dropped
 * with the SSE stream — the summary refetches on navigation, so there is no
 * out-of-band "new commits" banner. `viewing` is seeded from the first head sha
 * and advanced only by an explicit refresh.
 */
export function usePullRequestFreshness(
  ref: PullRequestRef,
  head: string | null,
  refreshing: boolean
) {
  const queryClient = useQueryClient();
  const viewing = useRef<string | null>(head);
  if (viewing.current === null) {
    viewing.current = head;
  }
  const hasNewChanges =
    head !== null && viewing.current !== null && viewing.current !== head;

  const refresh = useCallback(() => {
    viewing.current = head;
    return queryClient.invalidateQueries({ queryKey: keys.pull(ref) });
  }, [queryClient, ref, head]);

  return { hasNewChanges, refresh, refreshing };
}

const EMPTY_THREADS: readonly ReviewThread[] = [];

export function useCommentThreads(ref: PullRequestRef) {
  const getThreads = useAction(api.github.prActions.getThreads);
  const query = useQuery({
    queryKey: keys.pullThreads(ref),
    queryFn: () => getThreads(ref),
    retry: retryTransient,
    retryDelay: RETRY_DELAY,
  });
  return query.data ?? EMPTY_THREADS;
}

export function useConversation(ref: PullRequestRef) {
  const getConversation = useAction(api.github.prActions.getConversationAction);
  return useQuery({
    queryKey: keys.pullConversation(ref),
    queryFn: () => getConversation(ref),
    retry: retryTransient,
    retryDelay: RETRY_DELAY,
  });
}

const OPTIMISTIC_CONVERSATION_ID = "optimistic";

function dropOptimisticConversationComments(
  comments: readonly ConversationComment[]
) {
  return comments.filter(
    (comment) => comment.id !== OPTIMISTIC_CONVERSATION_ID
  );
}

/**
 * Adding a top-level conversation (issue) comment. The optimistic append and
 * rollback mirror the converted review-comment mutations.
 */
export function useAddConversationComment(ref: PullRequestRef) {
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const addConversationComment = useAction(
    api.github.prActions.addConversationComment
  );
  const queryKey = keys.pullConversation(ref);
  const mutation = useMutation({
    mutationFn: (body: string): Promise<ConversationComment> =>
      addConversationComment({ ...ref, body }),
    onMutate: async (body) => {
      await queryClient.cancelQueries({ queryKey });
      const optimistic: ConversationComment = {
        id: OPTIMISTIC_CONVERSATION_ID,
        author: session?.user
          ? { login: session.user.name, avatarUrl: session.user.image ?? "" }
          : null,
        body,
        bodyHTML: null,
        createdAt: new Date().toISOString(),
        githubUrl: "",
      };
      queryClient.setQueryData<Conversation>(queryKey, (current) =>
        current
          ? { ...current, comments: [...current.comments, optimistic] }
          : current
      );
    },
    onError: (error) => {
      queryClient.setQueryData<Conversation>(queryKey, (current) =>
        current
          ? {
              ...current,
              comments: dropOptimisticConversationComments(current.comments),
            }
          : current
      );
      reportMutationError(ref, "Couldn't post comment", error);
    },
    onSuccess: () => {
      trackEvent("comment_added", {
        owner: ref.owner,
        repo: ref.repo,
        number: ref.number,
      });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });
  return { addComment: mutation.mutate, adding: mutation.isPending };
}

const OPTIMISTIC_COMMENT_ID = "optimistic";

function optimisticComment(body: string, pending: boolean) {
  return {
    id: OPTIMISTIC_COMMENT_ID,
    body,
    author: null,
    createdAt: new Date().toISOString(),
    githubUrl: "",
    pending,
  };
}

function dropOptimisticComments(threads: readonly ReviewThread[]) {
  const next: ReviewThread[] = [];
  for (const thread of threads) {
    const comments = thread.comments.filter(
      (comment) => comment.id !== OPTIMISTIC_COMMENT_ID
    );
    if (comments.length > 0) {
      next.push({ ...thread, comments });
    }
  }
  return next;
}

export function useCreateComment(ref: PullRequestRef) {
  const queryClient = useQueryClient();
  const create = useAction(api.github.prActions.createReviewComment);
  const queryKey = keys.pullThreads(ref);
  const mutation = useMutation({
    mutationFn: (payload: CreateReviewComment) =>
      create({ ...ref, ...payload }),
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey });
      const optimistic: ReviewThread = {
        id: null,
        path: payload.path,
        line: payload.line,
        side: payload.side,
        startLine: payload.startLine,
        isResolved: false,
        isOutdated: false,
        viewerCanResolve: false,
        comments: [optimisticComment(payload.body, payload.pending)],
      };
      queryClient.setQueryData<readonly ReviewThread[]>(queryKey, (current) =>
        current ? [...current, optimistic] : current
      );
    },
    onError: (error) => {
      queryClient.setQueryData<readonly ReviewThread[]>(queryKey, (current) =>
        current ? dropOptimisticComments(current) : current
      );
      reportMutationError(ref, "Couldn't post comment", error);
    },
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey }),
        queryClient.invalidateQueries({
          queryKey: keys.pullPendingReview(ref),
        }),
      ]),
  });
  return { createComment: mutation.mutate, creating: mutation.isPending };
}

export function useReplyToComment(ref: PullRequestRef) {
  const queryClient = useQueryClient();
  const reply = useAction(api.github.prActions.replyToReviewComment);
  const queryKey = keys.pullThreads(ref);
  const mutation = useMutation({
    mutationFn: (payload: { body: string; commentId: string }) =>
      reply({ ...ref, body: payload.body, commentId: payload.commentId }),
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey });
      queryClient.setQueryData<readonly ReviewThread[]>(queryKey, (current) =>
        current
          ? current.map((thread) =>
              thread.comments[0]?.id === payload.commentId
                ? {
                    ...thread,
                    comments: [
                      ...thread.comments,
                      optimisticComment(payload.body, false),
                    ],
                  }
                : thread
            )
          : current
      );
    },
    onError: (error) => {
      queryClient.setQueryData<readonly ReviewThread[]>(queryKey, (current) =>
        current ? dropOptimisticComments(current) : current
      );
      reportMutationError(ref, "Couldn't post reply", error);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });
  return { reply: mutation.mutate, replying: mutation.isPending };
}

export function useResolveThread(ref: PullRequestRef) {
  const queryClient = useQueryClient();
  const resolveAction = useAction(api.github.prActions.resolveReviewThread);
  const queryKey = keys.pullThreads(ref);
  const mutation = useMutation({
    mutationFn: (payload: { resolved: boolean; threadId: string }) =>
      resolveAction({ ...ref, ...payload }),
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey });
      const previous =
        queryClient.getQueryData<readonly ReviewThread[]>(queryKey);
      queryClient.setQueryData<readonly ReviewThread[]>(queryKey, (current) =>
        current
          ? current.map((thread) =>
              thread.id === payload.threadId
                ? { ...thread, isResolved: payload.resolved }
                : thread
            )
          : current
      );
      return { previous };
    },
    onError: (error, _payload, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(queryKey, context.previous);
      }
      reportMutationError(ref, "Couldn't update thread", error);
    },
    onSuccess: (_data, payload) => {
      if (payload.resolved) {
        trackEvent("thread_resolved", {
          owner: ref.owner,
          repo: ref.repo,
          number: ref.number,
        });
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });
  return { resolve: mutation.mutate, resolving: mutation.isPending };
}

const EMPTY_PENDING: PendingReview = { pendingId: null, commentCount: 0 };

export function useReviewSubmission(ref: PullRequestRef) {
  const queryClient = useQueryClient();
  const getPending = useAction(api.github.prActions.getPending);
  const submitAction = useAction(api.github.prActions.submitPendingReview);
  const discardAction = useAction(api.github.prActions.discardPendingReview);
  const pendingKey = keys.pullPendingReview(ref);
  const pending = useQuery({
    queryKey: pendingKey,
    queryFn: () => getPending(ref),
    retry: false,
  });
  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: pendingKey }),
      queryClient.invalidateQueries({ queryKey: keys.pullThreads(ref) }),
    ]);
  const submit = useMutation({
    mutationFn: (payload: SubmitReview) =>
      submitAction({ ...ref, body: payload.body, event: payload.event }),
    onError: (error) =>
      reportMutationError(ref, "Couldn't submit review", error),
    onSettled: invalidate,
  });
  const discard = useMutation({
    mutationFn: () => discardAction(ref),
    onError: (error) =>
      reportMutationError(ref, "Couldn't discard review", error),
    onSettled: invalidate,
  });
  return {
    pendingReview: pending.data ?? EMPTY_PENDING,
    refreshPendingReview: () =>
      queryClient.invalidateQueries({ queryKey: pendingKey }),
    submitReview: submit.mutate,
    submitting: submit.isPending,
    discardReview: discard.mutate,
  };
}

export function useMergePullRequest(ref: PullRequestRef) {
  const queryClient = useQueryClient();
  const mergeAction = useAction(api.github.writes.merge);
  const merge = useMutation({
    mutationFn: () => mergeAction(ref),
    onSuccess: () => {
      trackEvent("pull_merged", {
        owner: ref.owner,
        repo: ref.repo,
        number: ref.number,
      });
      toast.success(`Merged #${ref.number}`);
      queryClient.invalidateQueries({ queryKey: keys.pull(ref) });
    },
    onError: (error) => reportMutationError(ref, "Couldn't merge", error),
  });
  return { merge: merge.mutate, merging: merge.isPending };
}

/**
 * Optimistic set/clear is applied to the cache and reconciled on settle.
 */
export interface ViewedFilesState {
  setAllViewed: (paths: readonly string[]) => void;
  setViewed: (change: { path: string; viewed: boolean }) => void;
  viewedFiles: ReadonlySet<string> | null;
}

export function useViewedFiles(ref: PullRequestRef): ViewedFilesState {
  const queryClient = useQueryClient();
  const getViewedFiles = useAction(api.github.prActions.getViewedFiles);
  const setViewedFile = useAction(api.github.prActions.setViewedFile);
  const setAllViewedFiles = useAction(api.github.prActions.setAllViewedFiles);
  const queryKey = keys.pullViewedFiles(ref);
  const query = useQuery({
    queryKey,
    queryFn: async (): Promise<ReadonlySet<string>> => {
      const files = await getViewedFiles(ref);
      const viewed = new Set<string>();
      for (const file of files) {
        if (file.viewed) {
          viewed.add(file.path);
        }
      }
      return viewed;
    },
    retry: retryTransient,
    retryDelay: RETRY_DELAY,
  });
  const mutationKey = ["viewed-files", ref.owner, ref.repo, ref.number];
  const mutation = useMutation({
    mutationKey,
    mutationFn: (change: { path: string; viewed: boolean }) =>
      setViewedFile({ ...ref, path: change.path, viewed: change.viewed }),
    onMutate: async (change) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData(queryKey);
      queryClient.setQueryData<ReadonlySet<string> | null>(
        queryKey,
        (current) => {
          if (!current) {
            return current;
          }
          const next = new Set(current);
          if (change.viewed) {
            next.add(change.path);
          } else {
            next.delete(change.path);
          }
          return next;
        }
      );
      return { previous };
    },
    onError: (error, _change, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(queryKey, context.previous);
      }
      reportMutationError(ref, "Couldn't update viewed state", error);
    },
    onSettled: () => {
      if (queryClient.isMutating({ mutationKey }) === 1) {
        return queryClient.invalidateQueries({ queryKey });
      }
    },
  });
  const allMutation = useMutation({
    mutationKey,
    mutationFn: (_paths: readonly string[]) =>
      setAllViewedFiles({ ...ref, viewed: true }),
    onMutate: async (paths: readonly string[]) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData(queryKey);
      queryClient.setQueryData<ReadonlySet<string> | null>(
        queryKey,
        (current) => (current ? new Set(paths) : current)
      );
      return { previous };
    },
    onError: (error, _paths, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(queryKey, context.previous);
      }
      reportMutationError(ref, "Couldn't mark all files viewed", error);
    },
    onSettled: () => {
      if (queryClient.isMutating({ mutationKey }) === 1) {
        return queryClient.invalidateQueries({ queryKey });
      }
    },
  });
  return {
    viewedFiles: query.data ?? null,
    setViewed: mutation.mutate,
    setAllViewed: allMutation.mutate,
  };
}

export function toGitPatch(file: PullRequestFile, patch: string | null) {
  const oldPath = file.previousPath ?? file.path;
  const oldRef = file.status === "added" ? "/dev/null" : `a/${oldPath}`;
  const newRef = file.status === "deleted" ? "/dev/null" : `b/${file.path}`;
  return `diff --git a/${oldPath} b/${file.path}\n--- ${oldRef}\n+++ ${newRef}\n${patch ?? ""}`;
}

interface ErrorCardContent {
  description: string;
  detail?: string;
  onRetry?: () => void;
  title: string;
}

/**
 * Map a read failure to an error card. Convex actions surface GitHub's failure
 * as an `Error` whose message carries the cause, so the card is chosen from that
 * message rather than an HTTP status.
 */
const NOT_FOUND = /not found|PullRequestNotFound/i;
const RATE_LIMITED = /rate limit|RateLimited/i;
const UNAVAILABLE = /unavailable|GitHubUnavailable|timeout|GitHubTimeout/i;

export function toErrorCardProps(
  error: unknown,
  onRetry: () => void
): ErrorCardContent {
  const message = errorMessage(error);
  if (NOT_FOUND.test(message)) {
    return {
      title: "Pull request not found",
      description:
        "This pull request doesn't exist, or the repository is private.",
    };
  }
  if (RATE_LIMITED.test(message)) {
    return {
      title: "Rate limited by GitHub",
      description: "GitHub is rate limiting requests. Try again shortly.",
      onRetry,
    };
  }
  if (UNAVAILABLE.test(message)) {
    return {
      title: "GitHub is unavailable",
      description: "We couldn't reach GitHub (shock). It may be down or slow.",
      onRetry,
    };
  }
  return {
    title: "Something went wrong",
    description: "We couldn't load this pull request.",
    detail: message,
    onRetry,
  };
}
