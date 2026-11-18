import type { EditorViewport } from "./bridge";

/** Pixels per line of the map; one pixel per character column. */
export const LINE = 3;
/** The bridge serves highlights at most this many lines per call. */
export const CHUNK = 2000;

/** The viewport as the page tracks it, stamped with the document version it was read at. */
export interface ViewState extends EditorViewport {
  version: number;
}

/** Where the map sits inside the panel, and where the visible area sits inside the map. */
export interface Layout {
  /** Panel height in pixels. */
  H: number;
  /** How far the map is slid up, when it is taller than the panel. */
  offset: number;
  /** Top of the viewport frame, in panel pixels. */
  top: number;
  height: number;
  /** The travel of the frame's top: pressing at `range` means the last line. */
  range: number;
  visible: number;
  L: number;
}

export function layout(view: ViewState | null, H: number): Layout {
  if (!view) return { H, offset: 0, top: 0, height: 0, range: 1, visible: 0, L: 1 };
  const L = Math.max(1, view.lineCount);
  const visible = Math.max(0, view.lastLine - view.firstLine);
  const scrollable = Math.max(1, view.scrollHeight - view.clientHeight);
  const p = Math.min(1, Math.max(0, view.scrollTop / scrollable));
  const mapH = L * LINE;
  const offset = p * Math.max(0, mapH - H);
  const range = Math.max(1, Math.min(H, mapH) - visible * LINE);
  return { H, offset, top: view.firstLine * LINE - offset, height: visible * LINE, range, visible, L };
}

/** The line to put at the top of the editor when the frame's top is pressed at `frameTop`. */
export function frameTopToLine(l: Layout, frameTop: number): number {
  const p = Math.min(1, Math.max(0, frameTop / l.range));
  return p * Math.max(0, l.L - l.visible);
}

/** The lines the panel currently shows, as a half-open range into the text. */
export function visibleSlice(offset: number, H: number, textLength: number): { first: number; last: number } {
  return { first: Math.floor(offset / LINE), last: Math.min(textLength, Math.ceil((offset + H) / LINE)) };
}

/** `[from, to)` split into bridge-sized calls. */
export function chunks(from: number, to: number, size = CHUNK): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let at = from; at < to; at += size) out.push([at, Math.min(to, at + size)]);
  return out;
}

/** Whether a highlight colour is a grey: plain text and comments stay faint. */
export function isGrey(color: string): boolean {
  const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(color);
  return !!m && Math.max(+m[1], +m[2], +m[3]) - Math.min(+m[1], +m[2], +m[3]) < 24;
}
