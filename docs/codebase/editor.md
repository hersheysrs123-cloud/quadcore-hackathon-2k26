# Block editor

> Part of the [SocraticOS codebase reference](../../CODEBASE_SUMMARY.md). The Notion-style editor: 20 block types, keyboard state machine, caret engine, undo/redo, smart paste, sub-pages, auto-save.

### 📝 A. Notion-Style Block Editor (`components/BlockNoteEditor.jsx`)
- **20 Block Types Supported**:
  1. `text`: Plain text paragraph with inline formatting, smart paste, and backspace merge.
  2. `h1`: Large section heading (`text-3xl font-bold`).
  3. `h2`: Medium section heading (`text-xl font-semibold`).
  4. `h3`: Small section heading (`text-lg font-semibold`).
  5. `h4`: Sub-heading (`text-base font-semibold`).
  6. `bullet`: Unordered list item with auto-continuation, hierarchical multi-tier indent levels (Level 0 `●`, Level 1 `○`, Level 2 `■`, Level 3 `□`), `Tab`/`Shift+Tab` indentation, Backspace un-indentation & conversion to text with empty DOM fallback, and Enter-at-start prepending (specifically on the first bullet).
  7. `number`: Ordered list item with dynamic sequential & hierarchical counting (Level 0 `1.`, `2.`, `3.`; Level 1 `a.`, `b.`, `c.`; Level 2 `i.`, `ii.`, `iii.`; Level 3 `A.`, `B.`, `C.`), `Tab` / `Shift+Tab` indentation, level inheritance on Enter, hierarchical reset across block boundaries, Backspace un-indentation, and Enter-at-start prepending.
  8. `todo`: Interactive checkbox with task strikethrough, `[x]` / `[X]` checked markdown shortcuts, clean split marker stripping, and database synchronization.
  9. `toggle`: Collapsible container with toggle arrow (`▶`/`▼`), dual-zone editing with seamless vertical arrow navigation (summary header `ArrowDown` steps into open details `<textarea>`; details `ArrowUp` at offset 0 returns to summary header), multi-line details with boundary `ArrowLeft`/`ArrowRight`, and Backspace un-listing.
  10. `callout`: Highlighted frame with 8 icon presets (`💡`, `⚠️`, `📌`, `🔥`, `⭐`, `🎉`, `ℹ️`, `🦆`) and click-away dismissal.
  11. `columns`: Multi-column split layout block supporting 2 to 5 columns with borderless Notion styling, dedicated `/2 columns` - `/5 columns` slash menu items, responsive grid cards (`grid-cols-1 md:grid-cols-2` up to `grid-cols-5`), individual column header titles with `Enter` advancing to column content, bidirectional vertical traversal (`content` first-line `ArrowUp` ↔ `title`), cross-column `ArrowLeft`/`ArrowRight` and `Tab`/`Shift+Tab` navigation, container card `Backspace`/`Delete` removal, rich editable multi-line bodies with live KaTeX `$formula$` and `` `code` `` rendering, and `ArrowDown` boundary exit.
  12. `table`: Interactive grid table block with streamlined Notion styling (no title input clutter; compact header with `▦ Table` label and dimension badge `Rows × Cols`), rich markdown & KaTeX cell rendering (`TableCell`), interactive inline LaTeX editing via click popover with presets and deletion, clean `$formula$` typing, dynamic cell editing, focus-activated column & row drag handles (`⠿`) that smoothly appear when focusing cells in that column or row (with visual drop indicators `ring-2 ring-inset ring-duck-400/80` for drag-and-drop reordering), `+ Column` / `+ Row` controls, column and row deletion (`✕`) with complete Undo/Redo (`Ctrl+Z`/`Ctrl+Y`), header row toggle, vertical arrow navigation across all intermediate rows (`Header` ↔ `Row 0` ↔ `Row 1`... ↔ `Exit`), horizontal arrow cell hopping (`ArrowLeft`/`ArrowRight`), headerless table `ArrowUp` exit, bottom-right cell upward entry, container card `Backspace`/`Delete` removal, and `Tab` / `Shift+Tab` keyboard cell navigation.
  13. `quote`: Blockquote with thick accent border.
  14. `math`: Full-width LaTeX equation block with live KaTeX rendering, intelligent visibility check with comfortable font scaling floor (`MIN_SCALE = 0.75`), dynamic horizontal scroll container with mouse wheel horizontal panning (`overflow-x-auto`), direct viewport click-to-edit, streamlined single `✨ Presets ▾` toggle button with expandable template & symbol tray, multi-line LaTeX traversal (`Shift+Enter` with line-by-line arrow navigation before boundary exit), horizontal arrow exit (`ArrowLeft`/`ArrowRight`), container card `Backspace`/`Delete` removal, and auto-save on arrow navigation.
  15. `inlinemath`: In-sentence LaTeX formula (`$formula$`) with Notion-style clear rendering (transparent background, borderless, text-matching color, soft hover feedback, and no side handles or pill borders), click popover editor, 10 formula presets, and 20 math symbols.
  16. `divider`: Horizontal divider (`hr`) with keyboard navigation (`ArrowUp`/`ArrowDown`) and backspace/delete removal.
  17. `site`: Site bookmark card with live Google Favicon resolution and URL normalization.
  18. `media`: Visual media embed supporting direct URLs and local file uploads for Images (PNG, JPG, GIF, WebP, SVG) and **YouTube Video Embeds** (`https://www.youtube-nocookie.com/embed/...` responsive 16:9 aspect-ratio iframe player, timestamp support `?t=120`, automatic YouTube URL detection, editable captions, and **width resize presets** `25%` / `50%` / `100%` for compact text flow).
  19. `code`: Code snippet block with 10-language syntax highlighting (JS, TS, Python, HTML, CSS, C++, Java, Rust, SQL, JSON), synchronized line numbers gutter (`1, 2, 3...`), 2-space `Tab` and `Shift+Tab` indentation, auto-indent on `Enter`, 1-click Copy with feedback tooltip, seamless inline backtick code (`` `x` ``) boundary caret navigation, non-premature last line vertical exit (only exiting when caret reaches snippet end), horizontal arrow boundary exit (`ArrowLeft` at 0 / `ArrowRight` at end), card `Backspace`/`Delete` removal, and upward entry caret placement at snippet end.
  20. `page`: **Nested sub-page card** (`{ type: "page", pageId, title, emoji }`) rendered by `PageBlock`. Looks the child note up live in `notesBySpace`, so renaming or re-iconing the child instantly updates the card (icon + title + `→` arrow); `title`/`emoji` are also cached on the block for exports and AI context. Click / `Enter` / `Space` opens the sub-page; `ArrowUp`/`ArrowDown` traverse; `Delete` removes the card **and moves the sub-page to the Trash** (`Backspace` just steps up). Degraded states: page in Trash → dashed card with 🔄 **Restore** (in place, parent stays open) and **Remove**; page gone → **Remove** only. Clone and "Turn into" are disabled for page cards so a sub-page can never be referenced twice.

- **Nested Sub-Pages (Notion-style page hierarchy)**:
  - **Creation**: `/page` in the slash menu (Page is ranked first for that query), the gutter **`+`** button (`Insert below` menu with a searchable block list — an empty text line is converted in place, a filled line gets the card below it), the `⋯` note menu **New sub-page** (header and sidebar rows). Each path calls `onCreateSubPage(parentId, spaceId)` → `Workspace.handleCreateSubPage` creates a blank note with `parentId` in the parent's space (`order` = sibling count), the editor embeds the card, flushes the parent with `performSave({ id, blocks })`, then navigates via `onSelectNote(child)`. A never-saved draft mints its own id first so the child can point at it.
  - **Invariant — one card per sub-page**: removing a card by any explicit edit (gutter 🗑️, `Delete` on the card, selection `Backspace`/`Delete`, `Ctrl+X`, forward `Delete` from the block above) calls `trashRemovedSubPages(prev, next)` → `onTrashSubPage(pageId)` → cascade trash. Undo re-inserts the card (now in the Trash state); the card's **Restore** or the Trash drawer's Recover brings the page back, and `ensurePageBlockInParent` re-adds a missing card to a live parent (via the editor's registered `insertPageBlock` when the parent is open, else by patching stored blocks).
  - **Focus engine**: `page` joins the standalone-embed set (`["divider","site","media","page"]`) — `focusBlock` focuses `#page_<blockId>`, so `ArrowUp` from the block below, `ArrowDown` from the title, and `Backspace` at the start of the next block land on the card.

- **Universal Cross-Block Focus Engine & Natural Arrow Navigation (`focusBlock`)**:
  - Centralized `focusBlock(targetBlock, position = "start" | "end")` dispatcher ensuring deterministic focus and caret placement across all 20 block types.
  - **Ref Registration Protection**: `EditorBlock` guards ref registration with `if (registerRef && contentRef.current)`, preventing child refs (e.g. `CodeBlock`'s `textareaRef`) from being overwritten by `null`.
  - **Bidirectional Vertical Traversal (`handleExitDown` / `handleExitUp`)**: Moving downward smoothly places caret at the logical start of any block (including `MathBlock`, `ColumnsBlock`, and embed cards). Moving upward lands at the true end of the previous block (bottom-right cell of `TableBlock`, end of snippet in `CodeBlock`, last column content in `ColumnsBlock`).
  - **Seamless Horizontal Transitions (`ArrowRight` at block end)**: Steps seamlessly from text blocks into complex and embed blocks without trapping the cursor.
  - **Safe Block Deletion & Slash Transformation**: Deleting empty blocks below complex blocks cleanly returns focus to the preceding block; converting blocks via `/math` or `/columns` smoothly retains focus without mouse interaction.
  - **Document Boundaries & Note Title Integration**: Pressing `ArrowDown` or `Enter` in the Note Title focuses Block 0 across any block type via `focusBlock(blocks[0], "start")`. Pressing `ArrowUp` or `ArrowLeft` from the top of Block 0 steps cleanly up into the Note Title input at the end of the title text (`noteTitleInputRef`).
  - **Native Keyboard Divider Navigation**: `divider` blocks are directly selectable with arrow keys, with `Backspace`/`Delete` removal and `ArrowUp`/`ArrowDown` traversal.
  - **Dynamic Multi-Scale Visual Line Calculations**: `isCaretOnFirstVisualLine` and `isCaretOnLastVisualLine` compare caret coordinates against rendered character start/end ranges backed by dynamic computed style line-height (`Math.max(28, padding + lineHeight * 0.6)`), ensuring accurate vertical line exits across all heading sizes (`h1`–`h4`) and zoomed viewports.
  - **Selective Insertion Dropzones**: Interactive insertion dropzones directly beneath complex/container blocks (`math`, `code`, `table`, `toggle`, `columns`, `site`, `media`, `divider`) allow single-click cursor placement right below the block without modifier keys. Omitted on linear blocks (`text`, `h1`–`h4`, `bullet`, `number`, `todo`, `inlinemath`, `callout`, `quote`) where standard `Enter` naturally appends new blocks.

- **Notion-Grade Line Splitting & Backspace Merging (`splitBlockDOMAtRange` & `getDOMCaretLength`)**:
  - **Heading & Bullet Enter Prepend (`onAddBefore`)**: Pressing `Enter` at offset 0 (start) of any heading (`h1`–`h4`) or bullet/number list item (`bullet`, `number`) with content prepends a new blank block above (a paragraph above headings; an empty bullet/number of matching `level` above lists, specifically the first bullet in a list) and shifts the target block and all downstream blocks downward, maintaining caret focus on the original item on the next line (matching Notion).
  - **Clean Enter Splitting**: Pressing `Enter` anywhere in a text, list, heading, quote, or callout block cleanly splits text into two blocks. Preserves inline math pills (`$formula$`) and code spans (`` `code` ``) without text corruption, strips redundant leading list markers (`- `, `1. `, `[ ]`), resets new todo block state (`checked: false`), and automatically spawns plain text paragraphs below headings and quotes.
  - **Exact Caret Placement on Backspace Merge**: Merging at offset 0 measures the true TreeWalker DOM offset via `getDOMCaretLength(prevEl)` (ignoring internal KaTeX rendered subtrees), synchronously applies merged content via `setBlockDOMFromText`, and places the cursor at the exact merge point via `setCaretAtOffset(targetEl, domCaretOffset)`.
  - **Whitespace Character Preservation on Backspace**: Distinguishes valid whitespace characters (`" "`, `\t`) from truly empty blocks. Typing space and pressing `Backspace` deletes the space character natively rather than deleting the entire block or un-listing. `isCaretAtLogicalStart` returns `false` when caret is after whitespace, and block deletion only triggers when DOM and state are strictly empty (`cleanDOM.length === 0`).
  - **Forward Delete Pull & Merge (`Delete` at block end)**: Pressing `Delete` at the end of a block cleanly pulls up and merges the next text block into the current block maintaining caret position, removes subsequent empty blocks or standalone embeds (divider, site, media), or steps into complex cards without dropping focus.
  - **Ghost-Free Empty Block Deletion**: Deleting empty blocks with `Backspace` between complex blocks reliably returns focus to the preceding block with double-tick rAF protection.
  - **Bottom Whitespace Focus**: Clicking empty whitespace below the document root focuses the last block at the end of text via `setCaretToEnd(el)` without spawning duplicate empty blocks.
  - **Clean Persistence & Zero-Width Sanitization (`cleanZeroWidth`)**: Strips zero-width unicode artifacts (`\u200B`, `\u200C`, `\u200D`, `\u2060`, `\uFEFF`, `\u0000`) across DOM deserialization (`getBlockTextFromDOM`), database persistence (`storageService.saveNote`), AI context extraction (`editorBlocksToText`, `extractHeadingsFromBlocks`), and document exports (`filterBlocksForExport`).

- **Notion-Style Right-Side Outline (Table of Contents)**:
  - Dynamically scans `h1`, `h2`, `h3`, `h4` headings across the document.
  - Sits on the right margin with a collapsible floating pill toggle `📑 Outline (N)` and expanded outline drawer.
  - Active scroll spy: Automatically highlights the heading currently in reading focus (`border-l-2 border-duck-400 bg-duck-500/15`) throttled via `requestAnimationFrame`.
  - Smooth in-page jumping: Clicking any outline item scrolls directly to that heading, focuses it, and triggers a pulse highlight ring.

- **Inline Image & Video Resize Presets (`25%` / `50%` / `100%`)**:
  - Segmented width toggle pills embedded directly in the media block header.
  - Automatically constraints Image, Video, and YouTube viewport widths (`w-1/4 min-w-[220px] mx-auto`, `w-1/2 min-w-[320px] mx-auto`, `w-full`) for balanced layout with text flow.
  - Sizing preferences persist per-block and export seamlessly to HTML and Markdown.
  - **Caption Keyboard Isolation & Enter Block Spawning**: The media caption input (`<input data-media-caption="true">`) isolates keystrokes via `e.stopPropagation()`, ensuring `Backspace`, `Delete`, and arrow keys perform native character editing without bubbling to outer block handlers (`onExitUp`). Pressing `Enter` in the caption cleanly spawns a new text paragraph directly below the media block (`onAddAfter`). Both `MediaBlock` and `SiteBlock` guard their outer `onKeyDown` handlers against events originating from child `INPUT` or `TEXTAREA` elements.

- **In-Memory Keyboard Navigation History (`Alt + ←` / `Alt + →`)**:
  - Centralized navigation history stack (`navHistoryRef`) in `components/Workspace.jsx` tracking note transitions across all spaces.
  - Global `Alt + ArrowLeft` and `Alt + ArrowRight` shortcuts for lightning-fast back-and-forth switching between recent notes.
  - Visual `◀` and `▶` breadcrumb controls in the top navigation bar with disabled state reflection and shortcut tooltips.

- **Google Docs & Web Rich HTML Smart Paste Sanitizer (`parseHtmlToBlocks` & `handleSmartPaste`)**:
  - Automatically parses clipboard `text/html` from Google Docs, Notion, Word, Canvas LMS, and web pages directly into structured, sanitized SocraticOS block trees.
  - Strips Google Docs boilerplate (`docs-internal-guid`, foreign inline font-family / font-size styles) preventing DOM corruption or theme leakage.
  - Converts semantic HTML elements (`<h1>`-`<h6>`, `<ul>`, `<ol>`, `<table>`, `<blockquote>`, `<pre>`, `<code>`, `<hr>`, `<iframe>`, `<video>`, `<img>`) into native blocks.
  - Converts inline tags and Google Docs span styling (`<b>`, `<strong>`, `font-weight: 700`, `<i>`, `<em>`, `font-style: italic`, `<code>`, `<a>`, `<mark>`, `<s>`) into clean inline Markdown tokens (`**bold**`, `*italic*`, `` `code` ``, `[link](url)`, `==highlight==`, `~~strike~~`).
  - **Bullet & List Formatting Preservation**: Safely strips list item bullet prefixes without stripping bold (`**`) or italic (`*`) delimiters.
  - **Bullet Type & Indent Level Retention**: Pasting text into active `bullet`, `number`, or `todo` blocks preserves the parent block type and indentation level (`level`).
  - **Robust Nested Bold & Italic Compiler (`formatMarkdownInline`)**: Supports nested bold and italic (`**bold with *italic* inside**`, `*italic with **bold** inside*`, `**_text_**`, `_**text**_`, `***text***`), promoting lines to `h3` only when explicitly ending with a colon (`* **Heading:**`).
  - Seamlessly falls back to `parseMarkdownToBlocks` when pasting pure Markdown, plain text, or Excel / Sheets TSV tables.

- **Floating Text Selection Popover Toolbar (`TextSelectionToolbar`)**:
  - Automatically appears above any highlighted text across any editable block, list, heading, quote, callout, or table cell.
  - Action buttons: **Bold** (`B`), **Italic** (`I`), **Underline** (`U`), **Cross / Strikethrough** (`S`), **Convert to Code** (`</>`), **Convert to Formula** (`$x$`), ✨ **Explain**, and 🦆 **Quiz me on Selection**.
  - **Focus & Caret Retention**: Converting text to math or code synchronously compiles into rich elements and re-focuses without losing document focus.
  - **Underline Persistence**: Underline `<u>` elements are preserved losslessly across DOM serialization, inline formatting, and editor state updates.
  - **Formatting Boundary Caret Escaping**: Setting the caret at the boundary end of formatted spans places the caret in a trailing text node outside the formatting element, preventing subsequent typing from being inadvertently styled.
  - **Punctuation-Aware Auto-Formatting**: Typing closing backticks (`` `code` ``) or dollar signs (`$formula$`) immediately before punctuation suppresses unwanted extraneous space insertion.

- **Hierarchical Sub-Bullets & Keyboard State Machine**:
  - Full multi-level nesting for bullet blocks (`level: 0` to `level: 4`) and numbered lists (`1.`, `a.`, `i.`, `A.`).
  - **Tab**: Indents active bullet (empty or with text) to a sub-bullet (`level = level + 1`).
  - **Shift+Tab**: Unindents active sub-bullet (`level = level - 1`). If unindented at `level: 0` while empty, converts the block to a plain text paragraph.
  - **Enter**: Pressing Enter on an empty sub-bullet unindents by 1 level before exiting to text; pressing Enter on a non-empty sub-bullet inherits the current level onto the newly created bullet below.
  - **Backspace**: Pressing Backspace at offset 0 of a sub-bullet unindents by 1 level before converting to plain text.
  - **Hierarchical Glyphs & Indentation**: Level 0 renders a solid filled circle (`●`), Level 1 renders a hollow ring (`○`) with `1.5rem` indent, Level 2 renders a solid square (`■`) with `3.0rem` indent, and Level 3+ renders a hollow square with `4.5rem+` indent.

- **Centralized Deeply-Cloned Undo/Redo Engine (`pushHistorySnapshot`)**:
  - Captures immutable deep JSON copies of `blocksRef.current` across all 19 editor mutation handlers, completely eliminating shared-reference memory leaks and historical state corruption.
  - Synchronously updates `pastBlocksRef.current`, `futureBlocksRef.current`, and `blocksRef.current` prior to React state batching, guaranteeing 100% reliable rapid sequential `Ctrl+Z` / `Ctrl+Y` / `Ctrl+Shift+Z` keystrokes.
  - Atomic block splitting on Enter via `splitBeforeContent` eliminates double-snapshot races between `onChange` and `onAddAfter`.
  - Symmetrical smart target focus restoration across both Undo and Redo: focuses the surviving neighboring block if the target was removed, never dropping focus to `document.body` or jumping to block 0.

- **In-Context Slash Menu (`/`)**: Typing `/` triggers a floating block-type selector directly beneath the active line, supporting all 23 command items, **relevance-ranked** by `rankSlashItems` (exact → prefix → keyword → substring, so `/page` → Page and `/h1` → Heading 1 rather than whichever loose keyword match is declared first):
  - Text, Page (nested sub-page), Heading 1 (`h1`), Heading 2 (`h2`), Heading 3 (`h3`), Heading 4 (`h4`)
  - 2 Columns, 3 Columns, 4 Columns, 5 Columns
  - Bullet List, Numbered List, To-Do List, Toggle List, Callout Box
  - Table, Quote, Math Equation, Inline Equation, Divider
  - Site Bookmark Embed, Image / YouTube Video Embed, Code Snippet
  - Dismissing via `Escape` or outside click immediately returns focus to the host block.

- **Block Gutter (`+` · 🗑️ · ⠿)**: Hovering a block reveals three aligned controls: **`+`** opens the searchable *Insert below* menu (same items as the slash menu, including **Page**), 🗑️ deletes the block, and ⠿ drags / opens the context menu.

- **Notion 6-Dots & Right-Click Context Menu**:
  - Accessible via hovering the `⠿` grip handle or **right-clicking anywhere on the block**.
  - Clean block-level actions: ✨ **Explain Block**, 🦆 **Quiz on Block**, Duplicate (📋), Move Up/Down (⬆️/⬇️), Copy Text (📄), and Turn Into Submenu. Dismissible via click-outside or `Escape`.

- **Cover Banners & Custom Icons**: 100% full-width cover banners with 5 gradient presets (*Cyberpunk*, *Sunset Amber*, *Ocean Teal*, *Midnight Blue*, *Socratic Gold*) and custom emoji picker with 24 academic presets (`NOTE_EMOJIS`).

- **3 Typography Font Options & Note Menu Selector**:
  - Three font options are offered: **Default Sans** (`font-note-sans`), **Classic Serif** (`font-note-serif`) and **Developer Mono** (`font-note-mono`). `app/globals.css` also defines `font-note-handwriting` and `font-note-geometric`, but `NOTE_FONTS` in `NoteMenu.jsx` does not offer them, so they can only be reached by editing a note's `fontStyle` directly.
  - Notion-style segmented font selector at the top of `NoteMenu` (`⋯`), allowing instant one-click switching with live preview glyphs (`Ag`).
  - **Per-Note Isolation & Persistence**: Font choices persist independently in IndexedDB via `saveNote({ ...note, fontStyle })`.
- **Full Width & Lock Page Toggles (`components/NoteMenu.jsx` & `components/BlockNoteEditor.jsx`)**:
  - **Full Width**: Notion-style toggle switch row under "Move to Space" in NoteMenu switching the document layout between standard reading column (`max-w-3xl px-10`) and edge-to-edge canvas (`w-full max-w-none px-6 md:px-12`). Persists per-note via `fullWidth: boolean`.
  - **Lock Page**: Notion-style toggle switch row under "Full width" making the document strictly read-only (`isLocked: boolean`). When active: renders a subtle top-right lock icon button (under top bar) with an instant "Unlock" action and tooltip, sets title input to `readOnly`, hides header action strips and banner controls, disables icon changes, sets `contentEditable={false}` across all blocks and table cells, hides gutter drag/delete buttons, and disables right-click and slash menus.

- **Real-Time Note Stats**: NoteMenu calculates total characters, total words, total blocks, and estimated reading time across all block contents, toggle details, and math formulas.

- **Auto-Instantiation & Click-to-Append**: Typing inside an empty space automatically instantiates a note. When `clickToAppend` is enabled, clicking blank space strictly below the last block in bottom whitespace appends a new block or focuses the last empty block; clicking in the outer sides of the screen or lateral padding beside blocks is strictly disabled from appending or focusing.

- **Debounced Auto-Save & Unmount Flush Engine**:
  - All block mutations automatically trigger a 400ms debounced save (`triggerDebouncedSave`).
  - `performSave` packages complete note payloads (`id`, `spaceId`, `title`, `blocks`, `banner`, `fontStyle`, `fullWidth`, `isLocked`, `isFavorite`, `emoji`).
  - `BlockNoteEditor` maintains an unmount cleanup effect that immediately flushes dirty state with explicit note and space IDs upon space switching or navigation, preventing data loss.
  - `Workspace.jsx` maintains an active `editorBlocksRef` to guarantee that manual saves (`Ctrl+S`, `NoteMenu`, favorite toggles) never overwrite live editor content with stale initial state.

- **High-Performance Lasso / Marquee Multi-Block Selection**:
  - Document-anchored selection box (`absolute` coordinate space) with 60/120fps `requestAnimationFrame` loop.
  - Continuous edge proximity auto-scrolling (up to 35px/frame) allowing seamless selection across long notes far beyond the viewport.
  - Batch intersection calculations and set equality state caching for zero-lag drag performance.
  - Re-entrance and marquee completion guards (`justFinishedMarquee` and `lastWhitespaceClickHandledTime`) preventing synthetic mouseup clicks on the side margin from clearing multi-block lasso selections.
