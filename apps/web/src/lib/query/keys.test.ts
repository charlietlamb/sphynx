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

  test("search nests under its installation", () => {
    const installation = keys.installation(7);
    expect(startsWith(keys.search(7, "is:pr"), installation)).toBe(true);
  });

  test("different installations do not collide", () => {
    expect(keys.search(1, "is:pr")).not.toEqual(keys.search(2, "is:pr"));
  });

  test("different users do not share installations", () => {
    expect(keys.installations("a")).not.toEqual(keys.installations("b"));
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
