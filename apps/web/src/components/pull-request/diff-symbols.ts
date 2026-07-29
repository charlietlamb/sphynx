import type { SymbolIndex } from "@/components/pull-request/patch-map";

export const DIFF_UNSAFE_CSS = `
:host {
  --diffs-font-features: "calt" 0, "liga" 0, "dlig" 0;
  --diffs-light-bg: var(--card);
  --diffs-dark-bg: var(--card);
  --diffs-bg-addition: light-dark(
    color-mix(in lab, var(--card) 92%, #18a46c),
    color-mix(in lab, var(--card) 87%, #07c480)
  );
  --diffs-bg-deletion: light-dark(
    color-mix(in lab, var(--card) 92%, #d52c36),
    color-mix(in lab, var(--card) 87%, #ff2e3f)
  );
}
[data-diffs-header] [data-change-icon] {
  display: none;
}
[data-diffs-header="default"] [data-metadata] {
  flex-wrap: nowrap;
  gap: 0.5rem;
  align-items: center;
}
/*
 * The file header is sticky, so it can detach from the card's real (scrolled
 * away) rounded top. Give it its own opaque rounded top with a hairline border
 * via a ::before so a stuck header reads as the top of the card and masks the
 * code scrolling behind it. At rest the header sits at the card's top where the
 * radius already matches, so the treatment is invisible there.
 */
[data-diffs-header] {
  border-bottom: 1px solid var(--border);
  border-top-left-radius: var(--radius);
  border-top-right-radius: var(--radius);
}
[data-diffs-header]::before {
  content: "";
  position: absolute;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  background: var(--card);
  border-top: 1px solid var(--border);
  border-top-left-radius: var(--radius);
  border-top-right-radius: var(--radius);
}
[data-diffs-header]::after {
  content: "";
  position: absolute;
  inset: 0 0 auto 0;
  height: 2px;
  background: transparent;
  border-top-left-radius: var(--radius);
  border-top-right-radius: var(--radius);
}
:host([data-active]) [data-diffs-header]::after {
  background: var(--primary);
}
[data-separator="line-info"] [data-separator-wrapper] {
  width: 100cqi;
  margin-right: 0;
  background-color: var(--diffs-bg-separator);
  border-radius: calc(var(--radius) * 0.6);
  overflow: hidden;
}
[data-annotation-content],
[data-annotation-content] *,
[data-annotation-slot],
[data-annotation-slot] * {
  font-family: var(--font-sans);
  white-space: normal;
  text-wrap: wrap;
}
[data-annotation-slot] code,
[data-annotation-slot] pre,
[data-annotation-slot] .font-mono {
  font-family: var(--font-mono);
}
[data-separator="line-info"] [data-expand-button],
[data-separator="line-info"] [data-separator-content] {
  background-color: transparent;
  border-radius: 0;
}
[data-separator="line-info"] [data-expand-button]:hover {
  background-color: color-mix(in lab, var(--diffs-bg-separator) 60%, var(--foreground) 8%);
}
[data-symbol] {
  font-weight: 600;
  text-decoration: underline;
  text-underline-offset: 3px;
  cursor: pointer;
}
[data-symbol]:hover {
  color: var(--primary);
}
[data-token-cursor] {
  background: var(--primary);
  border-radius: 2px;
  color: var(--primary-foreground);
}
[data-token-cursor] * {
  color: var(--primary-foreground);
}
`;

const QUOTE_ENDING = /["'`]$/;
const DESTRUCTURE_ROW = /^\s*(?:export\s+)?(?:const|let|var)\s*[{[]/;
/**
 * A single trailing dot is member access (`foo.bar` — don't link `bar`), but a
 * trailing `...` is the spread operator (`...foo`), which precedes a real
 * reference and must stay linkable. Matches a `.` preceded by a non-dot (or the
 * start), so `foo.` matches but `...` does not.
 */
const MEMBER_ACCESS_ENDING = /(?:^|[^.])\.$/;

/** Exposed for tests: is the text before a symbol a member access (not a spread)? */
export const endsWithMemberAccess = (before: string) =>
  MEMBER_ACCESS_ENDING.test(before);

function walkText(
  token: Element,
  siblingKey: "nextSibling" | "previousSibling",
  skipWhitespace: boolean
) {
  let current: Element = token;
  let node: Node | null = token[siblingKey];
  while (true) {
    while (node) {
      const text = node.textContent ?? "";
      if (skipWhitespace ? text.trim().length > 0 : text.length > 0) {
        return text;
      }
      node = node[siblingKey];
    }
    const parent = current.parentElement;
    if (!parent || parent.hasAttribute("data-line")) {
      return "";
    }
    current = parent;
    node = parent[siblingKey];
  }
}

const precedingText = (token: Element) =>
  walkText(token, "previousSibling", true).trimEnd();

const followingRawText = (token: Element) =>
  walkText(token, "nextSibling", false);

type Definition = NonNullable<ReturnType<SymbolIndex["get"]>>;

function referenceLike(definition: Definition, token: Element, row: Element) {
  const before = precedingText(token);
  if (QUOTE_ENDING.test(before)) {
    return false;
  }
  if (followingRawText(token).startsWith(":")) {
    return false;
  }
  if (definition.kind === "top" && endsWithMemberAccess(before)) {
    return false;
  }
  return !DESTRUCTURE_ROW.test(row.textContent ?? "");
}

function shouldStamp(
  definition: Definition,
  token: HTMLElement,
  path: string | null
) {
  if (definition.scope === "file" && definition.path !== path) {
    return false;
  }
  const row = token.closest("[data-line]");
  if (!row || row.getAttribute("data-line-type") === "change-deletion") {
    return false;
  }
  const isDefinitionSite =
    definition.path === path &&
    Number(row.getAttribute("data-line")) === definition.lineNumber;
  return !isDefinitionSite && referenceLike(definition, token, row);
}

function stampWithin(
  scope: ParentNode,
  index: SymbolIndex,
  path: string | null
) {
  for (const token of scope.querySelectorAll<HTMLElement>("span[data-char]")) {
    const definition = index.get(token.textContent ?? "");
    if (definition && shouldStamp(definition, token, path)) {
      token.setAttribute("data-symbol", "");
    } else if (token.hasAttribute("data-symbol")) {
      token.removeAttribute("data-symbol");
    }
  }
}

function stampSymbols(node: HTMLElement, index: SymbolIndex) {
  const root = node.shadowRoot;
  if (root) {
    stampWithin(root, index, node.getAttribute("data-path"));
  }
}

function stampAddedNodes(
  records: MutationRecord[],
  index: SymbolIndex,
  path: string | null
) {
  for (const record of records) {
    for (const added of record.addedNodes) {
      if (added instanceof Element) {
        stampWithin(added, index, path);
      }
    }
  }
}

interface StampEntry {
  index: SymbolIndex;
  observer: MutationObserver;
}

const stampObservers = new WeakMap<HTMLElement, StampEntry>();

export function keepSymbolsStamped(node: HTMLElement, index: SymbolIndex) {
  stampSymbols(node, index);
  const existing = stampObservers.get(node);
  if (existing) {
    existing.index = index;
    return;
  }
  if (!node.shadowRoot) {
    return;
  }
  const entry: StampEntry = {
    index,
    observer: new MutationObserver((records) => {
      stampAddedNodes(records, entry.index, node.getAttribute("data-path"));
    }),
  };
  entry.observer.observe(node.shadowRoot, {
    childList: true,
    subtree: true,
  });
  stampObservers.set(node, entry);
}

export function releaseSymbolStamping(node: HTMLElement) {
  stampObservers.get(node)?.observer.disconnect();
  stampObservers.delete(node);
}
