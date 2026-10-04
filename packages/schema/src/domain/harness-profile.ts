import { Schema } from "effect";
import { VariableName } from "./environment";
import { keptOnServer } from "./known-variables";

export const PROFILE_LIMITS = {
  /* Cloudflare and Daytona pass file content in one shell argument, capping a file near 128 KiB encoded. */
  fileChars: 96_000,
  files: 256,
  totalChars: 2_000_000,
} as const;

export const ProfileVariableName = VariableName.pipe(
  Schema.filter((name) => !keptOnServer(name), {
    message: (issue) =>
      `${String(issue.actual)} is used by a judge or sandbox, so it never reaches a profile`,
  })
);

export const ProfileName = Schema.String.pipe(
  Schema.pattern(/^[a-z0-9][a-z0-9-]{0,63}$/),
  Schema.annotations({
    description:
      "Lowercase letters, digits and hyphens, at most 64 characters, starting with a letter or digit.",
    identifier: "ProfileName",
  })
);
export type ProfileName = typeof ProfileName.Type;

/* Rules live in the regex because a Schema.filter on a Record key is lost when the MCP tool schema is generated. Every segment is guarded: this is joined onto the sandbox home and written, so one interior `..` escapes it. */
export const ProfilePath = Schema.String.pipe(
  Schema.pattern(/^(home|workspace)(?:\/(?!\.\.?(?:\/|$))[^/\0]+)+$/),
  Schema.maxLength(512),
  Schema.annotations({
    description:
      "A relative path under home/ or workspace/, without a .. segment.",
    identifier: "ProfilePath",
  })
);
export type ProfilePath = typeof ProfilePath.Type;

export const EnvName = Schema.String.pipe(
  Schema.pattern(/^[A-Z_][A-Z0-9_]*$/),
  Schema.annotations({
    description: "An environment variable name.",
    identifier: "EnvName",
  })
);
export type EnvName = typeof EnvName.Type;

const ProfileFiles = Schema.Record({
  key: ProfilePath,
  value: Schema.String.pipe(Schema.maxLength(PROFILE_LIMITS.fileChars)),
}).pipe(
  Schema.filter((files) => Object.keys(files).length <= PROFILE_LIMITS.files, {
    message: () => `A profile holds at most ${PROFILE_LIMITS.files} files.`,
  }),
  Schema.filter(
    (files) =>
      Object.values(files).reduce((sum, content) => sum + content.length, 0) <=
      PROFILE_LIMITS.totalChars,
    {
      message: () =>
        `A profile's files hold at most ${PROFILE_LIMITS.totalChars} characters in total.`,
    }
  )
);

export const HarnessProfile = Schema.Struct({
  /* Stored in the clear and readable by anyone who can read the run; secrets belong in Settings > Environment, named in variables. */
  env: Schema.optional(Schema.Record({ key: EnvName, value: Schema.String })),
  files: ProfileFiles,
  install: Schema.optional(Schema.String),
  name: ProfileName,
  run: Schema.optional(Schema.String),
  systemPrompt: Schema.optional(Schema.String),
  variables: Schema.optional(Schema.Array(ProfileVariableName)),
})
  .pipe(
    Schema.filter((profile) => {
      const clash = (profile.variables ?? []).find(
        (name) => profile.env?.[name] !== undefined
      );
      return (
        clash === undefined ||
        `${clash} is in both env and variables. Keep it in one.`
      );
    })
  )
  .annotations({
    description:
      "Configuration layered on a harness: files written under the sandbox home and workspace, a system prompt, environment, the names of Settings > Environment variables to pass in, an install command run before the harness, and for the command harness the run command.",
    identifier: "HarnessProfile",
  });
export type HarnessProfile = typeof HarnessProfile.Type;

/* Cannot be expressed in JSON Schema, so every tool description repeats it. */
export const profileFitsHarness = (variant: {
  readonly harness: string;
  readonly profile?: HarnessProfile | undefined;
}): boolean =>
  variant.harness === "command"
    ? variant.profile?.run !== undefined
    : variant.profile?.run === undefined;

export const PROFILE_HARNESS_RULE =
  "The command harness needs a profile with a run command; other harnesses take no run. Any harness may take an install command.";
