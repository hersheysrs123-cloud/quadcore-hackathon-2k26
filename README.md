# SocraticOS

> quadcore-hackathon-2k26

An all-in-one productivity and Socratic learning workspace. Block-based notes,
organised into spaces, with a Socratic Duck that quizzes you on any block until
it can score what you actually understand.

Next.js (App Router) · Tailwind CSS v4 · Supabase · Claude.

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

The workspace renders a mock note at [localhost:3000](http://localhost:3000) —
no database or API key required to see it. Set `ANTHROPIC_API_KEY` to get real
questions out of the Duck instead of the canned placeholder.

## Layout

```
app/
  layout.js                     Root shell, dark by default
  page.js                       Server component -> <Workspace />
  globals.css                   Tailwind v4 entry + @theme palette
  api/
    notes/create/route.js       POST   create a note + its blocks
    notes/[id]/route.js         GET    note + ordered blocks + sessions
    socratic/chat/route.js      POST   one Socratic turn against Claude
components/
  Workspace.jsx                 Shell state (active space, Duck target)
  Sidebar.jsx                   Spaces + note list
  NoteEditor.jsx                Note header + block list
  Block.jsx                     Per-block renderer + "Talk to Duck 🦆"
  DuckPane.jsx                  Slide-over: chat + understanding heatmap
lib/
  supabaseClient.js             Browser client (anon key, RLS applies)
  supabaseServer.js             Route-handler client (service role if present)
  constants.js                  SPACES, BLOCK_TYPES, content shapes
  blocks.js                     Block display helpers
  mockNote.js                   Placeholder note for the boilerplate UI
supabase/
  schema.sql                    Tables, enums, indexes, RLS, triggers
```

## API

### `POST /api/notes/create`

Creates a note in a space and seeds its blocks. With no `blocks`, you get a
single empty text block so the editor never opens on nothing.

```jsonc
{
  "spaceId": "uuid",
  "title": "Eigenvectors",        // optional, defaults to "Untitled"
  "blocks": [                     // optional
    { "block_type": "heading", "content_json": { "text": "Why Av = λv?", "level": 2 } }
  ]
}
```

→ `201 { note: { ...note, blocks: [...] } }`

### `GET /api/notes/[id]`

→ `200 { note: { ...note, blocks: [{ ...block, socratic_sessions: [...] }] } }`

Blocks come back sorted by `order_index`.

### `POST /api/socratic/chat`

One turn of the diagnostic. Send the conversation so far; get back the next
question plus an updated confidence map.

```jsonc
{
  "conceptName": "Eigenvectors",
  "messages": [{ "role": "user", "content": "..." }],
  "blockId": "uuid"               // optional — persists to socratic_sessions
}
```

→ `200`

```jsonc
{
  "reply": "What would happen to a vector at 45° under that shear?",
  "understanding": [
    { "concept": "Invariant directions", "confidence": 0.4, "evidence": "..." }
  ],
  "status": "active",
  "persisted": true
}
```

Uses `claude-opus-5` with structured outputs, so `understanding` is schema-valid
JSON rather than something you have to parse out of prose. It drops straight
into `socratic_sessions.heatmap_json`.

## Schema notes

Three decisions worth knowing about before you build on it:

- **`blocks.order_index` is `double precision`, not an integer.** Inserting
  between two blocks is `(prev + next) / 2` — no renumbering every row below it
  when someone drags a block during the demo.
- **`spaces.name` is `text` + a CHECK constraint**, while `block_type` and
  `status` are real enums. User-named spaces are the obvious next feature and
  relaxing a CHECK is one line; altering an in-use enum is not.
- **RLS is on and keyed to `auth.uid()`**, so it denies everything until
  Supabase Auth is wired up. Until then you need one of: the secret key in
  `SUPABASE_SERVICE_ROLE_KEY` (bypasses RLS entirely), or the DEV MODE block at
  the bottom of `schema.sql` uncommented (opens the tables to the publishable
  key). The mock UI renders without either; the API routes don't. Delete the DEV
  MODE policies before anything ships.

A trigger on `auth.users` seeds School / Personal / Misc for every new signup.
