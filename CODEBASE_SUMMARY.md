# SocraticOS — Comprehensive Codebase Summary & Handover Guide

> **To any AI Assistant or Developer taking over**: 
> This document provides an exhaustive technical overview of **SocraticOS**, explaining its architecture, state management, database schema, design system, key features, and operational gotchas.

---

## 📌 1. Executive Summary & Tech Stack

**SocraticOS** is a state-of-the-art, Notion-inspired all-in-one learning environment featuring block-based note editing, interactive 3D visualizations, study pomodoro timers, 24-hour auto-purging trash, and an integrated Socratic Rubber Duck AI tutor.

### Tech Stack:
- **Framework**: Next.js 15.5.22 (App Router, Webpack build engine)
- **UI & Logic**: React 19 Client & Server Components, Tailwind CSS (dynamic CSS variable system)
- **Database & Storage**: Supabase (PostgreSQL with RLS & RPC functions) + client-side `localStorage` hydration fallbacks
- **AI Integration**: Google Gemini API (powering Socratic diagnostic quizzes & widgets)
- **3D Engine**: Three.js / React Three Fiber for interactive 3D model rendering

---

## 📂 2. Repository Structure

```
c:\Users\Sivabalan\Documents\GitHub\quadcore-hackathon-2k26\
├── app/
│   ├── api/
│   │   ├── calendar/events/route.js    # Calendar event persistence
│   │   ├── explain/route.js            # Structured explanation of a note
│   │   ├── quiz/generate/route.js      # Builds a graded quiz from a note
│   │   ├── quiz/grade/route.js         # Marks it & emits the heatmap
│   │   ├── notes/[id]/route.js         # Single note API
│   │   ├── notes/create/route.js       # Note creation API
│   │   ├── notes/save/route.js         # GET & POST for note hydration & saving
│   │   ├── reset/route.js              # Factory Reset API (purges targeted Supabase tables)
│   │   ├── socratic/chat/route.js      # Socratic Rubber Duck AI chat handler
│   │   ├── socratic/widget/route.js    # AI Widget generator
│   │   └── visualizations/route.js     # 3D visualization persistence
│   ├── globals.css                     # Site-wide CSS variables for Dark & Light themes
│   ├── layout.js                       # Root layout, metadata & pre-paint theme bootstrap
│   ├── page.js                         # Marketing landing page (server component, no client JS)
│   └── workspace/page.js               # The app — renders <Workspace />
├── components/
│   ├── AlarmOverlay.jsx                # Global visual/audio alarm overlay & dynamic tab favicon swap (🦆 <-> ❗️)
│   ├── BlockNoteEditor.jsx             # Notion-style block editor with 17+ block types, 6-dots handles, covers & stats
│   ├── CalendarView.jsx                # Study schedule, month navigation, & Pomodoro countdown timer widget
│   ├── InstantNoteModal.jsx            # 75% screen instant note popup triggered via Ctrl+I or UI buttons
│   ├── Sidebar.jsx                     # Spaces navigation, 24h trash tab, Settings ⚙️ modal & Factory Reset captcha
│   ├── SocraticWorkspace.jsx           # UNREFERENCED — the Socratic session now lives in QuizPanel
│   ├── ThreeDView.jsx                  # Interactive 3D visualization studio
│   ├── Drawer.jsx                      # Shared right-panel chrome for Explain & Quiz
│   ├── ExplainPanel.jsx                # LLM explanation of the active note/block
│   ├── QuizPanel.jsx                   # Graded quiz + Socratic mode, one drawer
│   ├── ScoreRing.jsx                   # Animated score dial
│   ├── ConfidenceHeatmap.jsx           # Per-session sub-topic heatmap
│   ├── MasteryDashboard.jsx            # Aggregate strengths/weaknesses heatmap
│   └── Workspace.jsx                   # Main workspace layout, top HUD header, space state & auto-note creation
├── lib/
│   ├── blocks.js                       # Block text extractors & concept mappers
│   ├── constants.js                    # SPACES definition (School, Personal, Misc)
│   ├── demoNotes.js                    # Six seeded demo notes (first-run content)
│   ├── mastery.js                      # Status vocabulary + session -> topic rollup
│   ├── schemas.js                      # Gemini structured-output schemas (all AI routes)
│   └── supabaseClient.js               # Supabase browser client setup
├── supabase/
│   └── schema.sql                      # Idempotent PostgreSQL schema for Supabase SQL Editor
├── DESIGN_SYSTEM.md                    # Official UI design system & CSS color tokens spec
└── CODEBASE_SUMMARY.md                 # (This document)
```

---

## 🧩 3. Key Features & Implementation Mechanics

### 📝 A. Notion-Style Block Editor (`components/BlockNoteEditor.jsx`)
- **17 Block Types Supported**: `Text`, `Heading 1` (h1), `Heading 2` (h2), `Heading 3` (h3), `Heading 4` (h4), `Bullet List`, `Numbered List` (auto-indexing `1.`, `2.`), `To-Do List` (interactive checkboxes with strikethrough), `Toggle List` (collapsible arrow `▶`/`▼`), `Callout Box` (bordered frame with 8 icon presets), `Quote` (thick left border), `Divider` (`hr`), `Note Link` (workspace note picker popover), `Site Bookmark Embed` (clickable bookmark card with favicon), `Media Embed` (Image, Audio, or Video player), `Code Snippet`, and `Action Button`.
- **In-Context Slash Menu (`/`)**: Typing `/` pops up the block type menu directly underneath the active line (`absolute top-full left-0 mt-1`). Selecting a block type instantly clears initial typed text and `/`.
- **6-Dots Handles (`⠿`) & Context Menu**: Hovering a block displays aligned `🗑️` delete and `⠿` menu handles. Clicking `⠿` opens a popover containing:
  - ✨ **Explain** / 🦆 **Quiz me** for that block
  - **Formatting Controls**: <b>B</b> Bold, <i>I</i> Italic, <u>U</u> Underline, <s>S</s> Strikethrough
  - 🔄 **Turn Into Submenu** (all 17 block types)
  - 🗑️ **Delete Block** (in light red)
- **Cover Banners**: 100% full horizontal width (`w-full h-44 md:h-52`) across the notes viewport with 5 gradient presets (*Cyberpunk*, *Sunset Amber*, *Ocean Teal*, *Midnight Blue*, *Socratic Gold*). Action button sits at top-right (`right-6 top-3/top-4`) with translucent glass opacity (`bg-ink-950/40 opacity-60 hover:opacity-100`).
- **Custom Note Emoji Picker**: Add/Change/Remove note icon (`text-5xl` rendered above Note Title, Notion style).
- **Favorite Star (`⭐`)**: Toggle favorite state. Favorited notes display a gold star `⭐` in the sidebar note list.
- **Note Statistics (`📊 Stats`)**: Real-time popover calculating **Total Characters**, **Total Words**, and **Block Components**.
- **Auto-Note Creation**: Entering a space with zero notes and typing on the page automatically instantiates a new note, assigns it an ID, adds it to the space, and syncs to Supabase.

### ⚡ B. Instant Note Popup (`components/InstantNoteModal.jsx`)
- **75% Screen Coverage**: A `w-[75vw] h-[75vh] max-w-5xl` glassmorphic modal overlay.
- **Global Keyboard Shortcut**: `Ctrl+I` (or `Cmd+I`) opens the Instant Note window from anywhere in the app. `Ctrl+Enter` quick-saves.
- **Auto-Categorization**: Saves directly to the **"Misc"** space (with option to select other spaces).

### 🗑️ C. 24-Hour Auto-Purge Trash (`components/Sidebar.jsx`)
- Deleting a note moves it to the Trash Drawer with a `deletedAt` timestamp.
- A 1-minute interval background check purges items older than 24 hours.
- Individual & batch controls: `🔄 Recover`, `❌ Delete`, `🔄 Recover All`, `💥 Permanently Delete All`.

### 🚨 D. Global Visual Alarm Alert Overlay (`components/AlarmOverlay.jsx`)
- Triggers when a Pomodoro timer completes or calendar alarm fires (`window.dispatchEvent(new CustomEvent("socratic_alarm_triggered"))`).
- Displays a full-screen flashing alert modal (`🚨 ⏰ ❗️`) and plays an audio chime synthesis via Web Audio API.
- **Dynamic Browser Tab Swap**: Swaps the tab favicon from Duck (`🦆`) to Exclamation (`❗️`) and updates document title to `🚨 ALARM TRIGGERED! — SocraticOS`. Dismissing restores normal Duck favicon & title.

### ⚙️ E. Settings & Factory Reset Modal (`components/Sidebar.jsx` & `app/api/reset/route.js`)
- **Site-Wide Themes**: Dark Mode (`#12151e` Sleek Slate) and Light Mode (`#eef2f6` Warm Stone) via `data-theme` on root HTML.
- **Factory Reset 🚨**: Purges targeted tables (`notes`, `calendar`, `3d`, or `all`) via `POST /api/reset` requiring double confirmation and a randomized math human captcha verification check (`What is X + Y?`).


### ✨ F. Explain — the Teaching Half (`components/ExplainPanel.jsx`, `app/api/explain/route.js`)
- Reads the learner's own note and returns a **structured** explanation: one-line
  TL;DR, the mechanism in order, an analogy **with where it breaks marked**, the
  misconceptions most likely to bite, a worked example, and check-yourself
  questions that hand straight over to the quiz.
- Deliberately the opposite persona to the Socratic Duck (which is forbidden from
  ever answering). Keeping them as separate endpoints is what stops either from
  drifting into a hedged middle.
- Scope: whole note from the header `✨ Explain`, or one block from its `⠿` menu.

### 📋 G. Graded Quiz & Mastery Heatmap (`components/QuizPanel.jsx`, `components/MasteryDashboard.jsx`)
- `POST /api/quiz/generate` writes 5–6 questions from the note (mixed
  multiple-choice and short answer, distractors built from real mistakes).
- `POST /api/quiz/grade` marks them. **Multiple choice is graded in the route by
  integer comparison** and handed to the model as established fact; only short
  answers are LLM-graded, on the mechanism rather than the wording. A learner
  told a correct answer was wrong stops trusting every other number on the page.
- Both the quick quiz and the Socratic mode emit the same
  `{ score, summary, heatmap[] }` shape, which is what lets the dashboard treat
  them as one dataset.
- The **Mastery tab** rolls every session up per sub-topic: topic heatmap grouped
  by note, stat tiles, a weakest-first "what to study next" list where each row
  can re-explain or re-test that exact sub-topic, and a session log. A topic seen
  more than once keeps its history and shows whether it is improving.
- Sessions persist to `localStorage` under `socratic_study_sessions`, following
  the same `mounted`-guard convention as notes and trash.

### 🏠 H. Landing Page (`app/page.js`)
- The root route is a marketing page; the app moved to `/workspace`.
- Server component with **no client JS** — every effect is CSS. The product shot
  is hand-built markup rather than a screenshot so it cannot go stale against the
  palette.
- Written entirely in ink/duck tokens, so it follows the reader's light/dark
  choice like the rest of the app.

### 📚 I. First-Run Demo Content (`lib/demoNotes.js`)
- Six notes across School / Personal / Misc — eigenvectors, photosynthesis,
  Big-O, elasticity, memory science, neural networks.
- Written the way real notes are, **including the passages where the author
  admits being stuck**, because that is precisely what Explain and the quiz
  generator key off.
- Seeded only when the workspace is genuinely empty AND `socratic_demo_seeded`
  is unset, so a factory reset or a deliberate "delete everything" stays empty.

---

## 🗄️ 4. Database Schema & API Specifications

### Supabase Database Tables (`supabase/schema.sql`):
1. `public.spaces`: `id`, `name`, `icon`, `created_at`
2. `public.notes`: `id`, `title`, `space_id`, `space_name`, `banner`, `emoji`, `is_favorite`, `created_at`, `updated_at`
3. `public.blocks`: `id`, `note_id`, `block_type`, `content_json`, `position`, `updated_at`
4. `public.calendar_events`: `id`, `title`, `event_type`, `event_date`, `event_time`, `space_name`, `created_at`
5. `public.visualizations`: `id`, `title`, `model_type`, `scene_config_json`, `created_at`

### Core API Endpoints:
- `POST /api/notes/save`: Expects `{ noteId, title, blocks, banner, isFavorite, emoji, space }`. Upserts note metadata and replace-inserts all blocks into Supabase.
- `GET /api/notes/save`: Returns all saved notes with nested blocks for client hydration.
- `POST /api/reset`: Expects `{ target: "notes" | "calendar" | "3d" | "all" }`. Executes SQL DELETE on Supabase tables.
- `POST /api/explain`: Expects `{ concept, noteContent?, focus? }` → `{ explanation, usage }`.
- `POST /api/quiz/generate`: Expects `{ concept, noteContent }` → `{ quiz: { topic, questions[] }, usage }`.
- `POST /api/quiz/grade`: Expects `{ concept, noteContent?, questions[], responses[] }` → `{ result: { score, summary, gradedAnswers[], heatmap[] }, usage }`.

> **`GET /api/notes/save` soft-fails when Supabase is unreachable.** It answers
> `200 { success: false, offline: true, notes: [] }` rather than 500, because the
> workspace runs fine on `localStorage` alone and this route is called on every
> mount — a 500 put a red console error on every page load for an expected state.
> A genuine query error still returns 500.

---

## ⚙️ 5. Critical Developer Gotchas & Best Practices

1. **Next.js Dev Cache Corruption**:
   - If running `npm run build` while `npm run dev` is running, Next.js chunk cache can become corrupted (`MODULE_NOT_FOUND` error for chunks like `./331.js`).
   - **Resolution**: Run `Remove-Item -Recurse -Force .next` in PowerShell and restart dev server.

2. **SSR Hydration Mismatch Safety**:
   - Accessing `localStorage` inside initial React `useState` causes SSR hydration mismatches. Always use a `mounted` guard:
     ```js
     const [mounted, setMounted] = useState(false);
     useEffect(() => setMounted(true), []);
     ```

3. **URL Protocol Normalization**:
   - Always wrap external URLs with `formatUrl(url)` before passing to `href` or `src` attributes to prevent relative domain redirection (`http://localhost:3000/google.com`).

4. **Preventing Re-Render Loops**:
   - Avoid calling state setters inside un-guarded `useEffect` dependencies. Trigger state updates via explicit event handlers (`handleSaveNote`, `handleSelectNote`).

---

## 🎨 6. Design System Quick Reference

Refer to **[`DESIGN_SYSTEM.md`](file:///c:/Users/Sivabalan/Documents/GitHub/quadcore-hackathon-2k26/DESIGN_SYSTEM.md)** for full token specifications:
- Main Background: `bg-ink-950`
- Card & Header Surfaces: `bg-ink-900`
- Input & Block Backgrounds: `bg-ink-850`
- Primary Accent: `text-duck-300`, `bg-duck-500/20`, `border-duck-500/40`
- Delete Controls: Light red `text-rose-400/90`, `bg-rose-500/15`, `border-rose-500/30`
