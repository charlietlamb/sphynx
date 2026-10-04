import { IdGenerator } from "@sphynx/ids/id";
import type { Actor } from "@sphynx/schema/domain/actor";
import type {
  AddSubscription,
  CredentialScope,
  Subscription,
} from "@sphynx/schema/domain/credentials";
import { Context, Effect, Layer, Option } from "effect";
import { CredentialCipher } from "./cipher";
import { sealValues } from "./connection-payload";
import {
  CredentialConnectionRepository,
  CredentialConnectionRepositoryLive,
} from "./connection-repository";
import { subscriptionOf } from "./connection-row";
import { CredentialError } from "./errors";

interface NewSubscription {
  readonly authJson: string;
  readonly authMethodId: "auth-json" | "chatgpt";
  readonly integrationId: "codex" | "opencode" | "pi";
  readonly scope: CredentialScope;
}

export interface SubscriptionsShape {
  readonly add: (
    actor: Actor,
    input: AddSubscription
  ) => Effect.Effect<Subscription, CredentialError>;
  readonly addChatGpt: (
    actor: Actor,
    authJson: string,
    scope: CredentialScope
  ) => Effect.Effect<Subscription, CredentialError>;
  readonly list: (
    actor: Actor
  ) => Effect.Effect<readonly Subscription[], CredentialError>;
  readonly remove: (
    actor: Actor,
    id: string
  ) => Effect.Effect<void, CredentialError>;
}

export class Subscriptions extends Context.Tag("@sphynx/eval/Subscriptions")<
  Subscriptions,
  SubscriptionsShape
>() {}

const parsesAsJson = (authJson: string) =>
  Effect.try({
    catch: () =>
      new CredentialError({ message: "The auth file is not valid JSON" }),
    try: () => JSON.parse(authJson) as unknown,
  }).pipe(
    Effect.filterOrFail(
      (parsed) =>
        typeof parsed === "object" && parsed !== null && !Array.isArray(parsed),
      () =>
        new CredentialError({ message: "The auth file is not a JSON object" })
    )
  );

export const SubscriptionsLive = Layer.effect(
  Subscriptions,
  Effect.gen(function* () {
    const cipher = yield* CredentialCipher;
    const ids = yield* IdGenerator;
    const repository = yield* CredentialConnectionRepository;

    const create = (actor: Actor, input: NewSubscription) =>
      Effect.gen(function* () {
        if (input.scope === "personal" && !actor.isUser) {
          return yield* new CredentialError({
            message: "API keys cannot own personal subscriptions",
          });
        }
        yield* parsesAsJson(input.authJson);
        const id = yield* ids.generate("credentialConnection");
        const inserted = yield* repository.insert(actor, {
          authMethodId: input.authMethodId,
          createdBy: actor.isUser ? actor.id : null,
          id,
          integrationId: input.integrationId,
          name: id,
          organizationId: actor.organizationId,
          ownerUserId: input.scope === "personal" ? actor.id : null,
          scope: input.scope,
          sealedPayload: yield* sealValues(
            cipher,
            { authJson: input.authJson.trim() },
            {
              id,
              integrationId: input.integrationId,
              organizationId: actor.organizationId,
            }
          ),
          status: "active",
        });
        return yield* Option.match(subscriptionOf(inserted), {
          onNone: () =>
            Effect.fail(
              new CredentialError({ message: "Subscription was not saved" })
            ),
          onSome: Effect.succeed,
        });
      }).pipe(
        Effect.withSpan("Subscriptions.add"),
        Effect.annotateLogs({
          integrationId: input.integrationId,
          organizationId: actor.organizationId,
        })
      );

    return Subscriptions.of({
      add: (actor, input) =>
        create(actor, {
          authJson: input.authJson,
          authMethodId: "auth-json",
          integrationId: input.plan,
          scope: input.scope,
        }),
      addChatGpt: (actor, authJson, scope) =>
        create(actor, {
          authJson,
          authMethodId: "chatgpt",
          integrationId: "codex",
          scope,
        }),
      list: (actor) =>
        repository.list(actor).pipe(
          Effect.map((rows) =>
            rows.flatMap((row) => Option.toArray(subscriptionOf(row)))
          ),
          Effect.withSpan("Subscriptions.list")
        ),
      remove: (actor, id) =>
        repository
          .remove(actor, id)
          .pipe(
            Effect.withSpan("Subscriptions.remove"),
            Effect.annotateLogs({ organizationId: actor.organizationId })
          ),
    });
  })
).pipe(Layer.provide(CredentialConnectionRepositoryLive));
