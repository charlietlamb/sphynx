# react-mosaic drag: how it works here & how to not break it

The dashboard rearrange uses **react-mosaic-component@7** (drag) on **React 19** +
**TanStack Start SSR** + **Vite**. Its drag is fragile: a single wrong CSS rule or
prop silently kills it. This doc records the working setup and every landmine we
hit, so nobody re-derives it (it cost a very long debugging session).

## The setup that works

Files:
- `mosaic-dashboard-shell.tsx` — `<Mosaic className="sphynx-mosaic" dragAndDropManager={...}>`
- `use-mosaic-dnd-manager.ts` — our own **plain HTML5** DragDropManager
- `use-mosaic-layout.ts` — controlled `value`/`onChange`/`onRelease`
- `mosaic-dashboard.css` — the theme (the dangerous part)

Two non-obvious load-bearing choices:

1. **We pass our own `dragAndDropManager` = `createDragDropManager(HTML5Backend)`.**
   react-mosaic 7 defaults to a MultiBackend (HTML5 + touch via
   `rdndmb-html5-to-touch`). Through Vite's dep optimizer that MultiBackend arrives
   with an **empty backends pipeline** — `getBackend()` has no `rootElement`, `setup()`
   attaches no `dragstart` listeners, and drag is completely dead (resize still works
   because resize isn't react-dnd). Owning a plain HTML5 manager sidesteps it.
   Needs `dnd-core` + `react-dnd-html5-backend` (+ `react-dnd` for Vite dedupe) as
   direct `apps/web` deps.

2. **react-dnd 16 is patched for React 19** (`patches/react-dnd@16.0.1.patch`):
   `cloneWithRef` reads `element.props?.ref ?? element.ref` (React 19 removed
   `element.ref`). Durable via bun `patchedDependencies`.

## The drag-killer class of bug (READ THIS)

**Chrome aborts an HTML5 drag on frame one if the drag SOURCE element's box changes
— position, size, or interactivity — during the `dragstart` paint tick.** Symptom in
our trace tooling: `dragstart → dragend` immediately, `dropEffect=none`, **no
`dragover` at all**. The drag "can't leave the pane" / "the grab pointer goes."
(react-dnd #1085, #477, #2177; Chromium bug 168544.)

Why mosaic is uniquely exposed: on drag start react-mosaic runs
`defer(() => mosaicActions.hide(path))` (a ~1ms `setTimeout`) that collapses the
dragged pane. Our drag source is the **full-tile overlay** (`renderToolbar` returns
`<div className="absolute inset-0 …">`), so it is coextensive with the pane that
collapses. Anything that makes that collapse *visible to Chrome during dragstart*
kills the drag.

### Confirmed killers (do NOT reintroduce)

1. **`.sphynx-mosaic.-dragging .mosaic-window-toolbar { pointer-events: none }`** —
   THE one that cost us the most. react-mosaic adds the `.-dragging` class **during
   dragstart**; toggling `pointer-events` on the drag source's container mid-dragstart
   makes Chrome abort. Bisected to this exact rule. **Never gate anything on
   `.-dragging` that touches the toolbar/overlay.**

2. **`transition` on `.mosaic-tile` `top/right/bottom/left`.** react-mosaic positions
   tiles via inline top/right/bottom/left %. Animating those means `hide()`'s collapse
   *animates* over the transition duration → the source box is mid-animation during
   dragstart → abort. (This was our original "cards-on-canvas" motion; it's the reason
   the very first version broke.) If you want tile motion, drive it some other way, or
   only transition when NOT dragging.

3. **Off-screen drag preview.** `.mosaic-pane-preview { top: -9999px }` makes Chrome
   fail the drag-image screenshot and abort. The preview node must be **on-screen and
   painted** (`top: 0`, real size). It follows the cursor as the drag image, so being
   briefly visible top-left on grab is fine.

4. **Text-drag hijack.** If the pane body text is selectable, pressing a text row
   starts a native TEXT drag (dragstart carries `text/plain`) which instantly aborts.
   Fix: `[data-arranging] .mosaic-window-body { pointer-events: none; user-select:
   none; -webkit-user-drag: none }`. Gate on **`[data-arranging]`** (our toggle,
   present before the drag) — NOT `.-dragging` (see #1).

### Safe patterns

- Gate arrange affordances on our **`[data-arranging]`** attribute, which is set on
  the container BEFORE any drag begins — never on react-mosaic's `.-dragging`.
- The full-tile overlay drag source is fine **as long as nothing changes its box or
  pointer-events during dragstart.** Rings/washes via `box-shadow`/`::after` on the
  body are safe (they don't move the source box).
- Drop zones need to sit above the pane body during drag so drops land — but do it
  with z-index, not by disabling pointer-events on the source.

## Debugging method that actually worked

Everything synthetic (dispatched `DragEvent`s, CDP mouse, the DevTools drag tool)
**cannot** reproduce a real HTML5 drag — Chrome won't promote them to native drags,
so they always "pass" while the real drag fails. What worked:

1. **On-screen event tracer** persisted to `localStorage` (`DragDebugPanel`) so a
   real human drag's `pointerdown → dragstart → dragover → drop → dragend` sequence
   (with `dataTransfer.types` and `dropEffect`) is readable afterward. The
   signature `dragstart → dragend, dropEffect=none, no dragover` = the killer class.
2. **Strip-down + rebuild block by block.** Reduce to bare `<Mosaic>` defaults until
   drag works, then add back one block at a time, testing a real drag after each,
   until the offending block/rule reveals itself. This is how we found the
   `.-dragging` pointer-events rule — theorizing never did.

Note: the automation browser (Claude/DevTools MCP) is a SEPARATE Chrome instance
from the one a human tests in — different localStorage. To read a human's real drag
trace, read it from THEIR browser, or persist to localStorage and have them paste /
screenshot it.

## Verifying the manager is healthy (paste in console)

```js
const host = document.querySelector('.sphynx-mosaic');
let f = host[Object.keys(host).find(k=>k.startsWith('__reactFiber'))];
let mgr; for (;f;f=f.return){const n=f.type?.name;if(n&&/DndProvider/.test(n)){mgr=f.memoizedProps.manager?.dragDropManager||f.memoizedProps.manager;break;}}
const b = mgr.getBackend();
console.log(b.constructor.name, b.rootElement===window?'root=window':'BAD', 'sources', b.sourceNodes.size);
// want: HTML5BackendImpl root=window sources=3 (in arrange mode)
```
