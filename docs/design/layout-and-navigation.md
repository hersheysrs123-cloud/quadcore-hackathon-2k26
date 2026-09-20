# Design — layout, navigation and dialogs

> Part of the [SocraticOS design system](../../DESIGN_SYSTEM.md). Sidebar, top HUD header, web saver, settings and modal layouts (sections 1, 2, 3, 5, 6).

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
  - Hierarchy Breadcrumb (`📁 Space / 📝 Parent / 📄 Chapter / 📄 Sub-Topic`): every ancestor is a `button` crumb (`rounded-md px-1 py-0.5 text-ink-300 font-medium hover:bg-ink-800 hover:text-ink-100 max-w-[10rem] truncate`), the space crumb opens the Space Hub, the current page is a non-interactive `aria-current="page"` span (`font-semibold text-ink-100` + `⭐` when starred), separators are `text-ink-600 "/"`. Chains deeper than 4 collapse into an `…` button (`font-bold tracking-widest text-ink-400 hover:bg-ink-800`) whose `role="menu"` drop-down (`w-56 rounded-xl border-ink-700 bg-ink-900 p-1.5 shadow-2xl`, items indented `8px + 10px × depth`) lists the hidden ancestors. Non-note tabs keep their static label (`🌌 3D Simulations Studio` / `📅 Study Calendar & Timers` / `🔖 Web Saver & Bookmarks`).
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
