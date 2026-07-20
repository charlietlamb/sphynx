import { HttpClient, HttpClientResponse } from "@effect/platform";
import type {
  AddConversationComment,
  Conversation,
  ConversationComment,
} from "@sphynx/schema/pull-request-conversation";
import {
  GitHubUnavailable,
  type PullRequestRef,
} from "@sphynx/schema/pull-requests";
import {
  Cache,
  Context,
  Data,
  Duration,
  Effect,
  Layer,
  type Schema,
} from "effect";
import { GitHubConfig } from "./config";
import {
  CONVERSATION_QUERY,
  ConversationNodesSchema,
  toConversation,
  toRestComment,
  toRestConversation,
} from "./conversation-mappers";
import type { GitHubAuthedRestError } from "./errors";
import { makeGraphql, refAnnotations } from "./graphql";
import { makeRest, pullPath } from "./http";
import {
  RawIssueCommentSchema,
  RawIssueCommentsSchema,
  RawPullReviewsSchema,
} from "./rest-schemas";

const CONVERSATION_TTL = Duration.seconds(45);
const PAGE_SIZE = 50;

class ConversationKey extends Data.Class<{
  readonly token: string;
  readonly owner: string;
  readonly repo: string;
  readonly number: number;
}> {}

const issueCommentsPath = (ref: PullRequestRef) =>
  `/repos/${ref.owner}/${ref.repo}/issues/${ref.number}/comments`;

const keyFor = (ref: PullRequestRef, token: string) =>
  new ConversationKey({
    token,
    owner: ref.owner.toLowerCase(),
    repo: ref.repo.toLowerCase(),
    number: ref.number,
  });

const makeGitHubConversation = Effect.gen(function* () {
  const config = yield* GitHubConfig;
  const client = yield* HttpClient.HttpClient;
  const graphql = makeGraphql(config, client);
  const rest = makeRest(config, client);

  const decodeBody =
    <A, I>(schema: Schema.Schema<A, I, never>) =>
    (response: HttpClientResponse.HttpClientResponse) =>
      HttpClientResponse.schemaBodyJson(schema)(response).pipe(
        Effect.mapError(
          () => new GitHubUnavailable({ message: "Invalid GitHub response" })
        )
      );

  const fetchAuthed = (
    ref: PullRequestRef,
    token: string
  ): Effect.Effect<Conversation, GitHubAuthedRestError> =>
    graphql
      .pullRequestQuery(token, ConversationNodesSchema, CONVERSATION_QUERY, ref)
      .pipe(Effect.map(toConversation));

  const fetchAnonymous = (
    ref: PullRequestRef
  ): Effect.Effect<Conversation, GitHubAuthedRestError> =>
    Effect.all(
      [
        rest("", "GET", `${issueCommentsPath(ref)}?per_page=${PAGE_SIZE}`).pipe(
          Effect.flatMap(decodeBody(RawIssueCommentsSchema))
        ),
        rest("", "GET", pullPath(ref, `/reviews?per_page=${PAGE_SIZE}`)).pipe(
          Effect.flatMap(decodeBody(RawPullReviewsSchema))
        ),
      ],
      { concurrency: 2 }
    ).pipe(
      Effect.map(([comments, reviews]) => toRestConversation(comments, reviews))
    );

  const cache = yield* Cache.make({
    capacity: 256,
    timeToLive: CONVERSATION_TTL,
    lookup: (
      key: ConversationKey
    ): Effect.Effect<Conversation, GitHubAuthedRestError> => {
      const ref = { owner: key.owner, repo: key.repo, number: key.number };
      return key.token === ""
        ? fetchAnonymous(ref)
        : fetchAuthed(ref, key.token);
    },
  });

  const getWith = (ref: PullRequestRef, token: string) => {
    const key = keyFor(ref, token);
    return cache.get(key).pipe(Effect.tapError(() => cache.invalidate(key)));
  };

  const get = (
    ref: PullRequestRef,
    token: string
  ): Effect.Effect<Conversation, GitHubAuthedRestError> =>
    getWith(ref, token).pipe(
      Effect.withSpan("GitHubConversation.get"),
      Effect.annotateLogs(refAnnotations(ref))
    );

  const getAnonymous = (
    ref: PullRequestRef
  ): Effect.Effect<Conversation, GitHubAuthedRestError> =>
    getWith(ref, "").pipe(
      Effect.withSpan("GitHubConversation.getAnonymous"),
      Effect.annotateLogs(refAnnotations(ref))
    );

  const addComment = (
    ref: PullRequestRef,
    payload: AddConversationComment,
    token: string
  ): Effect.Effect<ConversationComment, GitHubAuthedRestError> =>
    rest(token, "POST", issueCommentsPath(ref), { body: payload.body }).pipe(
      Effect.flatMap(decodeBody(RawIssueCommentSchema)),
      Effect.map(toRestComment),
      Effect.tap(() =>
        Effect.all([
          cache.invalidate(keyFor(ref, token)),
          cache.invalidate(keyFor(ref, "")),
        ])
      ),
      Effect.withSpan("GitHubConversation.addComment"),
      Effect.annotateLogs(refAnnotations(ref))
    );

  return { get, getAnonymous, addComment } as const;
});

export class GitHubConversation extends Context.Tag(
  "@sphynx/github/Conversation"
)<GitHubConversation, Effect.Effect.Success<typeof makeGitHubConversation>>() {}

export const GitHubConversationLive = Layer.effect(
  GitHubConversation,
  makeGitHubConversation
);
