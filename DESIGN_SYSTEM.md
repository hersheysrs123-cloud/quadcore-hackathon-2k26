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

### 4. 3D Visualization Studio Canvas Palette (`components/visualizations/scene-kit.jsx`)

Three.js / WebGL scenes cannot read Tailwind CSS variables dynamically in the shader pipeline. The 3D viewport canvas clear colour and palette lines are calibrated to sit comfortably in the middle across both **Dark Mode** and **Light Mode**:

| Token | Hex | Usage / Rationale |
| :--- | :--- | :--- |
| `CANVAS_BG` | `#273043` | Studio Slate clear colour. Brighter and softer than pitch-black (`#090d16`), providing contrast and depth for glowing vectors, atoms, and labels without harsh glare or looking like an empty black void in light mode. |
| `PALETTE.line` | `#525e76` | Bonds, coordinate grid axes, and measurement lines. Balanced for clean separation against `#273043`. |
| `PALETTE.bone` | `#e8ebf0` | Atoms, neutral indicators, and high-contrast meshes. |
| `PALETTE.gold` | `#fbbf24` | Vector arrows, primary force directions, and energy highlights. |
| `PALETTE.sky` | `#38bdf8` | Optical rays, magnetic field lines, and cool state readouts. |

---

## 📐 Typography & Layout Guidelines

### Note Typography Palette (3 Academic Font Options)

SocraticOS features 3 per-note typography font families configured in `app/globals.css` and selectable via the Notion-style typography picker in `NoteMenu`:

| Font ID | Family Name | CSS Class | Font Stack | Best For |
| :--- | :--- | :--- | :--- | :--- |
| `sans` | **Default Sans** | `.font-note-sans` | `ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif` | Clean, modern UI default, structured outlines |
| `serif` | **Classic Serif** | `.font-note-serif` | `'Lora', 'Charter', Georgia, 'Times New Roman', serif` | Academic essays, history, literature, long-form reading |
| `mono` | **Developer Mono** | `.font-note-mono` | `'JetBrains Mono', 'Fira Code', ui-monospace, SFMono-Regular, Consolas, monospace` | STEM derivations, computer science, math matrices |

- **Note Title**: `text-4xl font-extrabold tracking-tight text-ink-100` (substantially larger than H1).
- **Headings**:
  - **H1**: `text-3xl font-bold tracking-tight text-ink-100`
  - **H2**: `text-xl font-semibold tracking-tight text-ink-100`
  - **H3**: `text-lg font-semibold text-ink-100`
  - **H4**: `text-base font-semibold text-ink-100`
- **Code Snippet**: `font-mono text-sm leading-relaxed text-emerald-300 bg-ink-850 rounded-lg px-4 py-3 border border-ink-700`
- **LaTeX Math Formula**: Seamless Notion-style inline math equations (`.katex-inline-node`) rendered clear (transparent background, borderless, text-matching color, soft hover background) and standalone equation blocks (`.katex-display`) with preserved KaTeX font metrics.

---

## 🧩 Component Architecture

### 1. Left Sidebar (`Sidebar.jsx`)
- **Width**: `w-64 shrink-0`.
- **Top Brand Row**:
  - Duck Emoji: `text-xl`
  - Brand Title: `text-sm font-bold text-ink-100`
  - Quick utility buttons: Donate/Support (`HeartHandshake`), Feedback (`MessageSquare`), and Settings (`⚙️`).
- **Global Tools Section**:
  - Group Header: `text-[10px] font-bold uppercase tracking-wider text-ink-500`
  - Compact 4-Column Icon Grid: `grid grid-cols-4 gap-1 p-1 bg-ink-950/60 rounded-xl border border-ink-800/80`.
    - Instant Note (`⚡`)
    - 3D Simulations (`🌌`)
    - Calendar (`📅`)
    - Web Saver (`🔖`)
  - Active state: `bg-ink-800 text-duck-300 shadow-sm ring-1 ring-duck-400/40 font-semibold`.
  - Integrated `GlobalTimerHUD` compact card.
- **Spaces Section**:
  - **Spaces Selector Dropdown**: Compact button (`text-xs font-medium text-ink-200 border border-ink-700/80 bg-ink-850/90`) displaying current space icon and name with a dropdown popover to choose/switch spaces, create custom spaces, or manage space password locks.
- **Notes List**: Full-height list per active space.
  - **Header Controls**: Inline "Select" / "Done" action button (`text-[11px] px-2 py-0.5 rounded font-medium text-ink-400 hover:text-ink-200 hover:bg-ink-800`), turning into active pill `bg-duck-500/20 text-duck-300 ring-1 ring-duck-400/40 font-semibold` when selecting.
  - **Multi-Selection Mode**:
    - Header count indicator: `{count} of {total} selected` with duck accent, alongside a `Deselect All` / `Select All` action link (`text-[11px] text-duck-400 hover:text-duck-300 font-medium`).
    - **Bulk Actions Toolbar**: 4-column compact grid (`p-2 rounded-xl bg-ink-850/90 border border-ink-750`) providing:
      - Star: `text-amber-400`
      - Copy (Duplicate): `text-sky-400`
      - Move: `text-duck-400`
      - Delete: `text-rose-400 hover:bg-rose-500/20`
    - **Checkbox Indicators**: Rounded square indicator on the left of each note item (`w-4 h-4 rounded border border-duck-400 bg-duck-500 text-ink-950` when selected, `border-ink-600 bg-ink-850` when idle).
    - **Selected Row Highlight**: `bg-duck-500/15 ring-1 ring-duck-400/40 text-duck-200 shadow-xs`.
    - **Suppressed Elements**: Drag handles and 3-dots menus are hidden while selection mode is active to prevent accidental clicks.
  - **Ghost Action Icons**: In normal view, Drag handle (`GripVertical` `⠿`) and Note Menu (`NoteMenu` `...`) are ghosted (`opacity-0`), seamlessly fading in on row hover (`group-hover:opacity-100 focus-within:opacity-100`) without layout shift.
  - Star favorite indicator `⭐` visible on favorited notes.
- **Confirmation Modals**:
  - `BatchDeleteConfirmModal`: Double-confirmation dialog for bulk deletion with rose warning badge (`bg-rose-500/10 border-rose-500/20 text-rose-200`), note title preview list, and 24h retention notice.
  - `BatchMoveModal`: Destination space picker modal with disabled badge for the current active space.
- **Bottom Trash Tab**: Fixed tab `🗑️ Trash (24h)` showing active deleted notes count with 24-hour auto-purge timer.

### 2. Top HUD Header (`Workspace.jsx`)
- **Height**: Single slim unified header (`h-13 shrink-0` / 52px).
- **Left Breadcrumb Context**:
  - Sidebar Toggle (`PanelLeftClose` / `PanelLeftOpen`)
  - Space / View Breadcrumb (`📁 Space Name / 📝 Note Title` with favorite star indicator `⭐`, or `🌌 3D Simulations Studio` / `📅 Study Calendar & Timers` / `🔖 Web Saver & Bookmarks`).
- **Center Navigation Tabs**: 3 space-specific study tabs (`📝 Notes`, `🎯 Quizzes`, `📊 Mastery`). The Mastery tab carries a `gap-500` count badge when the heatmap holds unresolved gaps.
- **Far Right Action Bar**:
  - Auto-save status indicator (`saveStatus` with pulsating green dot).
  - `✨ Explain` button (opens the AI Explain drawer for the active note).
  - `🦆 Quiz me` button (opens the graded quiz drawer).
  - `NoteMenu` icon button: clean 3-dots (`...` / `MoreHorizontal`) trigger without text, opening dropdown for `Save Note`, `Favorites ⭐`, `Note Stats`, `✨ Reformat Note (AI)`, `Export / Import`, and `Delete Note`.
  - Zen Focus Mode toggle (`Maximize2` / `Minimize2` icon, shortcut `Ctrl+Shift+F`), providing an edge-to-edge distraction-free view with a floating exit pill (`Esc`).

### 3. Web Saver & Folder Manager (`WebSaverView.jsx` & `AddBookmarkModal.jsx`)
- **Global Library Vault**: All folders and bookmarks are stored and queried globally across the workspace, accessible regardless of active space.
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
- **Progressive Disclosure Header Architecture**:
  - **Clean State (No Banner / No Icon)**: Document presents a distraction-free typing canvas. Hovering over the top title area (`group/header`) progressively reveals action pills: `[ 😀 Add Icon ]` and `[ 🖼️ Add Cover ]`. Note reformatting is accessible cleanly via `NoteMenu` (`✨ Reformat Note (AI)`).
  - **Cover Banners**: Spans **100% full horizontal width** (`w-full h-44 md:h-52`) across the top of the Notes tab. Presets include *Cyberpunk*, *Sunset Amber*, *Ocean Teal*, *Midnight Blue*, and *Socratic Gold*. Hovering the banner reveals `[ 🖼️ Change Cover ]` pill in the top-right.
  - **Note Icon**: Large `text-5xl` emoji above title; clicking triggers the emoji selector, while hovering allows changing or removing the icon.

- **19 Block Types**: Text, Headings (H1–H4), Bullet List, Numbered List, To-Do List, Toggle List, Callout Box, Table Grid Block, Quote, LaTeX Math Equation, Inline Math (`inlinemath`), Divider, Site Bookmark Embed, Media Embed, Code Snippet, and Canvas Whiteboard.
- **Full Width & Standard Layout Variants**:
  - Standard Reading Column (Default): `max-w-3xl px-10 mx-auto`.
  - Full Width Viewport: `w-full max-w-none px-6 md:px-12 mx-auto`.
- **Lock Page Read-Only Indicator Specs**:
  - Top-Right Lock Icon Button: `absolute top-3 right-6 z-30 flex items-center justify-center p-1.5 rounded-lg border border-ink-800/70 bg-ink-900/80 text-ink-400 hover:text-amber-300 hover:border-amber-500/40 hover:bg-ink-850/90 backdrop-blur-md shadow-sm`.
  - Icon: `h-4 w-4 text-amber-400/80 group-hover:text-amber-300 transition-colors`.
- **Table Grid Block Design Specs**:
  - Container: `group/tableblk relative my-3 overflow-hidden rounded-xl border border-ink-800 bg-ink-900/90 shadow-lg transition-all hover:border-duck-500/40`.
  - Header Toolbar: `flex items-center justify-between border-b border-ink-800 bg-ink-950/80 px-3.5 py-2 select-none`, with `▦` icon badge (`bg-duck-500/20 text-duck-400`), editable table caption, dimension badge (`{rows} × {cols}`), and `+ Column` / `+ Row` action buttons.
  - Table Grid: `border-collapse rounded-lg overflow-hidden border border-ink-800 bg-ink-950/60 text-xs`.
  - Column Drag Handles: Positioned top-center of each column (`top-0.5 left-1/2 -translate-x-1/2`), smoothly appearing (`opacity-100 bg-duck-500/20 text-duck-300 ring-1 ring-duck-500/40`) when any cell in that column is focused or when hovering the header. Draggable (`⠿`) with drop target highlight indicator (`bg-duck-500/25 ring-2 ring-inset ring-duck-400/80`).
  - Row Gutter & Drag Handles: Dedicated left gutter column (`w-8 min-w-[32px] max-w-[32px] bg-ink-950/40 select-none print:hidden`) displaying row number (`1, 2, 3...`) in muted mono font (`text-[10px] text-ink-600`), smoothly transforming into an interactive drag handle (`⠿`) highlighted in duck gold (`text-duck-400 font-bold`) when that row's cell is focused or hovered.
  - Headers (`th`): `border-r border-ink-800 px-3 py-2 text-left font-semibold text-duck-300 bg-ink-900` with hover delete column button (`text-rose-400 hover:bg-rose-500/20`).
  - Cells (`td`): `border-r border-ink-800/70 px-3 py-1.5 text-ink-100` hosting rich `TableCell` `contentEditable` elements with live Markdown (bold, italic, code, strikethrough, highlight) and KaTeX equation formatting, focus highlights (`focus:text-duck-200 focus:bg-ink-900/80`), and hover row deletion controls (`text-rose-400 hover:bg-rose-500/20`).
  - Keyboard Navigation: `Tab` / `Shift+Tab` across cells/rows with automatic row creation on bottom right cell; `Enter` to step down columns.
- **Hierarchical Multi-Tier Lists (Bullets & Numbered Items)**:
  - **Bullet List Hierarchy**:
    - Level 0: Solid disc (`●`), `pl-0` / `0rem` indent
    - Level 1: Hollow ring (`○`), `pl-6` / `1.5rem` indent
    - Level 2: Solid square (`■`), `pl-12` / `3.0rem` indent
    - Level 3+: Hollow square (`□`), `pl-18` / `4.5rem` indent
  - **Numbered List Hierarchy**:
    - Level 0: Decimal numerals (`1.`, `2.`, `3.`), `pl-0` / `0rem` indent
    - Level 1: Lowercase alphabet (`a.`, `b.`, `c.`), `pl-6` / `1.5rem` indent
    - Level 2: Lowercase Roman numerals (`i.`, `ii.`, `iii.`), `pl-12` / `3.0rem` indent
    - Level 3+: Uppercase alphabet (`A.`, `B.`, `C.`), `pl-18` / `4.5rem` indent
  - **Keyboard Interaction**:
    - `Tab`: Indents bullet or number item by 1 level (`level = level + 1`, capped at level 4).
    - `Shift+Tab`: Outdents item by 1 level; if at level 0 on empty item, converts cleanly to paragraph.
    - `Backspace`: Decrements level if indented, or un-lists empty items to plain text.
- **Heading & Bullet Notion-Grade Downward Flow**:
  - Pressing `Enter` at the logical start (offset 0) of any heading (`h1`–`h4`) prepends a new blank text paragraph above and moves the heading and all downstream blocks down, preserving heading style and content.
  - Pressing `Enter` at the logical start (offset 0) of any bullet (`bullet`) or numbered (`number`) item with content (specifically the first bullet in a list) prepends an empty list item of matching level above and moves the current item down to the next line with its list glyph intact, keeping focus at the start of the item on the next line.
- **Undo / Redo History Engine (`Ctrl+Z` / `Ctrl+Y` / `Ctrl+Shift+Z`)**: Fully deep-cloned immutable snapshots across all block mutations; atomic splitting on Enter; smart focus target restoration ensuring caret is never dropped to `document.body` or jumped to block 0.
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

### 9. Notion-Style Right-Side Outline (Table of Contents)
- **Minimap Dash Strip (Collapsed State)**: Minimalist vertical column of horizontal tick bars (`fixed top-24 right-2 sm:right-3.5 z-40`) on the right margin. Bar widths reflect heading hierarchy (`H1`: `w-5`, `H2`: `w-4`, `H3`: `w-3`, `H4`: `w-2`). Active section glows in solid white (`bg-white h-[2.5px] shadow-[0_0_8px_rgba(255,255,255,0.7)]`), inactive bars are subtle dark grey (`bg-[#4e515d]`).
- **Floating Outline Card (Expanded State)**: Border-clean dark popover (`w-64 sm:w-72 max-h-[calc(100vh-8rem)] rounded-2xl border border-[#2b2e37] bg-[#16181f]/95 p-3.5 shadow-2xl backdrop-blur-2xl`) revealed on hover or click-to-pin.
- **Hierarchy Tokens**:
  - `H1`: `pl-2.5 sm:pl-3 text-sky-400 font-medium text-xs` (Top level with breathing room inside highlight box)
  - `H2`: `pl-5 sm:pl-5.5 text-[#9ca0ab] text-xs`
  - `H3`: `pl-7 sm:pl-8 text-[#9ca0ab] text-xs`
  - `H4`: `pl-9 sm:pl-10 text-[#9ca0ab] text-xs`
- **Active Section Highlight**: Rounded dark pill (`bg-[#282b34] text-white font-medium shadow-sm ring-1 ring-white/10 rounded-lg py-1.5 pr-2.5` with hierarchy-based left padding).
- **Target Jump Pulse**: `ring-2 ring-duck-400 bg-duck-500/10` temporary visual ring on clicked headings.

### 10. Multi-Column Layout Block (`columns` 2–5 Columns Split)
- **Container Structure**: Clean, borderless responsive grid directly embedded in note flow (`w-full my-2 select-text`).
- **Slash Menu Triggers**: Dedicated `/2 columns`, `/3 columns`, `/4 columns`, `/5 columns`, `/split`, `/compare` selector entries.
- **Responsive Grid Breakpoints**:
  - 2 Cols: `grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4`
  - 3 Cols: `grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4`
  - 4 Cols: `grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4`
  - 5 Cols: `grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 sm:gap-4`
- **Column Card Tokens**:
  - Card Box: `flex flex-col rounded-xl border border-ink-800/80 bg-ink-900/80 p-3.5 shadow-sm hover:border-duck-500/30 hover:bg-ink-900/95`.
  - Column Header Input: Rich `contentEditable` container (`text-xs font-semibold text-ink-100 placeholder:text-ink-600 border-b border-ink-800/60 pb-1.5 mb-2 focus:border-duck-400`).
  - Column Body Content: Rich `contentEditable` multi-line area supporting live KaTeX formulas (`$formula$`) and inline code (`` `code` ``) formatting (`text-xs leading-relaxed text-ink-200 min-h-[5.5rem] focus:outline-none whitespace-pre-wrap`).

### 11. Multi-Select Note Combobox & Chip Badges (Quiz Creator)
- **Trigger Button**: `w-full flex items-center justify-between px-3 py-2 text-xs font-medium bg-ink-850 text-ink-100 border border-ink-700 rounded-xl hover:border-ink-600 focus:border-duck-500/60`.
- **Selection Count Pill**: `text-[10px] font-bold text-duck-300 bg-duck-500/15 border border-duck-500/30 px-1.5 py-0.5 rounded-full`.
- **Dropdown Popover Surface**: `absolute z-30 left-0 right-0 mt-1 p-2 bg-ink-900 border border-ink-700 rounded-xl shadow-2xl space-y-2 animate-fade-in`.
- **Filter Search Input**: `w-full pl-7 pr-2.5 py-1 text-[11px] text-ink-100 bg-ink-850 border border-ink-750 rounded-lg placeholder:text-ink-500 focus:border-duck-500/60`.
- **Selected Item Chip Badges**: `inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-ink-850 border border-ink-750 text-[11px] font-medium text-ink-200 shadow-xs`.
- **Dismiss Button**: `text-ink-500 hover:text-gap-400 p-0.5 rounded-xs transition-colors`.
- **Multi-Note Quiz Card Badges**: `text-[10px] font-bold text-duck-400 bg-duck-500/10 border border-duck-500/20 px-1.5 py-0.5 rounded-md shrink-0`.

### 12. Hierarchical Sub-Bullet Lists & Glyphs
- **Indentation Scale**: `style={{ paddingLeft: level * 1.5rem }}` (Level 0 = `0rem`, Level 1 = `1.5rem`, Level 2 = `3.0rem`, Level 3+ = `4.5rem+`).
- **Glyph Token Progression**:
  - `Level 0`: `mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-ink-400` (Solid Circle `●`).
  - `Level 1`: `mt-2 h-1.5 w-1.5 shrink-0 rounded-full border border-ink-400 bg-transparent` (Hollow Ring `○`).
  - `Level 2`: `mt-2.5 h-1.25 w-1.25 shrink-0 rounded-none bg-ink-400` (Solid Square `■`).
  - `Level 3+`: `mt-2.5 h-1.25 w-1.25 shrink-0 rounded-none border border-ink-400 bg-transparent` (Hollow Square).
- **Keyboard Transitions**:
  - `Tab`: Indents bullet to sub-bullet (`level = min(4, level + 1)`).
  - `Shift+Tab`: Outdents sub-bullet (`level = level - 1`). If unindented at `level 0` when empty, converts to standard paragraph text.
  - `Enter`: Empty sub-bullet unindents by 1 level; populated sub-bullet inherits parent level on new line.
  - `Backspace`: Caret at offset 0 unindents sub-bullet by 1 level before unformatting.

### 13. Quiz Deletion Confirmation Modal & In-Progress Badges
- **Modal Backdrop**: `fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-950/80 backdrop-blur-xs animate-fade-in`.
- **Modal Dialog Surface**: `w-full max-w-md rounded-2xl bg-ink-900 border border-ink-800 shadow-2xl p-6 space-y-4 animate-scale-in text-left`.
- **Modal Danger Action**: `px-4 py-2 rounded-xl bg-gap-500 hover:bg-gap-400 text-white text-xs font-bold shadow-md transition-colors flex items-center gap-1.5`.
- **In-Progress Quiz Card Badge**: `text-xs font-semibold text-amber-400 flex items-center gap-1.5` with animated amber pulse (`w-2 h-2 rounded-full bg-amber-400 animate-pulse`).
- **Resume Quiz Button**: `px-4 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-xs font-bold text-ink-950 shadow-sm transition-colors`.
- **Runner Auto-Save Indicator**: `flex items-center gap-1.5 text-[11px] font-medium text-ink-400 bg-ink-850 px-2 py-0.5 rounded-full border border-ink-800` (shows `Check` with "Progress saved" or spinner with "Saving...").

### 14. AI Note Reformatter Visual Feedback
- **Floating Banner Position**: `fixed top-16 left-1/2 -translate-x-1/2 z-50 pointer-events-none animate-fade-in select-none`.
- **Banner Surface**: `flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-ink-900/95 border border-duck-500/50 shadow-2xl backdrop-blur-md text-xs font-semibold text-duck-200 ring-4 ring-duck-400/20`.
- **Active Trigger Button State (`NoteMenu.jsx`)**: `bg-duck-500/15 border border-duck-500/30 text-duck-200 cursor-wait pointer-events-none` with spinning sparkle and pulsing `"AI"` tag.

### 15. KaTeX LaTeX & Chemical Formula Rendering (`MathText` & `.katex-inline-node`)
- **Display Math Container**: `block my-2 overflow-x-auto overflow-y-hidden text-center py-1 select-text` (with responsive horizontal scroll preservation for wide equations).
- **Inline Math Container (`MathText` & `.katex-inline-node`)**: Seamless Notion-style typography: transparent background (`bg-transparent`), zero borders (`border: none`), natural text matching (`color: inherit`, `text-ink-100`), baseline alignment (`vertical-align: baseline`), subtle hover background highlight (`hover:bg-ink-800/60`), and no side handles or pill brackets.
- **KaTeX Styling Guarantees**: Relies on bundled `katex/dist/katex.min.css` across all runners and review reports, guaranteeing standard Computer Modern math typography for physics vectors, calculus integrals, and chemistry arrows.

### 16. Redesigned Decluttered Quiz Runner Layout & Question Palette
- **Split Workspace Layout**: `flex-1 flex flex-col lg:flex-row h-full overflow-hidden bg-ink-950`.
- **Spacious Q&A Canvas**: `flex-1 overflow-y-auto p-6 md:p-10 flex flex-col items-center` wrapping a max-width container (`w-full max-w-4xl space-y-6`).
- **Prompt & Answer Card**: `p-6 md:p-8 rounded-2xl bg-ink-900 border border-ink-800 shadow-xl space-y-6`.
- **Multiple Choice Options**:
  - Default: `group flex w-full items-start gap-4 p-4 md:p-4.5 rounded-xl border border-ink-800 bg-ink-850/70 text-ink-300 hover:border-ink-700 hover:bg-ink-800/80 hover:text-ink-100 transition-all cursor-pointer`.
  - Selected State: `border-duck-400/90 bg-duck-400/10 text-ink-100 shadow-[0_0_20px_rgba(240,192,74,0.12)]`.
  - Letter Badge: `flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border text-xs font-bold mt-0.5` (`border-duck-400 bg-duck-400 text-ink-950` when picked, `border-ink-700 text-ink-400 bg-ink-800` unpicked).
- **Right Control & Navigation Station**: `w-full lg:w-80 xl:w-88 shrink-0 border-t lg:border-t-0 lg:border-l border-ink-800 bg-ink-900/60 backdrop-blur-xs p-6 flex flex-col justify-between overflow-y-auto space-y-6`.
- **Questions Navigator Matrix**:
  - Grid: `grid grid-cols-5 gap-2`.
  - Current Question Button: `bg-duck-400 text-ink-950 font-black ring-2 ring-duck-300 ring-offset-2 ring-offset-ink-900 shadow-md scale-105 z-1`.
  - Answered Button: `bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 hover:bg-emerald-500/30` with `w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_4px_rgba(52,211,153,0.8)]` indicator dot.
  - Unanswered Button: `bg-ink-850 border border-ink-800 text-ink-400 hover:bg-ink-800 hover:text-ink-200 hover:border-ink-700`.
- **High-Contrast Review Diagnostic Cards**:
  - Correct: `bg-emerald-950/25 border-emerald-500/40 shadow-[0_0_20px_rgba(16,185,129,0.06)]` with `bg-emerald-500/20 text-emerald-400 border-emerald-500/50` icon box and `bg-emerald-500/15 border-emerald-500/30 text-emerald-200` answer chip.
  - Incorrect: `bg-rose-950/25 border-rose-500/40 shadow-[0_0_20px_rgba(244,63,94,0.06)]` with `bg-rose-500/20 text-rose-400 border-rose-500/50` icon box, `bg-rose-500/15 border-rose-500/30 text-rose-200` answer chip, and `bg-emerald-950/40 border-emerald-500/40` correct answer callout.

### 17. Custom AI Quiz Creator Modal (`CreateQuizModal.jsx`) Layout Tokens
- **Wide Modal Shell**: `w-full max-w-4xl lg:max-w-5xl xl:max-w-6xl max-h-[92vh] bg-ink-900 border border-ink-800 rounded-2xl shadow-2xl overflow-hidden`.
- **Responsive Padding**: Header `px-6 sm:px-8 py-4`, Form Body `px-6 sm:px-8 py-5 sm:py-6 space-y-6`, Footer `px-6 sm:px-8 py-4`.
- **2-Column Section Heading Selector**: When scoping by section, headings render inside `grid grid-cols-1 md:grid-cols-2 gap-2` within a `max-h-60 overflow-y-auto` scroll area, doubling visible items and eliminating vertical bloat.
- **Categorized Slider Grids**:
  - Mathematics & Science Reasoning: `grid grid-cols-1 sm:grid-cols-2 gap-3.5`.
  - Objective Assessment: `grid grid-cols-1 sm:grid-cols-2 gap-3.5`.
  - Applied & Written Analysis: `grid grid-cols-1 sm:grid-cols-3 gap-3.5` (Code Input, Short Answer, Long Essay).
- **Difficulty Grid**: `grid grid-cols-2 sm:grid-cols-4 gap-2.5`.

### 18. Zero-Lag Range Sliders & UI Performance Standards (`quiz-slider`)
- **Track Transition Discipline**: Range sliders with dynamic inline gradient tracks (such as `QuestionCountSlider`) must NEVER use `transition: all` or transition the CSS `background` property. Background gradient interpolation cannot be hardware accelerated and induces 150ms frame drops during pointer events.
- **Track CSS Specification**:
  ```css
  input[type="range"].quiz-slider {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    height: 6px;
    background: var(--color-ink-800, #282d3f);
    border-radius: 9999px;
    outline: none;
    transition: opacity 0.15s ease; /* Strictly opacity, never background or all */
  }
  ```
- **Component Memoization (`React.memo`)**: Interactive slider cards (`QuestionCountSlider`) and checkbox items (`HeadingCheckboxItem`) must be isolated with `React.memo` to guarantee that dragging one control does not cascade re-renders into sibling sliders, headings, or dialog containers.
- **$O(1)$ Membership Lookup**: High-cardinality multi-select elements (e.g. document headings) must index selected keys into a memoized `Set` (`selectedHeadingsSet`), reducing per-item selection checks from $O(N \times M)$ linear scans to constant time $O(1)$.
- **Transition Scope**: Use `transition-colors` instead of `transition-all` on dynamically mapped lists to eliminate layout and composite recomputations.

### 19. Space Hub & Per-Space Curriculum Document Tokens
- **Space Hub Viewport**: `flex-1 flex flex-col h-full bg-ink-950 text-ink-100 overflow-y-auto`.
- **Space Hub Top Banner**: `shrink-0 border-b border-ink-800 bg-ink-900/90 px-6 py-4 backdrop-blur-md sticky top-0 z-20`.
- **Curriculum Document Cards**:
  - Active: `border-emerald-500/40 bg-emerald-950/10 shadow-sm` with `bg-emerald-500/20 text-emerald-300` icon container and emerald status pill.
  - Inactive / Excluded: `border-ink-800 bg-ink-850/40 opacity-70` with `bg-ink-800 text-ink-400` icon container.
  - Active Toggle Input: Custom styled checkbox `h-4 w-4 rounded border-ink-600 bg-ink-800 text-emerald-500 focus:ring-emerald-500/40 cursor-pointer`.
- **Pedagogy Option Cards (Academic Level & AI Persona)**:
  - Selected State: `border-emerald-500/50 bg-emerald-500/10 text-emerald-200 shadow-sm` (Academic Level) or `border-duck-500/50 bg-duck-500/10 text-duck-200 shadow-sm` (AI Persona).
  - Unselected State: `border-ink-800 bg-ink-850/60 text-ink-300 hover:bg-ink-800 hover:text-ink-100`.
- **Space Hub Sidebar Entry Point**:
  - Button placed directly below the Spaces switcher dropdown with `⚙️ Space Hub` icon and `Syllabus` badge. Active state: `border-duck-500/60 bg-duck-500/15 text-duck-300 shadow-duck-500/5 ring-1 ring-duck-500/30`.

### 20. AI Tutor Doubt-Clearing Drawer Tokens
- **Header Badge**: `border border-ink-800 bg-ink-850/60 p-3 rounded-xl` with space initial chip, academic level pill (`text-emerald-400`), and live syllabus status indicator.
- **Message Bubbles**:
  - User: `rounded-2xl rounded-br-xs bg-ink-800 border border-ink-700 text-ink-100`.
  - AI Tutor: `rounded-2xl rounded-bl-xs bg-ink-900 border border-ink-800 text-ink-200`.
- **Rich Markdown Elements (`components/MarkdownRenderer.jsx`)**:
  - Headings (H1–H4): Crisp colored headings with border dividers.
  - Fenced Code Blocks: 10-language syntax highlighting, copy-to-clipboard button, and dark terminal container (`border border-ink-800 bg-ink-950`).
  - KaTeX Display & Inline Math: Embedded KaTeX equations (`$formula$` and `$$formula$$`).
  - Markdown Tables: Rounded borders, highlighted headers (`border-b border-ink-800 bg-ink-900`), and hover rows.
  - Blockquotes: Left border accents (`border-l-2 border-duck-400/80 bg-ink-950/60 pl-3 py-1`).
- **Quick Doubt Starters**: `rounded-full border border-ink-750 bg-ink-850 px-2.5 py-1 text-[11px] font-medium text-ink-300 hover:border-duck-500/50 hover:bg-ink-800 hover:text-ink-100`.

### 22. Physics Diagram Tokens (`force-diagram.jsx` / `energy-bars.jsx`)

Two shared modules own the colour vocabulary for the mechanics scenes, so the same quantity is the same colour in every scene, in its in-scene arrow, in its bar and in the HUD's Details colour key.

- **Free-body forces** (`FORCE_COLOURS`): Weight `#fb7185` (rose) · W∥ = mg sinθ `#fb923c` (orange) · W⊥ = mg cosθ `#a78bfa` (violet) · Normal `#38bdf8` (sky) · Friction `#2dd4bf` (teal) · Applied `#fbbf24` (gold) · Resultant `#34d399` (emerald) · Elastic limit `#f43f5e`.
  - The two components of the weight are deliberately different hues from each other but both warm, so they read as halves of the red weight vector they were resolved from.
- **Energy & work stores** (`ENERGY_COLOURS`): GPE `#a78bfa` (violet) · KE `#38bdf8` (sky) · Thermal / wasted `#fb7185` (rose) · Work in `#fbbf24` (gold) · Work out `#34d399` (emerald) · Total `#e8ebf0` (bone).
- **Arrow scaling**: `useForceScale` normalises the largest force in a diagram to a fixed 1.7 world units. Fixing the scale instead sends arrows off-screen when the mass slider moves; scaling each arrow to its own length destroys the comparison a free-body diagram exists for.
- **Panel chrome**: instrument backings are `#0d121c` at `0.88`–`0.90` opacity; gridlines and axes use `PALETTE.line` / `PALETTE.slate`; every panel is titled with an `accent` `SceneLabel` and captioned with a `text-ink-400` one.
- **`DialGauge`**: 240° sweep, needle in the series colour, and an optional `redline` arc in the thermal rose — a reading past the redline recolours the needle, so a dangerous value says so without a caption.

### 23. Contextual Controls in the HUD Schema (`when`)

A topic's `controls` entry may carry `when: (params) => boolean`. `VisualizationHUD` filters on it before rendering, so a control that only applies to one of a topic's modes is hidden rather than shown inert — the simple-machines bench swaps its fulcrum-position slider for a sheave count when the machine type changes to the block and tackle. Controls without a `when` are always shown, so the field is fully backwards-compatible.

### 24. Universal 3D Visualization Sidebar Controls Resizability Standard
All 3D interactive visualizations across SocraticOS (including shared `VisualizationHUD.jsx`, dedicated `ShadowLabCanvas.jsx`, `EyeCanvas.jsx`, `BinaryTree3D.jsx`, and `RespiratoryCanvas.jsx`) implement a unified, responsive drag-to-resize sidebar pattern:
- **Panel Width Range**: Dynamically clamped between `Math.max(180, Math.floor(window.innerWidth * 0.10))` (minimum 10% viewport / 180px) and `Math.floor(window.innerWidth * 0.80)` (maximum 80% viewport).
- **Persistent Width Storage**: Persisted under `localStorage.getItem("socratic_hud_panel_width")` with SSR-safe initial mount fallback (286px–300px).
- **Right Edge Drag Handle**: `cursor-ew-resize` pill element (`h-14 w-1 rounded-full bg-ink-700/50 group-hover:bg-duck-400/80 group-hover:h-20`) with active drag scaling (`bg-duck-400 shadow-md scale-y-110`).
- **Bottom-Right Corner Grip Indicator**: `cursor-nwse-resize` 3-dot SVG grip pattern (`text-ink-600 hover:text-duck-400`).
- **Scroll Container**: Inner content is encased in a flex column with `max-h-[calc(100vh-2rem)] overflow-y-auto pr-0.5` preventing viewport overflow.

### 21. 3D Respiratory Mechanics & Thoracic Physics Tokens
- **Antagonistic Intercostal Tension Shaders**:
  - Active Contraction: Glowing scarlet crimson (`#ef4444` / `#f43f5e`, emissive intensity `1.7`–`1.8`) with active myofibril swelling signaling energetic recruitment (+35° external on inspiration; -45° internal on forced expiration).
  - Passive Relaxation: Rich oxygenated muscle crimson (`#881337` / `#9f1239`, emissive intensity `0.08`–`0.10`) preserving distinct muscular visibility against dark backgrounds.
  - Multi-Layer Isolation: HUD selector supporting "Both Layers", "External (Insp)", and "Internal (Exp)".
- **Diaphragm Dome Architecture**:
  - Muscular Rim: Deep crimson (`#881337`) with PBR striated myofibril texture, morphing downwards dynamically during active contraction ($Y = 1.05 \to 0.63$), recoiling into an elevated high dome.
  - Central Tendon (*Centrum Tendineum*): Pearly glistening collagen aponeurosis disc (`#f8fafc`) with trifoliate cloverleaf anatomy (anterior, right, and left leaflets).
  - Anatomical Apertures: Caval foramen (T8), esophageal hiatus (T10), and aortic hiatus (T12) with bilateral lumbar crura anchoring into L1–L3.
- **Dynamic Airway Particle Vectors**:
  - Inflow Stream: Crisp sky blue (`#38bdf8`, emissive `1.8`) representing fresh ambient oxygenated air streaming down trachea into bronchi.
  - Outflow Stream: Warm amber gold (`#fbbf24`, emissive `1.8`) representing expired carbon dioxide streams moving upward and out.
- **Real-Time Synchronized SVG Physics Gauges**:
  - Thorax Volume (L): Gradient fill `from-duck-500 via-emerald-400 to-sky-400` with vertical resting FRC marker line (`2.8 L`).
  - Intra-Thoracic Pressure $\Delta P$ (kPa): Bi-directional bar centered at atmospheric zero ($0\text{ kPa}$). Sub-atmospheric vacuum spans left in sky blue (`bg-sky-500`); positive compression spans right in rose (`bg-rose-500`).
  - Air Flow Rate $\dot{V}$ (L/s): Real-time vector meter displaying instantaneous volumetric flow velocity into or out of the lungs.
- **3D Kinematic Motion Arrows**:
  - Ribcage displacement vectors: `PALETTE.rose` (elevation & bucket-handle expansion) vs `PALETTE.sky` (recoil depression).
  - Sternal pump-handle vector: `PALETTE.gold` anteroposterior lift.
### 22. Cambridge IGCSE Math & STEM Question Component Tokens
- **Virtual Math Symbol Tray & Keyboard**:
  - Palette Container: `flex flex-wrap gap-1 p-2 rounded-xl bg-ink-850 border border-ink-800`.
  - Symbol Key Buttons: `px-2 py-1 rounded-lg border border-ink-750 bg-ink-900 hover:border-duck-500/50 hover:bg-duck-500/10 text-ink-200 text-xs font-mono transition-colors cursor-pointer`.
  - Tooltip: `title={sym.desc}` providing immediate guidance for learners unfamiliar with LaTeX syntax.
- **Live KaTeX Preview Card**:
  - Surface: `p-3 rounded-xl border border-ink-800 bg-ink-900/60 min-h-[2.5rem] flex items-center`.
  - Header Tag: `text-[10px] font-semibold text-ink-500 uppercase tracking-wider mb-1`.
  - Compiled Math: `text-sm text-duck-300 font-medium`.
- **Inbuilt Monospace Code Editor (`code_input`)**:
  - Header Bar: `flex items-center justify-between text-[11px] text-ink-500 pb-1`.
  - Language Tag: `font-mono text-duck-400 uppercase font-semibold`.
  - Editor Container: `w-full resize-none rounded-xl border border-ink-800 bg-ink-900 px-3.5 py-3 font-mono text-xs leading-relaxed text-emerald-200 placeholder:text-ink-600 focus:border-duck-500/50 focus:outline-none`.
  - Tab Key Interaction: Intercepts `e.key === "Tab"` to insert 2 spaces without losing focus or causing focus traversal.
- **Multi-Select Checkbox Cards (`multi_select`)**:
  - Unselected Card: `flex w-full items-start gap-3 rounded-xl border border-ink-800 bg-ink-850 text-ink-300 hover:border-ink-700 hover:text-ink-200 px-3.5 py-3 text-left text-[13px] transition-colors`.
  - Selected Card: `border-duck-500/60 bg-duck-500/10 text-ink-100`.
  - Checkbox Pill: `mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors`. Selected: `border-duck-400 bg-duck-400 text-ink-950`; Unselected: `border-ink-600 text-transparent`.
- **Step Ordering Cards (`step_ordering`)**:
  - Step Card: `flex items-center gap-2 p-2.5 rounded-xl border border-ink-800 bg-ink-850 text-[13px] text-ink-200`.
  - Index Badge: `w-5 h-5 rounded-full bg-ink-800 border border-ink-700 text-ink-400 text-[10px] font-bold flex items-center justify-center shrink-0`.
  - Directional Action Buttons: `p-1 rounded bg-ink-800 text-ink-400 hover:text-ink-100 disabled:opacity-20 cursor-pointer`.
- **Question Review Diagnostic Diffs**:
  - Correct Answer Card: `bg-emerald-950/25 border-emerald-500/40 shadow-[0_0_20px_rgba(16,185,129,0.06)]`.
  - Incorrect Answer Card: `bg-rose-950/25 border-rose-500/40 shadow-[0_0_20px_rgba(244,63,94,0.06)]`.
  - Expected Sequence / Chip List: `bg-emerald-500/20 border border-emerald-500/30 text-emerald-200 text-xs font-medium px-2.5 py-1 rounded-lg`.
  - Model Code Solution: `p-2.5 rounded-lg bg-ink-950/90 border border-ink-800 font-mono text-[11px] text-duck-200 overflow-x-auto whitespace-pre`.

### 18. Space-Specific Mastery Dashboard & Space Selector (`MasteryDashboard.jsx`)
- **Header Layout**:
  - Main Title: `text-[28px] sm:text-[32px] font-bold leading-tight tracking-tight text-ink-100 flex items-center gap-3`.
  - Quick Space Selector Dropdown: `rounded-xl border border-ink-700 bg-ink-850 py-1.5 pl-3 pr-8 text-xs font-semibold text-ink-100 focus:border-duck-500/50 focus:outline-none cursor-pointer appearance-none shadow-sm transition-all hover:border-ink-600`.
  - Space Options: List of active workspace spaces (e.g. `🏫 School Space`, `💼 Work Space`, `Personal Space`) plus `🌐 All Spaces` for complete cross-space analytics.
  - Subtitle Context: Dynamic session count & note count description updating between space-scoped (`Scoped to School`) and multi-space aggregate (`Aggregated across all spaces`).
  - Clear History Action: `rounded-lg border border-ink-800 px-3 py-1.5 text-xs text-ink-500 transition-colors hover:border-gap-500/40 hover:text-gap-500 cursor-pointer` (safely clearing only the selected space).
- **Stat Row**:
  - Score Ring Card: `col-span-2 flex items-center gap-4 rounded-2xl border border-ink-800 bg-ink-900 px-5 py-4 sm:col-span-1`.
  - Status Tiles: 3 distinct cards for Solid (`text-solid-500`), Shaky (`text-shaky-500`), and Gap (`text-gap-500`) with proportional percentage fill bars (`bg-ink-800` track with dynamic `fill` widths).
- **Empty State**:
  - Container: `mx-auto flex min-h-[40vh] max-w-2xl flex-col justify-center px-4 py-8 animate-fade-up`.
  - Header persists visibly above empty state to ensure instant switching back to populated spaces or All Spaces.
  - Note Suggestions: Recommends up to 3 notes specifically created in the active space with one-click `Quiz me →` actions.

### 19. 3D Model Credits & Open-Source Attribution Modal (`RespiratoryCanvas.jsx`)
- **Quick-Access Floating Pill Button**:
  - Container / Placement: `absolute top-3 right-3 z-20 pointer-events-auto`.
  - Styling: `flex items-center gap-1.5 rounded-lg border border-ink-800/90 bg-ink-900/90 px-2.5 py-1.5 text-xs font-semibold text-ink-300 shadow-xl backdrop-blur-md transition-all hover:border-duck-500/50 hover:bg-ink-850 hover:text-duck-300 cursor-pointer`.
- **HUD Header Credits Trigger**:
  - Inactive State: `border-ink-700 bg-ink-800 text-ink-400 hover:text-ink-200 hover:border-ink-600`.
  - Active / Open State: `border-duck-500/50 bg-duck-500/20 text-duck-300`.
- **In-HUD Deep Link**:
  - Styling: `pt-2 border-t border-ink-800/60 flex items-center justify-between text-[10px] text-ink-400` with action link `text-duck-400 hover:text-duck-300 hover:underline font-semibold cursor-pointer`.
- **Credits Modal Backdrop & Dialog**:
  - Backdrop: `fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-ink-950/80 backdrop-blur-sm animate-fade-in`.
  - Dialog Frame: `relative w-full max-w-xl max-h-[88vh] flex flex-col rounded-2xl border border-ink-700/80 bg-ink-900/98 shadow-2xl backdrop-blur-xl text-ink-100 overflow-hidden animate-scale-in`.
  - Header: `flex items-start justify-between gap-3 border-b border-ink-800 px-5 py-4 shrink-0 bg-ink-900`.
  - Open Source Badge: `rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-300`.
- **Attribution Cards**:
  - Card Box: `rounded-xl border border-ink-800 bg-ink-850/70 p-3.5 transition-colors hover:border-ink-700`.
  - Semantic License Badges:
    - CC-BY-4.0 & MIT: `bg-sky-500/15 text-sky-300 border-sky-500/30`.
    - CC-BY-4.0 (Commercial Permitted): `bg-emerald-500/15 text-emerald-300 border-emerald-500/30`.
    - Original Shader / Kinematics (Commercial Permitted): `bg-purple-500/15 text-purple-300 border-purple-500/30` / `bg-rose-500/15 text-rose-300 border-rose-500/30`.
  - Outbound Links: Dual links to original Sketchfab artists and GitHub hosting repositories with `ExternalLink` icon and `target="_blank" rel="noopener noreferrer"`.
- **Accessibility & Dismissal**:
  - Dismissible via top-right `X` icon, bottom `Close Credits` button, backdrop click, or native `Escape` key event listener.

### 23. Pre-Download Document Export Preview Tokens (`ExportPreview.jsx` & `ExportImportModal.jsx`)
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

## 🛠️ Code Conventions for AI & Developers

1. **Use Theme Variable Utility Classes**: Always use Tailwind utility classes mapping to `--color-ink-*` (e.g., `bg-ink-950`, `bg-ink-900`, `border-ink-800`, `text-ink-100`, `text-ink-400`).
2. **Never Hardcode Fixed Colors**: Avoid hardcoding raw hex codes like `#000000` or `#ffffff` in components so that Light Mode and Dark Mode render correctly.
3. **SSR Hydration Guard**: Use a `mounted` state (`const [mounted, setMounted] = useState(false); useEffect(() => setMounted(true), []);`) before consuming client-only APIs (`localStorage`, `window`, Dexie).
4. **Local-First Database Persistence**: Ensure new data models sync with Dexie.js (`lib/db.js` & `lib/storageService.js`) and gracefully fall back during offline usage.
5. **Modal Viewport Bounds**: Modal dialogs must use `max-h-[calc(100vh-2rem)] flex flex-col` and `shrink-0` on headers/footers to prevent clipping on compact displays.
6. **Print & PDF Content Guarantees**: Any user-created note content (titles, toggle details, LaTeX formulas, code snippets) must render cleanly in `@media print` without reliance on interactive form controls or fixed-height containers.
7. **KaTeX Extensions & Mathematical Glyphs**: Custom LaTeX macros (such as `\reflectbox{...}` and `\ext{...}`) are supported globally in `lib/editorCaret.js` using `KATEX_GLOBAL_MACROS` (including `"\\ext": "\\text{#1}"` to heal LLM `\ext` and tab-escaped `\text` outputs) and styled via `.reflect-flip` (`display: inline-block; transform: scaleX(-1);`) to ensure proper rendering across both inline and display math blocks.
8. **Selective Block Insertion Dropzones**: The bottom click-to-insert bar (`data-insert-zone="after"`, `hover:bg-duck-400/20`) is scoped strictly to complex/container blocks (`math`, `code`, `table`, `toggle`, `columns`, `site`, `media`, `divider`) where Enter does not naturally append a block below. Linear content blocks (`text`, `h1`–`h4`, `bullet`, `number`, `todo`, `inlinemath`, `callout`, `quote`) omit the bottom dropzone to preserve clean vertical spacing and avoid visual clutter.
9. **PDF Export & Print Sheet Color-Scheme Guarantee**: Always ensure `@media print` forces `:root, html, body` and `@page` to `color-scheme: light !important; background-color: #ffffff !important;` with `--color-ink-950: #ffffff !important`, and resets all dark background container utilities (`.bg-ink-950`, `.bg-ink-900`) to `transparent !important`. This prevents Chromium's print engine from rendering dark mode canvas margins (`rgb(18, 18, 18)`) around the printed page.
10. **Print Layout Rules & Scoped Block Engines**: Never apply layout properties (`display: block !important; width: 100% !important; flex: none !important;`) to universal background color utility selectors (`[class*="bg-ink-950"]`, `[class*="bg-ink-900"]`) in `@media print`. Always scope structural resets strictly to root layout containers (`#__next, main, [data-editor-root]`). For complex blocks (`code`, `table`, `toggle`), provide explicit scoped print rules:
    - **Code Blocks**: Display flex row with fixed-width gutter (`min-width: 2.75rem`) and full-width `<pre>` taking remaining width with high-contrast syntax highlighting token colors.
    - **Tables**: `display: table !important; width: 100% !important; min-width: 100% !important; table-layout: auto !important; border: 1.5px solid #cbd5e1 !important; border-radius: 8px !important;` with interactive toolbars and cell delete buttons strictly hidden (`display: none !important;`).
    - **Toggles**: Single-line flex title row (`gap: 4pt`) with amber `▼` disclosure chevrons mathematically centered directly over the 3px vertical accent line of the expanded details container (`margin-left: 10.5pt !important; margin-right: 5pt !important;`), collapsed badges strictly hidden, and expanded details rendered with legible 10.5pt typography and indented 14pt left border accent (`margin-left: 14pt !important; border-left: 3px solid #cbd5e1 !important;`).
    - **Media Images**: Constrained with `max-height: 180pt !important; object-fit: contain !important; margin: 0 auto !important;` to prevent dominating page vertical space. Captions render as small, muted captions (`font-size: 9pt !important; font-weight: 400 !important; color: #64748b !important; text-align: center !important;`) targeted via `data-media-caption="true"` to prevent specificity collisions with document title selectors.
11. **Toggle Block Layout & Auto-Expansion Rules (`components/BlockNoteEditor.jsx`)**:
    - **Header Flex Alignment**: The toggle header flex row uses `items-start` (never `items-center`) with `mt-0.5` on the 24px chevron button and status badge. This anchors the controls cleanly to line 1 of the title when titles wrap across multiple lines.
    - **Clickable Status Badge**: The `[COLLAPSED]` / `[EXPANDED]` badge is an interactive `<button>` with `hover:border-duck-500/40 hover:text-duck-300`, allowing quick toggling from either side of the block.
    - **Dynamic Auto-Expanding Details Textarea**: Interactive toggle details use dynamic height calculation (`el.style.height = Math.max(48, el.scrollHeight) + 'px'`) on mount, open transition, and input. Textareas use `resize-none overflow-hidden` to completely prevent internal scrollbars and clipping.
    - **Enter Key Stepping**: Pressing Enter at the end of a toggle heading automatically opens the toggle and focuses the details textarea at offset `(0, 0)`. Splitting a heading defaults `nextType` to `"text"`.
12. **Modal Scroll Containers & Unbroken Flex Chains**: When embedding full-length document previews or scrollable content inside modal dialogs:
    - The top-level modal element must declare an explicit computed height class (e.g. `h-[calc(100vh-4rem)] max-h-[920px] flex flex-col`) rather than only `max-h-...` to establish a definite containing block.
    - Every intermediate child wrapper in the DOM hierarchy between the modal root and the scrollable viewport must preserve `flex flex-col flex-1 h-full min-h-0 overflow-hidden`.
    - Inner iframe sandboxes must compute height dynamically against `doc.documentElement.scrollHeight` and forward `wheel` events to the parent canvas ref to avoid scroll trapping.
13. **Editor Click-to-Append & Side Margin Boundary Constraints (`components/BlockNoteEditor.jsx`)**:
    - When 'Click anywhere to place block' (`clickToAppend`) is enabled, clicking on the outer sides of the screen (outside the note reading column, `clientX < rootRect.left || clientX > rootRect.right`) and clicking on side margins beside existing blocks (`clientY <= contentBottom + 8`) is completely disabled from appending or focusing.
    - Click-to-append strictly operates within the note column in the empty bottom whitespace below the final block.
14. **Interactive Onboarding Tutorial Modal Architecture (`components/InteractiveTutorial.jsx`)**:
    - **Layering & Modal Framing**: Uses fixed viewport positioning (`z-[300]`) with glassmorphic backdrop blur (`bg-ink-950/85 backdrop-blur-md`) and elevated modal shell (`z-[310] max-w-4xl max-h-[92vh] rounded-2xl border-ink-700/80 bg-ink-900 shadow-2xl`).
    - **Dynamic Progress Indicator**: Integrated top accent bar featuring a smooth gradient progress fill (`from-duck-500 to-duck-300 h-1.5 transition-all duration-300 ease-out`) calculating percentage from current step index.
    - **Interactive Sandboxes**: Every chapter includes live test widgets with standard design tokens:
      - Category & Step Dots: Clickable step dots (`h-2 rounded-full w-2 bg-ink-700 hover:bg-ink-500`, active `w-6 bg-duck-400`).
      - Mini-Quiz Feedback Tokens: Correct option turns emerald (`border-emerald-500 bg-emerald-500/20 text-emerald-200`); incorrect option turns rose (`border-rose-500 bg-rose-500/20 text-rose-200`).
      - Pomodoro Visualizer: Live circular timer dial (`bg-ink-900 border-ink-700 text-duck-300 font-mono text-2xl font-black`) and tab notification badge preview.
      - Shortcut Buttons: Interactive hotkey pills with click-to-try or clipboard feedback tooltip (`kbd.bg-ink-950 text-duck-300`).

15. **3D Studio Single Top Bar & TopicSelectorDropdown Architecture (`TopicSelectorDropdown.jsx`)**:
    - **Single Distraction-Free Header**: Eliminates redundant secondary horizontal category scroll strips, maximizing viewport height for 3D canvases across both Workspace and `/visualizations` routes.
    - **Trigger Button Design Tokens**:
      - Shell: `rounded-xl border py-1.5 pl-2.5 pr-3 text-xs font-semibold cursor-pointer select-none transition-all`.
      - Closed State: `border-ink-700 bg-ink-850 text-ink-100 hover:border-duck-500/40 hover:bg-ink-800 shadow-sm`.
      - Active/Open State: `border-duck-500/60 bg-ink-800 text-duck-300 ring-2 ring-duck-500/20 shadow-md`.
      - Discipline Badge: `rounded-md bg-ink-900/90 px-1.5 py-0.5 text-[10.5px] font-bold text-ink-300 border border-ink-800 shadow-inner shrink-0` showing subject emoji + capitalized title.
      - Topic Title: Truncated max-width (`max-w-[160px] sm:max-w-[220px] md:max-w-[280px]`) accompanied by rotating chevron (`transition-transform duration-200`).
    - **Dropdown Popover Design Tokens**:
      - Shell: `w-[340px] sm:w-[420px] rounded-2xl border border-ink-750 bg-ink-900/98 shadow-2xl backdrop-blur-2xl z-50 ring-1 ring-black/40 overflow-hidden`.
      - Search Input Header: `p-2.5 border-b border-ink-800 bg-ink-900/90` with embedded `Search` and clear `X` buttons, `bg-ink-950/80 border-ink-750 text-xs text-ink-100 placeholder:text-ink-500 focus:border-duck-500/50`.
      - Subject Quick-Filter Pills: Horizontal pill strip (`bg-ink-950/50 border-b border-ink-800/80 px-2.5 py-1.5`) supporting 1-click discipline filtering:
        - Active Pill: `bg-duck-500/20 text-duck-300 border border-duck-500/50 shadow-sm`.
        - Inactive Pill: `text-ink-400 hover:text-ink-200 hover:bg-ink-850 border border-transparent`.
      - Sticky Discipline Headers: `sticky top-0 z-10 bg-ink-900/95 backdrop-blur-md border-b border-ink-800/80 px-3 py-1.5 text-[11px] font-bold text-ink-300 shadow-sm` with model count badge (`bg-ink-800/80 px-2 py-0.5 rounded-full border border-ink-700/60`).
      - Topic Item Rows: `group flex w-full items-center justify-between gap-3 px-3 py-2 text-left cursor-pointer transition-all`:
        - Active Option: `bg-duck-500/15 border-l-2 border-duck-400 text-duck-200` with `Check` icon in `text-duck-400`.
        - Inactive Option: `hover:bg-ink-850/80 text-ink-300 hover:text-ink-100 border-l-2 border-transparent`.
      - Popover Footer: `px-3 py-2 border-t border-ink-800 bg-ink-950/70 text-[10px] text-ink-500` displaying model counts across 5 disciplines and `Esc to close` shortcut hint.

16. **3D Simple Machines & Mechanics Apparatus Tokens (`SimpleMachinesCanvas.jsx`)**:
    - **Workbench Base**: Modern elevated laboratory table base (`#64748b` rounded slab with `#cbd5e1` brushed aluminum surface inlay and `#475569` corner support pedestals), replacing dark low-contrast surfaces. Floor grid lines balanced at `#334155` / `#475569`.
    - **Precision Balance Beam**: Luminous light blonde birch wood finish (`#f6ede0`) with extruded aluminum reinforcement rails (`#e2e8f0`). Features etched metric ruler graduations (20cm divisions), machined aluminum center pivot hub (`#cbd5e1`), center pivot pin (`#f8fafc`), and an instrument-grade balance deflection needle (`#ef4444`).
    - **Fulcrum Assembly & Elevation Clearance**: Polished metallic aluminum wedge (`#e2e8f0`, height 1.10) elevated on a bench shoe plate (`#cbd5e1`) to `PIVOT_HEIGHT_ABOVE_BENCH = 1.22` above `BENCH_Y`. Includes apex saddle collar (`#cbd5e1`), transverse axle pin (`#f8fafc`), front-facing angular deflection scale (`#f8fafc`) with red center zero and ±10° tick marks, and strict kinematic angle clamping ensuring the lever beam maintains $\ge 0.05$ clearance and never penetrates or dips under the workbench base.
    - **Laboratory Slotted Mass Load**:
      - Central polished suspension spindle (`#f8fafc`) with top circular hanger ring (`#e2e8f0`).
      - Base carrier plate (`#cbd5e1`) supporting stacked precision slotted weights in alternating chrome/platinum (`#f1f5f9` / `#e2e8f0`), raised hub bosses, and radial cutout slot notches.
      - Block-and-tackle safe load updated to light platinum (`#cbd5e1`) with heavy-duty lifting shackle, corner angle plates, and brass combination dial (`#fbbf24`).
    - **Energy & Work Bar Graph Instrumentation (`EnergyBars.jsx`)**:
      - Calibrated absolute energy scale (`scaleMax = 150 J` baseline) scaling bars linearly with load and effort rather than self-normalizing.
      - Integrated slate Y-axis vertical line, horizontal dashed scale division lines at 50% and 100% of scale, and left-axis numerical value labels.
      - Elevated chart mount (`y = BENCH_Y + 0.45`, `x = 5.1`) maintaining clean separation above workbench top with full visibility in standard camera frustums.
    - **Physics Dynamics & Class Vector Tokens (`SimpleMachinesCanvas.jsx`)**:
      - **Dynamic Rotational Inertia**: Stroke cadence scales realistically with load mass (`speed / ((loadN / 200)^0.22)`), visually showing inertial resistance under heavy loads.
      - **Lever Class Effort Directions & Labels**: Class 1 seesaw uses downward press `[0, -1, 0]` ("you push"), Pulley uses downward pull `[0, -1, 0]` ("you pull"), while Class 2 and Class 3 upward levers use `[0, 1, 0]` ("you lift") with load rising in unison.
      - **In-Situ Apparatus Force Vectors**: Live calibrated force arrows mounted directly at the lever beam's effort grip and load hanger (`forceScale = 1.6 / Math.max(650, loadN, effortForce)`), displaying real-time proportional growth and contraction with slider adjustments.
    - **Block and Tackle Gantry Rigging & Sheave Housing Tokens (`SimpleMachinesCanvas.jsx`)**:
      - **Laboratory Gantry Frame**: Twin base footing shoes (`#64748b`) with chrome anchor bolts, vertical structural columns (`#94a3b8`, $r=0.055$, $h=4.8$) with reinforcement collars, and an overhead crosshead I-beam (`#475569`) with lower guide rails (`#cbd5e1`).
      - **Upper & Lower Block Housings**: Steel cheek casings (`#64748b` with rounded corners), bright stainless through-axle pins (`#f8fafc`), and becket tie-off lugs. Lower block includes a vertical swivel shank and forged crane hook (`#e2e8f0`) connected via shackle to the vault load.
      - **Continuous Tangent Arc Rope Threading**: Rope geometry generates multi-point circular arc tangencies around sheave grooves ($R=0.22$) without clipping through pulley centers. Accurately alternates between upper and lower sheaves and terminates at lower (odd $n$) or upper (even $n$) becket.
      - **Kinematic Hauling Travel & Pulling Grip**: Free hauling lead routes over an exit sheave to an ergonomic knurled aluminum handle (`#e2e8f0`) with gold brass caps (`#fbbf24`), traveling exactly $n \times \text{loadDistance} \times \text{phase}$ with co-located effort travel markers and live pull direction vector.

17. **3D Archimedes Buoyancy Vessel & Apparatus Design Tokens (`BuoyancyCanvas.jsx`, `lib/buoyancy.js`)**:
    - **Luminous Laboratory Lighting**: Ambient intensity elevated to 0.88, directional key light elevated to 1.45 (`#ffffff`), banishing dark muddy shadows across materials and liquid transmission.
    - **Laboratory Workbench Base & Satin Gantry**: Elevated laboratory table base (`#64748b` rounded slab with `#e2e8f0` brushed aluminum surface inlay), unified with Simple Machines. Vertical upright columns and overhead crosshead beam in bright satin anodized aluminum (`#94a3b8`, metalness 0.8, roughness 0.25).
    - **Crystalline Acrylic Overflow Tank & Cylinder**: Five-panel transparent acrylic tank ($34\text{ cm} \times 20\text{ cm} \times 24\text{ cm}$, `#b8c9dc` at reduced opacity 0.13 with transmission 0.78 and roughness 0.10) elevated on workbench base, with angled overflow spout positioned at water height ($18\text{ cm}$) aligned with catch cylinder ($x = 3.8$). Cylinder foot lightened to `#94a3b8` with pure white graduation ticks (`#f1f5f9`).
    - **Bright Spring Scale Assembly**: Anodized aluminum casing (`#64748b`), pure white dial face plate (`#f8fafc`), light stem (`#cbd5e1`), polished chrome suspension hook (`#f1f5f9`), and white suspension cord (`#f1f5f9`).
    - **Light Modern Marine Craft (`RealisticBoat`)**:
      - Lofted outer hull with tapered bow cutwater stem, flared deadrise topsides, curved sheer line, flat transom stern, and centerline keel skeg (`colour` material finish with metalness 0.6, roughness 0.35).
      - Open interior hold with inner deck floor and bulkheads demonstrating the large air cavity explaining Archimedes flotation.
      - Titanium marine slate gunwale rub-rail capping, foredeck plate with polished chrome mooring bitt, and aft quarterdeck (`#5b6b80`).
      - Bright blonde teak center thwart bench (`#d4a373`) equipped with a polished chrome marine lifting eyelet ring (`#f1f5f9`, metalness 0.88, roughness 0.2) directly anchored to the spring scale suspension line.
      - Titanium marine slate transverse bilge ribs (`#5b6b80`) crossing the cockpit floor.
      - Flooded/swamped state rendering an internal fluid volume matching fluid refraction, colour, and surface level.
    - **Radiant Fluid & Solid Color Palette**:
      - Fluids: Air (`#cbd5e1`), Gasoline (bright solar yellow `#fef08a`, opacity 0.30), Freshwater (luminous clear sky `#38bdf8`, opacity 0.38), Saltwater (vibrant luminous turquoise `#5eead4`, opacity 0.42), Honey (golden radiant amber `#fbbf24`, opacity 0.58), Mercury (liquid silver `#e2e8f0`, roughness 0.15).
      - Solids: Oak Wood (blonde grain `#d4a373`), Ice (glowing glacial crystal `#e0f2fe`, opacity 0.88), Aluminium (bright billet `#e2e8f0`), Steel (bright stainless steel `#b8c5d6`), Gold (24k yellow gold `#fde047`).
    - **Directional Overflow Spout Stream**: Discrete fluid droplets (`sphereGeometry` $r=0.075$) with fluid opacity 0.85 animating downward along a parabolic trajectory from spout to cylinder solely during positive volume accumulation (`targetML - shownML > 0.6`), instantly dormant when volume is lowered.

18. **3D Wave Refraction & Optical Media Tokens (`PhysicsCanvas.jsx`, `media.js`)**:
    - **Optical Media Distinct Color Ramps**:
      - Air ($n = 1.0$): `#e0f2fe` (luminous ethereal sky white)
      - Ice ($n = 1.31$): `#67e8f9` (crisp glacial cyan)
      - Water ($n = 1.33$): `#0284c7` (deep luminous ocean cobalt)
      - Perspex ($n = 1.49$): `#c084fc` (vibrant optical acrylic violet)
      - Glass ($n = 1.50$): `#60a5fa` (bright optical crown blue)
      - Diamond ($n = 2.42$): `#fef08a` (radiant prism crystalline gold-yellow)
    - **Atmospheric Surrounding Medium Visibility**: Baseline opacity boosted to $0.12$ minimum (`clamp(0.12 + (n1 - 1) * 0.16, 0.12, 0.35)`), ensuring air and ambient environments are visually delineated from the canvas background.
    - **Refracting Block Luminescence**: Surface boundary lines reinforced at $2.8\text{ px}$ width (`0.95` opacity), edge cage opacity at `0.92`, and block mesh emissive intensity at `0.16`.

19. **3D Ray Optics Bench, Curved Mirrors & Lens Tokens (`PhysicsCanvas.jsx`, `scene-kit.jsx`)**:
    - **Optical Bench Track & Saddles (`OpticalRail`, `OpticalCarrier`)**:
      - Bench Track: Bright anodized laboratory aluminum rail (`#94a3b8`, metalness 0.55, roughness 0.35) with satin center channel (`#cbd5e1`), dual polished chrome guidance rails (`#f1f5f9`, metalness 0.95, roughness 0.10), and central gold zero-reference mark (`#fbbf24`).
      - Sliding Saddle Carriers: Precision sliding blocks in bright satin aluminum (`#cbd5e1`, metalness 0.70, roughness 0.30) with polished stainless steel clamp thumbscrews (`#f8fafc`, metalness 0.95, roughness 0.15) clamped beneath the object, optical element, and projection screen.
    - **Optical Glass Lenses (`DetailedOptic`)**:
      - Convex & Concave Elements: Lathe geometry with smooth bevel edge, high transmission glass material (`#a5f3fc`, opacity 0.34, roughness 0.05, metalness 0.12, emissive `#38bdf8` at 0.25).
      - Retaining Bezel Collar: Bright satin aluminum collar (`#cbd5e1`, metalness 0.75, roughness 0.25) with front/rear circular retention lips (`#e2e8f0`) and knurled brass top set screw (`#fbbf24`). Stray horizontal torus ring eliminated.
      - Vertical Support Post: Polished stainless steel rod (`#f8fafc`, metalness 0.95, roughness 0.15).
    - **Spherical Curved Mirrors with Calibrated Flush Casing (`DetailedOptic`, `mirrorProfile`)**:
      - Concave Mirror: Lathe dish curving from front rim at $X = 0$ to center bowl at $X = +0.16$ with silver front face (`#ffffff`, metalness 0.98, roughness 0.02, emissive `#e0f2fe` at 0.15). Fully enclosed by a cylindrical satin bezel ($X \in [-0.02, +0.22]$) with rear titanium protective plate (`#64748b` at $X = 0.215$).
      - Convex Mirror: Lathe dome cresting from apex at $X = -0.04$ to rim at $X = +0.12$. Held securely in a bezel casing ($X \in [0.05, 0.19]$) with rear protective plate at $X = 0.185$.
    - **Adaptive Vector Arrow Tokens (`VectorArrow` in `scene-kit.jsx`)**:
      - Eliminated hard cutoff pruning (`length < headLength * 1.1`).
      - Dynamic scaling: `effHeadLength = Math.min(headLength, length * 0.45)`, `effHeadRadius = Math.max(0.02, headRadius * (effHeadLength / headLength))`, `effRadius = Math.max(0.008, Math.min(radius, effHeadRadius * 0.45))`.
      - Short arrows of any diminutive length (e.g. $0.05\text{ cm}$ to $0.35\text{ cm}$) render with scaled heads and shafts without vanishing.
    - **Ray Construction Palette**:
      - Object: Radiant gold arrow (`#fbbf24`, `PALETTE.gold`).
      - Ray 1 (Parallel $\to$ Focus): Luminous emerald green (`#34d399`, `PALETTE.emerald`, lineWidth 2.4).
      - Ray 2 (Optical Center / Pole Reflection): Sky cyan (`#38bdf8`, `PALETTE.sky`, lineWidth 2.4).
      - Ray 3 (Focal Ray): Violet (`#a855f7`, `PALETTE.violet`, lineWidth 2.2).
      - Formed Image: Real image in solid emerald green (`#10b981`); virtual image in radiant rose (`#f43f5e`, `PALETTE.rose`, opacity 0.70).
      - Virtual Ray Extensions: Dashed construction lines (`opacity: 0.60`, `dashSize: 0.22`, `gapSize: 0.16`).
    - **Real Image Screen (`Screen`)**:
      - Frosted white projection diffuser card (`#f8fafc`, opacity 0.28, roughness 0.75) mounted on a bright stainless steel rod (`#f8fafc`) and satin bench carriage (`#cbd5e1`).

20. **3D Electromagnetic Induction & Faraday's Law Apparatus Tokens (`PhysicsCanvas.jsx`)**:
    - **Dual Apparatus Architecture**:
      - **AC Generator (Dynamo)**: Rotating rectangular copper loop in uniform field $B$ between permanent magnet poles with slip rings, brush contacts, live AC sinusoidal trace, and load indicators.
      - **Bar Magnet & Solenoid Coil**: Multi-turn copper solenoid wound on a transparent acrylic tube with an axial cylindrical bar magnet sliding along chrome guide rails, visualizing Lenz's Law and the $d\Phi/dt = 0$ stationary constraint.
    - **Live AC e.m.f. Top Sine Graph Waveform (`EmfTrace`)**:
      - Elevation: Mounted on top of the apparatus at `position={[0, 4.0, 0]}`, creating $0.8$ units of clear air above the generator magnet poles ($Y = 2.0$) and eliminating bottom viewport occlusion.
      - Graph Chrome: Midnight backing plate (`#0d121c` at $0.88$ opacity, border `#363d54`), horizontal center voltage zero line (`#525e76`), peak threshold dashed limit lines (`#334155`), and real-time scrolling sinusoidal trace in vibrant sky blue (`#38bdf8`, lineWidth 2.4).
      - Title & Scale Labels: Prominent title mounted above the graph grid at `position={[0, TRACE.height + 0.35, 0]}` ($Y = 5.25$, `#f8fafc`, font-bold), with dynamic peak voltage indicator ($\pm V_{\text{peak}}\text{ V}$).
    - **Laboratory Center-Zero Galvanometer (`LaboratoryGalvanometer`)**:
      - Chassis: Anodized slate aluminum enclosure (`#334155`, roughness 0.4, metalness 0.6).
      - Bezel & Dial: Polished chrome front bezel (`#e2e8f0`, metalness 0.9) with porcelain white dial face (`#f8fafc`, roughness 0.8).
      - Scale & Ticks: Center zero arc with graduation marks (`#64748b` / `#475569`, lineWidth 1.8), "+ / −" polarity markings, and brass center pivot cap (`#fbbf24`).
      - Needle: High-visibility pivoted red needle (`#ef4444`, emissive `#ef4444` at 0.90) dynamically tracking instantaneous e.m.f. with angular damping.
      - Stationary Anchor: Permanently positioned at $X = -1.3, Y = -3.30, Z = 1.35$ (right edge at $X = -0.2$), balanced beside the light bulb with fixed wiring leads.
    - **Demonstration Incandescent Light Bulb (`DemonstrationBulb`)**:
      - Socket Base: Ivory ceramic insulator block (`#f8fafc`, roughness 0.3) with threaded brass screw collar (`#d97706`, metalness 0.85, roughness 0.20) and brass binding posts (`#fbbf24`), standing upright on the bench in the foreground at fixed coordinates $X = 1.8, Y = -3.30, Z = 1.35$.
      - Glass Envelope: Blown glass envelope with physical transmission (`color: "#ffffff"`, transmission 0.88, roughness 0.12, opacity 0.38, ior 1.5).
      - Filament: Tungsten hairpin loop with perceptual non-linear voltage power scaling $\text{power} = \operatorname{clamp}((|\mathcal{E}| / V_{\text{rated}})^{1.6}, 0, 2.8)$ ($V_{\text{rated}} = 115\text{ V}$ generator, $85\text{ V}$ solenoid). Ramps dynamically from cold gray (`#64748b`) when unpowered to radiant orange (`#ea580c`), glowing gold, and brilliant incandescent white-hot (`#fef08a`, emissive intensity up to $7.5$) with localized `<pointLight>` intensity scaling from $0$ up to $9.0$ lumens.
    - **Lowered Laboratory Bench & Fixed Meter Anchoring (`LaboratoryBench`)**:
      - Elevation: Baseplate lowered to $Y = -3.48$ (tabletop surface flush at $Y = -3.30$, thickness $0.36$), bevelled edge molding (`#94a3b8`), and grounded rubber feet extending down to $Y = -3.70$.
      - Meter Decoupling & Wire Stability: Both `LaboratoryGalvanometer` ($X = -1.3, Y = -3.30, Z = 1.35$) and `DemonstrationBulb` ($X = 1.8, Y = -3.30, Z = 1.35$) maintain fixed coordinates regardless of `showBulb` state. Toggling the light bulb seamlessly mounts or unmounts the bulb without shifting the galvanometer or breaking wiring leads.
      - Riser Pedestal Flush Boundary: Pedestals extended to `boxGeometry args={[0.85, 1.7, 3.4]}` at $Y = -2.45$, meeting `MagnetPole` at $Y = -1.60$ flush with zero penetration. Central drive shaft extended to height $2.6$, guide rail stanchions to height $2.60$, and solenoid acrylic tube stanchions to height $3.50$.
    - **Laboratory Copper Coils & Rotor Apparatus (`RotatingCoil`)**:
      - Coil Windings: Metallic copper conductors (`#ea580c`, emissive `#fb923c` at 0.20, metalness 0.80, roughness 0.20) wound in $N$ stacked turns.
      - Axle & Slip Rings: Polished stainless steel drive axle (`#f1f5f9`, metalness 0.90, roughness 0.15) with dual polished brass slip rings (`#fbbf24`, metalness 0.88, roughness 0.18).
      - Brush Carriers: Lightened brass mounts (`#cbd5e1` / `#d97706`) with graphite contact blocks (`#475569`, roughness 0.70).
      - Translucent Flux Sheet: Planar rectangular sheet spanning coil aperture (`#38bdf8`, transparent, opacity $[0.04, 0.42]$ tracking $\Phi = B A \sin\theta$).
      - Circulating Charge Flow: 16 glowing charge carrier particles (`#fef08a`, emissive intensity 2.5) circulating along coil edges at speed $\propto \mathcal{E}(t)$.
    - **Bar Magnet & Solenoid Tokens (`SolenoidRig`)**:
      - Support Tube: Transparent acrylic core tube (`#e2e8f0`, opacity 0.22, transmission 0.85, roughness 0.10) held by twin anodized stanchions (`#94a3b8`).
      - Bar Magnet: Cylindrical magnet ($r=0.62$, $L=2.8$) with North pole (ruby red `#ef4444`), South pole (cobalt blue `#3b82f6`), and central chrome divider (`#f8fafc`), mounted on a guide rail sled.
      - 3D Dipole Field Loops: 6 curved elliptical field lines (`#38bdf8`, dashed, opacity 0.35) moving synchronously with the magnet.
      - Lenz's Law Vector: Emerald green arrow (`PALETTE.emerald`) dynamically appearing at solenoid center to indicate induced opposing magnetic field $\vec{B}_{\text{induced}}$.

21. **3D Projectile Motion & Air Resistance Apparatus Tokens (`PhysicsCanvas.jsx`)**:
    - **Upright Forward-Aiming Laboratory Cannon (`LaboratoryCannon`)**:
      - Elevation & Bore Alignment: Pivoting at $[0, \text{LAUNCH\_Y}, 0]$ with barrel tube extending forward along $+X$ ($X = 0$ to $X = +0.52\text{ m}$) towards the flight path. Front open muzzle bore with champagne gold crown ring (`#fde047`) and chrome bevel lip (`#ffffff`) points naturally up into the sky at elevation angle $\theta$. Closed hemispherical breech dome (`#f8fafc`) and chrome cascabel knob (`#ffffff`) seat at the rear $X \le 0$ inside the carriage cradle.
      - Ultra-Light Scientific Materials: Brilliant platinum barrel tube (`#f8fafc`, metalness `0.92`, roughness `0.12`) with dark graphite bore interior liner (`#334155`), sparkling champagne gold muzzle crown & reinforcement bands (`#fde047`, metalness `0.95`, roughness `0.14`), mirror chrome cascabel & trunnions (`#ffffff`), and light aluminum stanchion cheeks (`#cbd5e1`).
      - Protractor Elevation Quadrant: Crisp white dial (`#ffffff`) with laser-engraved $15^\circ$ interval ticks and glowing ruby angle pointer needle (`#ef4444`) tracking elevation angle.
    - **Single-Slab Zero-Z-Fighting Runway & Stratified Elevation Tiers (`DistanceRunway`, `LandingTarget`)**:
      - Zero Coplanar Overlap: Eliminates duplicate finish layer meshes; renders a single solid porcelain runway bed (`#f8fafc`, roughness `0.28`, metalness `0.18`) with satin aluminum curbs (`#cbd5e1`).
      - Hierarchical Depth Stacking: Runway deck ($Y = 0.280\text{ m}$), metric ticks ($Y = 0.282\text{ m}$ with `polygonOffset` factor `-1`), ideal vacuum landing ring ($Y = 0.285\text{ m}$ with `polygonOffset` factor `-2`), and active flight landing ring ($Y = 0.288\text{ m}$ with `polygonOffset` factor `-3`). Zero coplanar intersection across all camera zoom levels.
      - Spatial HTML Label Bands: Near curb ($Z = +0.38$) hosts metric graduations (`zIndexRange={[14, 5]}`), far curb ($Z = -0.38$) hosts landing distance badges (`zIndexRange={[25, 15]}`), apex hosts height marker (`zIndexRange={[40, 30]}`), and in-flight vector arrows host badges (`zIndexRange={[60, 45]}`).
    - **3D Label Visibility Toggle (`showLabels`)**:
      - Supports complete 1-click decluttering of all floating 3D labels (cannon elevation badge, force vector badges, apex altitude marker, runway metric ticks, landing target badges).
    - **60 FPS Zero-Latency Dynamic Force & Velocity Vectors (`updateVector`, `VectorMesh`)**:
      - Direct WebGL transform mutations on mesh refs inside `useFrame`, locked to ball coordinates $(ballX, ballY, 0)$ with zero React re-render overhead.
      - Dynamic Touchdown Hiding: Vectors automatically hide upon runway impact (`isFlying = running && t < flight.flightTime - 0.02`), preventing vector clustering or badge overlap over the landed ball and landing target.
      - Velocity Vector $\vec{v}$: Sky blue (`#38bdf8`, emissive `0.9`), tangential to instantaneous flight path.
      - Weight Force $\vec{W}$: Rose (`#fb7185`, emissive `0.9`), constant downward gravity ($m\cdot g$).
      - Drag Force $\vec{F}_{\text{drag}}$: Amber gold (`#fbbf24`, emissive `1.1`), quadratic atmospheric resistance opposing velocity ($F_d = -k |v| \vec{v}$).
      - Net Resultant Force $\vec{F}_{\text{net}}$: Emerald green (`#34d399`, emissive `1.0`), vector sum $\vec{W} + \vec{F}_{\text{drag}}$.
    - **Debounced Slider Interaction**:
      - Removed component remount `key` and decoupled `MuzzleBlast` from `angleDeg`. Parameter updates feature a 320ms settle debounce, enabling real-time 60 FPS slider trajectory morphing without stuttering or strobe flashes.

22. **3D Gravity Wells & Orbital Motion Design Tokens (`PhysicsCanvas.jsx`, `topics.js`)**:
    - **Spacetime Potential Sheet Wireframe**: Sky blue (`#38bdf8`, opacity `0.2`) on $14\text{ m} \times 14\text{ m}$ plane grid. Depth profiles as $-GM / \max(r, 0.9) + GM / R_{\text{half}}$ with smooth vertex normal shading.
    - **Banked Perimeter Retaining Lip & Containment Ring**:
      - Funnel Lip: Quadratic elevation curvature ($+0.35\text{ m}$ rise) starting at $r = 5.8\text{ m}$ to the perimeter ($r = 7.0\text{ m}$).
      - Luminous Containment Ring: Thin neon sky cyan double-sided ring (`#38bdf8`, opacity `0.45`, radius $6.68\text{ m}$–$6.82\text{ m}$) marking the outer boundary of the potential well.
    - **Symplectic Banked Rim Containment**:
      - Preserves tangential angular momentum while restoring radial velocity inward via $k_{\text{rim}} = 32.0$ restoring acceleration and radial momentum redirection.
      - Keeps high-speed satellites ($v \ge v_{\text{escape}}$) contained inside the potential well, transforming open escape trajectories into smooth perimeter rim banks.
    - **Apparatus & Celestial Bodies**:
      - Central Mass: Glowing gold sphere (`#fbbf24`, emissive intensity `1.8`) with atmospheric halo ring (`#fbbf24`, opacity `0.1`).
      - Orbiting Satellite: Machined glowing emerald beacon (`#34d399`, emissive intensity `1.4`) with non-wrapping smooth FIFO line trail (`#34d399`, opacity `0.7`).

23. **3D Light, Shadows & Straight Lines Optical Bench Design Tokens (`ShadowLabCanvas.jsx`, `lib/shadowOptics.js`)**:
    - **Scientific Optical Bench Apparatus**:
      - Bench Bed: Ruled metric optical bench in brushed aluminum (`#8c9cb3`, metalness `0.1`, roughness `0.65`).
      - Pedestal Posts: Matte slate column (`#39414f`, metalness `0.4`, roughness `0.6`) on weighted bevelled base (`#2c3340`), with dynamic anti-clipping elevation clearance $\Delta y = \max(H, H|\cos\theta| + R|\sin\theta|) + 0.4\text{ cm}$ and articulated center spindle.
    - **Detailed Light Sources (`LightSource`)**:
      - Pinpoint Torch: Dark gunmetal barrel (`#1e293b`, metalness `0.7`, roughness `0.45`) with triple ribbed knurled grip rings (`#0f172a`), stepped tailcap (`#334155`) with red click switch (`#ef4444`), stepped brass retaining collar (`#d4af37`, metalness `0.85`, roughness `0.25`), specular chrome parabolic reflector dish (`#f8fafc`, metalness `0.96`, roughness `0.08`), transparent convex optical glass lens disc (`#e0f2fe`, transmission `0.85`, opacity `0.35`, ior `1.5`), and radiant tungsten filament emitter (`#fffbe8`, emissive `#ffe9a8`, emissiveIntensity `3.4`).
      - Wide Troffer Lamp: Formed industrial sheet metal reflector hood (`#1e293b`, metalness `0.5`, roughness `0.6`) with polished aluminum inner trough liner (`#cbd5e1`, metalness `0.85`), twin angled tubular stanchion yoke struts (`#334155`, metalness `0.7`), molded ceramic bi-pin socket end caps (`#475569`) with brass terminal rings (`#d4af37`), frosted fluorescent diffuser tube (`#fef9c3`, emissive `#fef08a`, emissiveIntensity `2.5`), and glowing cathode core wire (`#ffffff`, emissive `#fffbeb`, emissiveIntensity `3.5`).
    - **3D Test Objects & Shelf Registry (8 Shapes)**:
      - Cylindrical Rod, Cube, Upright Cone, Sphere, Torus Ring, 4-Sided Square Pyramid, Letter T, Letter L.
      - Torus Ring: Annular torus mesh casting a donut shadow with a clear light aperture at $0^\circ$ and a solid rectangular bar at $90^\circ$ edge-on.
      - Square Pyramid: 4-sided pyramid transitioning from a triangular silhouette at $0^\circ$ to a square base silhouette at $90^\circ$.
      - Letter L: Correctly oriented standard upright "L" across 3D solid, 3D projection screen, and 2D HUD preview card.
    - **Projection Screen & Shadow Rendering Engine**:
      - Illumination: Inverse-square law $1/d^2$ throw factor with $\cos^3\theta$ angular falloff creating authentic radial vignetting on paper texture.
      - Measuring Grid: Ruled $10\text{ cm}$ grid lines (`rgba(96,110,132,0.30)`) with high-contrast optical axis crosshair (`rgba(96,110,132,0.55)`).
      - Measuring Guides: Gold dashed lines (`rgba(251,191,36,0.85)`) for full umbra boundary; cyan dashed lines (`rgba(56,189,248,0.80)`) for outer penumbra boundary.
      - Smooth Continuous Morphing: Continuous corner rounding $r = \min(w, h) \cdot \sin(\theta)$ eliminating harsh step transitions during cylinder and cone rotation.

24. **3D Incline Plane & Friction Laboratory Apparatus Design Tokens (`InclineFrictionCanvas.jsx`)**:
    - **High-Visibility Studio Lighting**:
      - Ambient Light: `0.85` intensity for clear visibility across all geometric faces.
      - Directional Key Light: `1.7` intensity with balanced specular highlights.
    - **Apparatus Base & Extruded Aluminum Fixtures**:
      - Base Plate: Satin brushed aluminum (`#94a3b8`, metalness `0.65`, roughness `0.35`).
      - Spirit Level Vial: Luminous emerald vial (`#4ade80`, emissive `#4ade80`, emissiveIntensity `1.5`).
      - Rear Upright Support Mast: Extruded structural aluminum rail (`#94a3b8`, metalness `0.8`, roughness `0.25`).
      - Sliding Collar & Knob: Precision silver collar (`#cbd5e1`) with knurled brass knob (`#fbbf24`).
      - Pivot Knuckles & Pin: Polished steel brackets (`#94a3b8`) with brass hinge pin (`#fbbf24`).
    - **Ramp Plank & Track Geometry**:
      - Wedge Incline Support: Light satin anodized silver (`#cbd5e1`, roughness `0.35`, metalness `0.35`).
      - Ramp Track Materials:
        - Polished Maple Wood: Warm honey birch (`#d4a373`, roughness `0.55`).
        - Teflon (PTFE): Pure porcelain white (`#f1f5f9`, metalness `0.35`, roughness `0.08`).
        - Neoprene Rubber: Modern slate blue-gray (`#64748b`, roughness `0.85`).
      - Guide Channel Rails: Mirror-finish extruded chrome (`#e2e8f0`, metalness `0.85`, roughness `0.2`).
      - Graduation Ruler Ticks: Crisp contrast markings (`#0f172a`, width `2.2` / `1.4`) with clear distance labels (`text-ink-200`).
      - Pulley & Pull String: Chrome pulley wheel (`#f1f5f9`) with brass axle pin (`#fbbf24`) and high-tensile gold nylon cable (`#f59e0b`, width `2.8`).
    - **Cargo Crate Materials & Detailing**:
      - Wood Body: Bright golden honey cedar (`#d4924b`, roughness `0.55`) with chestnut reinforcement banding (`#a06030`).
      - Corner Brackets: Gleaming polished brass brackets (`#fbbf24`, metalness `0.85`).
      - Lifting Handles: High-contrast chrome handles (`#e2e8f0`) with slate recessed wells (`#475569`).
    - **Grip Gauge & Plot Area (3D HUD Billboard & Chassis Tokens)**:
      - Dynamic Camera Billboard: Both `GraphPanel` and `GripGauge` wrap their structures in `@react-three/drei`'s `<Billboard follow={true}>` centered at their 3D geometric centers, rotating dynamically with camera OrbitControls to remain perpendicular to the viewing vector from all angles ($0^\circ$ to $360^\circ$) without planar foreshortening or mirror distortion.
      - 3D Instrument Chassis: Replaced single-sided 2D planes with extruded 3D chassis boxes (`boxGeometry` with depth `0.03` - `0.04`) and `THREE.DoubleSide` materials:
        - Grip Gauge: Slate-blue chassis (`#222f46`, opacity `0.95`, `args={[3.46, 0.44, 0.03]}`), border (`#475569`), tick divisions (`#64748b`), and double-sided fill bar.
        - Graph Panel: Slate chassis (`#1e2638`, opacity `0.94`, `args={[width + 0.8, height + 1.0, 0.04]}`), border (`#38455c`), grid (`#2e3b52`), and mathematical zero-axes (`#94a3b8`).
      - Centered World Pivots: Inner content offset by $[-w/2, -h/2, 0]$ ensures rotation occurs in-place around true bounding centers, preventing translation into adjacent apparatus fixtures during 180° rotations.
      - Direction-Aware Zero Baseline & Dashed Interior Lines:
        - Bottom Anchor (Uphill motion, $v \ge 0$): $v = 0$ is aligned with the bottom border (`yMin = 0`), maximizing vertical resolution and eliminating the center horizontal line.
        - Top Anchor (Downhill motion, $v \le 0$): $v = 0$ is aligned with the top border (`yMax = 0`).
        - Subtle Dashed Reference Line: When $yZero$ is interior, rendered as `#64748b` with `dashSize=0.08`, `gapSize=0.06`, `opacity=0.6`, `lineWidth=1.2`.
      - Calibrated Monospace Tick Labels: Monospace labels (`text-[9px] font-mono text-ink-400 select-none pointer-events-none`) for both time ($X$) and velocity ($Y$) axes.
      - Dynamic Label Visibility & Decluttering Mode:
        - Toggle `removeLabels`: Cascading suppression across vector tags, crate mass, ramp angle, centimeter ticks, grip status, and graph scales.
        - Preserves clean vector shafts and geometry with zero HTML layout shift.


