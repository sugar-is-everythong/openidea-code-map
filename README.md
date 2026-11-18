# code-map

A minimap beside every text editor, in the spirit of CodeGlance Pro: the whole
file at three pixels per line, coloured with the editor's own syntax colours, with
the visible area tinted on it.

中文简介：每个文本编辑器右侧的代码缩略图（CodeGlance 式），用编辑器真实的语法着色；
半透明色块标示当前可见区域，可拖拽、点击跳转、滚轮滚动编辑器；背景与编辑区同色，
右缘有分割线。宽度 120、每行 3 像素为固定参数。

- **Drag the tinted block** to scroll the file; the block deepens while held.
- **Press anywhere else** on the map to centre the editor there.
- **Wheel over the map** scrolls the editor, not the map.

The map slides when the file is taller than the panel, so the block always stays
inside it. The map carries no colour of its own: the page paints the IDE's editor
background (an undeclared iframe background would show up white) and the visible
area is a translucent block — 10% of the accent colour, 20% while dragged — light
enough that the code beneath reads through. The IDE draws the separator on the
editor side; the map draws its own 1px line on the right, so it does not melt into
the activity bar.
Colours are the editor's real highlight tree, fetched lazily for the
lines the panel shows (2000 lines per call) and refreshed when the IDE
invalidates them; plain text and comments stay faint grey. Switching tabs loads
the new file, a non-text editor hides the panel, and a theme change recolours
both the map and the frame.

Grant: `editor.read`. Needs the plugin API 1.10, so it installs on OpenIDEA
0.1.47 and on anything newer. The panel is a web page only — no WebAssembly
component — and declares one `editorPanels` contribution, 120 pixels wide at the
right edge of each editor group.

## What this plugin does not do

- No settings: width (120) and pixels per line (3) are fixed at declaration
  time. A toggle or a width slider needs a wasm side and a newer API surface;
  the panel's iframe has an opaque origin, so it cannot even remember a choice
  in `localStorage`.
- No caret or selection marker, and no hover preview of the original text: the
  editor-panel bridge exposes neither.
- Tab indentation is drawn one pixel per UTF-16 unit, not per editor tab stop,
  so indented blocks sit slightly left of where the editor shows them.

## Building

From the repository root:

```sh
pnpm --dir web-src install --frozen-lockfile
pnpm --dir web-src build
pnpm --dir web-src test
```

The first command installs `web-src/` (its `pnpm-lock.yaml` is committed); the
second builds the page into `web/`, which is gitignored but must exist before
packaging. The tests run in node against recording fakes of the canvas and the
bridge; no DOM is needed.

Install it through Settings › Plugins › Install from Disk — the plugin folder, a
`.zip` of it (`plugin.toml`, `README.md` and `web/` at the root, `web-src/` left
out), or the signed `sugar-is-everythong.code-map-0.1.0.oiplugin` from a release.
See the [plugin guide](https://github.com/l0ng-ai/openidea/blob/main/plugins/README.md).
