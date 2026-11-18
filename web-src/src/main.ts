import { themeVar, type EditorBridge, type HighlightSpan } from "./bridge";
import { chunks, frameTopToLine, layout, type ViewState } from "./map";
import { paint, type PaintContext } from "./render";

export interface PointerLike {
  offsetY: number;
  pointerId: number;
}

export interface WheelLike {
  deltaY: number;
  preventDefault(): void;
}

export interface CanvasLike {
  clientWidth: number;
  clientHeight: number;
  width: number;
  height: number;
  getContext(kind: "2d"): PaintContext | null;
  setPointerCapture(id: number): void;
  addEventListener(type: "wheel", fn: (e: WheelLike) => void, opts: { passive: boolean }): void;
  addEventListener(
    type: "pointerdown" | "pointermove" | "pointerup" | "pointercancel",
    fn: (e: PointerLike) => void,
  ): void;
}

export interface Deps {
  canvas: CanvasLike;
  editor: EditorBridge;
  themeVar: (name: string) => string;
  raf: (fn: () => void) => void;
  observeResize: (fn: () => void) => void;
  onThemeChange: (fn: () => void) => void;
  dpr: () => number;
}

export function start(deps: Deps): void {
  const { canvas, editor } = deps;
  let text: string[] = [];
  let colors = new Map<number, HighlightSpan[]>();
  const loading = new Set<string>();
  let view: ViewState | null = null;
  let drag: { grab: number } | null = null;
  let queued = false;

  function redraw(): void {
    if (queued) return;
    queued = true;
    deps.raf(draw);
  }

  function draw(): void {
    queued = false;
    const dpr = deps.dpr();
    const W = canvas.clientWidth;
    const H = canvas.clientHeight;
    if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const missing = paint(ctx, {
      W,
      H,
      l: view ? layout(view, H) : null,
      text,
      colors,
      muted: deps.themeVar("--openidea-fg-muted"),
      accent: deps.themeVar("--openidea-accent"),
      border: deps.themeVar("--openidea-border"),
      dragging: !!drag,
    });
    if (missing) void load(missing[0], missing[1]);
  }

  async function load(from: number, to: number): Promise<void> {
    const key = `${from}:${to}`;
    if (loading.has(key)) return;
    loading.add(key);
    const target = view ? view.version : 0;
    try {
      for (const [a, b] of chunks(from, to)) {
        const lines = await editor.highlights(a, b);
        lines.forEach((spans, i) => colors.set(a + i, spans));
      }
    } finally {
      loading.delete(key);
    }
    if (view && view.version === target) redraw();
  }

  async function reload(): Promise<void> {
    const target = await editor.get();
    colors = new Map();
    text = [];
    if (!target) {
      view = null;
      return redraw();
    }
    const doc = await editor.document.get();
    text = doc.text.split("\n");
    view = Object.assign(await editor.viewport(), { version: target.version });
    redraw();
  }

  editor.onTarget(() => void reload());
  editor.document.onChange((doc) => {
    text = doc.text.split("\n");
    if (view) view.version = doc.version;
    redraw();
  });
  editor.onViewport((v) => {
    view = Object.assign(v, { version: view ? view.version : 0 });
    redraw();
  });
  editor.onHighlights(({ fromLine, toLine }) => {
    for (const k of [...colors.keys()]) if (k >= fromLine && k < toLine) colors.delete(k);
    redraw();
  });
  deps.onThemeChange(redraw);
  deps.observeResize(redraw);

  function scrollToFrameTop(frameTop: number): void {
    if (!view) return;
    void editor.scrollTo(frameTopToLine(layout(view, canvas.clientHeight), frameTop));
  }

  canvas.addEventListener("pointerdown", (e) => {
    if (!view) return;
    const { top, height } = layout(view, canvas.clientHeight);
    const grab = e.offsetY >= top && e.offsetY <= top + height ? e.offsetY - top : height / 2;
    drag = { grab };
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      // Synthetic pointers (tests) have no capture; dragging still works.
    }
    scrollToFrameTop(e.offsetY - grab);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (drag) scrollToFrameTop(e.offsetY - drag.grab);
  });
  const stop = () => {
    drag = null;
    redraw();
  };
  canvas.addEventListener("pointerup", stop);
  canvas.addEventListener("pointercancel", stop);
  canvas.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      void editor.scrollBy(e.deltaY);
    },
    { passive: false },
  );

  void reload();
}

if (typeof document !== "undefined" && typeof window !== "undefined") {
  const canvas = document.getElementById("map");
  const editor = window.openidea?.editor;
  if (canvas instanceof HTMLCanvasElement && editor) {
    start({
      canvas,
      editor,
      themeVar,
      raf: (fn) => requestAnimationFrame(fn),
      observeResize: (fn) => {
        new ResizeObserver(fn).observe(canvas);
      },
      onThemeChange: (fn) => window.openidea?.onThemeChange(fn),
      dpr: () => window.devicePixelRatio || 1,
    });
  }
}
