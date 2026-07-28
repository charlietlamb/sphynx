import type { ReviewThread } from "@sphynx/schema/pull-request-comments";
import type {
  PullRequestFile,
  PullRequestRef,
  PullRequestSummary,
} from "@sphynx/schema/pull-requests";
import { Button } from "@sphynx/ui/components/ui/button";
import { useMemo, useState } from "react";
import { NoticePanel } from "@/components/layout/notice-panel";
import { PaneCard } from "@/components/layout/pane-card";
import { ConversationCodePane } from "@/components/pull-request/conversation-code-pane";
import { ConversationComposer } from "@/components/pull-request/conversation-composer";
import { ConversationDescription } from "@/components/pull-request/conversation-description";
import {
  buildConversationFeed,
  type FeedItem,
  feedKey,
  latestVerdicts,
} from "@/components/pull-request/conversation-feed";
import { ConversationFeedItem } from "@/components/pull-request/conversation-feed-item";
import { ConversationOverview } from "@/components/pull-request/conversation-overview";
import { ConversationSkeleton } from "@/components/pull-request/conversation-skeleton";
import type { PatchMap } from "@/components/pull-request/patch-map";
import {
  toErrorCardProps,
  useAddConversationComment,
  useCommentThreads,
  useConversation,
  useReplyToComment,
  useResolveThread,
} from "@/components/pull-request/pull-request-queries";
import type { PullRequestSearchSetter } from "@/components/pull-request/pull-request-search";
import {
  avatarNode,
  timelineNode,
} from "@/components/pull-request/timeline-node";
import { TimelineRow } from "@/components/pull-request/timeline-row";

interface ConversationPanelProps {
  files: readonly PullRequestFile[];
  patches: PatchMap;
  pullRequestRef: PullRequestRef;
  setSearch: PullRequestSearchSetter;
  summary: PullRequestSummary;
}

export default function ConversationPanel({
  files,
  patches,
  pullRequestRef,
  setSearch,
  summary,
}: ConversationPanelProps) {
  const conversation = useConversation(pullRequestRef);
  const threads = useCommentThreads(pullRequestRef);
  const { addComment, adding } = useAddConversationComment(pullRequestRef);
  const { reply, replying } = useReplyToComment(pullRequestRef);
  const { resolve } = useResolveThread(pullRequestRef);
  const [focusedThreadKey, setFocusedThreadKey] = useState<string | null>(null);
  const now = Date.now();

  const feed = useMemo(
    () =>
      conversation.data
        ? buildConversationFeed(summary, conversation.data, threads)
        : [],
    [summary, conversation.data, threads]
  );

  const filesByPath = useMemo(
    () => new Map(files.map((file) => [file.path, file])),
    [files]
  );

  const threadItems = useMemo(
    () =>
      feed.flatMap((item) =>
        item.kind === "thread"
          ? [{ key: feedKey(item), thread: item.thread }]
          : []
      ),
    [feed]
  );

  const participants = useMemo(() => {
    const byLogin = new Map(
      summary.author ? [[summary.author.login, summary.author]] : []
    );
    const authors = [
      ...(conversation.data?.comments ?? []).map((comment) => comment.author),
      ...(conversation.data?.reviews ?? []).map((review) => review.author),
      ...threads.flatMap((thread) =>
        thread.comments.map((comment) => comment.author)
      ),
    ];
    for (const author of authors) {
      if (author && !byLogin.has(author.login)) {
        byLogin.set(author.login, author);
      }
    }
    return [...byLogin.values()];
  }, [summary.author, conversation.data, threads]);

  const commenting = useMemo(
    () => ({ canComment: true, reply, replying, resolve }),
    [reply, replying, resolve]
  );

  if (conversation.isError) {
    const error = toErrorCardProps(conversation.error, () =>
      conversation.refetch()
    );
    return (
      <NoticePanel
        action={
          error.onRetry ? (
            <Button className="h-9 px-4" onClick={error.onRetry} size="sm">
              Try again
            </Button>
          ) : undefined
        }
        description={error.description}
        title={error.title}
      />
    );
  }

  if (conversation.isPending) {
    return <ConversationSkeleton />;
  }

  const openInDiff = (thread: ReviewThread) =>
    setSearch({
      tab: "diff",
      file: thread.path,
      line: thread.line,
      panes: null,
    });

  const focusedThread =
    feed.find(
      (item): item is Extract<FeedItem, { kind: "thread" }> =>
        item.kind === "thread" && feedKey(item) === focusedThreadKey
    )?.thread ?? null;

  const toggleFocus = (key: string) =>
    setFocusedThreadKey(key === focusedThreadKey ? null : key);

  const focusThreadFromOverview = (key: string) => {
    setFocusedThreadKey(String(key));
    document
      .querySelector(`[data-thread-key="${CSS.escape(key)}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <div className="flex min-h-0 flex-1 gap-2.5 overflow-hidden">
      <PaneCard className="no-scrollbar min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-3xl flex-col px-4 py-6">
          <TimelineRow node={avatarNode(summary.author)} variant="card">
            <ConversationDescription
              descriptionHTML={conversation.data.descriptionHTML}
              now={now}
              summary={summary}
            />
          </TimelineRow>
          {feed.map((item, index) => {
            const { node, variant } = timelineNode(item);
            return (
              <div
                data-thread-key={
                  item.kind === "thread" ? feedKey(item) : undefined
                }
                key={feedKey(item)}
              >
                <TimelineRow
                  last={index === feed.length - 1}
                  node={node}
                  variant={variant}
                >
                  <ConversationFeedItem
                    commenting={commenting}
                    focusedThreadKey={focusedThreadKey}
                    item={item}
                    now={now}
                    onToggleFocus={toggleFocus}
                    patches={patches}
                  />
                </TimelineRow>
              </div>
            );
          })}
          <div className="pt-2 pl-10">
            <ConversationComposer busy={adding} onSubmit={addComment} />
          </div>
        </div>
      </PaneCard>
      <PaneCard className="hidden w-[26rem] shrink-0 lg:flex">
        {focusedThread ? (
          <ConversationCodePane
            file={filesByPath.get(focusedThread.path) ?? null}
            onClose={() => setFocusedThreadKey(null)}
            onOpenInDiff={openInDiff}
            patch={patches.get(focusedThread.path) ?? null}
            thread={focusedThread}
          />
        ) : (
          <ConversationOverview
            now={now}
            onFocusThread={focusThreadFromOverview}
            participants={participants}
            reviewers={latestVerdicts(conversation.data.reviews)}
            summary={summary}
            threadItems={threadItems}
          />
        )}
      </PaneCard>
    </div>
  );
}
