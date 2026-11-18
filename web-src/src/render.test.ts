import { describe, expect, it } from "vitest";
import type { HighlightSpan } from "./bridge";
import { layout, type ViewState } from "./map";
import { paint } from "./render";
import { fakeCtx } from "./testing";

const MUTED = "rgb(120, 120, 120)";
const ACCENT = "rgb(80, 140, 220)";
const BORDER = "rgb(38, 40, 44)";
const EDGE = { x: 119, y: 0, w: 1, h: 300, style: BORDER, alpha: 1 };

const view = (over: Partial<ViewState> = {}): ViewState => ({
  firstLine: 0,
  lastLine: 1,
  lineCount: 1,
  scrollTop: 0,
  scrollHeight: 2,
  clientHeight: 2,
  version: 1,
  ...over,
});

function input(over: Partial<Parameters<typeof paint>[1]> = {}) {
  return {
    W: 120,
    H: 300,
    l: layout(view(), 300),
    text: ["hello world"],
    colors: new Map<number, HighlightSpan[]>(),
    muted: MUTED,
    accent: ACCENT,
    border: BORDER,
    dragging: false,
    ...over,
  };
}

describe("paint", () => {
  it("only clears and draws the right edge without a view", () => {
    const ctx = fakeCtx();
    expect(paint(ctx, input({ l: null }))).toBeNull();
    expect(ctx.clears).toEqual([[0, 0, 120, 300]]);
    expect(ctx.fills).toEqual([EDGE]);
  });

  it("draws faint word blocks and reports missing colours", () => {
    const ctx = fakeCtx();
    expect(paint(ctx, input())).toEqual([0, 1]);
    expect(ctx.fills.filter((f) => f.alpha === 0.2)).toEqual([
      { x: 0, y: 0, w: 5, h: 2.5, style: MUTED, alpha: 0.2 },
      { x: 6, y: 0, w: 5, h: 2.5, style: MUTED, alpha: 0.2 },
    ]);
    expect(ctx.fills[0]).toEqual(EDGE);
  });

  it("draws coloured spans at full alpha and skips grey ones", () => {
    const ctx = fakeCtx();
    const colors = new Map<number, HighlightSpan[]>([
      [0, [
        { from: 0, to: 5, color: "rgb(200, 60, 60)" },
        { from: 6, to: 11, color: "rgb(120, 122, 124)" },
      ]],
    ]);
    expect(paint(ctx, input({ colors }))).toBeNull();
    expect(ctx.fills).toContainEqual({ x: 0, y: 0, w: 5, h: 2.5, style: "rgb(200, 60, 60)", alpha: 1 });
    expect(ctx.fills.some((f) => f.style === "rgb(120, 122, 124)")).toBe(false);
  });

  it("marks the visible area with a translucent block, stronger while dragging", () => {
    const calm = fakeCtx();
    paint(calm, input());
    expect(calm.fills).toHaveLength(4);
    expect(calm.fills[0]).toEqual(EDGE);
    expect(calm.fills.at(-1)).toEqual({ x: 0, y: 0, w: 120, h: 4, style: ACCENT, alpha: 0.1 });
    const held = fakeCtx();
    paint(held, input({ dragging: true }));
    expect(held.fills.at(-1)).toEqual({ x: 0, y: 0, w: 120, h: 4, style: ACCENT, alpha: 0.2 });
    expect(held.globalAlpha).toBe(1);
  });

  it("reports the missing slice of a long file", () => {
    const ctx = fakeCtx();
    const colors = new Map<number, HighlightSpan[]>();
    for (let i = 0; i < 60; i++) colors.set(i, []);
    const l = layout(view({ lineCount: 1000, lastLine: 10, scrollHeight: 2000, clientHeight: 300 }), 300);
    expect(paint(ctx, input({ l, text: Array(1000).fill("x"), colors }))).toEqual([60, 100]);
  });
});
