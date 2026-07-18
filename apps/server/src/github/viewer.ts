import { HttpClient } from "@effect/platform";
import type { ViewedFile } from "@sphynx/schema/pull-request-views";
import type { PullRequestRef } from "@sphynx/schema/pull-requests";
import { Array as Arr, Context, Effect, Layer, Schema } from "effect";
import { GitHubConfig } from "./config";
import type { GitHubAuthedError } from "./errors";
import {
  makeGraphql,
  PageInfoSchema,
  paginateConnection,
  refAnnotations,
} from "./graphql";

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

const ViewedFilesSchema = Schema.Struct({
  files: Schema.Struct({
    pageInfo: PageInfoSchema,
    nodes: Schema.Array(
      Schema.Struct({
        path: Schema.String,
        viewerViewedState: Schema.String,
      })
    ),
  }),
});

const BATCH_SIZE = 25;

const makeGitHubViewer = Effect.gen(function* () {
  const config = yield* GitHubConfig;
  const client = yield* HttpClient.HttpClient;
  const github = makeGraphql(config, client);

  const listViewedFiles = (
    ref: PullRequestRef,
    token: string
  ): Effect.Effect<ViewedFile[], GitHubAuthedError> =>
    paginateConnection(
      (after) =>
        github
          .pullRequestQuery(token, ViewedFilesSchema, VIEWED_FILES_QUERY, ref, {
            after,
          })
          .pipe(Effect.map((pullRequest) => pullRequest.files)),
      (node) => ({
        path: node.path,
        viewed: node.viewerViewedState === "VIEWED",
      })
    ).pipe(
      Effect.withSpan("GitHubViewer.listViewedFiles"),
      Effect.annotateLogs(refAnnotations(ref))
    );

  const setFileViewed = (
    ref: PullRequestRef,
    file: ViewedFile,
    token: string
  ): Effect.Effect<void, GitHubAuthedError> =>
    Effect.gen(function* () {
      const id = yield* github.pullRequestId(ref, token);
      yield* github.query(
        token,
        Schema.Unknown,
        file.viewed ? MARK_VIEWED_MUTATION : UNMARK_VIEWED_MUTATION,
        { id, path: file.path }
      );
    }).pipe(
      Effect.withSpan("GitHubViewer.setFileViewed"),
      Effect.annotateLogs({
        ...refAnnotations(ref),
        "github.viewed": file.viewed,
      })
    );

  const setAllFilesViewed = (
    ref: PullRequestRef,
    viewed: boolean,
    token: string
  ): Effect.Effect<void, GitHubAuthedError> =>
    Effect.gen(function* () {
      const files = yield* listViewedFiles(ref, token);
      const pending = files.filter((file) => file.viewed !== viewed);
      if (pending.length === 0) {
        return;
      }
      const id = yield* github.pullRequestId(ref, token);
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
          return github.query(
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
        ...refAnnotations(ref),
        "github.viewed": viewed,
      })
    );

  return { listViewedFiles, setFileViewed, setAllFilesViewed } as const;
});

export class GitHubViewer extends Context.Tag("@sphynx/server/GitHubViewer")<
  GitHubViewer,
  Effect.Effect.Success<typeof makeGitHubViewer>
>() {}

export const GitHubViewerLive = Layer.effect(GitHubViewer, makeGitHubViewer);
