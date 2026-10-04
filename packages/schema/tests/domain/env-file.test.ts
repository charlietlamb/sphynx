import { describe, expect, it } from "bun:test";
import { parseEnvFile } from "../../src/domain/env-file";

const entriesOf = (text: string) => parseEnvFile(text).entries;

describe("reading a .env file", () => {
  it("reads KEY=VALUE lines and skips comments and blank lines", () => {
    expect(
      entriesOf("OPENAI_API_KEY=sk-1\n\n# a comment\n  BASE_URL = https://x ")
    ).toEqual([
      { name: "OPENAI_API_KEY", value: "sk-1" },
      { name: "BASE_URL", value: "https://x" },
    ]);
  });

  it("drops a leading export", () => {
    expect(entriesOf("export API_KEY=abc")).toEqual([
      { name: "API_KEY", value: "abc" },
    ]);
  });

  it("unwraps quoted values and keeps what is inside them", () => {
    expect(
      entriesOf(`A="hello # world"\nB='no \\n escape'\nC="line\\nnext"`)
    ).toEqual([
      { name: "A", value: "hello # world" },
      { name: "B", value: "no \\n escape" },
      { name: "C", value: "line\nnext" },
    ]);
  });

  it("drops a trailing comment after a quoted value", () => {
    expect(
      entriesOf(`A="has # inside" # note\nB='x' # y\nC=plain # z`)
    ).toEqual([
      { name: "A", value: "has # inside" },
      { name: "B", value: "x" },
      { name: "C", value: "plain" },
    ]);
  });

  it("keeps a trailing comment's quotes out of the value", () => {
    expect(
      entriesOf(`A="value" # say "hi"\nB='value' # it's fine\nC="x" #"`)
    ).toEqual([
      { name: "A", value: "value" },
      { name: "B", value: "value" },
      { name: "C", value: "x" },
    ]);
  });

  it("keeps an escaped quote inside a double quoted value", () => {
    expect(entriesOf(`A="say \\"hi\\"" # note`)).toEqual([
      { name: "A", value: 'say "hi"' },
    ]);
  });

  it("reads a double quoted value across lines", () => {
    expect(
      entriesOf('KEY="-----BEGIN KEY-----\nabc\n-----END KEY-----"\nNEXT=1')
    ).toEqual([
      { name: "KEY", value: "-----BEGIN KEY-----\nabc\n-----END KEY-----" },
      { name: "NEXT", value: "1" },
    ]);
  });

  it("reads an unclosed quote as a plain value on its own line", () => {
    expect(entriesOf(`A="open\nB=2`)).toEqual([
      { name: "A", value: '"open' },
      { name: "B", value: "2" },
    ]);
  });

  it("names empty assignments apart from the entries", () => {
    expect(parseEnvFile(`A=\nB=""\nC=1\nD= # nothing`)).toEqual({
      empty: ["A", "B", "D"],
      entries: [{ name: "C", value: "1" }],
    });
  });

  it("takes the last value of a repeated name", () => {
    expect(parseEnvFile("export A=1\n# A=commented\nA=2\nEMPTY=\n")).toEqual({
      empty: ["EMPTY"],
      entries: [{ name: "A", value: "2" }],
    });
  });

  it("reads CRLF line endings", () => {
    expect(entriesOf("A=1\r\nB=2\r\n")).toEqual([
      { name: "A", value: "1" },
      { name: "B", value: "2" },
    ]);
  });

  it("keeps every = after the first in the value", () => {
    expect(entriesOf("URL=https://x/v1?a=1&b=2")).toEqual([
      { name: "URL", value: "https://x/v1?a=1&b=2" },
    ]);
  });

  it("skips lines without a name and value separator", () => {
    expect(entriesOf("just words\n=nothing\nA=1")).toEqual([
      { name: "A", value: "1" },
    ]);
  });

  it("skips lines whose name is not a variable name", () => {
    expect(
      entriesOf("A # note=1\nMY-VAR=1\n1ST=x\nexport GOOD_1=yes\n_HIDDEN=2")
    ).toEqual([
      { name: "GOOD_1", value: "yes" },
      { name: "_HIDDEN", value: "2" },
    ]);
  });

  it("keeps the quoted value and drops text after its closing quote", () => {
    expect(entriesOf(`A="value" junk\nB='x'y\nC=1`)).toEqual([
      { name: "A", value: "value" },
      { name: "B", value: "x" },
      { name: "C", value: "1" },
    ]);
  });

  it("keeps every line of a multi line value followed by junk", () => {
    expect(entriesOf(`A="abc\ndef" junk\nB=2`)).toEqual([
      { name: "A", value: "abc\ndef" },
      { name: "B", value: "2" },
    ]);
  });

  it("reads nothing from an empty paste", () => {
    expect(parseEnvFile("")).toEqual({ empty: [], entries: [] });
  });
});
