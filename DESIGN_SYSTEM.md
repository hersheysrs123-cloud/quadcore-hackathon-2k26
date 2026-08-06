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

Reserved for the mastery heatmap and quiz results. **Never** reuse these as
decoration or as a generic series colour.

| Token | Dark | Light | Meaning | Glyph |
| :--- | :--- | :--- | :--- | :--- |
| `--color-solid-500` | `#0ca30c` | `#0a7d0a` | Solid — explained the mechanism unprompted | `●` |
| `--color-shaky-500` | `#ec835a` | `#ea580c` | Shaky — correct but recited, or needed leading | `◐` |
| `--color-gap-500` | `#d03b3b` | `#b02a2a` | Gap — wrong, absent, or collapsed on a follow-up | `○` |

**Colour is never the only channel.** Every place that paints a status must also
render the glyph and the word — a good/bad scale is red-vs-green by definition,
which collapses under deuteranopia (ΔE 0.7). The glyphs form an ordinal ramp
(filled → half → hollow) that survives greyscale and a 12px cell.

The scale's yellow step is deliberately **unused**: it measures 1.08 contrast
against `--color-duck-400`, so a "shaky" chip would read as a primary button.
The light steps are re-stepped for the light surface rather than flipped, and
light-mode shaky avoids the darker orange because it sits ΔE 0.1 from the
light-mode duck accent. All three clear 4.5:1 on `ink-900` in both modes.

---

## 📐 Typography & Layout Guidelines

- **Font Family**: System UI sans-serif with `-webkit-font-smoothing: antialiased`.
- **Note Title**: `text-4xl font-extrabold tracking-tight text-ink-100` (substantially larger than H1).
- **Headings**:
  - **H1**: `text-3xl font-bold tracking-tight text-ink-100`
  - **H2**: `text-xl font-semibold tracking-tight text-ink-100`
  - **H3**: `text-lg font-semibold text-ink-100`
- **Code Snippet**: `font-mono text-sm leading-relaxed text-emerald-300 bg-ink-850 rounded-lg px-4 py-3 border border-ink-700`

---

## 🧩 Component Architecture

### 1. Left Sidebar (`Sidebar.jsx`)
- **Width**: Fixed `w-64 shrink-0`.
- **Brand Header**:
  - Duck Emoji: `text-xl`
  - Brand Title: `text-sm font-bold text-ink-100`
  - **Spaces Selector Dropdown**: Compact button next to logo (`text-xs font-medium text-ink-200 border border-ink-700/70 bg-ink-850/90`) displaying current space icon and name with a dropdown popover to choose/switch spaces or create a new space.
  - Settings Button: `text-lg text-ink-400 hover:text-ink-100` (positioned top-right of brand header).
- **Notes List**: Expanded full-height list per active space with delete icon `🗑️` on hover.
- **Bottom Trash Tab**: Fixed tab `🗑️ Trash (24h)` showing active deleted notes count with 24-hour auto-purge timer.

### 2. Top HUD Header (`Workspace.jsx`)
- **Height**: `h-14 shrink-0`.
- **Left Breadcrumb Context**:
  - Active Space (`text-sm font-semibold text-ink-300`)
  - Separator (`/`)
  - Active Note Title (`text-base font-bold text-ink-100`).
- **Center Navigation Tabs**: 4 pill tabs (`📝 Notes`, `📅 Calendar`, `🧊 3D`, `📊 Mastery`). The Mastery tab carries a `gap-500` count badge when the heatmap holds unresolved gaps.
- **Far Right Action Bar**:
  - `💾 Save Note` button (triggers Supabase note persistence & toast notification).
  - `✨ Explain` button (opens the Explain drawer for the active note).
  - `🦆 Quiz me` button (opens the graded quiz drawer; the Socratic Duck is its second tab).

### 3. BlockNoteEditor (`BlockNoteEditor.jsx`)
- **Page Cover Banners**: Spans **100% full horizontal width** (`w-full h-44 md:h-52`) across the top of the Notes tab. Presets include *Cyberpunk*, *Sunset Amber*, *Ocean Teal*, *Midnight Blue*, and *Socratic Gold*.
- **Top Right Cover Button**: Positioned at top-right (`right-6 top-3/top-4`). Renders as a translucent glassmorphic button over active cover banners (`bg-ink-950/40 opacity-60 hover:opacity-100`).
- **Slash Menu (`/`)**: Floating block-type picker menu (`text`, `h1`, `h2`, `h3`, `bullet`, `code`, `action`).
- **Floating Action Bar**: Appears above non-empty selected text blocks with formatting triggers (`B`, *I*, <u>U</u>).
- **Block Context Menu**: `✨ Explain` / `🦆 Quiz me` for that block, then formatting, "turn into", and delete. There is deliberately no separate Duck entry — it opened the same Socratic session that is already the second tab of the Quiz drawer.
- **6-Dots Handle is draggable**: holding `⠿` sets `draggable` on the row so blocks reorder by drag; a plain click still opens the context menu. The drop target shows a `duck-400` insertion rule.

### 4. Settings & Factory Reset (`Sidebar.jsx`)
- **General Tab**: Theme switcher (Dark Slate vs. Warm Stone Light) and Supabase database sync button.
- **Factory Reset Tab**: Module factory reset options (Notes, Calendar, 3D, All) requiring double confirmation and a randomized math captcha human verification check.

---

## 🛠️ Code Conventions for AI & Developers

1. **Use Theme Variable Utility Classes**: Always use Tailwind utility classes mapping to `--color-ink-*` (e.g., `bg-ink-950`, `bg-ink-900`, `border-ink-800`, `text-ink-100`, `text-ink-400`).
2. **Never Hardcode Fixed Colors**: Avoid hardcoding raw hex codes like `#000000` or `#ffffff` in components so that Light Mode and Dark Mode render correctly.
3. **SSR Hydration Guard**: Use a `mounted` state (`const [mounted, setMounted] = useState(false); useEffect(() => setMounted(true), []);`) before consuming client-only APIs (`localStorage`, `window`).
4. **Database Persistence**: Ensure new data models sync with Supabase API routes (`/api/notes/save`, `/api/calendar/events`, `/api/visualizations`) and fallback gracefully to `localStorage`.
