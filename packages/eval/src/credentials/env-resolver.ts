import { keptOnServer } from "@sphynx/schema/domain/known-variables";
import { Effect, Layer, Redacted } from "effect";
import {
  credentialFromVariables,
  variablesFor,
} from "../environment/variable-credentials";
import { CredentialError } from "./errors";
import { CredentialResolver } from "./resolver";
import { KEYLESS_HARNESSES } from "./variants";

export interface LeasedCredential {
  readonly authMethodId: string;
  readonly values: Readonly<Record<string, string>>;
}

export interface LocalCredentials {
  readonly credentials: ReadonlyMap<string, LeasedCredential>;
  readonly variables: Readonly<Record<string, string>>;
}

const environment = (): Readonly<Record<string, string>> =>
  Object.fromEntries(
    Object.entries(process.env).flatMap(([name, value]) =>
      value === undefined ? [] : [[name, value] as const]
    )
  );

const resolved = (integrationId: string, credential: LeasedCredential) =>
  Redacted.make({
    authMethodId: credential.authMethodId,
    connectionId: "local",
    integrationId,
    revision: 0,
    values: credential.values,
  });

const notHeld = (message: string) =>
  new CredentialError({ code: "not-found", message });

const toSet = (integrationId: string) => {
  const names = variablesFor(integrationId);

  return names.length === 0 ? "" : ` Set ${names.join(" and ")}.`;
};

const answering = (
  credentialFor: (
    integrationId: string
  ) => Effect.Effect<LeasedCredential, CredentialError>,
  variables: Readonly<Record<string, string>>
) =>
  Layer.succeed(
    CredentialResolver,
    CredentialResolver.of({
      persist: () => Effect.void,
      resolve: ({ integrationId }) =>
        Effect.map(credentialFor(integrationId), (credential) =>
          resolved(integrationId, credential)
        ),
      resolveBound: ({ credentialRef }) =>
        Effect.fail(
          notHeld(
            `a local run has no stored credential, so ${credentialRef} cannot be read`
          )
        ),
      variables: ({ names }) => {
        const withheld = names.filter(keptOnServer);
        if (withheld.length > 0) {
          return Effect.fail(
            notHeld(`${withheld.join(", ")} never reaches a profile`)
          );
        }
        const missing = names.filter((name) => variables[name] === undefined);
        return missing.length > 0
          ? Effect.fail(
              notHeld(`Set ${missing.join(", ")} to run this profile`)
            )
          : Effect.succeed(
              Redacted.make(
                Object.fromEntries(
                  names.map((name) => [name, variables[name] ?? ""])
                )
              )
            );
      },
    })
  );

const keyless = (integrationId: string) =>
  [...KEYLESS_HARNESSES].some((harness) => harness === integrationId);

export const credentialResolverFrom = (local: LocalCredentials) =>
  answering((integrationId) => {
    if (keyless(integrationId)) {
      return Effect.succeed({ authMethodId: "none", values: {} });
    }
    const held = local.credentials.get(integrationId);
    return held === undefined
      ? Effect.fail(
          notHeld(
            `this run holds credentials for ${[...local.credentials.keys()].join(", ")}, not one for ${integrationId}.${toSet(integrationId)}`
          )
        )
      : Effect.succeed(held);
  }, local.variables);

export const CredentialResolverFromEnv = Layer.suspend(() => {
  const values = environment();
  const named = new Map(Object.entries(values));
  return answering((integrationId) => {
    if (keyless(integrationId)) {
      return Effect.succeed({ authMethodId: "none", values: {} });
    }
    const credential = credentialFromVariables(integrationId, named);
    return credential === undefined
      ? Effect.fail(
          notHeld(
            `Nothing in this shell runs ${integrationId}.${toSet(integrationId)}`
          )
        )
      : Effect.succeed(credential);
  }, values);
});
