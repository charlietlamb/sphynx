import { createHash } from "node:crypto";
import type { ProfileContent } from "./harness-profile";

/* By code unit, not locale, so a version does not move with the machine's language. */
const byCodeUnit = (left: string, right: string) => {
  if (left === right) {
    return 0;
  }

  return left < right ? -1 : 1;
};

const sortedEntries = (
  record: Readonly<Record<string, string>> | null | undefined
) =>
  record == null
    ? null
    : Object.entries(record).toSorted(([left], [right]) =>
        byCodeUnit(left, right)
      );

/* Maps are sorted so read order cannot change the version. The name is excluded:
   renaming a profile is not editing it. */
export const profileVersionOf = (profile: ProfileContent): string =>
  createHash("sha256")
    .update(
      JSON.stringify({
        env: sortedEntries(profile.env),
        files: sortedEntries(profile.files),
        /* Coalesced so an omitted field and an explicitly null one hash alike. */
        install: profile.install ?? null,
        run: profile.run ?? null,
        systemPrompt: profile.systemPrompt ?? null,
        ...(profile.variables?.length
          ? { variables: profile.variables.toSorted(byCodeUnit) }
          : {}),
      })
    )
    .digest("hex")
    .slice(0, 32);
