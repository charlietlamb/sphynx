import {
  type HttpClient,
  HttpClientRequest,
  HttpClientResponse,
} from "@effect/platform";
import { Unauthorized } from "@sphynx/schema/pull-request-views";
import {
  GitHubTimeout,
  GitHubUnavailable,
  type PullRequestRef,
} from "@sphynx/schema/pull-requests";
import { Effect, Schema } from "effect";
import type { GitHubConfig } from "./config";
import {
  type GitHubAuthedError,
  pullRequestNotFound,
  RetryableGitHubError,
  retryPolicy,
} from "./errors";

export const refAnnotations = (ref: PullRequestRef) => ({
  "github.owner": ref.owner,
  "github.repository": ref.repo,
  "github.pull_number": ref.number,
});

export const PageInfoSchema = Schema.Struct({
  hasNextPage: Schema.Boolean,
  endCursor: Schema.NullishOr(Schema.String),
});

const GraphQLErrors = Schema.optional(
  Schema.Array(Schema.Struct({ message: Schema.String }))
);

const pullRequestData = <A, I, R>(inner: Schema.Schema<A, I, R>) =>
  Schema.Struct({
    repository: Schema.NullishOr(
      Schema.Struct({ pullRequest: Schema.NullishOr(inner) })
    ),
  });

const PULL_REQUEST_ID_QUERY = `
query($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $number) { id }
  }
}`;

const PullRequestIdSchema = Schema.Struct({ id: Schema.String });

type GitHubConfigService = typeof GitHubConfig.Service;

const rejectFailedStatus = (
  status: number
): Effect.Effect<
  void,
  Unauthorized | RetryableGitHubError | GitHubUnavailable
> => {
  if (status === 401 || status === 403) {
    return Effect.fail(
      new Unauthorized({ message: "GitHub rejected the request" })
    );
  }
  if (status >= 500) {
    return Effect.fail(
      new RetryableGitHubError({ message: `GitHub returned ${status}` })
    );
  }
  if (status >= 400) {
    return Effect.fail(
      new GitHubUnavailable({
        message: `GitHub rejected the request with ${status}`,
      })
    );
  }
  return Effect.void;
};

export const makeGraphql = (
  config: GitHubConfigService,
  client: HttpClient.HttpClient
) => {
  const query = <A, I>(
    token: string,
    dataSchema: Schema.Schema<A, I, never>,
    document: string,
    variables: Record<string, unknown>
  ): Effect.Effect<A, GitHubAuthedError> =>
    Effect.gen(function* () {
      const outgoing = HttpClientRequest.post(`${config.apiUrl}/graphql`).pipe(
        HttpClientRequest.bearerToken(token),
        HttpClientRequest.bodyUnsafeJson({ query: document, variables })
      );
      const response = yield* client
        .execute(outgoing)
        .pipe(
          Effect.mapError(
            () => new GitHubUnavailable({ message: "GitHub is unreachable" })
          )
        );
      yield* rejectFailedStatus(response.status);
      const envelope = yield* HttpClientResponse.schemaBodyJson(
        Schema.Struct({
          data: Schema.NullishOr(dataSchema),
          errors: GraphQLErrors,
        })
      )(response).pipe(
        Effect.mapError(
          () => new GitHubUnavailable({ message: "Invalid GitHub response" })
        )
      );
      const firstError = envelope.errors?.[0];
      if (envelope.data === null || envelope.data === undefined) {
        return yield* Effect.fail(
          new GitHubUnavailable({
            message: firstError ? firstError.message : "Empty GitHub response",
          })
        );
      }
      if (firstError) {
        yield* Effect.logWarning("GitHub returned partial data").pipe(
          Effect.annotateLogs({ "github.graphql_error": firstError.message })
        );
      }
      return envelope.data;
    }).pipe(
      Effect.retry({
        schedule: retryPolicy,
        times: 2,
        while: (error) => error._tag === "RetryableGitHubError",
      }),
      Effect.catchTag(
        "RetryableGitHubError",
        (error) => new GitHubUnavailable({ message: error.message })
      ),
      Effect.timeoutFail({
        duration: config.timeout,
        onTimeout: () =>
          new GitHubTimeout({ message: "GitHub request timed out" }),
      })
    );

  const pullRequestQuery = <A, I>(
    token: string,
    inner: Schema.Schema<A, I, never>,
    document: string,
    ref: PullRequestRef,
    extraVariables: Record<string, unknown> = {}
  ): Effect.Effect<A, GitHubAuthedError> =>
    query(token, pullRequestData(inner), document, {
      owner: ref.owner,
      name: ref.repo,
      number: ref.number,
      ...extraVariables,
    }).pipe(
      Effect.flatMap((data) => {
        const pullRequest = data.repository?.pullRequest;
        return pullRequest
          ? Effect.succeed(pullRequest)
          : Effect.fail(pullRequestNotFound());
      })
    );

  const pullRequestId = (
    ref: PullRequestRef,
    token: string
  ): Effect.Effect<string, GitHubAuthedError> =>
    pullRequestQuery(
      token,
      PullRequestIdSchema,
      PULL_REQUEST_ID_QUERY,
      ref
    ).pipe(Effect.map((pullRequest) => pullRequest.id));

  return { query, pullRequestQuery, pullRequestId } as const;
};

const MAX_CONNECTION_PAGES = 20;

interface ConnectionPage<N> {
  readonly nodes: readonly N[];
  readonly pageInfo: typeof PageInfoSchema.Type;
}

export const paginateConnection = <N, A, E>(
  fetchPage: (after: string | null) => Effect.Effect<ConnectionPage<N>, E>,
  toItem: (node: N) => A | null
): Effect.Effect<A[], E> =>
  Effect.gen(function* () {
    const items: A[] = [];
    let after: string | null = null;
    for (let page = 0; page < MAX_CONNECTION_PAGES; page += 1) {
      const { nodes, pageInfo }: ConnectionPage<N> = yield* fetchPage(after);
      for (const node of nodes) {
        const item = toItem(node);
        if (item !== null) {
          items.push(item);
        }
      }
      if (!(pageInfo.hasNextPage && pageInfo.endCursor)) {
        return items;
      }
      after = pageInfo.endCursor;
    }
    return items;
  });
