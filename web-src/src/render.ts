import type { HighlightSpan } from "./bridge";
import { isGrey, LINE, visibleSlice, type Layout } from "./map";

/** The 2D context calls the map uses, so a recording fake can stand in for canvas. */
export interface PaintContext {
  setTransform(a: number, b: number, c: number, d: number, e: number, f: number): void;
  clearRect(x: number, y: number, w: number, h: number): void;
  fillRect(x: number, y: number, w: number, h: number): void;
  fillStyle: string | CanvasGradient | CanvasPattern;
  globalAlpha: number;
}

export interface PaintInput {
  W: number;
  H: number;
  l: Layout | null;
  text: string[];
  colors: Map<number, HighlightSpan[]>;
  muted: string;
  accent: string;
  border: string;
  dragging: boolean;
}

/**
 * Paints the visible slice of the file and the viewport frame. Returns the
 * half-open line range whose colours are still missing, or null when complete.
 */
export function paint(ctx: PaintContext, input: PaintInput): [number, number] | null {
  const { W, H, l, text, colors, muted, accent, border, dragging } = input;
  ctx.clearRect(0, 0, W, H);
  // The IDE draws the line on the editor side only; this one separates the map
  // from whatever sits to its right.
  ctx.globalAlpha = 1;
  ctx.fillStyle = border;
  ctx.fillRect(W - 1, 0, 1, H);
  if (!l) return null;
  const { first, last } = visibleSlice(l.offset, H, text.length);
  const missing: number[] = [];
  for (let i = first; i < last; i++) {
    const y = i * LINE - l.offset;
    const line = text[i] || "";
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = muted;
    for (const m of line.matchAll(/\S+/g)) ctx.fillRect(m.index ?? 0, y, m[0].length, LINE - 0.5);
    ctx.globalAlpha = 1;
    const spans = colors.get(i);
    if (!spans) missing.push(i);
    else
      for (const s of spans) {
        if (isGrey(s.color)) continue;
        ctx.fillStyle = s.color;
        ctx.fillRect(s.from, y, s.to - s.from, LINE - 0.5);
      }
  }
  // A tinted block, not an outline: light enough that the code beneath reads through.
  const frameH = Math.max(l.height, 4);
  ctx.fillStyle = accent;
  ctx.globalAlpha = dragging ? 0.2 : 0.1;
  ctx.fillRect(0, l.top, W, frameH);
  ctx.globalAlpha = 1;
  return missing.length ? [missing[0], missing[missing.length - 1] + 1] : null;
}
