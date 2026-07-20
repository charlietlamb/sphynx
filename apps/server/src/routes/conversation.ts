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
      const { readToken, writeToken } = yield* GitHubAuth;

      return handlers
        .handle("getConversation", ({ path, headers }) =>
          readToken(headers.cookie).pipe(
            Effect.flatMap((token) => conversation.get(path, token)),
            Effect.catchTag("Unauthorized", () =>
              conversation.getAnonymous(path)
            )
          )
        )
        .handle("addConversationComment", ({ path, headers, payload }) =>
          writeToken(headers.cookie).pipe(
            Effect.flatMap((token) =>
              conversation.addComment(path, payload, token)
            )
          )
        );
    })
);
