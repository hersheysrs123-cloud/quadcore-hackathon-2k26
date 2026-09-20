# Design — print, PDF and export previews

> Part of the [SocraticOS design system](../../DESIGN_SYSTEM.md). Print stylesheet, standalone HTML export and the pre-download preview (sections 7, 8, 29).

### 7. Print Stylesheet & PDF Export (`@media print`)
- **Page Layout**: Set to A4 with `margin: 1.2cm 1.5cm`, modern sans-serif typography (`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, system-ui, sans-serif, "Segoe UI Emoji"`), and interactive UI chrome (`aside`, `header`, `nav`, `button:not(.print-content)`, modals, timer HUDs, drag handles, table toolbar chrome) blanket-hidden.
- **Universal Solid Dark Text**: Enforces `color: #0f172a !important;` on `[data-editor-root] *`, `[data-block-id] *`, `[contenteditable]`, and all neutral ink / duck utilities (`.text-ink-*`, `.text-duck-*`), preventing faint inverted cyan/gray text on white paper.
- **Cover Banner**: Compact sleek banner rendering (`height: 60pt; max-height: 60pt; border-radius: 6pt; margin-bottom: 8pt;`) with exact background color / image preservation (`print-color-adjust: exact`) and interactive picker buttons suppressed.
- **Print Header & Emojis**: Note icon and title auto-wrap cleanly via print-rendered `<h1>` with native color emoji font fallback (`Segoe UI Emoji`, `Apple Color Emoji`, `Noto Color Emoji`) on both the note header and callout boxes.
- **Code Block Formatting & Syntax Highlighting**: Clean light card (`#f8fafc border border-slate-200`) with atomic page break protection (`break-inside: avoid !important; page-break-inside: avoid !important;`), pitch-black container backgrounds completely stripped, line numbers gutter on `#f1f5f9` with slate text `#94a3b8`, and 12 high-contrast token colors (keywords `#be185d`, types/functions `#0284c7`, strings `#059669`, comments `#64748b`, numbers `#d97706`, builtins `#2563eb`).
- **LaTeX Math Scaling**: Equations auto-scale via `clamp(8pt, 1.6vw, 11.5pt)` with complete suppression of horizontal scrollbars, and inline math pills rendered seamlessly without computer pill borders or background shading.
- **Tables**: Modern standalone rounded card table (`border-collapse: separate; border-spacing: 0; border: 1px solid #cbd5e1; border-radius: 8px;`) with light slate header `#f1f5f9` and bold text `#0f172a`, clean white cells with `#1e293b` text, outer card padding/border stripped, and rounded outer corner cells.
- **Vibrant Block Cards**: Callouts render cleanly in plain white (`#ffffff`, subtle neutral border `#e2e8f0`, standard dark text `#0f172a`, and prominent emoji icon), quotes render in soft gold (`#fefce8`, left accent `#eab308`, text `#334155`), site bookmarks render in soft blue (`#f0f9ff`, border `#bae6fd`, link `#0284c7` without inner dark cards), and media image embeds render frameless without dark borders or backgrounds.
- **Multi-Column Splits**: Enforced side-by-side flex row layout (`display: flex; flex-direction: row; gap: 12pt;`) with light card styling (`#f8fafc`, border `#cbd5e1`, bold title `#0f172a`, body `#1e293b`).
- **Normalized Checkboxes & Lists**: Checkboxes normalized across all print engines (`-webkit-appearance: none; appearance: none;`) with crisp `#475569` border, 12pt size, and vivid `#0284c7` fill with white `"✓"` checkmark when checked; list bullet dots rendered with `#334155` fill and border (`print-color-adjust: exact`).
- **Atomic Blocks & Pagination**: `break-inside: avoid` enforced on code blocks, toggles, tables, multi-column splits, callouts, and media blocks to prevent awkward cross-page splits, with zeroed trailing container margins preventing trailing blank pages.

### 8. Standalone HTML Export Styling (`blocksToHTMLLossy`)
- **Theme Palette**: Self-contained dark theme with `#12151e` background, `#f1f3fa` high-contrast typography, `#f8fafc` headings, and `#334155` card borders.
- **LaTeX Auto-Render Engine**: Embedded KaTeX CDN stylesheet (`katex@0.18.1`) and `auto-render.min.js` script with display `$$` and inline `$` delimiters. Equations render in gold (`#f7d67c`).
- **Code Blocks**: Dedicated syntax highlighter emitting 10 token color classes (pink `#f472b6` keywords, cyan `#67e8f9` types/functions, emerald `#6ee7b7` strings, amber `#fbbf24` numbers, and slate `#64748b` comments) with language badge headers.
- **Rich Media & Bookmarks**:
  - Site Bookmark Cards: `#181c27` background, 🌐 icon, cyan hyperlink (`#38bdf8`), and muted URL subtitle (`#94a3b8`).
  - Media Embeds: Responsive `<img />`, native `<audio controls>`, `<video controls>`, and 16:9 aspect-ratio responsive YouTube `<iframe>` embeds (`media-youtube` container with 56.25% padding-bottom or `aspect-video`) with editable captions and `25%` / `50%` / `100%` width preset styling.
  - Canvas Whiteboard: Dashed card container (`#181c27`, border `#475569`) with 🎨 icon and `[Canvas Drawing]` label.
  - Checkboxes & Toggles: Custom check boxes (`.todo-check.checked` `#0284c7` with checkmark, `.todo-check.unchecked` `#181c27`) and native collapsible `<details><summary>`.
  - Tables: Responsive dark container (`#181c27`) with gold headers (`#f7d67c`) and subtle row borders (`#232938`).

### 29. Pre-Download Document Export Preview Tokens (`ExportPreview.jsx` & `ExportImportModal.jsx`)
- **Responsive Dynamic Modal Sizing**:
  - Format Picker View: Standard compact modal `max-w-2xl max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-3.5rem)]`.
  - Preview Mode Transition: Expanded document reader canvas `max-w-4xl max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-3.5rem)]` with smooth CSS transition.
- **Top Control & Format Switcher Bar**:
  - Surface: `border-b border-ink-800 bg-ink-950/80 px-4 sm:px-6 py-3 shrink-0`.
  - Back Button: `border border-ink-700 bg-ink-900 px-2.5 py-1.5 text-xs font-semibold text-ink-300 hover:bg-ink-800 hover:text-ink-100 rounded-lg`.
  - Format Switcher Tabs: `bg-ink-900/90 border border-ink-800 p-1 rounded-xl` housing active pill `bg-duck-500 text-ink-950 font-bold shadow-xs` and inactive pill `text-ink-400 hover:text-ink-200 hover:bg-ink-800/60`.
- **Word Document (.docx) Sheet Preview Tokens**:
  - Ribbon Bar: `bg-[#1f4e79] text-white text-xs font-medium px-4 py-2 border-b border-gray-200` with Microsoft Word logo indicator and print layout metadata.
  - Page Canvas: Authentic 8.5" x 11" sheet layout `bg-white text-gray-900 shadow-2xl rounded-sm max-w-3xl mx-auto p-8 sm:p-14 min-h-[580px] border border-gray-200 font-sans leading-relaxed`.
  - Typography Hierarchy:
    - Document Title: `text-2xl sm:text-3xl font-bold text-[#1f4e79] border-b-2 border-[#1f4e79]/20 pb-3 mb-6`.
    - H1: `text-xl font-bold text-[#1f4e79] mt-4 mb-2`.
    - H2: `text-lg font-bold text-[#2e74b5] mt-3 mb-1`.
    - H3 / H4: `text-base / text-sm font-semibold text-[#1f4e79] / text-[#2e74b5]`.
    - Body Text: `text-[13.5px] text-gray-800 leading-relaxed`.
    - Tables: `border border-gray-300 rounded-md` with `bg-[#1f4e79]/10 text-[#1f4e79] font-bold` header cells.
    - Code Blocks: `bg-gray-50 border border-gray-300 rounded-md font-mono text-xs text-gray-800`.
- **HTML Web Page (.html) Browser Mockup Tokens**:
  - Mockup Header: `border-b border-ink-800 bg-ink-900 px-4 py-2 text-xs` with faux window traffic lights (red, amber, emerald dots) and address bar pill `file:///exports/{filename}` with emerald globe icon.
  - Sandbox iFrame: Isolated security container with dynamic height auto-sizing to `scrollHeight` via `handleIframeLoad` + `ResizeObserver` on `doc.body` with mouse wheel forwarding to the parent scroll canvas.
- **Plain Text (.txt) Monospace Editor Tokens**:
  - Titlebar: `border-b border-ink-800 bg-ink-900/80 px-4 py-2 text-xs font-mono text-ink-400`.
  - Body: `font-mono text-xs sm:text-[13px] leading-relaxed text-ink-200 whitespace-pre p-4 sm:p-6 overflow-x-auto`.
- **Markdown (.md) Reader Tokens**:
  - Container: `rounded-xl border border-ink-800 bg-ink-950 p-6 sm:p-8 shadow-2xl`.
  - Rendering Engine: `MarkdownRenderer` with syntax highlighting and KaTeX display/inline math.
- **Code Block Viewer with Line Gutter**:
  - Numbering Gutter: `w-10 pr-4 text-right select-none text-ink-600 font-mono text-[10px]`.
  - Code Cell: `whitespace-pre font-mono text-ink-100 text-[11px] sm:text-xs leading-relaxed`.
- **Bottom Footer Download Bar**:
  - Surface: `border-t border-ink-800 bg-ink-950 px-4 sm:px-6 py-3.5 shrink-0`.
  - Primary Action Button: `border border-duck-500/40 bg-duck-500 px-5 py-2 text-xs font-bold text-ink-950 hover:bg-duck-400 shadow-md active:scale-95`.
- **Scroll Container Architecture**:
  - Canvas Container: `flex-1 min-h-0 overflow-y-auto overscroll-contain focus:outline-none focus-visible:ring-1 focus-visible:ring-duck-500/30 scrollbar-thin scrollbar-thumb-ink-700/80 hover:scrollbar-thumb-duck-500/50 scroll-smooth`.
  - Viewport Bounds: `h-[calc(100vh-2.5rem)] sm:h-[calc(100vh-4rem)] md:h-[calc(100vh-5rem)] max-h-[920px]` with backdrop `overflow-hidden` to prevent parent scroll conflict.

---
