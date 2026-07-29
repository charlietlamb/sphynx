import { Array as Arr, Effect, Schema } from "effect";
import {
  configFromEnv,
  type GitHubClient,
  makeGitHubClient,
} from "./githubClient";
import { type GitHubError, GitHubUnavailable } from "./githubErrors";
import type { PullRequestRef } from "./refs";

interface ViewedFile {
  readonly path: string;
  readonly viewed: boolean;
}

const VIEWED_FILES_QUERY = `
query($owner: String!, $name: String!, $number: Int!, $after: String) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $number) {
      files(first: 100, after: $after) {
        pageInfo { hasNextPage endCursor }
        nodes { path viewerViewedState }
      }
    }
  }
}`;

const MARK_VIEWED_MUTATION = `
mutation($id: ID!, $path: String!) {
  markFileAsViewed(input: { pullRequestId: $id, path: $path }) {
    pullRequest { id }
  }
}`;

const UNMARK_VIEWED_MUTATION = `
mutation($id: ID!, $path: String!) {
  unmarkFileAsViewed(input: { pullRequestId: $id, path: $path }) {
    pullRequest { id }
  }
}`;

const PULL_REQUEST_ID_QUERY = `
query($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $number) { id }
  }
}`;

const PullRequestIdSchema = Schema.Struct({
  repository: Schema.NullishOr(
    Schema.Struct({
      pullRequest: Schema.NullishOr(Schema.Struct({ id: Schema.String })),
    })
  ),
});

const PageInfoSchema = Schema.Struct({
  hasNextPage: Schema.Boolean,
  endCursor: Schema.NullishOr(Schema.String),
});

const ViewedFilesSchema = Schema.Struct({
  repository: Schema.NullishOr(
    Schema.Struct({
      pullRequest: Schema.NullishOr(
        Schema.Struct({
          files: Schema.Struct({
            pageInfo: PageInfoSchema,
            nodes: Schema.Array(
              Schema.Struct({
                path: Schema.String,
                viewerViewedState: Schema.String,
              })
            ),
          }),
        })
      ),
    })
  ),
});

const BATCH_SIZE = 25;

const MAX_CONNECTION_PAGES = 20;

const makeViewer = (client: GitHubClient) => {
  const pullRequestId = (
    ref: PullRequestRef,
    token: string
  ): Effect.Effect<string, GitHubError> =>
    client
      .query(token, PullRequestIdSchema, PULL_REQUEST_ID_QUERY, {
        owner: ref.owner,
        name: ref.repo,
        number: ref.number,
      })
      .pipe(
        Effect.flatMap((data) => {
          const id = data.repository?.pullRequest?.id;
          return id
            ? Effect.succeed(id)
            : Effect.fail(
                new GitHubUnavailable({ message: "Pull request not found" })
              );
        })
      );

  const listViewedFiles = (
    ref: PullRequestRef,
    token: string
  ): Effect.Effect<ViewedFile[], GitHubError> =>
    Effect.gen(function* () {
      const files: ViewedFile[] = [];
      let after: string | null = null;
      for (let page = 0; page < MAX_CONNECTION_PAGES; page += 1) {
        const data: typeof ViewedFilesSchema.Type = yield* client.query(
          token,
          ViewedFilesSchema,
          VIEWED_FILES_QUERY,
          {
            owner: ref.owner,
            name: ref.repo,
            number: ref.number,
            after,
          }
        );
        const connection = data.repository?.pullRequest?.files ?? null;
        if (connection === null) {
          return files;
        }
        for (const node of connection.nodes) {
          files.push({
            path: node.path,
            viewed: node.viewerViewedState === "VIEWED",
          });
        }
        if (
          !(connection.pageInfo.hasNextPage && connection.pageInfo.endCursor)
        ) {
          return files;
        }
        after = connection.pageInfo.endCursor;
      }
      return files;
    }).pipe(
      Effect.withSpan("GitHubViewer.listViewedFiles"),
      Effect.annotateLogs({ "github.repo": `${ref.owner}/${ref.repo}` })
    );

  const setFileViewed = (
    ref: PullRequestRef,
    path: string,
    viewed: boolean,
    token: string
  ): Effect.Effect<void, GitHubError> =>
    Effect.gen(function* () {
      const id = yield* pullRequestId(ref, token);
      yield* client.query(
        token,
        Schema.Unknown,
        viewed ? MARK_VIEWED_MUTATION : UNMARK_VIEWED_MUTATION,
        { id, path }
      );
    }).pipe(
      Effect.withSpan("GitHubViewer.setFileViewed"),
      Effect.annotateLogs({
        "github.repo": `${ref.owner}/${ref.repo}`,
        "github.viewed": viewed,
      })
    );

  const setAllFilesViewed = (
    ref: PullRequestRef,
    viewed: boolean,
    token: string
  ): Effect.Effect<void, GitHubError> =>
    Effect.gen(function* () {
      const files = yield* listViewedFiles(ref, token);
      const pending = files.filter((file) => file.viewed !== viewed);
      if (pending.length === 0) {
        return;
      }
      const id = yield* pullRequestId(ref, token);
      const field = viewed ? "markFileAsViewed" : "unmarkFileAsViewed";
      yield* Effect.forEach(
        Arr.chunksOf(pending, BATCH_SIZE),
        (chunk) => {
          const aliased = chunk
            .map(
              (file, index) =>
                `m${index}: ${field}(input: { pullRequestId: $id, path: ${JSON.stringify(file.path)} }) { clientMutationId }`
            )
            .join("\n");
          return client.query(
            token,
            Schema.Unknown,
            `mutation($id: ID!) {\n${aliased}\n}`,
            { id }
          );
        },
        { discard: true }
      );
    }).pipe(
      Effect.withSpan("GitHubViewer.setAllFilesViewed"),
      Effect.annotateLogs({
        "github.repo": `${ref.owner}/${ref.repo}`,
        "github.viewed": viewed,
      })
    );

  return { listViewedFiles, setFileViewed, setAllFilesViewed } as const;
};

export const listViewedFiles = (
  ref: PullRequestRef,
  token: string
): Effect.Effect<ViewedFile[], GitHubError> =>
  makeViewer(makeGitHubClient(configFromEnv())).listViewedFiles(ref, token);

export const setFileViewed = (
  ref: PullRequestRef,
  path: string,
  viewed: boolean,
  token: string
): Effect.Effect<void, GitHubError> =>
  makeViewer(makeGitHubClient(configFromEnv())).setFileViewed(
    ref,
    path,
    viewed,
    token
  );

export const setAllFilesViewed = (
  ref: PullRequestRef,
  viewed: boolean,
  token: string
): Effect.Effect<void, GitHubError> =>
  makeViewer(makeGitHubClient(configFromEnv())).setAllFilesViewed(
    ref,
    viewed,
    token
  );
