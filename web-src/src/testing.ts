import type { PaintContext } from "./render";

export interface Fill {
  x: number;
  y: number;
  w: number;
  h: number;
  style: string;
  alpha: number;
}

export interface FakeCtx extends PaintContext {
  fillStyle: string;
  fills: Fill[];
  clears: number[][];
  transforms: number[][];
}

/** A recording stand-in for CanvasRenderingContext2D. */
export function fakeCtx(): FakeCtx {
  const ctx: FakeCtx = {
    fillStyle: "",
    globalAlpha: 1,
    fills: [],
    clears: [],
    transforms: [],
    setTransform(...a: number[]) {
      ctx.transforms.push(a);
    },
    clearRect(...a: number[]) {
      ctx.clears.push(a);
    },
    fillRect(x, y, w, h) {
      ctx.fills.push({ x, y, w, h, style: ctx.fillStyle, alpha: ctx.globalAlpha });
    },
  };
  return ctx;
}
