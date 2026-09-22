# Design — layout, navigation and dialogs

> Part of the [SocraticOS design system](../../DESIGN_SYSTEM.md). Application shell, top bar, web saver, settings and modal layouts (sections 1, 2, 3, 5, 6).

### 1. The left shell — nav rail + notes panel (`components/redesign/`)

The chrome is two columns, not one sidebar. `NavRail.jsx` is always visible;
`NotesPanel.jsx` appears only in the Notes section and can be collapsed from
the top bar. `Sidebar.jsx` still exports the modals both of them open, but it
is no longer rendered as a component.

#### 1a. Nav rail (`NavRail.jsx`)
- **Width**: `w-[4.25rem] shrink-0`, `bg-ink-900 border-r border-ink-800`, full height.
- **Brand**: duck tile at the top, linking Home.
- **Sections** (icon over a 10px label, in study-loop order): Home, Notes, Quizzes, Mastery, Calendar, 3D Lab, Saved. Active: `bg-ink-800 text-ink-100`; idle: `text-ink-500 hover:text-ink-200`. Mastery carries a `gap-500` count badge when the heatmap holds unresolved gaps.
- **Foot tools**: running-timer readout (live `mm:ss` when a timer is going), Capture (`Ctrl+I`), Search (`Ctrl+K`), theme toggle, Settings.

#### 1b. Notes panel (`NotesPanel.jsx`)
- **Width**: `w-64 shrink-0`, `bg-ink-900 border-r border-ink-800`.
- **Space switcher** — two layouts, chosen in Settings ("Space Switcher Display") and persisted in `db.settings` under `space_switcher_layout`:
  - `dropdown` (default): a trigger showing the active space's icon, name and note count, opening a `role="listbox"` popover with per-row edit, "New space" and "Space settings & syllabus".
  - `grid`: two-column tiles for one-click switching (`border-ink-750 bg-ink-850/80`, active `border-duck-500/60 bg-duck-500/15 text-duck-300`), each with a hover-revealed edit pencil.
- **Search**: "Find a note" input (`bg-ink-850`, `focus-within:border-ink-700`) filtering the space by title. Results render flat and are **not** reorderable.
- **Notes List**: nested sub-page tree per active space.
  - **Header Controls**: Inline "Select" / "Done" action button (`text-[11px] px-2 py-0.5 rounded font-medium text-ink-400 hover:text-ink-200 hover:bg-ink-800`), turning into active pill `bg-duck-500/20 text-duck-300 ring-1 ring-duck-400/40 font-semibold` when selecting.
  - **Multi-Selection Mode**:
    - Header count indicator: `{count} of {total} selected` with duck accent, alongside a `Deselect all` / `Select all` action link (`text-[11px] text-duck-400 hover:text-duck-300 font-medium`).
    - **Bulk Actions Toolbar**: 4-column compact grid (`p-2 rounded-xl bg-ink-850/90 border border-ink-750`) providing Star/Unstar, Copy (duplicate), Move and Delete. Each cell is an icon over a 10px label, `text-ink-300 hover:bg-ink-800 hover:text-ink-100`, `disabled:opacity-30` while nothing is selected. Only two carry their own hue: Star is `text-duck-400` (filled when every selected note is already starred) and Delete is `text-gap-400`. Copy and Move stay neutral — four competing colours in a 4-cell grid read as decoration rather than meaning.
    - **Checkbox Indicators**: Rounded square indicator on the left of each note item (`w-4 h-4 rounded border border-duck-400 bg-duck-500 text-ink-950` when selected, `border-ink-600 bg-ink-850` when idle).
    - **Selected Row Highlight**: `bg-duck-500/15 ring-1 ring-duck-400/40 text-duck-200 shadow-xs`.
    - **Suppressed Elements**: Drag handles and 3-dots menus are hidden while selection mode is active to prevent accidental clicks.
  - **Ghost Action Icons**: In normal view, Drag handle (`GripVertical` `⠿`) and Note Menu (`NoteMenu` `...`) are ghosted (`opacity-0`), seamlessly fading in on row hover (`group-hover:opacity-100 focus-within:opacity-100`) without layout shift.
  - **Drag-to-reorder**: strictly **within one sibling group**. A row rejects a drop (`dropEffect = "none"`) from a note that is not its sibling, so a sub-page can never be re-parented by accident. The drop indicator is a `bg-duck-400` hairline pinned to the row's top or bottom edge, inset to the row's own indent. Dropping on the empty space below the list sends a **top-level** note to the end. Reordering is disabled in search results and while multi-select is active.
  - Star favorite indicator `⭐` visible on favorited notes.
- **Confirmation Modals**:
  - `BatchDeleteConfirmModal`: Double-confirmation dialog for bulk deletion with rose warning badge (`bg-rose-500/10 border-rose-500/20 text-rose-200`), note title preview list, and 24h retention notice.
  - `BatchMoveModal`: Destination space picker modal with disabled badge for the current active space.
- **Bottom Trash Tab**: `🗑️ Trash` row with a count pill, opening `TrashModal`.
- **Timer HUD**: the compact `GlobalTimerHUD` card no longer lives here. The rail shows the running clock, and the full card is on Home (`HomeView.jsx`).

### 2. Top bar (`components/redesign/TopBar.jsx`)
- **Height**: Single slim unified header (`h-13 shrink-0` / 52px).
- **Left Breadcrumb Context**:
  - Notes-panel toggle (`PanelLeft`), shown only in the Notes section
  - Back / forward history arrows
  - Hierarchy Breadcrumb (`📁 Space / 📝 Parent / 📄 Chapter / 📄 Sub-Topic`): every ancestor is a `button` crumb (`rounded-md px-1 py-0.5 text-ink-300 font-medium hover:bg-ink-800 hover:text-ink-100 max-w-[10rem] truncate`), the space crumb opens the Space Hub, the current page is a non-interactive `aria-current="page"` span (`font-semibold text-ink-100` + `⭐` when starred), separators are `text-ink-600 "/"`. Chains deeper than 4 collapse into an `…` button (`font-bold tracking-widest text-ink-400 hover:bg-ink-800`) whose `role="menu"` drop-down (`w-56 rounded-xl border-ink-700 bg-ink-900 p-1.5 shadow-2xl`, items indented `8px + 10px × depth`) lists the hidden ancestors. Non-note tabs keep their static label (`🌌 3D Simulations Studio` / `📅 Study Calendar & Timers` / `🔖 Web Saver & Bookmarks`).
- **Sections** moved to the nav rail; the top bar no longer carries tabs.
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

### 5. Settings & Factory Reset (`SettingsModal`, exported from `Sidebar.jsx`)
- **General Tab**: theme, editor click-to-append, and **Space Switcher Display** (`Dropdown Menu` / `Grid View`) — the layout `NotesPanel` renders.
- **Shortcuts Tab**: Reference for all global keyboard shortcuts (`Ctrl+K`, `Ctrl+I`, `Ctrl+S`, `Ctrl+Z`, `Ctrl+Y`, `/`).
- **3D & Graphics Tab**: Performance presets (*Auto*, *High*, *Medium*, *Low/Battery Saver*), target FPS (30/60/120), DPR pixel ratio scaling, and auto-pause when hidden.
- **API Keys Tab**: Personal Google Gemini API key configuration stored 100% privately in Dexie IndexedDB.
- **Backup & Reset Tab**: Export/import `.socratic` JSON packages and table-targeted factory reset with typed `"RESET"` confirmation.

### 6. Modal Dialogs & Overlay Layouts
- **Backdrop**: `fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-md p-3 sm:p-4 md:p-6 overflow-y-auto animate-fade-in`.
- **Dialog Container**: `relative w-full max-w-2xl max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-3.5rem)] flex flex-col overflow-hidden rounded-2xl border border-ink-700 bg-ink-900 shadow-2xl transition-all my-auto`.
- **Header & Footer**: Always attach `shrink-0` to modal header and footer components (`bg-ink-950/60 border-ink-800`) to guarantee they never compress or push off-screen.
- **Scrollable Body**: Container body must declare `overflow-y-auto flex-1 min-h-0` to isolate scrolling to the modal content area without expanding the dialog beyond the viewport.
