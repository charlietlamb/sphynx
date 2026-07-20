import { describe, expect, test } from "bun:test";
import { composeEtag, etagFor } from "./composite-etag";

describe("composeEtag", () => {
  test("is stable regardless of input order", () => {
    const a = composeEtag([
      { key: "o/one", etag: '"x"' },
      { key: "o/two", etag: '"y"' },
    ]);
    const b = composeEtag([
      { key: "o/two", etag: '"y"' },
      { key: "o/one", etag: '"x"' },
    ]);
    expect(a).toBe(b);
  });

  test("changes when any repo's etag moves", () => {
    const before = composeEtag([
      { key: "o/one", etag: '"x"' },
      { key: "o/two", etag: '"y"' },
    ]);
    const after = composeEtag([
      { key: "o/one", etag: '"x"' },
      { key: "o/two", etag: '"z"' },
    ]);
    expect(before).not.toBe(after);
  });

  test("changes when a repo joins or leaves", () => {
    const one = composeEtag([{ key: "o/one", etag: '"x"' }]);
    const two = composeEtag([
      { key: "o/one", etag: '"x"' },
      { key: "o/two", etag: '"y"' },
    ]);
    expect(one).not.toBe(two);
  });
});

describe("etagFor", () => {
  test("reads a repo's etag back out", () => {
    const composite = composeEtag([
      { key: "o/one", etag: '"x"' },
      { key: "o/two", etag: '"y"' },
    ]);
    expect(etagFor(composite, "o/one")).toBe('"x"');
    expect(etagFor(composite, "o/two")).toBe('"y"');
  });

  test("survives etags containing quotes, slashes and braces", () => {
    const gnarly = 'W/"a/b{c}\\"d"';
    const composite = composeEtag([{ key: "o/one", etag: gnarly }]);
    expect(etagFor(composite, "o/one")).toBe(gnarly);
  });

  test("returns null for an unknown repo, empty tag, or absent composite", () => {
    const composite = composeEtag([{ key: "o/one", etag: '"x"' }]);
    expect(etagFor(composite, "o/missing")).toBeNull();
    expect(
      etagFor(composeEtag([{ key: "o/one", etag: "" }]), "o/one")
    ).toBeNull();
    expect(etagFor(null, "o/one")).toBeNull();
  });

  test("returns null rather than throwing on a malformed composite", () => {
    expect(etagFor("not json", "o/one")).toBeNull();
    expect(etagFor("[1,2,3]", "o/one")).toBeNull();
  });
});
