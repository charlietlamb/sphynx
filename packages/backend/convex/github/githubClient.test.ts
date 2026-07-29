import { Effect } from "effect";
import { afterEach, describe, expect, test, vi } from "vitest";
import { makeGitHubClient } from "./githubClient";

afterEach(() => vi.unstubAllGlobals());

describe("GitHub write retries", () => {
  test("does not replay an ambiguous REST write", async () => {
    const fetch = vi.fn().mockRejectedValue(new Error("socket closed"));
    vi.stubGlobal("fetch", fetch);
    const client = makeGitHubClient({
      apiUrl: "https://api.github.test",
      apiVersion: "2022-11-28",
      timeoutMillis: 1000,
    });

    await Effect.runPromiseExit(
      client.rest("token", "POST", "/repos/acme/widgets/issues", {
        body: "hello",
      })
    );

    expect(fetch).toHaveBeenCalledTimes(1);
  });

  test("retries a transient GET", async () => {
    const fetch = vi
      .fn()
      .mockRejectedValueOnce(new Error("socket closed"))
      .mockResolvedValueOnce(
        new Response("{}", {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      );
    vi.stubGlobal("fetch", fetch);
    const client = makeGitHubClient({
      apiUrl: "https://api.github.test",
      apiVersion: "2022-11-28",
      timeoutMillis: 1000,
    });

    await Effect.runPromise(client.rest("token", "GET", "/user/installations"));

    expect(fetch).toHaveBeenCalledTimes(2);
  });

  test("preserves status and headers for a 304 without a body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(null, {
          status: 304,
          headers: { etag: '"cached"' },
        })
      )
    );
    const client = makeGitHubClient({
      apiUrl: "https://api.github.test",
      apiVersion: "2022-11-28",
      timeoutMillis: 1000,
    });

    const response = await Effect.runPromise(
      client.rest("token", "GET", "/repos/acme/widgets")
    );

    expect(response.status).toBe(304);
    expect(response.header("etag")).toBe('"cached"');
  });

  test("aborts a timed-out request", async () => {
    const signals: AbortSignal[] = [];
    const fetch = vi.fn().mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          const signal = init.signal as AbortSignal;
          signals.push(signal);
          signal.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError"))
          );
        })
    );
    vi.stubGlobal("fetch", fetch);
    const client = makeGitHubClient({
      apiUrl: "https://api.github.test",
      apiVersion: "2022-11-28",
      timeoutMillis: 1,
    });

    await Effect.runPromiseExit(client.rest("token", "POST", "/slow"));

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(signals[0]?.aborted).toBe(true);
  });

  test("aborts when the response body stalls after headers", async () => {
    const signals: AbortSignal[] = [];
    const fetch = vi
      .fn()
      .mockImplementation((_url: string, init: RequestInit) => {
        const signal = init.signal as AbortSignal;
        signals.push(signal);
        return Promise.resolve(
          new Response(
            new ReadableStream({
              start(controller) {
                signal.addEventListener("abort", () =>
                  controller.error(new DOMException("Aborted", "AbortError"))
                );
              },
            }),
            {
              status: 200,
              headers: { "content-type": "application/json" },
            }
          )
        );
      });
    vi.stubGlobal("fetch", fetch);
    const client = makeGitHubClient({
      apiUrl: "https://api.github.test",
      apiVersion: "2022-11-28",
      timeoutMillis: 1,
    });

    const error = await Effect.runPromise(
      client.rest("token", "POST", "/slow-body").pipe(Effect.flip)
    );

    expect(error._tag).toBe("GitHubTimeout");
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(signals[0]?.aborted).toBe(true);
  });
});
