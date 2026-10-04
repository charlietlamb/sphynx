export interface EnvEntry {
  readonly name: string;
  readonly value: string;
}

export interface EnvFile {
  readonly empty: readonly string[];
  readonly entries: readonly EnvEntry[];
}

interface Read {
  readonly lines: number;
  readonly value: string;
}

const LINE_BREAK = /\r?\n/;
const ASSIGNMENT = /^(?:export\s+)?([^\s=#][^=]*?)\s*=\s*(.*)$/;
const TRAILING_COMMENT = /(?:^|\s+)#.*$/;
const WRAPPED = /^(["'])([\s\S]*)\1$/;
const DOUBLE_ESCAPE = /\\(["\\nrt])/g;
const ESCAPES: Readonly<Record<string, string>> = {
  '"': '"',
  "\\": "\\",
  n: "\n",
  r: "\r",
  t: "\t",
};

const unescapeDouble = (value: string) =>
  value.replaceAll(DOUBLE_ESCAPE, (_, char: string) => ESCAPES[char] ?? char);

const closingQuote = (text: string, quote: string) => {
  for (let index = 1; index < text.length; index++) {
    if (quote === '"' && text[index] === "\\") {
      index++;
    } else if (text[index] === quote) {
      return index;
    }
  }
  return -1;
};

const onlyComment = (rest: string) => {
  const trimmed = rest.trim();
  return trimmed === "" || trimmed.startsWith("#");
};

const quoted = (
  raw: string,
  following: readonly string[]
): Read | undefined => {
  const quote = raw[0];
  if (quote !== '"' && quote !== "'") {
    return;
  }
  let text = raw;
  for (let lines = 1; lines <= following.length + 1; lines++) {
    const end = closingQuote(text, quote);
    if (end !== -1) {
      if (!onlyComment(text.slice(end + 1))) {
        return;
      }
      const inner = text.slice(1, end);
      return {
        lines,
        value: quote === '"' ? unescapeDouble(inner) : inner,
      };
    }
    const next = following[lines - 1];
    if (next === undefined) {
      return;
    }
    text = `${text}\n${next}`;
  }
};

const unquoted = (raw: string): Read => {
  const value = raw.replace(TRAILING_COMMENT, "").trim();
  const wrapped = WRAPPED.exec(value);
  return { lines: 1, value: wrapped?.[2] ?? value };
};

export const parseEnvFile = (text: string): EnvFile => {
  const lines = text.split(LINE_BREAK);
  const values = new Map<string, string>();
  let index = 0;
  while (index < lines.length) {
    const match = ASSIGNMENT.exec(lines[index]?.trim() ?? "");
    if (match === null) {
      index++;
      continue;
    }
    const [, name = "", raw = ""] = match;
    const read = quoted(raw, lines.slice(index + 1)) ?? unquoted(raw);
    values.delete(name);
    values.set(name, read.value);
    index += read.lines;
  }
  const all = [...values].map(([name, value]) => ({ name, value }));
  return {
    empty: all.filter(({ value }) => value === "").map(({ name }) => name),
    entries: all.filter(({ value }) => value !== ""),
  };
};
