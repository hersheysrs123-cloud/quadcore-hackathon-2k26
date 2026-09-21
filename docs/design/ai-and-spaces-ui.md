# Design — AI reformatter, Space Hub and tutor drawer

> Part of the [SocraticOS design system](../../DESIGN_SYSTEM.md). Sections 14, 19 and 20.

### 14. AI Note Reformatter Visual Feedback
- **Floating Banner Position**: `fixed top-16 left-1/2 -translate-x-1/2 z-50 pointer-events-none animate-fade-in select-none`.
- **Banner Surface**: `flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-ink-900/95 border border-duck-500/50 shadow-2xl backdrop-blur-md text-xs font-semibold text-duck-200 ring-4 ring-duck-400/20`.
- **Active Trigger Button State (`NoteMenu.jsx`)**: `bg-duck-500/15 border border-duck-500/30 text-duck-200 cursor-wait` with spinning sparkle and pulsing `"AI"` tag.

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
