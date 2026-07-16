export interface SymbolHintItem {
  element: HTMLElement;
  label: string;
  x: number;
  y: number;
}

export interface SymbolHintState {
  buffer: string;
  items: SymbolHintItem[];
}

const HINT_CHARS = "asdfgqwert";

function hintLabels(count: number) {
  if (count <= HINT_CHARS.length) {
    return [...HINT_CHARS.slice(0, count)];
  }
  const labels: string[] = [];
  for (const first of HINT_CHARS) {
    for (const second of HINT_CHARS) {
      labels.push(`${first}${second}`);
      if (labels.length === count) {
        return labels;
      }
    }
  }
  return labels;
}

interface VisibleSymbol {
  element: HTMLElement;
  x: number;
  y: number;
}

function collectVisibleSymbols(scope: HTMLElement | null): VisibleSymbol[] {
  if (!scope) {
    return [];
  }
  const scopeRect = scope.getBoundingClientRect();
  const targets: VisibleSymbol[] = [];
  for (const container of scope.querySelectorAll("diffs-container")) {
    const symbols =
      container.shadowRoot?.querySelectorAll<HTMLElement>("[data-symbol]");
    for (const element of symbols ?? []) {
      const rect = element.getBoundingClientRect();
      const visible =
        rect.width > 0 &&
        rect.top >= scopeRect.top &&
        rect.bottom <= scopeRect.bottom &&
        rect.left >= scopeRect.left &&
        rect.right <= scopeRect.right;
      if (visible) {
        targets.push({ element, x: rect.left, y: rect.top });
      }
    }
  }
  return targets;
}

export function collectSymbolHints(
  scope: HTMLElement | null
): SymbolHintItem[] {
  const targets = collectVisibleSymbols(scope).slice(0, HINT_CHARS.length ** 2);
  const labels = hintLabels(targets.length);
  return targets.map((target, index) => ({ ...target, label: labels[index] }));
}

export function clickHintTarget(element: HTMLElement) {
  if (!element.isConnected) {
    return;
  }
  const rect = element.getBoundingClientRect();
  const options = {
    bubbles: true,
    composed: true,
    cancelable: true,
    clientX: rect.x + 4,
    clientY: rect.y + 4,
  };
  element.dispatchEvent(new PointerEvent("pointerdown", options));
  element.dispatchEvent(new PointerEvent("pointerup", options));
  element.dispatchEvent(new MouseEvent("click", options));
}
