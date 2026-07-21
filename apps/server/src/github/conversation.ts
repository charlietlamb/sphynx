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
  Ref,
  type Schema,
} from "effect";
import { GitHubConfig } from "./config";
import {
  CONVERSATION_QUERY,
  ConversationNodesSchema,
  toConversation,
  toRestComment,
} from "./conversation-mappers";
import type { GitHubAuthedRestError } from "./errors";
import { makeGraphql, refAnnotations } from "./graphql";
import { makeRest } from "./http";
import { RawIssueCommentSchema } from "./rest-schemas";

const CONVERSATION_TTL = Duration.seconds(45);
const TOKEN_CAPACITY = 256;
/**
 * Keyed on the credential id, never the raw token: installation tokens rotate
 * hourly, so a token-keyed entry would be orphaned on every rotation.
 */
class ConversationKey extends Data.Class<{
  readonly credentialId: string;
  readonly owner: string;
  readonly repo: string;
  readonly number: number;
}> {}

const issueCommentsPath = (ref: PullRequestRef) =>
  `/repos/${ref.owner}/${ref.repo}/issues/${ref.number}/comments`;

const keyFor = (ref: PullRequestRef, credentialId: string) =>
  new ConversationKey({
    credentialId,
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

  const tokens = yield* Ref.make(new Map<string, string>());

  const cache = yield* Cache.make({
    capacity: 256,
    timeToLive: CONVERSATION_TTL,
    lookup: (
      key: ConversationKey
    ): Effect.Effect<Conversation, GitHubAuthedRestError> =>
      Ref.get(tokens).pipe(
        Effect.flatMap((live) => {
          const token = live.get(key.credentialId);
          return token
            ? fetchAuthed(
                { owner: key.owner, repo: key.repo, number: key.number },
                token
              )
            : Effect.dieMessage(`no token registered for ${key.credentialId}`);
        })
      ),
  });

  /**
   * Register the token in place, bounded to the cache capacity. The previous
   * copy-on-write grew the map one entry per credential ever seen (unbounded on
   * an always-on process) and re-allocated it on every request.
   */
  const rememberToken = (credentialId: string, token: string) =>
    Ref.update(tokens, (live) => {
      if (!live.has(credentialId) && live.size >= TOKEN_CAPACITY) {
        const oldest = live.keys().next().value;
        if (oldest !== undefined) {
          live.delete(oldest);
        }
      }
      live.set(credentialId, token);
      return live;
    });

  const get = (
    ref: PullRequestRef,
    credentialId: string,
    token: string
  ): Effect.Effect<Conversation, GitHubAuthedRestError> => {
    const key = keyFor(ref, credentialId);
    return rememberToken(credentialId, token).pipe(
      Effect.zipRight(cache.get(key)),
      Effect.tapError(() => cache.invalidate(key)),
      Effect.withSpan("GitHubConversation.get"),
      Effect.annotateLogs(refAnnotations(ref))
    );
  };

  const addComment = (
    ref: PullRequestRef,
    payload: AddConversationComment,
    credentialId: string,
    token: string
  ): Effect.Effect<ConversationComment, GitHubAuthedRestError> =>
    rest(token, "POST", issueCommentsPath(ref), { body: payload.body }).pipe(
      Effect.flatMap(decodeBody(RawIssueCommentSchema)),
      Effect.map(toRestComment),
      Effect.tap(() => cache.invalidate(keyFor(ref, credentialId))),
      Effect.withSpan("GitHubConversation.addComment"),
      Effect.annotateLogs(refAnnotations(ref))
    );

  return { get, addComment } as const;
});

export class GitHubConversation extends Context.Tag(
  "@sphynx/github/Conversation"
)<GitHubConversation, Effect.Effect.Success<typeof makeGitHubConversation>>() {}

export const GitHubConversationLive = Layer.effect(
  GitHubConversation,
  makeGitHubConversation
);
