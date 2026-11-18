/**
 * The editor-panel half of the IDE's frame bridge (`window.openidea`), which
 * the IDE injects before the page's scripts. Shapes follow the host's ops:
 * `src/features/plugins/views/WebView.tsx` and `frame-bridge.js`.
 */

export interface DocumentState {
  version: number;
  text: string;
}

/** The group's file, or null when the group shows no text editor. */
export interface EditorTarget {
  path: string;
  language: string;
  version: number;
  lineCount: number;
}

/** 0-based, fractional lines; pixels for the scroll geometry. */
export interface EditorViewport {
  firstLine: number;
  lastLine: number;
  lineCount: number;
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
}

/** One coloured run of a line; columns are UTF-16 code units. */
export interface HighlightSpan {
  from: number;
  to: number;
  color: string;
}

export interface EditorBridge {
  get(): Promise<EditorTarget | null>;
  onTarget(fn: (target: EditorTarget | null) => void): void;
  document: {
    get(): Promise<DocumentState>;
    onChange(fn: (state: DocumentState) => void): void;
  };
  viewport(): Promise<EditorViewport>;
  onViewport(fn: (viewport: EditorViewport) => void): void;
  /** Scrolls so that (fractional) `line` is at the top of the visible area. */
  scrollTo(line: number): Promise<void>;
  scrollBy(pixels: number): Promise<void>;
  /** Syntax colours of `[fromLine, toLine)`, at most 2000 lines per call. */
  highlights(fromLine: number, toLine: number): Promise<HighlightSpan[][]>;
  onHighlights(fn: (range: { fromLine: number; toLine: number }) => void): void;
}

export interface FrameTheme {
  dark: boolean;
  vars: Readonly<Record<string, string>>;
}

export interface OpenideaBridge {
  readonly theme: FrameTheme | null;
  onThemeChange(fn: (theme: FrameTheme) => void): void;
  /** Only present in an editor panel (`?openidea=editor-panel`). */
  editor?: EditorBridge;
}

/** A theme colour as the IDE resolved it, e.g. `rgb(122, 130, 141)`. */
export function themeVar(name: string): string {
  return window.openidea?.theme?.vars[name] ?? "";
}
