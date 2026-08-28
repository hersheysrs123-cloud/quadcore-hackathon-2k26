# SocraticOS — Design System & Theme Specifications

> **Notice for Developers & AI Assistants**: 
> This document defines the authoritative design tokens, color ramps, component architecture, and styling rules for SocraticOS. Always refer to this specification when building new UI components or modifying existing themes.

---

## 🎨 Theme Architecture & Color Tokens

SocraticOS uses a dynamic CSS variable system defined in `app/globals.css` with `@import "tailwindcss";` and `@theme`. The theme toggles between **Dark Mode** (default) and **Light Mode** via the `data-theme="light"` attribute or `.light` class on the root `<html>` element.

### 1. Color Palette Tokens (`--color-ink-*`)

| Token | Dark Mode (Sleek Slate) | Light Mode (Warm Stone) | Usage / Intent |
| :--- | :--- | :--- | :--- |
| `--color-ink-950` | `#12151e` | `#eef2f6` | Main viewport background |
| `--color-ink-900` | `#181c27` | `#f7fafc` | Sidebar, Top HUD Header, Card surfaces |
| `--color-ink-850` | `#1f2332` | `#e2e8f0` | Inputs, hover states, block backgrounds |
| `--color-ink-800` | `#282d3f` | `#cbd5e1` | Borders, active tab indicators, dividers |
| `--color-ink-700` | `#363d54` | `#94a3b8` | Secondary borders, muted badges |
| `--color-ink-600` | `#4e5672` | `#64748b` | Placeholders, muted hints, scrollbars |
| `--color-ink-500` | `#737c9a` | `#475569` | Subtitles, breadcrumbs, uppercase section titles |
| `--color-ink-400` | `#9aa2bc` | `#334155` | Secondary text, nav item icons |
| `--color-ink-200` | `#d6dbed` | `#1e293b` | Primary body text |
| `--color-ink-100` | `#f1f3fa` | `#0f172a` | High-contrast headings & active titles |

### 2. Accent Tokens (`--color-duck-*`)

| Token | Hex / Value | Usage |
| :--- | :--- | :--- |
| `--color-duck-300` | `#f7d67c` (Dark) / `#d97706` (Light) | Duck action bar text, active 3D badge text |
| `--color-duck-400` | `#f0c04a` (Dark) / `#b45309` (Light) | Primary accent buttons, active space dot |
| `--color-duck-500` | `#d9a227` (Dark) / `#92400e` (Light) | Focused borders, button hover ring |

### 3. Mastery Status Scale (`--color-solid-500` / `--color-shaky-500` / `--color-gap-500`)

Reserved for the mastery heatmap, quiz results, and topic confidence indicators. **Never** reuse these as decoration or as a generic series colour.

| Token | Dark | Light | Meaning | Glyph |
| :--- | :--- | :--- | :--- | :--- |
| `--color-solid-500` | `#0ca30c` | `#0a7d0a` | Solid — explained the mechanism unprompted | `●` |
| `--color-shaky-500` | `#ec835a` | `#ea580c` | Shaky — correct but recited, or needed leading | `◐` |
| `--color-gap-500` | `#d03b3b` | `#b02a2a` | Gap — wrong, absent, or collapsed on a follow-up | `○` |

**Colour is never the only channel.** Every place that paints a status must also render the glyph and the word — a good/bad scale is red-vs-green by definition, which collapses under deuteranopia ($\Delta E \approx 0.7$). The glyphs form an ordinal ramp (filled → half → hollow) that survives greyscale and a 12px cell.

The scale's yellow step is deliberately **unused**: it measures 1.08 contrast against `--color-duck-400`, so a "shaky" chip would read as a primary button. The light steps are re-stepped for the light surface rather than flipped, and light-mode shaky avoids the darker orange because it sits $\Delta E \approx 0.1$ from the light-mode duck accent. All three clear 4.5:1 on `ink-900` in both modes.

---

## 📐 Typography & Layout Guidelines

- **Font Family**: System UI sans-serif with `-webkit-font-smoothing: antialiased`.
- **Note Title**: `text-4xl font-extrabold tracking-tight text-ink-100` (substantially larger than H1).
- **Headings**:
  - **H1**: `text-3xl font-bold tracking-tight text-ink-100`
  - **H2**: `text-xl font-semibold tracking-tight text-ink-100`
  - **H3**: `text-lg font-semibold text-ink-100`
  - **H4**: `text-base font-semibold text-ink-100`
- **Code Snippet**: `font-mono text-sm leading-relaxed text-emerald-300 bg-ink-850 rounded-lg px-4 py-3 border border-ink-700`
- **LaTeX Math Formula**: `font-serif text-base text-duck-200 bg-ink-850 rounded-lg px-4 py-3 border border-ink-700`

---

## 🧩 Component Architecture

### 1. Left Sidebar (`Sidebar.jsx`)
- **Width**: Fixed `w-64 shrink-0`.
- **Brand Header**:
  - Duck Emoji: `text-xl`
  - Brand Title: `text-sm font-bold text-ink-100`
  - **Spaces Selector Dropdown**: Compact button next to logo (`text-xs font-medium text-ink-200 border border-ink-700/70 bg-ink-850/90`) displaying current space icon and name with a dropdown popover to choose/switch spaces, create custom spaces, or manage space password locks.
  - Settings Button: `text-lg text-ink-400 hover:text-ink-100` (positioned top-right of brand header).
- **Notes List**: Full-height list per active space with star favorite indicator `⭐`, custom note emoji, and hover delete icon `🗑️`.
- **Bottom Trash Tab**: Fixed tab `🗑️ Trash (24h)` showing active deleted notes count with 24-hour auto-purge timer.

### 2. Top HUD Header (`Workspace.jsx`)
- **Height**: `h-14 shrink-0`.
- **Left Breadcrumb Context**:
  - Active Space (`text-sm font-semibold text-ink-300`)
  - Separator (`/`)
  - Active Note / View Title (`text-base font-bold text-ink-100`).
- **Center Navigation Tabs**: 5 pill tabs (`📝 Notes`, `📅 Calendar`, `🔖 Web Saver`, `🌌 3D Orbit`, `📊 Mastery`). The Mastery tab carries a `gap-500` count badge when the heatmap holds unresolved gaps.
- **Far Right Action Bar**:
  - Multi-Timer HUD Trigger (`<GlobalTimerHUD />`).
  - `💾 Save Note` / Note Action Menu (`<NoteMenu />`).
  - `✨ Explain` button (opens the Explain drawer for the active note).
  - `🦆 Quiz me` button (opens the graded quiz drawer; the Socratic Duck is its second tab).

### 3. Web Saver & Folder Manager (`WebSaverView.jsx` & `AddBookmarkModal.jsx`)
- **Dual-Pane Layout**:
  - **Left Folder Tree**: Fixed `w-64 shrink-0` sidebar (`bg-ink-900 border-r border-ink-800`), nested folder rows with hover context menus (`+` subfolder, `✏️` rename, `🗑️` delete), and `ring-2 ring-duck-400` drag-and-drop drop targets.
  - **Main Bookmark Studio**: Full flex viewport (`bg-ink-950`) with live debounced search, active tag filter chips, sorting menu, and view mode toggle (Grid Cards ⊞ vs Compact Rows ☰).
- **Favicon Badging**: `h-8 w-8` rounded containers (`bg-ink-800 border border-ink-700`) with Google Favicon resolution and fallback globe glyphs.
- **Bookmark Cards & Rows**:
  - Glassmorphic card surfaces (`bg-ink-900/90 border border-ink-800 hover:border-duck-500/40 hover:bg-ink-850`).
  - External link launch with animated `ExternalLink` icon (`target="_blank" rel="noopener noreferrer"`).
  - Domain pill badge (`rounded-md bg-ink-800/80 px-2 py-0.5 text-[10px] font-mono text-ink-300`).
  - Tag chips (`bg-duck-500/10 border border-duck-500/20 text-duck-300`).
  - Quick action buttons with copied confirmation indicator (`Copy` $\to$ `Check`).

### 4. BlockNoteEditor (`BlockNoteEditor.jsx`)
- **Page Cover Banners**: Spans **100% full horizontal width** (`w-full h-44 md:h-52`) across the top of the Notes tab. Presets include *Cyberpunk*, *Sunset Amber*, *Ocean Teal*, *Midnight Blue*, and *Socratic Gold*.
- **Top Right Banner Controls**: Positioned at top-right (`right-6 top-3/top-4`) as a stacked column (`flex flex-col items-end gap-2 print:hidden`):
  - **Cover Button**: Renders as a translucent glassmorphic button (`bg-ink-950/40 opacity-60 hover:opacity-100`) to `Add Cover Banner` or `Change Cover`.
  - **Intelligent Reformat Button**: Positioned directly beneath the Change Cover button with `✨ Reformat Note` (and `🪄 Reformatting Note...` processing state) and contextual animated toast badges.
- **Left Controls Bar Below Banner**: Aligned with note content (`mb-4 pl-8 flex items-center gap-2.5 flex-wrap print:hidden`), housing the Note Icon picker (`Add Icon` / `Change Icon`).

- **19 Block Types**: Text, Headings (H1–H4), Bullet List, Numbered List, To-Do List, Toggle List, Callout Box, Table Grid Block, Quote, LaTeX Math Equation, Inline Math (`inlinemath`), Divider, Site Bookmark Embed, Media Embed, Code Snippet, and Canvas Whiteboard.
- **Table Grid Block Design Specs**:
  - Container: `group/tableblk relative my-3 overflow-hidden rounded-xl border border-ink-800 bg-ink-900/90 shadow-lg transition-all hover:border-duck-500/40`.
  - Header Toolbar: `flex items-center justify-between border-b border-ink-800 bg-ink-950/80 px-3.5 py-2 select-none`, with `▦` icon badge (`bg-duck-500/20 text-duck-400`), editable table caption, dimension badge (`{rows} × {cols}`), and `+ Column` / `+ Row` action buttons.
  - Table Grid: `border-collapse rounded-lg overflow-hidden border border-ink-800 bg-ink-950/60 text-xs`.
  - Headers (`th`): `border-r border-ink-800 px-3 py-2 text-left font-semibold text-duck-300 bg-ink-900` with hover delete column button (`text-rose-400 hover:bg-rose-500/20`).
  - Cells (`td`): `border-r border-ink-800/70 px-3 py-1.5 text-ink-100` hosting rich `TableCell` `contentEditable` elements with live Markdown (bold, italic, code, strikethrough, highlight) and KaTeX equation formatting, focus highlights (`focus:text-duck-200 focus:bg-ink-900/80`), and hover row deletion controls (`text-rose-400 hover:bg-rose-500/20`).

  - Keyboard Navigation: `Tab` / `Shift+Tab` across cells/rows with automatic row creation on bottom right cell; `Enter` to step down columns.
- **Slash Menu (`/`)**: Floating block-type picker menu.
- **Floating Action Bar**: Appears above non-empty selected text blocks with formatting triggers (`B`, *I*, <u>U</u>, <s>S</s>, $x$).
- **Draggable 6-Dots Handle (`⠿`)**: Drag to reorder blocks with `duck-400` drop target; click to open the context menu.



### 5. Settings & Factory Reset (`Sidebar.jsx`)
- **Shortcuts Tab**: Reference for all global keyboard shortcuts (`Ctrl+K`, `Ctrl+I`, `Ctrl+S`, `Ctrl+Z`, `Ctrl+Y`, `/`).
- **3D & Graphics Tab**: Performance presets (*Auto*, *High*, *Medium*, *Low/Battery Saver*), target FPS (30/60/120), DPR pixel ratio scaling, and auto-pause when hidden.
- **API Keys Tab**: Personal Google Gemini API key configuration stored 100% privately in Dexie IndexedDB.
- **Backup & Reset Tab**: Export/import `.socratic` JSON packages and table-targeted factory reset with math captcha verification.

### 6. Modal Dialogs & Overlay Layouts
- **Backdrop**: `fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-md p-3 sm:p-4 md:p-6 overflow-y-auto animate-fade-in`.
- **Dialog Container**: `relative w-full max-w-2xl max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-3.5rem)] flex flex-col overflow-hidden rounded-2xl border border-ink-700 bg-ink-900 shadow-2xl transition-all my-auto`.
- **Header & Footer**: Always attach `shrink-0` to modal header and footer components (`bg-ink-950/60 border-ink-800`) to guarantee they never compress or push off-screen.
- **Scrollable Body**: Container body must declare `overflow-y-auto flex-1 min-h-0` to isolate scrolling to the modal content area without expanding the dialog beyond the viewport.

### 7. Print Stylesheet & PDF Export (`@media print`)
- **Page Layout**: Set to A4 with `margin: 1.2cm 1.5cm` and all interactive chrome (`aside`, `header`, `nav`, `button:not(.print-content)`, modals, timer HUDs, drag handles) blanket-hidden.
- **Print Header**: Note icon and note title auto-wrap cleanly via print-rendered `<h1>` without `<input>` truncation or banner whitespace voids.
- **Code Block Formatting**: Light card background (`#f8fafc border border-ink-200`) with no inline `<code>` double-border striping.
- **LaTeX Math Scaling**: Equations auto-scale via `clamp(8pt, 1.6vw, 11.5pt)` with complete suppression of horizontal scrollbars.
- **Toggles & Site Bookmarks**: Details text renders as clean pre-wrapped text; interactive status badges and duplicate link URLs are suppressed.

---

## 🛠️ Code Conventions for AI & Developers

1. **Use Theme Variable Utility Classes**: Always use Tailwind utility classes mapping to `--color-ink-*` (e.g., `bg-ink-950`, `bg-ink-900`, `border-ink-800`, `text-ink-100`, `text-ink-400`).
2. **Never Hardcode Fixed Colors**: Avoid hardcoding raw hex codes like `#000000` or `#ffffff` in components so that Light Mode and Dark Mode render correctly.
3. **SSR Hydration Guard**: Use a `mounted` state (`const [mounted, setMounted] = useState(false); useEffect(() => setMounted(true), []);`) before consuming client-only APIs (`localStorage`, `window`, Dexie).
4. **Local-First Database Persistence**: Ensure new data models sync with Dexie.js (`lib/db.js` & `lib/storageService.js`) and gracefully fall back during offline usage.
5. **Modal Viewport Bounds**: Modal dialogs must use `max-h-[calc(100vh-2rem)] flex flex-col` and `shrink-0` on headers/footers to prevent clipping on compact displays.
6. **Print & PDF Content Guarantees**: Any user-created note content (titles, toggle details, LaTeX formulas, code snippets) must render cleanly in `@media print` without reliance on interactive form controls or fixed-height containers.

