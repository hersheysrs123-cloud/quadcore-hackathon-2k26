# Design — editor and blocks

> Part of the [SocraticOS design system](../../DESIGN_SYSTEM.md). Block editor, outline, columns, sub-bullets, KaTeX and nested sub-pages (sections 4, 9, 10, 12, 15, 28).

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

### 15. KaTeX LaTeX & Chemical Formula Rendering (`MathText` & `.katex-inline-node`)
- **Display Math Container**: `block my-2 overflow-x-auto overflow-y-hidden text-center py-1 select-text` (with responsive horizontal scroll preservation for wide equations).
- **Inline Math Container (`MathText` & `.katex-inline-node`)**: Seamless Notion-style typography: transparent background (`bg-transparent`), zero borders (`border: none`), natural text matching (`color: inherit`, `text-ink-100`), baseline alignment (`vertical-align: baseline`), subtle hover background highlight (`hover:bg-ink-800/60`), and no side handles or pill brackets.
- **KaTeX Styling Guarantees**: Relies on bundled `katex/dist/katex.min.css` across all runners and review reports, guaranteeing standard Computer Modern math typography for physics vectors, calculus integrals, and chemistry arrows.

### 28. Nested Sub-Pages: Page Cards, Sidebar Tree & Gutter Insert Menu
- **Sub-Page Card (`PageBlock`, block type `page`)**:
  - Live card: `flex items-center gap-3 rounded-lg border border-transparent bg-ink-900/40 px-3 py-2 my-1 cursor-pointer hover:bg-ink-850 hover:border-ink-700 focus:ring-1 focus:ring-duck-400/50 focus:border-duck-500/40` (`tabIndex=0`, `role="link"`).
  - Icon tile: `h-7 w-7 rounded-md bg-ink-850 text-base` holding the child's emoji; Title: `text-[15px] font-semibold text-ink-100 underline decoration-ink-700 underline-offset-4` (hover → `decoration-duck-400/70`); Arrow: `→ text-ink-500`, nudged `translate-x-0.5` and tinted `text-duck-300` on hover.
  - Degraded card (page trashed or missing): `border-dashed border-ink-700 bg-ink-900/30 cursor-default`, title `text-ink-400 line-through decoration-ink-600`, helper line `text-[11px] text-ink-500`, actions `🔄 Restore` (`border-duck-500/40 bg-duck-500/15 text-duck-200 hover:bg-duck-500/25`) and `Remove` (`border-ink-750 bg-ink-850 text-ink-300 hover:border-rose-500/40 hover:text-rose-300`), both `print:hidden`.
- **Block Gutter**: three hover controls at `absolute -left-[4.5rem] top-2 gap-0.5` — `+` (`text-sm font-bold text-ink-500 hover:bg-ink-800 hover:text-duck-300`; stays `bg-ink-800 text-duck-300` while its menu is open), `🗑️` (`text-rose-400/90 hover:bg-rose-500/20`), `⠿` (`text-ink-500 hover:text-duck-300 cursor-grab`).
- **Insert-below menu**: the `SlashMenu` surface (`w-64 rounded-xl border-ink-700 bg-ink-900 shadow-2xl`) with header label `Insert below` and an inline filter input (`rounded-md border-ink-750 bg-ink-950 px-2 py-1 text-xs focus:border-duck-400`); empty state `text-[11px] italic text-ink-500 "No matching blocks."`. Items are relevance-ranked (`rankSlashItems`), the active row is `bg-ink-800 text-ink-100` with a `bg-duck-500/20 text-duck-300` icon tile.
- **Sidebar Tree Rows** (`Sidebar.jsx`, `renderNoteNode`):
  - Indent: `paddingLeft = 14px × depth`; every row reserves a `h-5 w-5` slot before the emoji so titles align whether or not a chevron is present.
  - Chevron toggle: `ChevronRight` `h-3.5 w-3.5 strokeWidth 2.5 text-ink-500 hover:bg-ink-800 hover:text-duck-300`, rotated `rotate-90` when expanded (`transition-transform duration-200`), `aria-expanded` mirrored.
  - Nested list: wrapper `grid transition-[grid-template-rows] duration-200 ease-out grid-rows-[0fr] | grid-rows-[1fr]`; inner `<ul class="min-h-0 overflow-hidden space-y-1">` gains `mt-1` when open and `inert` when closed.
  - Drag indicator starts at the row's indent (`left: <indent>px`) so it never spans a parent row; rows outside the dragged note's sibling group are dimmed `opacity-60` and refuse drops (`dropEffect = "none"`).
  - Trash drawer relationship badge: `rounded bg-duck-500/10 px-1.5 py-0.5 text-[10px] text-duck-300` reading `↳ in {parent}`.
- **Note menu item**: `New sub-page` uses `FilePlus2` (`text-duck-400`) with a `Nested` hint label (`text-[10px] text-ink-500`).
