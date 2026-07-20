import { describe, expect, test } from "bun:test";
import { keys } from "./keys";

const ref = { owner: "useautumn", repo: "autumn", number: 2296 };

const startsWith = (key: readonly unknown[], prefix: readonly unknown[]) =>
  prefix.every((part, index) => key[index] === part);

describe("query keys", () => {
  test("every pull entity nests under its pull", () => {
    const pull = keys.pull(ref);
    for (const key of [
      keys.pullSummary(ref),
      keys.pullBody(ref),
      keys.pullFiles(ref),
      keys.pullPatches(ref),
      keys.pullConversation(ref),
      keys.pullThreads(ref),
      keys.pullPendingReview(ref),
      keys.pullViewedFiles(ref),
      keys.pullFileContents(ref, "sha", "src/a.ts"),
    ]) {
      expect(startsWith(key, pull)).toBe(true);
    }
  });

  test("a pull nests under its repo", () => {
    expect(startsWith(keys.pull(ref), keys.repo(ref))).toBe(true);
    expect(startsWith(keys.repoEvents(ref, 1), keys.repo(ref))).toBe(true);
  });

  test("pipeline and search nest under their installation", () => {
    const installation = keys.installation(7);
    expect(startsWith(keys.pipeline(7), installation)).toBe(true);
    expect(startsWith(keys.search(7, "is:pr"), installation)).toBe(true);
  });

  test("different installations do not collide", () => {
    expect(keys.pipeline(1)).not.toEqual(keys.pipeline(2));
  });

  test("different repos do not collide", () => {
    expect(keys.repo({ owner: "a", repo: "b" })).not.toEqual(
      keys.repo({ owner: "a", repo: "c" })
    );
  });

  test("file contents are addressed by sha and path", () => {
    expect(keys.pullFileContents(ref, "sha1", "a.ts")).not.toEqual(
      keys.pullFileContents(ref, "sha2", "a.ts")
    );
    expect(keys.pullFileContents(ref, "sha1", "a.ts")).not.toEqual(
      keys.pullFileContents(ref, "sha1", "b.ts")
    );
  });
});
