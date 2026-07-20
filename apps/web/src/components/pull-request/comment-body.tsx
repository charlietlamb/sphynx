import { Fragment } from "react";
import { CommentMarkdown } from "@/components/pull-request/comment-markdown";
import { SuggestionBlock } from "@/components/pull-request/suggestion-block";

const HTML_COMMENT = /<!--[\s\S]*?-->/g;
const DETAILS_BLOCK = /<details\b[^>]*>[\s\S]*?<\/details>/g;
const UNCLOSED_DETAILS = /<details\b[\s\S]*$/;
const IMAGE_WITH_ALT = /<img\b[^>]*?alt="([^"]*)"[^>]*>/gi;
const KNOWN_HTML_TAG =
  /<\/?(?:a|br|div|img|p|picture|source|span|sub|summary|sup)\b[^>]*\/?>/gi;
const SUGGESTION_BLOCK = /```suggestion\r?\n([\s\S]*?)```/g;
const TRAILING_NEWLINE = /\r?\n$/;

function stripHiddenBlocks(body: string) {
  return body
    .replace(HTML_COMMENT, "")
    .replace(DETAILS_BLOCK, "")
    .replace(UNCLOSED_DETAILS, "");
}

function cleanText(text: string) {
  return text.replace(IMAGE_WITH_ALT, "$1").replace(KNOWN_HTML_TAG, "").trim();
}

interface BodySegment {
  offset: number;
  suggestion: string | null;
  text: string;
}

function segmentBody(body: string): BodySegment[] {
  const visible = stripHiddenBlocks(body);
  const segments: BodySegment[] = [];
  let cursor = 0;
  for (const match of visible.matchAll(SUGGESTION_BLOCK)) {
    segments.push({
      offset: cursor,
      text: cleanText(visible.slice(cursor, match.index)),
      suggestion: match[1].replace(TRAILING_NEWLINE, ""),
    });
    cursor = (match.index ?? 0) + match[0].length;
  }
  segments.push({
    offset: cursor,
    text: cleanText(visible.slice(cursor)),
    suggestion: null,
  });
  return segments.filter(
    (segment) => segment.text !== "" || segment.suggestion !== null
  );
}

interface CommentBodyProps {
  body: string;
  originalLines: readonly string[];
}

export function CommentBody({ body, originalLines }: CommentBodyProps) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      {segmentBody(body).map((segment) => (
        <Fragment key={segment.offset}>
          {segment.text === "" ? null : <CommentMarkdown text={segment.text} />}
          {segment.suggestion === null ? null : (
            <SuggestionBlock
              originalLines={originalLines}
              suggestedLines={segment.suggestion.split("\n")}
            />
          )}
        </Fragment>
      ))}
    </div>
  );
}
