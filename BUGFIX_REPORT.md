# Bugfix report — full codebase sweep

Full-repo bug sweep across the Next.js/React app: the local-first Dexie storage layer, the block editor, export/import, the 3D/chemistry visualizers, and the AI/quiz API routes. Everything below was reproduced (or root-caused from a clean read of the code), fixed in this branch, and re-verified — either by tracing the logic by hand or by driving the actual UI in a browser via Playwright.

The single highest-impact fix: **the app could not build or run at all** before this branch — see below.

## 0. Critical: build was completely broken

`package.json` declared `dexie`, `dexie-react-hooks`, `docx`, `katex`, and `mammoth`, but `node_modules` was never synced after those were added — `npm run build` failed immediately with `Module not found` for all five. Ran `npm install` (`package-lock.json` already matched `package.json`, so no lockfile changes were needed). Verified with two full clean production builds; the final one compiled successfully in 17.7 min with no errors or warnings, all 6 static pages generated, and bundle sizes consistent with a healthy build (`/workspace` 427 kB / 531 kB First Load JS, `/visualizations` 18.3 kB / 126 kB).

## 1. Export / print bugs (the visual-issue ask)

All four export formats share one `blocks` array as their source of truth; three of the four had the same class of bug.

- **Numbered lists exported as "1." repeated for every item** (Markdown, plain text, DOCX, and the internal AI-context serializer in `lib/blocks.js`). The live editor numbers correctly — only the *exported* text was wrong, because each block was rendered independently with a hardcoded `1.`. Fixed with a running counter that increments through a consecutive run of `"number"` blocks and resets the moment a different block type breaks the run.
  - `lib/exportImport.js` — `blocksToMarkdownLossy`, `blocksToPlainText`, `blocksToDocxBlob`
  - `lib/blocks.js` — `editorBlocksToText` (feeds Explain/Quiz/Duck AI features, not just export)

- **HTML export wrapped every bullet/number item in its own separate `<ul>`/`<ol>`** instead of one shared list per run — visually, a 5-item list rendered as five separate single-item lists stacked on top of each other, restarting numbering each time. Fixed by accumulating consecutive `bullet`/`number` blocks and flushing one shared list tag when the run ends. (`lib/exportImport.js` — `blocksToHTMLLossy`, extracted a `blockToHtmlFragment` helper for the non-list cases.)

- **PDF/print export dropped the note title, the note's emoji icon, math/canvas block titles, and — most severely — all visible text inside every code block.** Root cause: the print stylesheet (`app/globals.css`, inside the existing `@media print` block) blanket-hides `input`, `button`, and `.absolute`-positioned elements to strip editor UI chrome. That's correct for buttons like "Add block," but the note title and icon *are* `<input>`/`<button>` elements (Notion-style inline editing), and a code block's visible syntax-highlighted text is an `.absolute`-positioned overlay sitting on top of a transparent-text textarea — so the same rule that hides chrome was also hiding real content. Added a `.print-content` opt-out class (kept `display: block`, stripped native `border`/`appearance` so inputs don't look like inputs) applied to the title input, emoji button, math-block title input, and canvas-block title input; added a `.code-highlight-underlay` class that additionally drops the overlay out of absolute positioning so it lays out normally in print. Verified with an actual browser screenshot in print-media emulation showing the title, emoji, and full code block content all present.

- **Markdown callout round-trip data loss on re-import.** A callout is exported as `> 💡 some text` — a blockquote carrying an emoji — which is indistinguishable from a plain quote (`> some text`) by prefix alone. The importer's generic `> ` quote check ran first and matched everything, so every callout you exported and re-imported silently became a plain quote, losing the icon and the callout styling. Fixed with a Unicode-aware regex (`\p{Extended_Pictographic}`) checked *before* the generic quote branch. (`lib/exportImport.js` — `tryParseMarkdownToBlocks`)

## 2. Data-loss and correctness bugs

- **Mastery Dashboard lost all topic/heatmap data on reload.** `recordStudySession` wrote a session object using field names (`topics`, `timestamp`) that didn't match what the dashboard and `lib/mastery.js` actually read (`heatmap`, `createdAt`), so graded quiz/Socratic sessions appeared to save successfully but the dashboard rendered empty after a refresh. Fixed by writing the field names readers actually expect, keeping `topics` only as a fallback input so no caller's data is dropped. (`lib/storageService.js`)

- **"Factory reset" and "reset notes" didn't actually reset.** Both wrote the localStorage seeding flag under the literal string `"socratic_demo_seeded"`, but the seeding check in `lib/db.js` reads a different key, `"socratic_demo_seeded_v7"`. Immediately after a reset, the app would see the *real* key still unset and silently reseed the demo notes back in — reset appeared to do nothing. Fixed by exporting the real key as `DEMO_SEED_KEY` from `lib/db.js` and having both reset paths write that instead of a hardcoded duplicate string. (`lib/db.js`, `lib/storageService.js`)

- **Quiz grading crashed on malformed input.** `question.options[picked]` throws if `question.options` is missing/undefined rather than just an out-of-range index; a malformed or partially-generated quiz question could crash grading entirely instead of degrading gracefully. Fixed with optional chaining, in both places this logic is duplicated. (`lib/aiService.js`, `app/api/quiz/grade/route.js`)

## 3. Editor bugs

- **Undo/redo didn't visually update the editor.** Each block's `contentEditable` DOM only re-synced from state when `block.id` or `block.type` changed, not when `block.content` changed. Undo/redo works by swapping in a past snapshot of the whole `blocks` array — same ids and types, different content — so the dependency array never fired and the DOM kept showing pre-undo text. Worse: the *next* keystroke would read that stale DOM text and write it back into state, silently discarding the undo. Fixed by adding `block.content` to the effect's dependency array; a dirty-check inside the effect (`contentRef.current.textContent !== block.content`) keeps it a no-op during normal typing, so this doesn't fight the user's own input. (`components/BlockNoteEditor.jsx`, `EditorBlock`'s sync effect)

- **Drag-to-reorder blocks landed one slot off and bypassed undo entirely.** The drop indicator UI signals "insert before this block," but the reorder math didn't account for the source block's removal shifting every later index down by one when dragging forward — so blocks consistently landed one position too far. Separately, dragging was the only editing action that didn't push onto the undo stack, so `Ctrl+Z` right after a drag would skip over it and revert an unrelated earlier edit instead. Fixed the off-by-one and added the missing undo-history push. (`components/BlockNoteEditor.jsx`, the block-drop handler)

- **Pasting into a code block (or any nested textarea/input) destroyed it.** The "smart markdown paste" handler is bound on the outer editor container, so paste events from nested `<textarea>`/`<input>` elements (a code block's body, a toggle's details field, the math formula box, canvas title, URL fields) bubble up to it too. It would intercept the paste, parse it as markdown, and splice the code block out and replace it with newly parsed blocks — destroying whatever snippet was in it. Fixed by returning early when the paste event's target is a `TEXTAREA`/`INPUT`. (`components/BlockNoteEditor.jsx`, `handleSmartPaste`)

- **Switching notes right after editing the title could silently overwrite the newly-opened note.** The title-save debounce used `setTimeout` with no cleanup; the editor is mounted with `key={note.id}`, so switching notes unmounts the old instance, but a pending timeout doesn't know that — it still fires after unmount, and the parent's save handler falls back to whatever note is active *at that later moment*, overwriting the new note with the old note's content. Fixed with an unmount cleanup effect that clears the pending timeout. (`components/BlockNoteEditor.jsx`)

## 4. Space / password bugs

- **Setting or entering a space password with a non-Latin1 character (accents, emoji, non-Latin scripts) crashed silently.** Plain `btoa()` throws a `DOMException` on any character outside Latin1. Setting such a password would fail with the modal appearing to close normally while nothing was actually saved; entering one to unlock would throw inside an async handler with no error shown, leaving the user stuck. Fixed with a `toBase64()` helper that UTF-8-encodes first, and wrapped the unlock comparison in a try/catch that falls through to a plain "Incorrect password" instead of throwing uncaught. (`components/Workspace.jsx`, `components/EnterPasswordModal.jsx`)

- **Deleting a space never deleted its notes unless it was the currently active space**, because the delete-space flow called the delete-note function without telling it which space's notes to operate on, and that function defaulted to whatever space the user currently had open. Notes in a *different*, non-active space were orphaned — the space's UI entry disappeared but its notes silently reappeared on refresh. Fixed by threading the target space through explicitly instead of relying on the ambient "currently active space." Also now cleans up that space's saved password so a future space recreated with the same name doesn't inherit the old lock. (`components/Workspace.jsx`)

## 5. Visualization bugs

- **3D Cell/Osmosis view's cutaway toggle was unreachable from one of the two entry points into visualizations** — the control existed in the underlying scene component but was never wired into this topic's control schema, so the toggle simply didn't appear in the UI. Added the missing default and control entry. (`components/ThreeDView.jsx`)
- **Organic chemistry visualizer only exposed 3 of 6 working molecule families** (alkane/alkene/alcohol) in its picker, and capped the carbon-chain slider at 4 — alkyne, carboxylic acid, and ester scenes were already implemented and functional but simply not selectable. Exposed all six and raised the slider max to 12. (`app/visualizations/page.jsx`)
- **Bohr atom scene's default element fallback was `"carbon"` instead of `"C"`** — the scene looks up elements by chemical symbol, so an unset/invalid element prop silently fell through to nothing rendering instead of a working default atom. (`components/visualizations/ChemistryCanvas.jsx`)
- Restructured the visualization category quick-switch strip so topic-level quick-switch buttons (filtered by category/search) sit alongside the category buttons, instead of the topic being reachable only via a dropdown that always lists every topic regardless of category. (`components/ThreeDView.jsx`)

---

## Known issue — found, root-caused, NOT fixed

**Typing a markdown shortcut and continuing to type can scramble the next word.** Type `"- "`, `"1. "`, `"# "`, `"> "`, or `"[ ] "` at the start of a block to trigger its markdown auto-conversion, then keep typing without pausing — completely normal usage, not an edge case — and the first word typed afterward can come out corrupted (wrong order/dropped characters).

**Root cause:** block types that need extra DOM structure around their editable text — bullet's marker span, todo's checkbox, toggle's arrow, etc. — render that `contentEditable` inside a different JSX branch than the plain "text" block type. When a markdown shortcut converts a block's type, React sees a structurally different subtree and mounts a brand-new DOM node rather than patching the existing one in place. That new node starts unfocused, and whatever caret position the browser was tracking is gone.

**What was tried:** three different fixes — restoring the caret synchronously in the input handler, deferring the restore by a tick, and moving the write into the block's sync effect gated on selection state. Instrumented each with logging to confirm what was actually happening on screen. All three visibly re-focused the correct new DOM node — confirmed via logged node identity — yet the very next keystroke still landed at the wrong position and the corruption still occurred. That means the actual bug is not simply "focus isn't restored," and something beyond what's directly inspectable from this component's effects/handlers is still involved (a likely candidate: a stale Selection/Range object being reused after the remount, since focus and caret position are tracked separately by the browser). Confirming that needs step-by-step live browser devtools debugging, which wasn't available in this environment.

**Decision:** reverted all changes at this specific site back to the original pre-existing code rather than ship added complexity that doesn't demonstrably fix the problem. Left a detailed comment at the site (`components/BlockNoteEditor.jsx`, the `shortcuts` loop inside `handleInput`) with the full root-cause trail for whoever picks this up next.

## Other things worth knowing (not bugs, not touched)

- `hooks/useLocalNotes.js` contains a second, separate `recordSession` implementation with the same stale-field-name bug described in §2 — but it's dead code, never imported anywhere in the live app. Left as-is; flagging in case it gets revived later.
- `patch_canvas.js` at the repo root is a dead one-off migration script referencing a devcontainer path that doesn't exist in this repo, not wired into any npm script, and targeting a component that was never actually added. Not a live bug, just repo hygiene worth cleaning up separately.
- `scripts/check-block-mapping.mjs` / `lib/blockMapping.js` pass their own internal checks but belong to a pre-Dexie/Postgres architecture layer that's no longer used by the live app (confirmed via grep — nothing imports it). Left as-is.

## Verification performed

- Two full clean production builds (`npm run build`), the final one confirmed compiling successfully with matching bundle sizes and no new warnings.
- Playwright-driven browser tests: export flow through all four formats (MD/HTML/TXT/DOCX) with a numbered list, verifying correct sequential numbering in each; print-media emulation screenshot confirming title/emoji/code content survive PDF export; plain-typing-speed test confirming no regression for normal (non-shortcut) typing; undo/redo visual sync confirmed working.
