import { readdir, readFile } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import type { EvalHarness } from "@sphynx/schema/domain/eval-trial";
import {
  type HarnessProfile,
  PROFILE_LIMITS,
  ProfilePath,
  profileFitsHarness,
} from "@sphynx/schema/domain/harness-profile";
import { Effect, Schema } from "effect";
import ignore, { type Ignore } from "ignore";
import {
  CommandProfileNeedsRun,
  ProfileDirectoryUnreadable,
  ProfileFileTooLarge,
  ProfilePathInvalid,
  ProfileStepNotSupported,
  ProfileTooLarge,
  ProfileTooManyFiles,
} from "./profile-errors";
import { readProfileManifest } from "./profile-manifest";
import type { ProfileRef, VariantInput } from "./types";

const SHIPPED_ROOTS = ["home", "workspace"] as const;
const SKIPPED_DIRECTORIES = new Set([".eve", ".git", "node_modules"]);

const isMissing = (cause: unknown) =>
  cause instanceof Error && "code" in cause && cause.code === "ENOENT";

interface IgnoreScope {
  readonly base: string;
  readonly matcher: Ignore;
}

const posix = (path: string) => path.split(sep).join("/");

const readScope = async (current: string): Promise<IgnoreScope[]> => {
  const text = await readFile(join(current, ".gitignore"), "utf8").catch(
    (cause: unknown) => {
      if (isMissing(cause)) {
        return;
      }

      throw cause;
    }
  );

  return text === undefined
    ? []
    : [{ base: current, matcher: ignore({ ignorecase: false }).add(text) }];
};

const isIgnored = (
  scopes: readonly IgnoreScope[],
  path: string,
  isDirectory: boolean
) =>
  scopes.reduce((ignored, { base, matcher }) => {
    const local = posix(relative(base, path));
    const verdict = matcher.test(isDirectory ? `${local}/` : local);

    if (verdict.ignored) {
      return true;
    }

    return verdict.unignored ? false : ignored;
  }, false);

const walk = async (
  dir: string,
  current: string,
  inherited: readonly IgnoreScope[]
): Promise<string[]> => {
  const scopes = [...inherited, ...(await readScope(current))];
  const entries = await readdir(current, { withFileTypes: true });
  const found = await Promise.all(
    entries.map((entry) => {
      const path = join(current, entry.name);
      const relativePath = path
        .slice(dir.length + 1)
        .split(sep)
        .join("/");

      if (entry.isDirectory()) {
        return SKIPPED_DIRECTORIES.has(entry.name) ||
          isIgnored(scopes, path, true)
          ? []
          : walk(dir, path, scopes);
      }

      return entry.isFile() && !isIgnored(scopes, path, false)
        ? [relativePath]
        : [];
    })
  );

  return found.flat();
};

const walkRoot = (dir: string, root: string, inherited: IgnoreScope[]) =>
  walk(dir, join(dir, root), inherited).catch((cause: unknown) => {
    if (isMissing(cause)) {
      return [];
    }

    throw cause;
  });

const shippedPaths = (dir: string) =>
  Effect.tryPromise({
    catch: (cause) => new ProfileDirectoryUnreadable({ cause, dir }),
    try: async () => {
      const inherited = await readScope(dir);
      const roots = await Promise.all(
        SHIPPED_ROOTS.map((root) => walkRoot(dir, root, inherited))
      );

      return roots.flat().sort();
    },
  });

const validPath = (path: string) =>
  Schema.decodeUnknown(ProfilePath)(path).pipe(
    Effect.mapError(() => new ProfilePathInvalid({ path }))
  );

const readShipped = (dir: string, path: string) =>
  Effect.gen(function* () {
    const bytes = yield* Effect.tryPromise({
      catch: (cause) => new ProfileDirectoryUnreadable({ cause, dir }),
      try: () => readFile(join(dir, path)),
    });

    if (bytes.includes(0)) {
      return [];
    }

    const content = bytes.toString("utf8");

    if (content.length > PROFILE_LIMITS.fileChars) {
      return yield* new ProfileFileTooLarge({ chars: content.length, path });
    }

    return [[yield* validPath(path), content] as const];
  });

const LARGEST_SHOWN = 3;

const directoryOf = (path: string) => {
  const segments = path.split("/");

  return segments.length > 2 ? segments.slice(0, 2).join("/") : segments[0];
};

const largestDirectories = (paths: readonly string[]) => {
  const counts = new Map<string, number>();

  for (const path of paths) {
    const directory = directoryOf(path);
    counts.set(directory, (counts.get(directory) ?? 0) + 1);
  }

  return [...counts]
    .sort((left, right) => right[1] - left[1])
    .slice(0, LARGEST_SHOWN)
    .map(([directory, count]) => `${directory} (${count})`);
};

const shippedFiles = (dir: string) =>
  Effect.gen(function* () {
    const paths = yield* shippedPaths(dir);

    if (paths.length > PROFILE_LIMITS.files) {
      return yield* new ProfileTooManyFiles({
        count: paths.length,
        largest: largestDirectories(paths),
      });
    }

    const entries = yield* Effect.forEach(
      paths,
      (path) => readShipped(dir, path),
      { concurrency: 8 }
    ).pipe(Effect.map((read) => read.flat()));

    const chars = entries.reduce((sum, [, content]) => sum + content.length, 0);

    if (chars > PROFILE_LIMITS.totalChars) {
      return yield* new ProfileTooLarge({ chars });
    }

    return Object.fromEntries(entries);
  });

const fittingHarness = (base: EvalHarness, profile: HarnessProfile) => {
  if (profileFitsHarness({ harness: base, profile })) {
    return Effect.succeed(profile);
  }

  if (base === "command") {
    return new CommandProfileNeedsRun({ name: profile.name });
  }

  return new ProfileStepNotSupported({ base, step: "run" });
};

export const profileVariant = (
  entry: string,
  variant: {
    readonly harness: EvalHarness;
    readonly model: string;
    readonly profile: ProfileRef;
    readonly sandbox?: VariantInput["sandbox"];
  }
) =>
  Effect.gen(function* () {
    const dir = resolve(dirname(entry), variant.profile.dir);

    yield* Effect.tryPromise({
      catch: (cause) => new ProfileDirectoryUnreadable({ cause, dir }),
      try: () => readdir(dir),
    });

    const [files, manifest] = yield* Effect.all([
      shippedFiles(dir),
      readProfileManifest(dir),
    ]);

    const profile = yield* fittingHarness(variant.harness, {
      ...manifest,
      files,
      name: variant.profile.name,
    });

    return {
      harness: variant.harness,
      model: variant.model,
      profile,
      sandbox: variant.sandbox,
    } satisfies VariantInput;
  }).pipe(
    Effect.withSpan("Eval.profileVariant", {
      attributes: { profile: variant.profile.name },
    })
  );
