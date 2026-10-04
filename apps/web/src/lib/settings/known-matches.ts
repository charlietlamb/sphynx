import {
  KNOWN_VARIABLES,
  type KnownVariable,
} from "@sphynx/schema/domain/known-variables";

export const knownMatches = (query: string): readonly KnownVariable[] => {
  const needle = query.trim().toUpperCase();

  if (needle === "") {
    return KNOWN_VARIABLES;
  }

  const prefixed = KNOWN_VARIABLES.filter((known) =>
    known.name.startsWith(needle)
  );
  const inside = KNOWN_VARIABLES.filter(
    (known) => !known.name.startsWith(needle) && known.name.includes(needle)
  );

  return [...prefixed, ...inside];
};
