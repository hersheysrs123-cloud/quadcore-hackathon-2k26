# Design — quizzes and mastery UI

> Part of the [SocraticOS design system](../../DESIGN_SYSTEM.md). Quiz creator, runner, sliders, IGCSE question components, deletion modal and the mastery dashboard (sections 11, 13, 16, 17, 18, 25, 26).

### 11. Multi-Select Note Combobox & Chip Badges (Quiz Creator)
- **Trigger Button**: `w-full flex items-center justify-between px-3 py-2 text-xs font-medium bg-ink-850 text-ink-100 border border-ink-700 rounded-xl hover:border-ink-600 focus:border-duck-500/60`.
- **Selection Count Pill**: `text-[10px] font-bold text-duck-300 bg-duck-500/15 border border-duck-500/30 px-1.5 py-0.5 rounded-full`.
- **Dropdown Popover Surface**: `absolute z-30 left-0 right-0 mt-1 p-2 bg-ink-900 border border-ink-700 rounded-xl shadow-2xl space-y-2 animate-fade-in`.
- **Filter Search Input**: `w-full pl-7 pr-2.5 py-1 text-[11px] text-ink-100 bg-ink-850 border border-ink-750 rounded-lg placeholder:text-ink-500 focus:border-duck-500/60`.
- **Selected Item Chip Badges**: `inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-ink-850 border border-ink-750 text-[11px] font-medium text-ink-200 shadow-xs`.
- **Dismiss Button**: `text-ink-500 hover:text-gap-400 p-0.5 rounded-xs transition-colors`.
- **Multi-Note Quiz Card Badges**: `text-[10px] font-bold text-duck-400 bg-duck-500/10 border border-duck-500/20 px-1.5 py-0.5 rounded-md shrink-0`.

### 13. Quiz Deletion Confirmation Modal & In-Progress Badges
- **Modal Backdrop**: `fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-950/80 backdrop-blur-xs animate-fade-in`.
- **Modal Dialog Surface**: `w-full max-w-md rounded-2xl bg-ink-900 border border-ink-800 shadow-2xl p-6 space-y-4 animate-scale-in text-left`.
- **Modal Danger Action**: `px-4 py-2 rounded-xl bg-gap-500 hover:bg-gap-400 text-white text-xs font-bold shadow-md transition-colors flex items-center gap-1.5`.
- **In-Progress Quiz Card Badge**: `text-xs font-semibold text-amber-400 flex items-center gap-1.5` with animated amber pulse (`w-2 h-2 rounded-full bg-amber-400 animate-pulse`).
- **Resume Quiz Button**: `px-4 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-xs font-bold text-ink-950 shadow-sm transition-colors`.
- **Runner Auto-Save Indicator**: `flex items-center gap-1.5 text-[11px] font-medium text-ink-400 bg-ink-850 px-2 py-0.5 rounded-full border border-ink-800` (shows `Check` with "Progress saved" or spinner with "Saving...").

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
  - Mathematics & Science Reasoning: `grid grid-cols-1 sm:grid-cols-2 gap-3`.
  - Objective Assessment: `grid grid-cols-1 sm:grid-cols-2 gap-3`.
  - Applied & Written Analysis: `grid grid-cols-1 sm:grid-cols-3 gap-3` (Code Input, Short Answer, Long Essay).
- **Difficulty Grid**: `grid grid-cols-2 sm:grid-cols-4 gap-2`.

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

### 25. Cambridge IGCSE Math & STEM Question Component Tokens
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

### 26. Space-Specific Mastery Dashboard & Space Selector (`MasteryDashboard.jsx`)
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
