# SocraticOS

> quadcore-hackathon-2k26

An all-in-one productivity and Socratic learning workspace. Block-based notes,
organised into spaces, with a Socratic Rubber Duck that quizzes you on any block,
scores what you actually understand, and generates an interactive playground
aimed at whatever you got wrong.

Next.js (App Router) · Tailwind CSS v4 · Supabase · Google AI Studio (Gemini).

## Setup

```bash
npm install
```

```bash
cp .env.example .env.local
```

Fill in `.env.local`, then run the schema: open the Supabase SQL Editor, paste
all of [`supabase/schema.sql`](supabase/schema.sql), and hit Run. It's
idempotent, so re-run it freely while you iterate.

```bash
npm run dev
```

The workspace renders a mock note at [localhost:3000](http://localhost:3000) with
no keys at all. `GOOGLE_API_KEY` is what makes the Duck work; the database is
only needed for the notes routes.

## Layout

```
app/
  layout.js                     Root shell, dark by default
  page.js                       Server component -> <Workspace />
  globals.css                   Tailwind v4 entry + @theme palette
  api/
    notes/create/route.js       POST   create a note + its blocks
    notes/[id]/route.js         GET    note + ordered blocks + sessions
    socratic/chat/route.js      POST   one Socratic turn, or the final score
    socratic/widget/route.js    POST   build a playground from the gaps
components/
  Workspace.jsx                 Shell state (active space, Duck target)
  Sidebar.jsx                   Spaces + note list
  BlockNoteEditor.jsx           Notion-style editor: slash menu, Duck action bar
  NoteEditor.jsx                Superseded by BlockNoteEditor; unreferenced
  Block.jsx                     Per-block renderer + "Talk to Duck 🦆"
  SocraticWorkspace.jsx         Drawer: chat -> diagnostic -> playground
  ConfidenceHeatmap.jsx         Score, summary, per-subtopic heatmap
  WidgetCanvas.jsx              Interactive canvas + generated sliders
lib/
  gemini.js                     Gemini REST client, model + token constants
  schemas.js                    Structured-output schemas for both routes
  supabaseClient.js             Browser client (publishable key, RLS applies)
  supabaseServer.js             Route-handler client (secret key if present)
  constants.js                  SPACES, BLOCK_TYPES, content shapes
  blocks.js                     Block display + note flattening helpers
  blockMapping.js               Editor <-> database block translation
  mockNote.js                   Placeholder note for the boilerplate UI
scripts/
  check-block-mapping.mjs       Round-trip guard for blockMapping (npm run check:blocks)
supabase/
  schema.sql                    Tables, enums, indexes, RLS, triggers
```

## The Socratic loop

```
chat ──(isFinalTurn)──▶ diagnostic + heatmap ──(red gaps)──▶ widget
```

### `POST /api/socratic/chat`

```jsonc
{
  "noteContent": "...",           // whole note, flattened — optional context
  "concept": "Eigenvectors",      // required
  "conversationHistory": [{ "role": "user", "content": "..." }],
  "isFinalTurn": false
}
```

`isFinalTurn: false` → `{ type: "question", reply, usage }`
`isFinalTurn: true` → `{ type: "diagnostic", diagnostic: { score, summary, heatmap, recommendedWidget }, usage }`

### `POST /api/socratic/widget`

```jsonc
{
  "concept": "Eigenvectors",
  "redSubtopics": [{ "subtopic": "Shear matrices", "feedback": "..." }],
  "recommendedWidget": "3d_vector_simulation"
}
```

→ `{ widget: { widgetType, initialState, interactiveControls, explanationKey }, usage }`

Both use Gemini structured output (`responseMimeType: "application/json"` plus a
`responseSchema`), so the heatmap and the widget config arrive schema-valid
rather than parsed out of prose.

## Notes API

`POST /api/notes/create` creates a note *and* seeds its blocks, so the editor
never opens on nothing. `GET /api/notes/[id]` returns the note with blocks sorted
by `order_index`.

## Design notes

- **`lib/gemini.js` talks to the REST API with `fetch`**, not `@google/genai`.
  One fewer dependency, no SDK drift, and `generate()` is the only function that
  touches the network if you want to swap it.
- **`lib/blockMapping.js` is the only place the editor and the database meet.**
  The editor is flat (`{id, type, content}`); rows are structured
  (`{block_type, content_json}`). Headings split by level in the editor and
  collapse to one enum value with `content_json.level`; `media` and `socratic`
  have no editor equivalent, so they flatten to text and carry their payload on
  a `meta` field the editor preserves but ignores. That round trip is lossless
  and `npm run check:blocks` asserts it.
- **`blocks.order_index` is `double precision`, not an integer.** Inserting
  between two blocks is `(prev + next) / 2` — no renumbering every row below it.
- **`spaces.name` is `text` + a CHECK constraint**, while `block_type` and
  `status` are real enums. User-named spaces are the likely next feature and
  relaxing a CHECK is one line; altering an in-use enum is not.
- **`WidgetCanvas` uses Canvas 2D with a hand-rolled perspective projection**,
  not Three.js. `project()` and `draw()` are the only functions touching the
  canvas, so swapping in react-three-fiber is a contained change.
- **RLS is on and keyed to `auth.uid()`**, so it denies everything until
  Supabase Auth is wired up. Until then you need either the secret key in
  `SUPABASE_SERVICE_ROLE_KEY` or the DEV MODE block at the bottom of
  `schema.sql`. Delete those policies before anything ships.

A trigger on `auth.users` seeds School / Personal / Misc for every new signup.

## Known warnings

`npm audit` reports 3 high-severity advisories in `postcss` and `sharp`. Both are
transitive dependencies *inside* Next.js, the vulnerable range covers every
current Next version, and neither is reachable here (no attacker-controlled CSS,
no image uploads). **Do not run `npm audit fix --force`** — it "fixes" them by
downgrading to `next@9.3.3`, which would delete the App Router.
