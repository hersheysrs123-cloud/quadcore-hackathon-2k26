# SocraticOS — Design System & Theme Specifications

> **Notice for Developers & AI Assistants**: 
> This document defines the authoritative design tokens, color ramps, component architecture, and styling rules for SocraticOS. Always refer to this specification when building new UI components or modifying existing themes.

---

> **This file holds the foundations** (colour tokens, typography). Component specs, conventions and per-scene 3D tokens live in [`docs/design/`](docs/design) and are indexed below. Read [`conventions.md`](docs/design/conventions.md) before writing any UI code.

---

## 🎨 Theme Architecture & Color Tokens

SocraticOS uses a dynamic CSS variable system defined in `app/globals.css` with `@import "tailwindcss";` and `@theme`. The theme toggles between **Dark Mode** (default) and **Light Mode** via the `data-theme="light"` attribute or `.light` class on the root `<html>` element.

### 1. Color Palette Tokens (`--color-ink-*`)

| Token | Dark Mode (Sleek Slate) | Light Mode (crisp white) | Usage / Intent |
| :--- | :--- | :--- | :--- |
| `--color-ink-950` | `#12151e` | `#ffffff` | Main viewport background |
| `--color-ink-900` | `#181c27` | `#f3f4f6` | Sidebar, Top HUD Header, Card surfaces |
| `--color-ink-850` | `#1f2332` | `#ffffff` | Inputs, hover states, block backgrounds |
| `--color-ink-800` | `#282d3f` | `#9ca3af` | Borders, active tab indicators, dividers |
| `--color-ink-750` | `#2f364b` | `#848b99` | Half-step between 800 and 700: input and chip borders (`border-ink-750`) |
| `--color-ink-700` | `#363d54` | `#6b7280` | Secondary borders, muted badges |
| `--color-ink-600` | `#4e5672` | `#4b5563` | Placeholders, muted hints, scrollbars |
| `--color-ink-500` | `#737c9a` | `#374151` | Subtitles, breadcrumbs, uppercase section titles |
| `--color-ink-400` | `#9aa2bc` | `#1f2937` | Secondary text, nav item icons |
| `--color-ink-300` | `#b8bfd6` | `#182130` | Half-step between 400 and 200: readable secondary text (`text-ink-300`) |
| `--color-ink-200` | `#d6dbed` | `#111827` | Primary body text |
| `--color-ink-100` | `#f1f3fa` | `#000000` | High-contrast headings & active titles |

> **Only the steps listed here exist.** Tailwind v4 generates no CSS at all for a colour that is not defined in `@theme`, so a class such as `text-ink-350` compiles to nothing and the element silently inherits its parent's colour. Before adding a new step, define it in both the dark `@theme` block and the `[data-theme="light"]` override in `app/globals.css`.

### 2. Accent Tokens (`--color-duck-*`)

| Token | Hex / Value | Usage |
| :--- | :--- | :--- |
| `--color-duck-100` | `#fdf1d0` (Dark) / `#6b2f0b` (Light) | Emphasis text on a selected row (e.g. the highlighted Command Palette result) |
| `--color-duck-200` | `#fae3a3` (Dark) / `#7c3a0d` (Light) | Emphasis text on accent-tinted surfaces |
| `--color-duck-300` | `#f7d67c` (Dark) / `#d97706` (Light) | Duck action bar text, active 3D badge text |
| `--color-duck-400` | `#f0c04a` (Dark) / `#b45309` (Light) | Primary accent buttons, active space dot |
| `--color-duck-500` | `#d9a227` (Dark) / `#92400e` (Light) | Focused borders, button hover ring |
| `--color-duck-700` | `#8a6410` (Dark) / `#78350f` (Light) | Solid ribbon fills (Word export preview) |

### 3. Mastery Status Scale (`--color-solid-500` / `--color-shaky-500` / `--color-gap-500`)

Reserved for the mastery heatmap, quiz results, and topic confidence indicators. **Never** reuse these as decoration or as a generic series colour.

| Token | Dark | Light | Meaning | Glyph |
| :--- | :--- | :--- | :--- | :--- |
| `--color-solid-500` | `#0ca30c` | `#0a7d0a` | Solid — explained the mechanism unprompted | `●` |
| `--color-shaky-500` | `#ec835a` | `#ea580c` | Shaky — correct but recited, or needed leading | `◐` |
| `--color-gap-500` | `#d03b3b` | `#b02a2a` | Gap — wrong, absent, or collapsed on a follow-up | `○` |

Each status also has lighter emphasis steps for text and hover states: `--color-solid-300` / `--color-solid-400` (`#4ade80` / `#22c55e` dark, `#16a34a` / `#15803d` light) and `--color-gap-300` / `--color-gap-400` (`#f08080` / `#e35d5d` dark, `#b91c1c` / `#991b1b` light). The light steps are darker, not lighter, so they stay legible on white.

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

Two further classes, `.font-note-handwriting` (Caveat) and `.font-note-geometric` (Plus Jakarta Sans), are defined in `app/globals.css` but `NOTE_FONTS` in `NoteMenu.jsx` does not offer them, so the picker shows three.

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

Component and pattern specs, one file per area (section numbers are unchanged from the original document):

| File | Sections |
| :--- | :--- |
| [layout-and-navigation.md](docs/design/layout-and-navigation.md) | 1 Sidebar · 2 Top HUD · 3 Web Saver · 5 Settings · 6 Modals |
| [editor-and-blocks.md](docs/design/editor-and-blocks.md) | 4 Block editor · 9 Outline · 10 Columns · 12 Sub-bullets · 15 KaTeX · 28 Nested sub-pages |
| [print-and-export.md](docs/design/print-and-export.md) | 7 Print stylesheet · 8 Standalone HTML export · 29 Export preview |
| [quizzes-and-mastery-ui.md](docs/design/quizzes-and-mastery-ui.md) | 11 Note combobox · 13 Deletion modal · 16 Quiz runner · 17 Quiz creator · 18 Sliders · 25 IGCSE question types · 26 Mastery dashboard |
| [ai-and-spaces-ui.md](docs/design/ai-and-spaces-ui.md) | 14 AI reformatter · 19 Space Hub · 20 AI tutor drawer |
| [3d-studio-ui.md](docs/design/3d-studio-ui.md) | 21 Physics diagrams · 22 Contextual controls · 23 Sidebar resizing · 24 Respiratory · 27 Model credits · topic selector |

## 🛠️ Code Conventions for AI & Developers

The rules every UI change must follow: [conventions.md](docs/design/conventions.md) (conventions 1–14). Conventions 15–27 are the per-scene 3D specifications:

| File | Conventions |
| :--- | :--- |
| [3d-scene-tokens-mechanics.md](docs/design/3d-scene-tokens-mechanics.md) | 16 Simple machines · 17 Buoyancy · 24 Incline · 25 Hooke's law · 26 Roller coaster · 27 Dynamometer stand |
| [3d-scene-tokens-optics-and-fields.md](docs/design/3d-scene-tokens-optics-and-fields.md) | 18 Refraction · 19 Ray optics · 20 Induction · 21 Projectile · 22 Gravity wells · 23 Shadow lab |
