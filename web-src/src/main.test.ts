import { describe, expect, it } from "vitest";
import type { DocumentState, EditorBridge, EditorTarget, EditorViewport, HighlightSpan } from "./bridge";
import { start, type CanvasLike, type PointerLike, type WheelLike } from "./main";
import { fakeCtx } from "./testing";

const TARGET: EditorTarget = { path: "/p/a.rs", language: "rust", version: 7, lineCount: 100 };
const VIEWPORT: EditorViewport = {
  firstLine: 0,
  lastLine: 10,
  lineCount: 100,
  scrollTop: 0,
  scrollHeight: 1000,
  clientHeight: 200,
};
const SPAN: HighlightSpan = { from: 0, to: 2, color: "rgb(200, 60, 60)" };

interface Pending {
  from: number;
  to: number;
  resolve: (spans: HighlightSpan[][]) => void;
}

function harness(opts: { manual?: boolean; height?: number; lines?: number } = {}) {
  const lines = opts.lines ?? 100;
  const log: string[] = [];
  const pending: Pending[] = [];
  const highlightCalls: Array<[number, number]> = [];
  const scrollCalls: number[] = [];
  const scrollByCalls: number[] = [];
  const captures: number[] = [];
  const handlers = {
    target: [] as Array<(t: EditorTarget | null) => void>,
    change: [] as Array<(s: DocumentState) => void>,
    viewport: [] as Array<(v: EditorViewport) => void>,
    highlights: [] as Array<(r: { fromLine: number; toLine: number }) => void>,
  };
  let target: EditorTarget | null = { ...TARGET, lineCount: lines };
  let doc: DocumentState = { version: 7, text: Array(lines).fill("fn main() {}").join("\n") };
  let viewport: EditorViewport = { ...VIEWPORT, lineCount: lines };
  let captureThrows = false;
  let wheelOpts: { passive: boolean } | null = null;

  const editor: EditorBridge = {
    get: async () => {
      log.push("get");
      return target;
    },
    onTarget: (fn) => handlers.target.push(fn),
    document: {
      get: async () => {
        log.push("document.get");
        return doc;
      },
      onChange: (fn) => handlers.change.push(fn),
    },
    viewport: async () => {
      log.push("viewport");
      return viewport;
    },
    onViewport: (fn) => handlers.viewport.push(fn),
    scrollTo: async (line) => {
      scrollCalls.push(line);
    },
    scrollBy: async (px) => {
      scrollByCalls.push(px);
    },
    highlights: (from, to) => {
      log.push(`highlights:${from}:${to}`);
      highlightCalls.push([from, to]);
      const spans = () => Array.from({ length: to - from }, () => [SPAN]);
      if (opts.manual) return new Promise<HighlightSpan[][]>((resolve) => pending.push({ from, to, resolve }));
      return Promise.resolve(spans());
    },
    onHighlights: (fn) => handlers.highlights.push(fn),
  };

  const ctx = fakeCtx();
  const listeners = new Map<string, Array<(e: PointerLike | WheelLike) => void>>();
  const canvas: CanvasLike = {
    clientWidth: 120,
    clientHeight: opts.height ?? 300,
    width: 0,
    height: 0,
    getContext: () => ctx,
    setPointerCapture: (id) => {
      if (captureThrows) throw new Error("synthetic pointer");
      captures.push(id);
    },
    addEventListener: ((type: string, fn: (e: PointerLike | WheelLike) => void, o?: { passive: boolean }) => {
      if (type === "wheel") wheelOpts = o ?? null;
      const list = listeners.get(type) ?? [];
      list.push(fn);
      listeners.set(type, list);
    }) as CanvasLike["addEventListener"],
  };

  const queue: Array<() => void> = [];
  let resizeFn = () => {};
  let themeFn = () => {};
  const deps = {
    canvas,
    editor,
    themeVar: (n: string) =>
      n === "--openidea-fg-muted" ? "rgb(120, 120, 120)" : n === "--openidea-border" ? "rgb(38, 40, 44)" : "rgb(80, 140, 220)",
    raf: (fn: () => void) => {
      queue.push(fn);
    },
    observeResize: (fn: () => void) => {
      resizeFn = fn;
    },
    onThemeChange: (fn: () => void) => {
      themeFn = fn;
    },
    dpr: () => 1,
  };

  const tick = () => new Promise((r) => setTimeout(r, 0));
  const flush = () => {
    for (let i = 0; queue.length && i < 100; i++) queue.shift()!();
  };
  async function settle() {
    await tick();
    flush();
    await tick();
    flush();
  }
  const emit = (type: string, e: PointerLike | WheelLike) => {
    for (const fn of listeners.get(type) ?? []) fn(e);
  };

  return {
    ctx,
    log,
    pending,
    highlightCalls,
    scrollCalls,
    scrollByCalls,
    captures,
    handlers,
    queue,
    flush,
    settle,
    tick,
    emit,
    start: () => start(deps),
    setTarget: (t: EditorTarget | null) => {
      target = t;
    },
    wheelOpts: () => wheelOpts,
    setCaptureThrows: (v: boolean) => {
      captureThrows = v;
    },
    resize: () => resizeFn(),
    theme: () => themeFn(),
    resolvePending: () => {
      for (const p of pending.splice(0)) p.resolve(Array.from({ length: p.to - p.from }, () => [SPAN]));
    },
  };
}

describe("start", () => {
  it("reads target, document and viewport in order, then colours the slice", async () => {
    const h = harness();
    h.start();
    await h.settle();
    expect(h.log.slice(0, 3)).toEqual(["get", "document.get", "viewport"]);
    expect(h.highlightCalls).toEqual([[0, 100]]);
    expect(h.ctx.transforms[0]).toEqual([1, 0, 0, 1, 0, 0]);
    expect(h.ctx.fills.some((f) => f.style === SPAN.color)).toBe(true);
  });

  it("clears the map when the group shows no editor", async () => {
    const h = harness();
    h.start();
    await h.settle();
    h.ctx.fills.length = 0;
    h.setTarget(null);
    for (const fn of h.handlers.target) fn(null);
    await h.settle();
    expect(h.ctx.fills).toEqual([{ x: 119, y: 0, w: 1, h: 300, style: "rgb(38, 40, 44)", alpha: 1 }]);
    expect(h.ctx.clears.at(-1)).toEqual([0, 0, 120, 300]);
    h.emit("pointerdown", { offsetY: 50, pointerId: 1 });
    expect(h.scrollCalls).toEqual([]);
  });

  it("fetches a long slice in bridge-sized chunks and dedupes in-flight loads", async () => {
    const h = harness({ manual: true, lines: 5000, height: 10000 });
    h.start();
    await h.settle();
    expect(h.highlightCalls).toEqual([[0, 2000]]);
    h.resize();
    await h.settle();
    expect(h.highlightCalls).toEqual([[0, 2000]]);
    h.resolvePending();
    await h.settle();
    expect(h.highlightCalls).toEqual([
      [0, 2000],
      [2000, 3334],
    ]);
    h.resolvePending();
    await h.settle();
    expect(h.highlightCalls).toEqual([
      [0, 2000],
      [2000, 3334],
    ]);
    expect(h.pending).toEqual([]);
  });

  it("refetches only the invalidated range", async () => {
    const h = harness();
    h.start();
    await h.settle();
    h.highlightCalls.length = 0;
    for (const fn of h.handlers.highlights) fn({ fromLine: 10, toLine: 20 });
    await h.settle();
    expect(h.highlightCalls).toEqual([[10, 20]]);
  });

  it("drops a load that finishes after an edit bumped the version", async () => {
    const h = harness({ manual: true });
    h.start();
    await h.settle();
    expect(h.pending.length).toBe(1);
    for (const fn of h.handlers.change) fn({ version: 8, text: "a\nb" });
    expect(h.queue.length).toBe(1);
    h.resolvePending();
    await h.tick();
    expect(h.queue.length).toBe(1);
    h.flush();
    await h.settle();
    expect(h.highlightCalls).toEqual([[0, 100]]);
    expect(h.pending).toEqual([]);
  });

  it("keeps the document version across viewport updates", async () => {
    const h = harness({ manual: true });
    h.start();
    await h.settle();
    for (const fn of h.handlers.viewport) fn({ ...VIEWPORT, scrollTop: 100 });
    h.resolvePending();
    await h.tick();
    expect(h.queue.length).toBe(1);
  });

  it("swaps the text on change, keeping colours until the host invalidates them", async () => {
    const h = harness();
    h.start();
    await h.settle();
    h.ctx.fills.length = 0;
    for (const fn of h.handlers.change) fn({ version: 9, text: "x\ny\nz" });
    await h.settle();
    expect(h.ctx.fills.filter((f) => f.alpha === 0.2)).toEqual([
      { x: 0, y: 0, w: 1, h: 2.5, style: "rgb(120, 120, 120)", alpha: 0.2 },
      { x: 0, y: 3, w: 1, h: 2.5, style: "rgb(120, 120, 120)", alpha: 0.2 },
      { x: 0, y: 6, w: 1, h: 2.5, style: "rgb(120, 120, 120)", alpha: 0.2 },
    ]);
    for (const fn of h.handlers.highlights) fn({ fromLine: 0, toLine: 3 });
    await h.settle();
    expect(h.highlightCalls.at(-1)).toEqual([0, 3]);
  });

  it("drags the frame from inside, and stops on pointerup", async () => {
    const h = harness({ lines: 1000 });
    h.start();
    await h.settle();
    h.emit("pointerdown", { offsetY: 5, pointerId: 3 });
    expect(h.captures).toEqual([3]);
    expect(h.scrollCalls.at(-1)).toBe(0);
    h.emit("pointermove", { offsetY: 145, pointerId: 3 });
    expect(h.scrollCalls.at(-1)).toBeCloseTo((140 / 270) * 990, 6);
    h.emit("pointerup", { offsetY: 145, pointerId: 3 });
    const n = h.scrollCalls.length;
    h.emit("pointermove", { offsetY: 200, pointerId: 3 });
    expect(h.scrollCalls.length).toBe(n);
  });

  it("centres the viewport when pressed outside the frame", async () => {
    const h = harness({ lines: 1000 });
    h.start();
    await h.settle();
    h.emit("pointerdown", { offsetY: 200, pointerId: 1 });
    expect(h.scrollCalls.at(-1)).toBeCloseTo((185 / 270) * 990, 6);
  });

  it("drags even when pointer capture is unavailable, and stops on cancel", async () => {
    const h = harness({ lines: 1000 });
    h.setCaptureThrows(true);
    h.start();
    await h.settle();
    h.emit("pointerdown", { offsetY: 5, pointerId: 9 });
    expect(h.scrollCalls.length).toBe(1);
    h.emit("pointercancel", { offsetY: 5, pointerId: 9 });
    h.emit("pointermove", { offsetY: 100, pointerId: 9 });
    expect(h.scrollCalls.length).toBe(1);
  });

  it("scrolls the editor on wheel without scrolling the panel", async () => {
    const h = harness();
    h.start();
    await h.settle();
    let prevented = 0;
    h.emit("wheel", {
      deltaY: 120,
      preventDefault: () => {
        prevented++;
      },
    });
    expect(h.scrollByCalls).toEqual([120]);
    expect(prevented).toBe(1);
    expect(h.wheelOpts()).toEqual({ passive: false });
  });

  it("redraws on theme change and resize, coalesced per frame", async () => {
    const h = harness();
    h.start();
    await h.settle();
    h.theme();
    h.theme();
    expect(h.queue.length).toBe(1);
    h.flush();
    h.resize();
    expect(h.queue.length).toBe(1);
  });
});
