import { describe, expect, test } from "bun:test";
import { structuredReply } from "../../../src/lib/evals/structured-reply";

describe("an agent reply that is structured data", () => {
  test("is shown as indented JSON", () => {
    expect(structuredReply('{"status":"created","posts":[]}')).toBe(
      '{\n  "status": "created",\n  "posts": []\n}'
    );
  });

  test("includes a list", () => {
    expect(structuredReply('[{"postId":"p1"}]')).toBe(
      '[\n  {\n    "postId": "p1"\n  }\n]'
    );
  });

  test("is not a reply that only mentions JSON or is a bare value", () => {
    expect(structuredReply("Saved. Result: {status: created}")).toBeNull();
    expect(structuredReply('"created"')).toBeNull();
    expect(structuredReply("{not json")).toBeNull();
  });
});
