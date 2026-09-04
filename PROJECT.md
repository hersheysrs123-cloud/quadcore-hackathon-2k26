# Project: SocraticOS Block Note Editor Notion-Grade Navigation & Interaction

## Architecture
- **Core Component**: `components/BlockNoteEditor.jsx` (Central block-based note editor with contenteditable blocks, DOM/TreeWalker caret managers, selection boundaries, keyboard shortcuts, formatting, and persistence).
- **Storage Layer**: `lib/storageService.js` (Local storage & indexed DB persistence, note saving/loading, serialization/deserialization).
- **Math Engine**: KaTeX inline and block nodes (`katex-inline-node`, `renderInlineMathPreview`, `tryAutoFormatInlineMath`).
- **Data Flow**:
  - User Input / Keydown / Click Events -> `handleKeyDown` / `handleGlobalMouseUp` / `handleInlineBoundaryKeyDown`
  - DOM Range & TreeWalker Caret Mapping (`setCaretAtOffset`, `setCaretToEnd`, `setCaretToStart`, `getDOMCaretLength`, `isCaretAtLogicalStart`, `isCaretAtLogicalEnd`)
  - State Sync & Serialization (`getBlockTextFromDOM`, `cleanZeroWidth`, `saveNote`) -> Storage
  - Formatting & Pills (`tryAutoFormatInlineCode`, `tryAutoFormatInlineMath`, `renderMarkdownInline`)

## Code Layout
- `components/BlockNoteEditor.jsx`: Primary block editor, selection helpers, event handlers, caret placement algorithms.
- `lib/storageService.js`: Persistence service, note save/load sanitization.
- `tests/`: Automated unit, integration, and E2E test suites executed by Node test runner (`node --test`).
- `tests/e2e_caret_navigation.test.js`: E2E opaque-box test suite for caret navigation, pills, splitting, merging, and whitespace focus.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| F1 | Seamless Arrow Block Navigation | ArrowUp/Down boundary checks ignoring KaTeX DOM text in Range.toString() for smooth vertical block transitions | M1 | Survey R1 |
| F2 | Inline Pill Boundary Traversal | ArrowLeft/Right across `<code>` and `.katex-inline-node` pills without trapping or phantom offsets | M1 | Survey R1 |
| F3 | Inline Math Interaction & Live Compilation | Eliminate caret trapping, keystroke swallowing near KaTeX pills, support live `$x$` auto-compilation | M1 | Survey R2 |
| F4 | Clean Enter Line Splitting | Splitting text & list blocks into two clean blocks without losing words or leaking raw markdown markers | M2 | Survey R3 |
| F5 | Backspace Merging & Exact Caret Placement | Merging block at offset 0 into previous block and placing caret at exact merge point using TreeWalker offset | M2 | Survey R3 |
| F6 | Bottom Whitespace Click Focus | Clicking blank area below document focuses end of last block without unwanted block creation | M3 | Survey R4 |
| F7 | Clean Persistence & Zero-Width Sanitization | Stripping `\u200B`, `\uFEFF`, and temporary markers from block text and storage pipeline | M3 | Survey R4 |
| F8 | E2E Opaque-Box Test Suite (Tiers 1-4) | Comprehensive 82+ test suite covering all features, boundaries, pairwise interactions, and scenarios | M4 | Survey Req 5 |
| F9 | Adversarial Hardening (Tier 5) & Production Protocol | White-box stress testing, docs update (`CODEBASE_SUMMARY.md`, `ANTIGRAVITY_BUG_FIXES.md`), Next.js build & port 3000 verification | M4 | Directives |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Navigation & Inline Math Pills | Fix F1, F2, F3 in `components/BlockNoteEditor.jsx` | none | DONE |
| M2 | Line Splitting & Backspace Merging | Fix F4, F5 in `components/BlockNoteEditor.jsx` | M1 | DONE |
| M3 | Whitespace Focus & Clean Persistence | Fix F6, F7 in `components/BlockNoteEditor.jsx` & `lib/storageService.js` | M1 | DONE |
| M4 | E2E Test Pass, Adversarial Hardening & Production Protocol | Pass all tests (184+ existing + 82+ E2E), Tier 5 adversarial checks, update docs, run production build protocol | M1, M2, M3 | DONE |

## Interface Contracts
### Caret & Offset Calculation Helpers
- `isCaretAtLogicalStart(el: HTMLElement): boolean`: Returns true if caret is at the beginning of editable text, ignoring contenteditable=false pills.
- `isCaretAtLogicalEnd(el: HTMLElement): boolean`: Returns true if caret is at the end of editable text, ignoring contenteditable=false pills.
- `getDOMCaretLength(el: HTMLElement): number`: Traverses DOM text nodes and contenteditable=false nodes matching `setCaretAtOffset`'s coordinate space.
- `setCaretAtOffset(el: HTMLElement, targetOffset: number): void`: Sets caret to target TreeWalker offset; supports `<textarea>`/`<input>`.
- `setCaretToEnd(el: HTMLElement): void`: Positions caret after last text/pill; supports `<textarea>`/`<input>`.
- `setCaretToStart(el: HTMLElement): void`: Positions caret before first text/pill; supports `<textarea>`/`<input>`.
- `cleanZeroWidth(str: string): string`: Removes `\u200B`, `\u200C`, `\u200D`, `\u2060`, `\uFEFF`, `\u0000`.
