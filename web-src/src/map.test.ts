import { describe, expect, it } from "vitest";
import type { ViewState } from "./map";
import { CHUNK, chunks, frameTopToLine, isGrey, layout, visibleSlice } from "./map";

const view = (over: Partial<ViewState> = {}): ViewState => ({
  firstLine: 0,
  lastLine: 10,
  lineCount: 100,
  scrollTop: 0,
  scrollHeight: 1000,
  clientHeight: 200,
  version: 1,
  ...over,
});

describe("layout", () => {
  it("is zeroed without a view", () => {
    expect(layout(null, 300)).toEqual({ H: 300, offset: 0, top: 0, height: 0, range: 1, visible: 0, L: 1 });
  });

  it("does not slide a map shorter than the panel", () => {
    const l = layout(view({ lineCount: 100 }), 300);
    expect(l.offset).toBe(0);
    expect(l.top).toBe(0);
    expect(l.height).toBe(30);
    expect(l.range).toBe(270);
    expect(l.L).toBe(100);
  });

  it("slides a tall map with the scroll position", () => {
    const tall = { lineCount: 1000, scrollHeight: 2000, clientHeight: 300, lastLine: 10 };
    expect(layout(view({ ...tall, scrollTop: 0, firstLine: 0 }), 300)).toMatchObject({ offset: 0, top: 0, range: 270 });
    const mid = layout(view({ ...tall, scrollTop: 850, firstLine: 495, lastLine: 505 }), 300);
    expect(mid.offset).toBe(1350);
    expect(mid.top).toBe(135);
    const end = layout(view({ ...tall, scrollTop: 1700, firstLine: 990, lastLine: 1000 }), 300);
    expect(end.offset).toBe(2700);
    expect(end.top).toBe(270);
    expect(end.top + end.height).toBe(300);
  });

  it("clamps the scroll progress and the scrollable span", () => {
    const tall = { lineCount: 1000, scrollHeight: 2000, clientHeight: 300 };
    expect(layout(view({ ...tall, scrollTop: -50 }), 300).offset).toBe(0);
    expect(layout(view({ ...tall, scrollTop: 99999 }), 300).offset).toBe(2700);
    expect(layout(view({ scrollHeight: 200, clientHeight: 200, scrollTop: 0 }), 300).offset).toBe(0);
  });

  it("handles an empty visible span and fractional lines", () => {
    const none = layout(view({ firstLine: 5, lastLine: 5 }), 300);
    expect(none.visible).toBe(0);
    expect(none.height).toBe(0);
    expect(none.range).toBe(300);
    const frac = layout(view({ firstLine: 10.5, lastLine: 20.25 }), 300);
    expect(frac.visible).toBeCloseTo(9.75);
    expect(frac.height).toBeCloseTo(29.25);
    expect(frac.top).toBeCloseTo(31.5);
  });
});

describe("frameTopToLine", () => {
  const l = layout(view({ lineCount: 1000, scrollHeight: 2000, clientHeight: 300 }), 300);

  it("maps the ends of the travel to the ends of the file", () => {
    expect(frameTopToLine(l, 0)).toBe(0);
    expect(frameTopToLine(l, l.range)).toBe(990);
    expect(frameTopToLine(l, l.range / 2)).toBe(495);
  });

  it("clamps outside the travel and is monotonic", () => {
    expect(frameTopToLine(l, -10)).toBe(0);
    expect(frameTopToLine(l, 10000)).toBe(990);
    expect(frameTopToLine(l, 100)).toBeLessThan(frameTopToLine(l, 200));
  });

  it("round-trips a consistent viewport", () => {
    const mid = layout(view({ lineCount: 1000, scrollHeight: 2000, clientHeight: 300, scrollTop: 850, firstLine: 495, lastLine: 505 }), 300);
    expect(frameTopToLine(mid, mid.top)).toBeCloseTo(495);
  });
});

describe("visibleSlice", () => {
  it("covers the panel and clamps to the text", () => {
    expect(visibleSlice(0, 300, 1000)).toEqual({ first: 0, last: 100 });
    expect(visibleSlice(850, 300, 1000)).toEqual({ first: 283, last: 384 });
    expect(visibleSlice(1700, 300, 1000)).toEqual({ first: 566, last: 667 });
    expect(visibleSlice(0, 300, 10)).toEqual({ first: 0, last: 10 });
  });
});

describe("chunks", () => {
  it("splits at the bridge limit", () => {
    expect(chunks(0, 5000)).toEqual([
      [0, CHUNK],
      [CHUNK, 2 * CHUNK],
      [2 * CHUNK, 5000],
    ]);
    expect(chunks(0, 100)).toEqual([[0, 100]]);
    expect(chunks(3, 3)).toEqual([]);
  });
});

describe("isGrey", () => {
  it("treats a channel spread below 24 as grey", () => {
    expect(isGrey("rgb(100, 100, 123)")).toBe(true);
    expect(isGrey("rgb(100, 100, 124)")).toBe(false);
    expect(isGrey("rgba(10, 20, 30, 0.5)")).toBe(true);
    expect(isGrey("rgb(255, 0, 0)")).toBe(false);
    expect(isGrey("#aabbcc")).toBe(false);
    expect(isGrey("")).toBe(false);
  });
});
