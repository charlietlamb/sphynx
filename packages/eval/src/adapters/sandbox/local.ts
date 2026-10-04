import { spawn } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { Config, Duration, Effect, Either, Option } from "effect";
import { SandboxUnavailable } from "../../domain/errors";
import type { SandboxAdapterShape, SandboxHandle } from "../../ports/sandbox";
import { execStream } from "./exec-stream";
import { localCache } from "./local-cache";
import { localDetached } from "./local-detached";
import { localInstalls } from "./local-installs";
import { markUsed } from "./local-prune";
import { localRoots } from "./local-roots";
import {
  DEFAULT_TIMEOUT_MS,
  providerCall,
  unavailableFor,
} from "./provider-adapter";

const call = providerCall("local");

const refused = (reason: string) =>
  new SandboxUnavailable({ provider: "local", reason });

const execute = (
  cwd: string,
  command: string,
  timeoutMs: number,
  env: Readonly<Record<string, string>>
) =>
  execStream((sink) =>
    Effect.async<number, SandboxUnavailable>((resume) => {
      const child = spawn(command, {
        cwd,
        detached: true,
        env,
        shell: "/bin/bash",
      });

      child.stdout.on("data", (data: Buffer) => sink.stdout(data.toString()));
      child.stderr.on("data", (data: Buffer) => sink.stderr(data.toString()));
      child.on("error", (cause) =>
        resume(Effect.fail(unavailableFor("local")(cause)))
      );
      child.on("close", (code) => resume(Effect.succeed(code ?? 137)));

      return Effect.sync(() => {
        const group = child.pid;
        const signalled =
          group !== undefined &&
          Either.isRight(Either.try(() => process.kill(-group, "SIGKILL")));

        if (!signalled) {
          child.kill("SIGKILL");
        }
      });
    }).pipe(
      Effect.timeoutFail({
        duration: Duration.millis(timeoutMs),
        onTimeout: () => refused(`timed out after ${timeoutMs}ms`),
      })
    )
  );

const refusing = (reason: string): SandboxAdapterShape => ({
  attach: () => Effect.fail(refused(reason)),
  destroy: () => Effect.void,
  open: () => Effect.fail(refused(reason)),
  provider: "local",
});

const OFF =
  "the local sandbox runs commands on this machine, so it opens only where SPHYNX_LOCAL_SANDBOX is set";

export const makeLocalAdapter: Effect.Effect<SandboxAdapterShape> = Effect.gen(
  function* () {
    const enabled = yield* Config.boolean("SPHYNX_LOCAL_SANDBOX").pipe(
      Config.withDefault(false)
    );

    if (!enabled) {
      return refusing(OFF);
    }

    const path = yield* Config.string("PATH").pipe(Config.withDefault(""));
    const roots = yield* localRoots;

    return {
      attach: (id) =>
        Effect.fail(
          refused(
            `a local sandbox does not outlive its process, so ${id} cannot be reattached`
          )
        ),
      destroy: (handle) =>
        call(() => rm(handle.id, { force: true, recursive: true })),
      open: (request) =>
        Effect.gen(function* () {
          const root = yield* call(() =>
            mkdtemp(join(tmpdir(), "sphynx-local-"))
          );

          const home = join(root, "home");
          const temp = join(root, "tmp");
          const packages = {
            BUN_INSTALL_CACHE_DIR: join(roots.packages, "bun"),
            npm_config_cache: join(roots.packages, "npm"),
          };

          yield* call(() => mkdir(home));
          yield* call(() => mkdir(temp));
          yield* Effect.forEach(Object.values(packages), markUsed, {
            discard: true,
          });
          yield* call(() => mkdir(request.workspace, { recursive: true }));

          const base = { ...packages, HOME: home, PATH: path, TMPDIR: temp };

          return {
            cache:
              request.cache === undefined
                ? Option.none()
                : Option.some(localCache(roots.cache, roots.staging)),
            exec: (command, options) =>
              execute(
                options?.cwd ?? root,
                command,
                options?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
                { ...base, ...options?.env }
              ),
            home,
            id: root,
            installs: Option.some(localInstalls(roots.installs, roots.staging)),
            provider: "local",
            resumable: Option.some(localDetached(root, path, base)),
            writeFile: (target, content) => {
              const file = target.startsWith("/") ? target : join(root, target);

              return call(async () => {
                await mkdir(dirname(file), { recursive: true });
                await writeFile(file, content, "utf8");
              });
            },
          } satisfies SandboxHandle;
        }),
      provider: "local",
    } satisfies SandboxAdapterShape;
  }
).pipe(Effect.orDie);
