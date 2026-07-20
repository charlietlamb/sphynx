import { HttpApiBuilder } from "@effect/platform";
import { SphynxApi } from "@sphynx/schema/api";
import { Effect } from "effect";
import { GitHubAuth } from "../auth/github-auth";
import { GitHubConversation } from "../github/conversation";

export const PullRequestConversationApiLive = HttpApiBuilder.group(
  SphynxApi,
  "pullRequestConversation",
  (handlers) =>
    Effect.gen(function* () {
      const conversation = yield* GitHubConversation;
      const { readCredential, writeCredential } = yield* GitHubAuth;

      return handlers
        .handle("getConversation", ({ path, headers }) =>
          readCredential(headers.cookie).pipe(
            Effect.flatMap((credential) =>
              credential.token.pipe(
                Effect.flatMap((token) =>
                  conversation.get(path, credential.id, token)
                )
              )
            )
          )
        )
        .handle("addConversationComment", ({ path, headers, payload }) =>
          writeCredential(headers.cookie).pipe(
            Effect.flatMap((credential) =>
              credential.token.pipe(
                Effect.flatMap((token) =>
                  conversation.addComment(path, payload, credential.id, token)
                )
              )
            )
          )
        );
    })
);
