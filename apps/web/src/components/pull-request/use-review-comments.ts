import type { SelectedLineRange } from "@pierre/diffs";
import type { PullRequestRef } from "@sphynx/schema/pull-requests";
import { useCallback, useMemo } from "react";
import {
  useCreateComment,
  useReplyToComment,
  useResolveThread,
  useReviewSubmission,
} from "@/components/pull-request/pull-request-queries";
import type {
  CommentDraft,
  CommentSide,
  LineSelection,
} from "@/components/pull-request/use-review-state";

function draftFromRange(path: string, range: SelectedLineRange): CommentDraft {
  const forward = range.end >= range.start;
  const start = forward ? range.start : range.end;
  const end = forward ? range.end : range.start;
  const side: CommentSide =
    ((forward ? (range.endSide ?? range.side) : range.side) as
      | CommentSide
      | undefined) ?? "additions";
  return { path, line: end, startLine: start === end ? null : start, side };
}

interface ReviewCommentsInput {
  canComment: boolean;
  draft: CommentDraft | null;
  headSha: string;
  lineSelection: LineSelection | null;
  ref: PullRequestRef;
  setDraft: (draft: CommentDraft | null) => void;
  setLineSelection: (selection: LineSelection | null) => void;
}

export function useReviewComments({
  canComment,
  draft,
  headSha,
  lineSelection,
  ref,
  setDraft,
  setLineSelection,
}: ReviewCommentsInput) {
  const { createComment, creating } = useCreateComment(ref);
  const { reply, replying } = useReplyToComment(ref);
  const { resolve } = useResolveThread(ref);
  const { pendingReview, submitReview, submitting, discardReview } =
    useReviewSubmission(ref);

  const openDraft = useCallback(
    (path: string, range: SelectedLineRange) =>
      setDraft(draftFromRange(path, range)),
    [setDraft]
  );

  const changeSelection = useCallback(
    (path: string, range: SelectedLineRange | null) => {
      if (!range) {
        setLineSelection(null);
        return;
      }
      const normalized = draftFromRange(path, range);
      setLineSelection({
        path,
        start: normalized.startLine ?? normalized.line,
        end: normalized.line,
        side: normalized.side,
      });
    },
    [setLineSelection]
  );

  const cancelDraft = useCallback(() => setDraft(null), [setDraft]);

  const submitDraft = useCallback(
    (body: string, pending: boolean) => {
      if (!draft) {
        return;
      }
      createComment({
        body,
        commitSha: headSha,
        path: draft.path,
        line: draft.line,
        side: draft.side,
        startLine: draft.startLine,
        pending,
      });
      setDraft(null);
    },
    [draft, createComment, headSha, setDraft]
  );

  return useMemo(
    () => ({
      canComment,
      cancelDraft,
      changeSelection,
      creating,
      discardReview,
      draft,
      openDraft,
      pendingReview,
      reply,
      replying,
      resolve,
      selection: lineSelection,
      submitDraft,
      submitReview,
      submitting,
    }),
    [
      canComment,
      cancelDraft,
      changeSelection,
      creating,
      discardReview,
      draft,
      openDraft,
      pendingReview,
      reply,
      replying,
      resolve,
      lineSelection,
      submitDraft,
      submitReview,
      submitting,
    ]
  );
}

export type ReviewCommenting = ReturnType<typeof useReviewComments>;
