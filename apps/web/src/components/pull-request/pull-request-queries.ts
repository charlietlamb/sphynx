import {
  type CreateReviewComment,
  type PendingReview,
  PendingReviewSchema,
  type ReviewThread,
  ReviewThreadsSchema,
  type SubmitReview,
} from "@sphynx/schema/pull-request-comments";
import { ViewedFilesSchema } from "@sphynx/schema/pull-request-views";
import {
  MAX_FILE_PAGES,
  type PullRequestFile,
  PullRequestFileContentsSchema,
  PullRequestFilesPageSchema,
  type PullRequestRef,
  PullRequestSummarySchema,
} from "@sphynx/schema/pull-requests";
import {
  type QueryClient,
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { Schema } from "effect";
import { useCallback } from "react";
import { toast } from "sonner";

const FILES_PER_PAGE = 100;

interface ApiErrorBody {
  _tag?: string;
  message?: string;
  resetAt?: string | null;
  retryAfterSeconds?: number | null;
}

class ApiError extends Error {
  readonly status: number;
  readonly body: ApiErrorBody;

  constructor(status: number, body: ApiErrorBody) {
    super(body.message ?? `Request failed with status ${status}`);
    this.status = status;
    this.body = body;
  }
}

function showMutationError(title: string, error: unknown) {
  toast.error(title, {
    description:
      error instanceof ApiError && error.body.message
        ? error.body.message
        : "Can't reach the server. Please try again.",
  });
}

const ACCESS_BLOCK = /restricts OAuth apps/;

function accessBlockKey(ref: PullRequestRef) {
  return ["pull-request", ref.owner, ref.repo, ref.number, "access-block"];
}

function reportMutationError(
  queryClient: QueryClient,
  ref: PullRequestRef,
  title: string,
  error: unknown
) {
  if (
    error instanceof ApiError &&
    error.body.message &&
    ACCESS_BLOCK.test(error.body.message)
  ) {
    queryClient.setQueryData(accessBlockKey(ref), error.body.message);
  }
  showMutationError(title, error);
}

export function useAccessBlock(ref: PullRequestRef) {
  const query = useQuery({
    queryKey: accessBlockKey(ref),
    queryFn: () => null as string | null,
    enabled: false,
  });
  return query.data ?? null;
}

async function fetchDecoded<A, I>(
  url: string,
  schema: Schema.Schema<A, I>
): Promise<A> {
  const response = await fetch(url);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(response.status, body as ApiErrorBody);
  }
  return Schema.decodeUnknownPromise(schema)(await response.json());
}

function pullUrl({ owner, repo, number }: PullRequestRef) {
  return `/api/public/github/repos/${owner}/${repo}/pulls/${number}`;
}

function viewedFilesUrl({ owner, repo, number }: PullRequestRef) {
  return `/api/github/repos/${owner}/${repo}/pulls/${number}/viewed-files`;
}

function pullRequestQuery(ref: PullRequestRef) {
  return queryOptions({
    queryKey: ["pull-request", ref.owner, ref.repo, ref.number],
    queryFn: () => fetchDecoded(pullUrl(ref), PullRequestSummarySchema),
  });
}

function pullRequestFilesQuery(ref: PullRequestRef, fileCount: number) {
  return queryOptions({
    queryKey: [
      "pull-request",
      ref.owner,
      ref.repo,
      ref.number,
      "files",
      fileCount,
    ],
    queryFn: async () => {
      const pageCount = Math.min(
        Math.max(Math.ceil(fileCount / FILES_PER_PAGE), 1),
        MAX_FILE_PAGES
      );
      const pages = await Promise.all(
        Array.from({ length: pageCount }, (_, index) =>
          fetchDecoded(
            `${pullUrl(ref)}/files?page=${index + 1}`,
            PullRequestFilesPageSchema
          )
        )
      );
      return pages.flatMap((page) => page.files);
    },
  });
}

export function usePullRequest(ref: PullRequestRef) {
  const pullRequest = useQuery(pullRequestQuery(ref));
  const files = useQuery({
    ...pullRequestFilesQuery(ref, pullRequest.data?.stats.changedFiles ?? 0),
    enabled: pullRequest.data !== undefined,
  });
  return { pullRequest, files };
}

export function fileContentsQuery(
  ref: PullRequestRef,
  sha: string,
  path: string | undefined
) {
  return queryOptions({
    queryKey: [
      "pull-request",
      ref.owner,
      ref.repo,
      ref.number,
      "file-contents",
      sha,
      path,
    ],
    queryFn: () =>
      fetchDecoded(
        `${pullUrl(ref)}/file-contents?path=${encodeURIComponent(path ?? "")}&sha=${sha}`,
        PullRequestFileContentsSchema
      ),
    enabled: Boolean(path && sha),
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
  });
}

export function useFileContents(
  ref: PullRequestRef,
  sha: string,
  path: string | undefined
) {
  const query = useQuery(fileContentsQuery(ref, sha, path));
  return query.data?.content ?? null;
}

const HEAD_POLL_INTERVAL = 45_000;

export function usePullRequestFreshness(ref: PullRequestRef) {
  const queryClient = useQueryClient();
  const current = useQuery(pullRequestQuery(ref));
  const poll = useQuery({
    queryKey: ["pull-request", ref.owner, ref.repo, ref.number, "head-poll"],
    queryFn: () => fetchDecoded(pullUrl(ref), PullRequestSummarySchema),
    enabled: current.data !== undefined,
    initialData: () => queryClient.getQueryData(pullRequestQuery(ref).queryKey),
    refetchInterval: HEAD_POLL_INTERVAL,
    retry: false,
  });
  const hasNewChanges = Boolean(
    current.data && poll.data && poll.data.head.sha !== current.data.head.sha
  );
  const refresh = useCallback(
    () =>
      queryClient.invalidateQueries({
        queryKey: ["pull-request", ref.owner, ref.repo, ref.number],
      }),
    [queryClient, ref.owner, ref.repo, ref.number]
  );
  return { hasNewChanges, refresh, refreshing: current.isFetching };
}

const EMPTY_THREADS: readonly ReviewThread[] = [];

function commentThreadsQuery(ref: PullRequestRef) {
  return queryOptions({
    queryKey: [
      "pull-request",
      ref.owner,
      ref.repo,
      ref.number,
      "comment-threads",
    ],
    queryFn: () =>
      fetchDecoded(`${pullUrl(ref)}/comment-threads`, ReviewThreadsSchema),
  });
}

export function useCommentThreads(ref: PullRequestRef) {
  const query = useQuery(commentThreadsQuery(ref));
  return query.data?.threads ?? EMPTY_THREADS;
}

const OPTIMISTIC_COMMENT_ID = -1;

async function postJson(url: string, payload: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(response.status, body as ApiErrorBody);
  }
}

function commentsUrl({ owner, repo, number }: PullRequestRef) {
  return `/api/github/repos/${owner}/${repo}/pulls/${number}`;
}

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
  const { queryKey } = commentThreadsQuery(ref);
  const mutation = useMutation({
    mutationFn: (payload: CreateReviewComment) =>
      postJson(`${commentsUrl(ref)}/comments`, payload),
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
      queryClient.setQueryData(queryKey, (current) =>
        current ? { threads: [...current.threads, optimistic] } : current
      );
    },
    onError: (error) => {
      queryClient.setQueryData(queryKey, (current) =>
        current ? { threads: dropOptimisticComments(current.threads) } : current
      );
      reportMutationError(queryClient, ref, "Couldn't post comment", error);
    },
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey }),
        queryClient.invalidateQueries({
          queryKey: pendingReviewQuery(ref).queryKey,
        }),
      ]),
  });
  return { createComment: mutation.mutate, creating: mutation.isPending };
}

export function useReplyToComment(ref: PullRequestRef) {
  const queryClient = useQueryClient();
  const { queryKey } = commentThreadsQuery(ref);
  const mutation = useMutation({
    mutationFn: (payload: { body: string; commentId: number }) =>
      postJson(`${commentsUrl(ref)}/comment-replies`, payload),
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey });
      queryClient.setQueryData(queryKey, (current) =>
        current
          ? {
              threads: current.threads.map((thread) =>
                thread.comments[0]?.id === payload.commentId
                  ? {
                      ...thread,
                      comments: [
                        ...thread.comments,
                        optimisticComment(payload.body, false),
                      ],
                    }
                  : thread
              ),
            }
          : current
      );
    },
    onError: (error) => {
      queryClient.setQueryData(queryKey, (current) =>
        current ? { threads: dropOptimisticComments(current.threads) } : current
      );
      reportMutationError(queryClient, ref, "Couldn't post reply", error);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });
  return { reply: mutation.mutate, replying: mutation.isPending };
}

export function useResolveThread(ref: PullRequestRef) {
  const queryClient = useQueryClient();
  const { queryKey } = commentThreadsQuery(ref);
  const mutation = useMutation({
    mutationFn: (payload: { resolved: boolean; threadId: string }) =>
      postJson(`${commentsUrl(ref)}/comment-threads/resolve`, payload),
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey });
      queryClient.setQueryData(queryKey, (current) =>
        current
          ? {
              threads: current.threads.map((thread) =>
                thread.id === payload.threadId
                  ? { ...thread, isResolved: payload.resolved }
                  : thread
              ),
            }
          : current
      );
    },
    onError: (error) =>
      reportMutationError(queryClient, ref, "Couldn't update thread", error),
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });
  return { resolve: mutation.mutate };
}

function pendingReviewQuery(ref: PullRequestRef) {
  return queryOptions({
    queryKey: [
      "pull-request",
      ref.owner,
      ref.repo,
      ref.number,
      "pending-review",
    ],
    queryFn: async (): Promise<PendingReview> => {
      const response = await fetch(`${commentsUrl(ref)}/pending-review`);
      if (response.status === 401) {
        return { pendingId: null, commentCount: 0 };
      }
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new ApiError(response.status, body as ApiErrorBody);
      }
      return Schema.decodeUnknownPromise(PendingReviewSchema)(
        await response.json()
      );
    },
    retry: false,
  });
}

export function useReviewSubmission(ref: PullRequestRef) {
  const queryClient = useQueryClient();
  const pending = useQuery(pendingReviewQuery(ref));
  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries({
        queryKey: pendingReviewQuery(ref).queryKey,
      }),
      queryClient.invalidateQueries({
        queryKey: commentThreadsQuery(ref).queryKey,
      }),
    ]);
  const submit = useMutation({
    mutationFn: (payload: SubmitReview) =>
      postJson(`${commentsUrl(ref)}/pending-review/submit`, payload),
    onError: (error) =>
      reportMutationError(queryClient, ref, "Couldn't submit review", error),
    onSettled: invalidate,
  });
  const discard = useMutation({
    mutationFn: () =>
      postJson(`${commentsUrl(ref)}/pending-review/discard`, {}),
    onError: (error) =>
      reportMutationError(queryClient, ref, "Couldn't discard review", error),
    onSettled: invalidate,
  });
  return {
    pendingReview: pending.data ?? { pendingId: null, commentCount: 0 },
    refreshPendingReview: () =>
      queryClient.invalidateQueries({
        queryKey: pendingReviewQuery(ref).queryKey,
      }),
    submitReview: submit.mutate,
    submitting: submit.isPending,
    discardReview: discard.mutate,
  };
}

function viewedFilesQuery(ref: PullRequestRef) {
  return queryOptions({
    queryKey: ["pull-request", ref.owner, ref.repo, ref.number, "viewed-files"],
    queryFn: async (): Promise<ReadonlySet<string> | null> => {
      const response = await fetch(viewedFilesUrl(ref));
      if (response.status === 401) {
        return null;
      }
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new ApiError(response.status, body as ApiErrorBody);
      }
      const decoded = await Schema.decodeUnknownPromise(ViewedFilesSchema)(
        await response.json()
      );
      const viewed = new Set<string>();
      for (const file of decoded.files) {
        if (file.viewed) {
          viewed.add(file.path);
        }
      }
      return viewed;
    },
    retry: false,
  });
}

export function useViewedFiles(ref: PullRequestRef) {
  const queryClient = useQueryClient();
  const query = useQuery(viewedFilesQuery(ref));
  const mutationKey = ["viewed-files", ref.owner, ref.repo, ref.number];
  const mutation = useMutation({
    mutationKey,
    mutationFn: async (change: { path: string; viewed: boolean }) => {
      const response = await fetch(viewedFilesUrl(ref), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(change),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new ApiError(response.status, body as ApiErrorBody);
      }
    },
    onMutate: async (change) => {
      const { queryKey } = viewedFilesQuery(ref);
      await queryClient.cancelQueries({ queryKey });
      queryClient.setQueryData(queryKey, (current) => {
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
      });
    },
    onError: (error, change) => {
      queryClient.setQueryData(
        viewedFilesQuery(ref).queryKey,
        (current: ReadonlySet<string> | null | undefined) => {
          if (!current) {
            return current;
          }
          const next = new Set(current);
          if (change.viewed) {
            next.delete(change.path);
          } else {
            next.add(change.path);
          }
          return next;
        }
      );
      reportMutationError(
        queryClient,
        ref,
        "Couldn't update viewed state",
        error
      );
    },
    onSettled: () => {
      if (queryClient.isMutating({ mutationKey }) === 1) {
        return queryClient.invalidateQueries({
          queryKey: viewedFilesQuery(ref).queryKey,
        });
      }
    },
  });
  const allMutation = useMutation({
    mutationKey,
    mutationFn: async (_paths: readonly string[]) => {
      const response = await fetch(`${viewedFilesUrl(ref)}/all`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ viewed: true }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new ApiError(response.status, body as ApiErrorBody);
      }
    },
    onMutate: async (paths: readonly string[]) => {
      const { queryKey } = viewedFilesQuery(ref);
      await queryClient.cancelQueries({ queryKey });
      queryClient.setQueryData(queryKey, (current) =>
        current ? new Set(paths) : current
      );
    },
    onError: (error) =>
      reportMutationError(
        queryClient,
        ref,
        "Couldn't mark all files viewed",
        error
      ),
    onSettled: () => {
      if (queryClient.isMutating({ mutationKey }) === 1) {
        return queryClient.invalidateQueries({
          queryKey: viewedFilesQuery(ref).queryKey,
        });
      }
    },
  });
  return {
    viewedFiles: query.data ?? null,
    setViewed: mutation.mutate,
    setAllViewed: allMutation.mutate,
  };
}

export function toGitPatch(file: PullRequestFile) {
  const oldPath = file.previousPath ?? file.path;
  const oldRef = file.status === "added" ? "/dev/null" : `a/${oldPath}`;
  const newRef = file.status === "deleted" ? "/dev/null" : `b/${file.path}`;
  return `diff --git a/${oldPath} b/${file.path}\n--- ${oldRef}\n+++ ${newRef}\n${file.patch ?? ""}`;
}

interface ErrorCardContent {
  description: string;
  detail?: string;
  onRetry?: () => void;
  title: string;
}

function rateLimitDescription(body: ApiErrorBody) {
  if (body.resetAt) {
    const minutes = Math.max(
      1,
      Math.ceil((new Date(body.resetAt).getTime() - Date.now()) / 60_000)
    );
    return `GitHub's rate limit resets in about ${minutes} ${minutes === 1 ? "minute" : "minutes"}.`;
  }
  if (body.retryAfterSeconds) {
    return `GitHub asked us to retry in ${body.retryAfterSeconds} seconds.`;
  }
  return "GitHub is rate limiting requests. Try again shortly.";
}

export function toErrorCardProps(
  error: unknown,
  onRetry: () => void
): ErrorCardContent {
  if (error instanceof ApiError && error.status === 404) {
    return {
      title: "Pull request not found",
      description:
        "This pull request doesn't exist, or the repository is private.",
    };
  }
  if (error instanceof ApiError && error.status === 429) {
    return {
      title: "Rate limited by GitHub",
      description: rateLimitDescription(error.body),
      onRetry,
    };
  }
  if (
    error instanceof ApiError &&
    (error.status === 502 || error.status === 504)
  ) {
    return {
      title: "GitHub is unavailable",
      description: "We couldn't reach GitHub (shock). It may be down or slow.",
      onRetry,
    };
  }
  return {
    title: "Something went wrong",
    description: "We couldn't load this pull request.",
    detail: error instanceof Error ? error.message : String(error),
    onRetry,
  };
}
