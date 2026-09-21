# SocraticOS — Comprehensive Codebase Summary & Handover Guide

> **To any AI Assistant or Developer taking over**: 
> This document provides an exhaustive, authoritative technical overview of **SocraticOS** (`quadcore-hackathon-2k26`). It explains the architecture, local-first IndexedDB storage model, UI component hierarchy, 20-block note editor, 51-topic 3D scientific simulation studio across 5 STEM domains, AI tutoring & diagnostic quiz engines, multi-timer HUD system, export/import engine, design system tokens, and operational gotchas.

---

## 📌 1. Executive Summary & Tech Stack

**SocraticOS** is an intelligent, Notion-inspired learning operating system and 3D scientific visualization studio built on one fundamental principle: **rereading is not studying**. The application pairs rich block-based note-taking with interactive real-time 3D models, structured AI explanations, diagnostic quizzes across 7 question types, an interactive space-grounded AI Tutor, multi-timer HUDs, website bookmarking with folder hierarchies, and an aggregate mastery heatmap tracking sub-topic confidence over time.

### Tech Stack:
- **Framework**: Next.js 15.0.0 (App Router, Turbopack / Webpack build engine)
- **UI & Logic**: React 19 (Server & Client Components), Tailwind CSS v4 (`@tailwindcss/postcss`, dynamic CSS variable design tokens)
- **State Management & Hooks**: **Zustand** v5 (`persist` middleware, auto-sleep ticker engine) + **usehooks-ts** v3 (`useOnClickOutside` standardized event hooks)
- **Database & Storage**: Local-first IndexedDB via **Dexie.js** (`SocraticOS_LocalDB` v8) — 100% offline, private, zero-latency browser storage for notes, trash, calendar events, study sessions, alarms, folders, bookmarks, quizzes, quiz trash, space documents, and graphics settings
- **AI Integration**: Direct **Google Gemini API** (`lib/gemini.js` with OpenAPI 3.0 schema enforcement) + Client-side Dexie API Key storage with fallback to `/api/` server routes (`app/api/explain`, `app/api/quiz/generate`, `app/api/quiz/grade`, `app/api/reformat`, `app/api/tutor/chat`). `lib/aiService.js` provides isomorphic client/server AI orchestration
- **3D Engine**: Three.js (r185), `@react-three/fiber` (v9), `@react-three/drei` (v10), custom Canvas engines with OrbitControls, procedural & clinical CT geometry, and WebGL lifecycle memory management
- **Math & Equation Engine**: KaTeX (`katex`) for full block and in-sentence `$formula$` inline math rendering
- **Syntax Highlighting**: **PrismJS** (`prismjs` v1.30.0) AST tokenizer across 10 programming languages with custom color token mapping
- **Document & File Conversion**: `docx` + `mammoth` (MS Word generation & parsing), HTML/Markdown/Plain-Text lossless conversion, Netscape Bookmark standard HTML import/export, `.socratic` JSON workspace backup format
- **Timer & Audio Subsystem**: Reactive multi-timer Zustand store (`lib/timerStore.js`, 0% idle CPU auto-sleep), Web Audio API chime synthesis for alarms, dynamic browser tab favicon (`🦆` $\leftrightarrow$ `❗️`) and title flashing

---

## 📂 2. Repository Structure & File Map

The annotated file tree is split by area so each file stays readable:

| File | Covers |
| :--- | :--- |
| [file-map-app-and-components.md](docs/codebase/file-map-app-and-components.md) | `app/` (pages, API routes, error boundaries) and `components/` (28 app-UI components) |
| [file-map-3d-visualizations.md](docs/codebase/file-map-3d-visualizations.md) | `components/visualizations/` — every 3D scene, the shared kits and the topic registry |
| [file-map-lib.md](docs/codebase/file-map-lib.md) | `lib/` — one pure engine per 3D topic, plus storage, AI, export and editor services |
| [file-map-tests-scripts-docs.md](docs/codebase/file-map-tests-scripts-docs.md) | `tests/` (78 unit files, integration, e2e, the four guardrails), `scripts/`, `docs/` and root files |

## 🧩 3. Key Features & Implementation Mechanics

| File | Covers (original section) |
| :--- | :--- |
| [editor.md](docs/codebase/editor.md) | A — block editor: 20 block types, keyboard state machine, caret engine, undo/redo, smart paste, sub-pages, auto-save |
| [workspace-navigation-and-timers.md](docs/codebase/workspace-navigation-and-timers.md) | B — sidebar, command palette, instant capture, history · D — multi-timer HUD and alarms |
| [3d-studio-core.md](docs/codebase/3d-studio-core.md) | C — studio architecture, topic registry, dual-tab HUD and visual keys |
| [3d-physics.md](docs/codebase/3d-physics.md) | C — the 17 physics scenes |
| [3d-chemistry.md](docs/codebase/3d-chemistry.md) | C — the 13 chemistry scenes |
| [3d-biology.md](docs/codebase/3d-biology.md) | C — the 16 biology scenes |
| [3d-cs-and-math.md](docs/codebase/3d-cs-and-math.md) | C — the 2 computer-science and 3 mathematics scenes |
| [ai-quizzes-and-mastery.md](docs/codebase/ai-quizzes-and-mastery.md) | E — AI tutor, explain, reformatter · F — Quizzes Studio, generation, grading, mastery |
| [spaces-export-and-web-saver.md](docs/codebase/spaces-export-and-web-saver.md) | G — Space Hub · H — export/import/backup · I — web saver · J — trash and reset |
| [tutorial-and-performance.md](docs/codebase/tutorial-and-performance.md) | K — onboarding tutorial · L — performance architecture |

## 🗄️ 4. Local-First Database Architecture

Dexie schema v8, all 12 object stores and where the network is used: [database.md](docs/codebase/database.md).

## 🎨 5. Design System Quick Reference

Refer to **[`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md)** for exhaustive design token specifications:

### Color Palette:
- **Backgrounds**: Main Viewport `bg-ink-950` (`#12151e` Dark / `#ffffff` Light), Card/Sidebar/HUD `bg-ink-900` (`#181c27` / `#f3f4f6`), Inputs/Blocks `bg-ink-850` (`#1f2332` / `#ffffff`).
- **Borders & Dividers**: Primary `border-ink-800` (`#282d3f` / `#9ca3af`), Secondary `border-ink-700` (`#363d54` / `#6b7280`).
- **Text Ramps**: High-contrast `text-ink-100` (`#f1f3fa` / `#000000`), Body `text-ink-200` (`#d6dbed` / `#111827`), Secondary `text-ink-300` (`#b8bfd6` / `#182130`), Muted `text-ink-400` / `text-ink-500`.
- **Accents**: Duck Gold Primary `text-duck-300` (`#f7d67c`), `bg-duck-500/20`, `border-duck-500/40`.
- **Mastery Status Scale**:
  - Solid: `●` `text-solid-500` (`#0ca30c` Dark / `#0a7d0a` Light)
  - Shaky: `◐` `text-shaky-500` (`#ec835a` Dark / `#ea580c` Light)
  - Gap: `○` `text-gap-500` (`#d03b3b` Dark / `#b02a2a` Light)
- **Destructive Controls**: Light Red `text-rose-400`, `bg-rose-500/15`, `border-rose-500/30`.

---

## ⚙️ 6. Critical Developer Gotchas & Best Practices

| File | Covers |
| :--- | :--- |
| [gotchas-general.md](docs/codebase/gotchas-general.md) | Gotchas 1–14: theme flash, hydration, demo seeding, URL normalisation, WebGL cleanup, print/PDF, error boundaries… |
| [gotchas-3d-physics-scenes.md](docs/codebase/gotchas-3d-physics-scenes.md) | Gotchas 15–23: simple machines, buoyancy, refraction, motor effect, ray optics, induction, projectile, incline, Hooke's law |
| [gotchas-nested-sub-pages.md](docs/codebase/gotchas-nested-sub-pages.md) | Gotcha 24: the `parentId` + `page` block invariants — read before touching trash, restore, move or duplicate |

## 🧪 7. Test Suites & Verification Commands

```bash
# Run everything: unit, integration, e2e, the caret-navigation suite and the stress tests
npm test

# Run production build
npm run build
```
