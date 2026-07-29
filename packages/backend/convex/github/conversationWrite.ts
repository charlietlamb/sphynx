import { Effect, Schema } from "effect";
import {
  configFromEnv,
  type GitHubClient,
  makeGitHubClient,
} from "./githubClient";
import { type GitHubError, GitHubUnavailable } from "./githubErrors";
import type { ConversationComment } from "./prReads";
import type { PullRequestRef } from "./refs";

const RawUserSchema = Schema.Struct({
  login: Schema.String,
  avatar_url: Schema.String,
});

const RawIssueCommentSchema = Schema.Struct({
  id: Schema.Number,
  body: Schema.NullishOr(Schema.String),
  user: Schema.NullOr(RawUserSchema),
  created_at: Schema.String,
  html_url: Schema.String,
});

type RawIssueComment = typeof RawIssueCommentSchema.Type;

const issueCommentsPath = (ref: PullRequestRef) =>
  `/repos/${encodeURIComponent(ref.owner)}/${encodeURIComponent(ref.repo)}/issues/${ref.number}/comments`;

const toRestComment = (row: RawIssueComment): ConversationComment => ({
  id: String(row.id),
  author: row.user
    ? { login: row.user.login, avatarUrl: row.user.avatar_url }
    : null,
  body: row.body ?? "",
  bodyHTML: null,
  createdAt: row.created_at,
  githubUrl: row.html_url,
});

const makeConversationWrite = (client: GitHubClient) => {
  const addComment = (
    ref: PullRequestRef,
    body: string,
    token: string
  ): Effect.Effect<ConversationComment, GitHubError> =>
    client.rest(token, "POST", issueCommentsPath(ref), { body }).pipe(
      Effect.flatMap((response) =>
        Effect.tryPromise({
          try: () => response.json(),
          catch: () =>
            new GitHubUnavailable({ message: "Invalid GitHub response" }),
        }).pipe(
          Effect.flatMap((payload) =>
            Schema.decodeUnknown(RawIssueCommentSchema)(payload).pipe(
              Effect.mapError(
                () =>
                  new GitHubUnavailable({ message: "Invalid GitHub response" })
              )
            )
          )
        )
      ),
      Effect.map(toRestComment),
      Effect.withSpan("GitHubConversationWrite.addComment"),
      Effect.annotateLogs({ "github.repo": `${ref.owner}/${ref.repo}` })
    );

  return { addComment } as const;
};

export const addConversationComment = (
  ref: PullRequestRef,
  body: string,
  token: string
): Effect.Effect<ConversationComment, GitHubError> =>
  makeConversationWrite(makeGitHubClient(configFromEnv())).addComment(
    ref,
    body,
    token
  );
