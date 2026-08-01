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
│   │   ├── notes/[id]/route.js         # Single note API
│   │   ├── notes/create/route.js       # Note creation API
│   │   ├── notes/save/route.js         # GET & POST for note hydration & saving
│   │   ├── reset/route.js              # Factory Reset API (purges targeted Supabase tables)
│   │   ├── socratic/chat/route.js      # Socratic Rubber Duck AI chat handler
│   │   ├── socratic/widget/route.js    # AI Widget generator
│   │   └── visualizations/route.js     # 3D visualization persistence
│   ├── globals.css                     # Site-wide CSS variables for Dark & Light themes
│   ├── layout.js                       # Root layout & metadata
│   └── page.js                         # Root entry component rendering Workspace
├── components/
│   ├── AlarmOverlay.jsx                # Global visual/audio alarm overlay & dynamic tab favicon swap (🦆 <-> ❗️)
│   ├── BlockNoteEditor.jsx             # Notion-style block editor with 17+ block types, 6-dots handles, covers & stats
│   ├── CalendarView.jsx                # Study schedule, month navigation, & Pomodoro countdown timer widget
│   ├── InstantNoteModal.jsx            # 75% screen instant note popup triggered via Ctrl+I or UI buttons
│   ├── Sidebar.jsx                     # Spaces navigation, 24h trash tab, Settings ⚙️ modal & Factory Reset captcha
│   ├── SocraticWorkspace.jsx           # Socratic Rubber Duck diagnostic drawer & interactive quiz engine
│   ├── ThreeDView.jsx                  # Interactive 3D visualization studio
│   └── Workspace.jsx                   # Main workspace layout, top HUD header, space state & auto-note creation
├── lib/
│   ├── blocks.js                       # Block text extractors & concept mappers
│   ├── constants.js                    # SPACES definition (School, Personal, Misc)
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
  - 🦆 **Test Understanding with Duck**
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
