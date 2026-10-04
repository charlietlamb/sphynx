import { type ChildProcess, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { createServer } from "node:net";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { Client } from "eve/client";

export interface ServeEveOptions {
  readonly cwd: string;
  readonly env?: Readonly<Record<string, string>>;
  readonly port?: number;
  readonly readyTimeoutMs?: number;
}

export interface EveServer {
  readonly close: () => Promise<void>;
  readonly url: string;
}

const READY_TIMEOUT_MS = 120_000;
const HEALTH_POLL_MS = 200;
const KEPT_LINES = 5;
const DRAIN_MS = 2000;
const STOP_GRACE_MS = 5000;
const LINE_BREAK = /\r?\n/;
const BANNER = /^\S*eve\s+v\d/;

const shown = (line: string) => line !== "" && !BANNER.test(line);

type Stream = "stderr" | "stdout";

interface Written {
  open: boolean;
  readonly stream: Stream;
  text: string;
}

const tailOf = (child: ChildProcess) => {
  const written: Written[] = [];
  const keep = (stream: Stream) => (chunk: Buffer) => {
    const text = chunk.toString();
    process.stderr.write(text);
    const [first = "", ...rest] = text.split(LINE_BREAK);
    const open = written.findLast(
      (line) => line.stream === stream && line.open
    );

    if (open === undefined) {
      written.push({ open: true, stream, text: first });
    } else {
      open.text += first;
    }

    for (const line of rest) {
      const last = written.findLast((each) => each.stream === stream);

      if (last !== undefined) {
        last.open = false;
      }

      written.push({ open: true, stream, text: line });
    }
  };

  child.stdout?.on("data", keep("stdout"));
  child.stderr?.on("data", keep("stderr"));
  const drained = new Promise<void>((resolve) => {
    child.once("close", () => resolve());
  });

  return async () => {
    const giveUp = new AbortController();

    try {
      await Promise.race([
        drained,
        sleep(DRAIN_MS, undefined, { signal: giveUp.signal }),
      ]);
    } finally {
      giveUp.abort();
    }

    return written
      .map(({ text }) => text.trim())
      .filter(shown)
      .slice(-KEPT_LINES)
      .join(" ");
  };
};

const freePort = () =>
  new Promise<number>((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close(() => resolve(port));
    });
  });

const exited = (child: ChildProcess) =>
  new Promise<void>((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) {
      resolve();
      return;
    }

    child.once("exit", () => resolve());
  });

const healthy = async (client: Client) => {
  try {
    await client.health();
    return true;
  } catch {
    return false;
  }
};

const awaitHealth = async (
  client: Client,
  child: ChildProcess,
  timeoutMs: number,
  said: () => Promise<string>
) => {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      const output = await said();
      throw new Error(
        output === ""
          ? `eve dev exited with code ${child.exitCode}`
          : `eve dev exited with code ${child.exitCode}: ${output}`
      );
    }

    if (await healthy(client)) {
      return;
    }

    await sleep(HEALTH_POLL_MS);
  }

  throw new Error(`eve dev did not answer health within ${timeoutMs}ms`);
};

export const serveEve = async ({
  cwd,
  env,
  port,
  readyTimeoutMs = READY_TIMEOUT_MS,
}: ServeEveOptions): Promise<EveServer> => {
  const bin = join(cwd, "node_modules", ".bin", "eve");

  if (!existsSync(bin)) {
    throw new Error(`${bin} not found. Install eve in the agent directory.`);
  }

  const listen = port ?? (await freePort());
  const url = `http://127.0.0.1:${listen}`;
  const child = spawn(
    bin,
    ["dev", "--no-ui", "--logs", "none", "--port", String(listen)],
    {
      cwd,
      env: { ...process.env, EVE_TELEMETRY_DISABLED: "1", ...env },
      stdio: ["ignore", "pipe", "pipe"],
    }
  );
  const said = tailOf(child);
  const close = async () => {
    child.kill("SIGTERM");
    const stopped = await Promise.race([
      exited(child).then(() => true),
      sleep(STOP_GRACE_MS).then(() => false),
    ]);

    if (!stopped) {
      child.kill("SIGKILL");
      await exited(child);
    }
  };

  try {
    await awaitHealth(new Client({ host: url }), child, readyTimeoutMs, said);
  } catch (error) {
    await close();
    throw error;
  }

  return { close, url };
};
