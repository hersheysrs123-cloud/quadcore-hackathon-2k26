# Literature — poems, annotations and revision

The Literature section is a close-reading workspace: you type a poem in line by
line, attach analysis to arbitrary spans of it, and then revise from that
analysis with it blurred out.

It was integrated from a standalone vanilla-JS app. The **data model and the
pure range logic were kept verbatim**; the imperative DOM layer was rewritten
as React against this project's shell, storage and design tokens.

---

## 1. The data model

One poem is one row in `db.poems`:

```js
{
  id: "poem_…",
  spaceId: "School",          // space-scoped, exactly like quizzes and bookmarks
  title: "Ozymandias — Percy Bysshe Shelley",
  lines: ["I met a traveller…", …],   // one string per line; "" is a stanza break
  intro: "…", conclusion: "…",        // per-poem essay drafts
  annotations: [ … ],
  sample: false,              // true only for the bundled demo poem
  created: 1700000000000, updated: …,        // numeric — used for ordering
  createdAt: "2026-…", updatedAt: "2026-…",  // ISO — project convention
}
```

An annotation:

```js
{
  id: "ann_…",
  ranges: [ { startLine, startChar, endLine, endChar }, … ],
  text: "…",        // the analysis
  label: "Imagery", // optional short tag
  created, updated,
}
```

### Two invariants worth knowing before you touch any of this

**1. A range's end is EXCLUSIVE, and line/char are both 0-based.** Ranges may
span any number of lines.

**2. An annotation owns an ARRAY of ranges, not one range.** The array is the
feature: a rhyme pair on two different lines is *one* annotation with two
"parts", not two annotations. Any code that reads `ann.range` (singular) is
reading the pre-integration shape — `sanitizePoem()` upgrades that on import,
and nothing else should ever produce it.

An annotation's **number is derived, never stored**. `orderAnnotations()` sorts
by first position in the poem, so inserting an annotation halfway up renumbers
everything below it with no migration.

---

## 2. `lib/literature.js` — the pure logic

No DOM, no Dexie, no React; unit-tested under plain Node in
[`tests/unit/literature-core.test.mjs`](../../tests/unit/literature-core.test.mjs).

| Function | Does |
| :--- | :--- |
| `trimRange(lines, r)` | Clamps a raw selection to the poem, then shaves whitespace and empty lines off both ends. Returns `null` when nothing real is selected — this is what makes a stray triple-click harmless. |
| `rangeText` / `annotationParts` / `annotationQuote` | The literal text a range covers; per-part and joined display quotes. |
| `buildLineSegments(i, text, anns)` | **The core trick.** Cuts one line at every annotation boundary into non-overlapping segments, each tagged with every annotation id covering it, plus the end markers. |
| `bucketAnnotationsByLine(poem)` | Annotations grouped by the lines they touch, so rendering is one pass. |
| `orderAnnotations` / `numberMap` | Reading-order numbering. |
| `remapAnnotations(anns, lineMap, newLines)` | Moves annotations through a line edit. `lineMap[old] = new`, or `-1` when deleted. Reports `droppedParts` / `droppedAnns`. |
| `sanitizePoem` / `migrate(raw)` | Validates an imported blob or throws. **Out-of-range imports are dropped, not clamped**, so a corrupt file can never invent a highlight. |
| `sampleData()` | Ozymandias, with an overlap, two readings of one phrase, and a two-part rhyme annotation. |

### Why segmentation rather than nested elements

Partial overlaps cannot be expressed as nested spans — `<a>one <b>two</a> three</b>`
is not a tree. So the line is cut at every boundary instead, and each flat
segment records its own coverage depth. That also keeps the text a flat run of
spans, which is what makes the selection maths in §4 exact.

---

## 3. `lib/literatureService.js` — persistence

Dexie CRUD following `storageService.js` conventions (SSR guard, missing-table
guard, `prefix_timestamp_random` ids).

`createPoem` · `savePoem` · `deletePoem` · `updatePoemContent` · `setEssay` ·
`addAnnotation` · `updateAnnotation` · `deleteAnnotation` ·
`exportPoemsJson` · `importPoems` · `clearSpacePoems` · `movePoemsToSpace` ·
`resetLiteratureData` · `loadLiteratureUI` / `saveLiteratureUI`.

**`initLiteratureData(spaceId)`** runs once at boot and is additive only:

1. If `localStorage["literature-revision/v1"]` exists and has not been adopted,
   its poems are pulled into Dexie. The localStorage key is **left in place**,
   so the standalone app keeps working; a flag prevents a second import.
2. Otherwise, if there are no poems at all, the Ozymandias sample is planted.

Both steps are flag-guarded, so deleting the sample does not make it grow back.

UI preferences (mode, tab, selected poem, panel open) live in
`localStorage["socratic_literature_ui"]`, not Dexie: they are per-browser, not
per-workspace.

---

## 4. `components/literature/PoemCanvas.jsx` — selection ↔ ranges

The rendered DOM is a **contract**, not an implementation detail:

```
.lit-line[data-line]                       one poem line, 0-based
  .lit-seg[data-start][data-end][data-ids] a run with a fixed coverage set
  .lit-marker[data-id][data-at]            a superscript number, TEXT-FREE
```

- `data-start` turns a DOM node + offset straight back into a character offset,
  without walking text.
- **Markers must stay text-free.** Their digits come from a CSS
  `::after { content: attr(data-n) }`. Put them in a text node and they become
  part of the line's character count, shifting every offset after them and
  making them selectable.

`getSelectionRange()` resolves both selection edges to `{line, char}` and runs
the result through `trimRange`. Hover/open classes are applied **imperatively**
in an effect rather than through render props: a long poem has hundreds of
segments and hovering must not re-render the canvas.

---

## 5. The rest of the components

| File | Owns |
| :--- | :--- |
| `components/LiteratureView.jsx` | The section: poem list, header, mode switch, popover lifecycle, keyboard, import/export, responsive drawers |
| `components/literature/PoemCanvas.jsx` | The poem and the selection maths (§4) |
| `components/literature/AnalysisPanel.jsx` | The side panel — an *index* in Normal mode, the recall surface in Test mode |
| `components/literature/AnnotationPopover.jsx` | Three popovers in one shell: `view`, `choose` (several annotations on the same words) and `edit` (multi-phrase chips) |
| `components/literature/PoemLinesModal.jsx` | The line editor, and the `lineMap` that keeps annotations attached. Also exports `ConfirmDialog` |
| `components/literature/EssayPanel.jsx` | Intro/Conclusion, debounced 350 ms with a flush on blur, tab change and unmount |

### Popover lifecycle gotchas

- A `view` popover opened by **hover** is unpinned and closes on a 220 ms
  leave timer; one opened by **click** is pinned and only closes explicitly.
  `popHoveredRef` is tracked with real enter/leave events because `:hover` is
  not reliably recomputed for an element that appears under the cursor.
- **The `edit` popover ignores `closePopover()` unless forced.** It holds
  unsaved writing, so only Save, Cancel and `Esc` may close it.
- Focusing the editor's textarea wipes the document selection in every browser.
  `pendingRange` deliberately keeps the last real poem selection alive so
  **+ Add selected phrase** stays usable.

### Responsive behaviour

Four fixed columns (rail 68 + list 244 + analysis 322 + essay 330) leave the
poem nothing below ~1600px, so each side panel becomes an overlay drawer once
it stops fitting, via `useMediaQuery` from `usehooks-ts`:

| Width | Layout |
| :--- | :--- |
| ≥ 1536 | list · poem · analysis · essay, all inline |
| 1280–1535 | essay becomes a drawer (`NotebookPen` toggle) |
| 900–1279 | analysis also becomes a drawer. **Test mode does not auto-open it** — it would bury the poem — and its toggle stays enabled so you can still reach it |
| < 900 | the poem list becomes a drawer too (`List` toggle) |

---

## 6. Where it plugs into the shell

- **`NavRail.jsx`** — a `literature` section between *3D Lab* and *Saved*.
- **`TopBar.jsx`** — `SECTION_TITLES.literature` for the breadcrumb.
- **`Workspace.jsx`** — `activeTab === "literature"` renders `<LiteratureView activeSpace={…} />`, and the tab joins the list that manages its own scrolling. Tab restore is generic, so `?tab=literature` and the persisted last-tab both work with no whitelist to update.
- **`CommandPalette.jsx`** — "Open Literature (Poems & Analysis)".
- **`HomeView.jsx`** — a Literature card with live poem/annotation counts.
- **`Sidebar.jsx`** (SettingsModal) — a *Factory Reset Literature* target.
- **`storageService.js`** — `renameSpace` carries poems across, `deleteSpace` removes that space's poems, `factoryResetWorkspace` gained a `"literature"` target and clears `db.poems` on `"all"`.

## 7. Styling

The stacked-underline geometry cannot be expressed in Tailwind (layered
`linear-gradient` backgrounds at three offsets), so `.lit-*` rules live in a
scoped block at the foot of `app/globals.css`, written against the `ink`/`duck`
tokens. Everything else is ordinary Tailwind utilities. See
[docs/design/literature-ui.md](../design/literature-ui.md).
