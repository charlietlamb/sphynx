import { beforeAll, describe, expect, it } from "bun:test";
import { Database } from "@sphynx/db/client";
import { organization } from "@sphynx/db/schema/auth/organizations";
import { user } from "@sphynx/db/schema/auth/users";
import { skipWithoutDatabase, testDatabase } from "@sphynx/db/test-database";
import { IdGeneratorLive } from "@sphynx/ids/layer";
import {
  type Actor,
  OrganizationId,
  UserId,
} from "@sphynx/schema/domain/actor";
import { Duration, Effect, Layer } from "effect";
import {
  CredentialConnectionRepository,
  CredentialConnectionRepositoryLive,
} from "../../src/credentials/connection-repository";

const database = testDatabase({
  poolMax: 2,
  statementTimeout: Duration.seconds(10),
});
const TestLayer = Layer.mergeAll(
  CredentialConnectionRepositoryLive.pipe(
    Layer.provide(Layer.mergeAll(database, IdGeneratorLive))
  ),
  database
);

const suffix = Date.now();
const owner = `org_scope_owner_${suffix}`;
const intruder = `org_scope_intruder_${suffix}`;
const userId = `user_scope_${suffix}`;

const actorOf = (organizationId: string): Actor => ({
  id: UserId.make(userId),
  isUser: true,
  organizationId: OrganizationId.make(organizationId),
  permissions: [],
});

const run = <A, E>(
  effect: Effect.Effect<A, E, CredentialConnectionRepository | Database>
): Promise<A> =>
  Effect.runPromise(
    effect.pipe(Effect.provide(TestLayer)) as Effect.Effect<A, E>
  );

describe.skipIf(skipWithoutDatabase())(
  "a credential write reaches only its own organisation",
  () => {
    beforeAll(() =>
      run(
        Effect.gen(function* () {
          const db = yield* Database;
          const now = new Date();

          yield* Effect.promise(() =>
            db.insert(organization).values([
              {
                createdAt: now,
                id: owner,
                name: "Owner",
                slug: `scope-owner-${suffix}`,
              },
              {
                createdAt: now,
                id: intruder,
                name: "Intruder",
                slug: `scope-intruder-${suffix}`,
              },
            ])
          );
          yield* Effect.promise(() =>
            db.insert(user).values({
              createdAt: now,
              email: `scope-${suffix}@example.com`,
              emailVerified: true,
              id: userId,
              name: "Scope test",
              updatedAt: now,
            })
          );
        })
      )
    );

    it("refuses another organisation's row on find and remove", async () => {
      const outcome = await run(
        Effect.gen(function* () {
          const repository = yield* CredentialConnectionRepository;
          const created = yield* repository.insert(actorOf(owner), {
            authMethodId: "auth-json",
            id: `credentialConnection_scope_${suffix}`,
            integrationId: "opencode",
            name: "Owned",
            organizationId: owner,
            ownerUserId: userId,
            scope: "organization",
            sealedPayload: "sealed",
            status: "active",
          });
          const asIntruder = actorOf(intruder);

          return {
            found: yield* Effect.either(
              repository.find(asIntruder, created.id)
            ),
            removed: yield* Effect.either(
              repository.remove(asIntruder, created.id)
            ),
            unchanged: yield* repository.find(actorOf(owner), created.id),
          };
        })
      );

      expect(outcome.found._tag).toBe("Left");
      expect(outcome.removed._tag).toBe("Left");
      expect(outcome.unchanged.sealedPayload).toBe("sealed");
    });

    it("leaves a last-used stamp alone for another organisation", async () => {
      const outcome = await run(
        Effect.gen(function* () {
          const repository = yield* CredentialConnectionRepository;
          const created = yield* repository.insert(actorOf(owner), {
            authMethodId: "api-key",
            id: `credentialConnection_touch_${suffix}`,
            integrationId: "e2b",
            name: "Owned",
            organizationId: owner,
            ownerUserId: userId,
            scope: "organization",
            sealedPayload: "sealed",
            status: "active",
          });

          yield* repository.touch(intruder, created.id, new Date());

          return yield* repository.find(actorOf(owner), created.id);
        })
      );

      expect(outcome.lastUsedAt).toBe(null);
    });
  }
);
