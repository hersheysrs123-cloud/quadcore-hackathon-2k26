# Literature — UI specs

The Literature section uses the ordinary design system: `ink` surfaces, `duck`
accent, `rounded-xl`/`rounded-2xl`, `animate-fade-up` modals, lucide icons. This
file covers only what is specific to it.

## Typography

The poem is set in **`font-note-serif`** (`--font-note-serif`, Lora/Charter/
Georgia) at `text-[19px] leading-[2.35]`, capped at `max-w-[46em]`. The generous
line height is not decoration: it is the space the underline stack is drawn
into.

Serif also appears at smaller sizes for anything quoting the poem — annotation
quotes, popover headers, phrase chips, line-editor inputs — so quoted text
always reads as *the poem* rather than as chrome. Everything else stays on
`--font-ui`.

## The underline stack

Defined in the `.lit-*` block at the foot of `app/globals.css`. Tailwind cannot
express it: it is three `linear-gradient` background layers at three vertical
offsets inside the `--lit-u-pad: 11px` reserved beneath each line.

| Depth | Layers | Token |
| :--- | :--- | :--- |
| 1 | one line, 8–10px from the bottom | `--color-duck-400` |
| 2 | adds a second at 4–6px | `--color-duck-700` |
| 3+ | adds a third at 0–2px | `--color-shaky-500` |

Every state is a **background layer, never a border or `text-decoration`**, so
toggling a highlight never changes metrics and never reflows the poem.

Hover/active tint is applied to the same segment via `--lit-tint`:

| State | Tint |
| :--- | :--- |
| `:hover` | `duck-400` at 12% |
| `.is-hot` (hovered from the panel) | `duck-400` at 18% |
| `.is-open` (its popover is open) | `duck-400` at 28% |

`color-mix(in srgb, …)` is used so both themes get a correct tint from one rule.

## Markers

`.lit-marker` is a `<sup>` whose digits come from `::after { content: attr(data-n) }`
— **never a text node**, see [the codebase note](../codebase/literature.md#4-componentsliteraturepoemcanvasjsx--selection--ranges).

- Default: `duck-300` on `duck-400/15`, `1px` border at `duck-400/35`.
- Hover / hot: solid `duck-400`, `ink-950` text.
- Open: `duck-300` fill.
- `.is-part` (the 2nd+ phrase of a multi-part annotation): `opacity: .72`, so a
  rhyme pair reads as "one note, seen twice" rather than as two notes.

## Line numbers

`.lit-line::before` is a CSS counter at `ink-600`, `10.5px`, `opacity: 0` until
`.lit-poem:hover`. Always-on numbering competes with the poem for attention, and
this is a reading surface first.

## Blur / recall

`.lit-blurable.is-hidden` → `blur(5px)`, `opacity: .85`, `ink-500`,
`user-select: none`, and `pointer-events: none` on descendants so a blurred card
is one click target.

Applied **only to analysis text** — in the panel, the view popover and the
chooser preview. The poem is never blurred: in Test mode you are recalling your
reading of the text, not the text.

In Normal mode the panel shows quote + label + location only; the analysis body
is rendered exclusively in Test mode, so the panel is an index rather than a
wall of text beside the poem.

## Layout

| Region | Width |
| :--- | :--- |
| Poem list | `244px` |
| Poem column | fluid, `min-w-0` |
| Analysis panel | `322px` |
| Essay panel | `330px` |

Below the breakpoints in
[the codebase note](../codebase/literature.md#responsive-behaviour) each side
panel becomes an overlay drawer: `absolute inset-y-0`, `z-[120]`
(essay `z-[130]`), `shadow-2xl`, `transition-transform duration-200`, behind one
shared scrim at `z-[110]` (`bg-ink-950/50 backdrop-blur-xs`).

## Z-index ladder

| Layer | z |
| :--- | :--- |
| Floating "Add analysis" | `210` |
| Annotation popover | `220` |
| Drawer scrim | `110` |
| Drawers | `120` / `130` |
| Poem modals + import | `250` / `260` |
| Nested confirm dialog | `270` / `280` |
| Toast | `300` |

The confirm dialog sits above the line editor because it is raised *from* it
("Delete poem?", "Discard changes?").

## Test hooks

`data-testid="literature-poem-list"`, `data-testid="literature-essay-panel"`,
plus the structural `data-lit-popover`, `data-lit-panel`, `data-lit-float-add`
attributes used for outside-click detection.
