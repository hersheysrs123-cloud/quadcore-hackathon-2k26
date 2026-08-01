# AGENTS.md

Operating notes for coding agents working in **SocraticOS** (`quadcore-hackathon-2k26`).

[`README.md`](README.md) explains *what* the project is and documents the API
shapes, the database schema decisions and the Socratic loop. Read it first and
don't duplicate it here. This file covers *how to work in the repo*: commands,
conventions, invariants you must not break, and traps that have already cost
someone an hour.

---

## Commands

```bash
npm run dev            # Next dev server on :3000
npm run build          # production build — also the only real typecheck
npm run check:blocks   # round-trip guard for lib/blockMapping.js
```

- **`npm run lint` does not work.** No ESLint config exists, and `next lint` is
  deprecated and prompts interactively. Don't call it; use `npm run build` to
  catch errors.
- **There is no test framework.** `scripts/check-block-mapping.mjs` is plain Node
  asserting one invariant, and exits non-zero on failure. Follow that pattern if
  you add checks — don't introduce Jest/Vitest without being asked.
- **Never run `npm audit fix --force`.** It downgrades to `next@9.3.3` and
  deletes the App Router. See the README's *Known warnings*.

### Do not run `next build` while the dev server is running

The build overwrites `.next/`, and the running dev server keeps referencing
chunks the build deleted — it starts 500ing with
`ENOENT: .next/server/vendor-chunks/*.js`. If you need both:

```bash
# stop dev server, then:
rm -rf .next && npx next build && rm -rf .next
# then restart dev
```

---

## Environment

Secrets live in `.env.local` (gitignored); `.env.example` documents every key and
why it is shaped that way. Rules that matter:

- `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS. It is **server-only** — it may only
  be read inside `app/api/**/route.js`. Never prefix it `NEXT_PUBLIC_`, never
  import it from a component.
- Leave it **unset** rather than filled with a placeholder. The routes fall back
  to the publishable key when absent; a junk value is used verbatim and fails.
- `GOOGLE_API_KEY` is server-only too.
- The workspace renders a mock note with **no keys at all** — you can do most UI
  work without touching Supabase.

---

## Conventions

- **Path alias** `@/*` → repo root (`jsconfig.json`). Use `@/components/...`,
  not relative climbing.
- **JavaScript, not TypeScript.** No `.ts`/`.tsx`. Components are `.jsx`; `lib/`
  and API routes are `.js`.
- **Client components need `"use client"`.** Anything with state, effects,
  browser APIs or R3F. `app/page.js` is deliberately a server component.
- **Comments explain *why*, never *what*.** The codebase's distinctive habit is
  a short paragraph above a non-obvious decision — read `lib/blockMapping.js` or
  `scripts/check-block-mapping.mjs` for the register. Section dividers use
  `// ─── Name ───────` box rules. Match this; do not add narration like
  `// set the state`.
- **Match surrounding density.** Existing files are lightly but deliberately
  commented. Don't strip comments and don't blanket every line.

### Tailwind v4 — read this before styling anything

There is no `tailwind.config.js`. The palette is declared in an `@theme` block
in [`app/globals.css`](app/globals.css), and **only declared tokens generate
utilities.**

| Available | |
|---|---|
| Neutrals | `ink-950 900 850 800 700 600 500 400 200 100` |
| Accent | `duck-300 400 500` |

`text-ink-300` compiles to **nothing** — no error, no style, just silently
unstyled text. `components/Sidebar.jsx` already has this bug in a few places.
Check the token exists before using it.

---

## Invariants — breaking these is a real regression

1. **`lib/blockMapping.js` round trip must stay lossless.** It's the only place
   the flat editor block shape and the structured database row meet. Run
   `npm run check:blocks` after touching it, `lib/constants.js`, or the block
   enums.
2. **`blocks.order_index` is `double precision`, not an integer.** Insert
   between two blocks with `(prev + next) / 2`. Never renumber rows.
3. **RLS is on and keyed to `auth.uid()`.** It denies everything until Supabase
   Auth is wired. The DEV MODE policies at the bottom of `supabase/schema.sql`
   must be deleted before anything ships.
4. **`CANVAS_BG` in `components/visualizations/scene-kit.jsx` must track
   `--color-ink-950`.** Three.js can't read CSS variables, so the WebGL clear
   colour is hardcoded. Change one, change the other, or every 3D viewport shows
   a seam against the page.

---

## The 3D visualization hub

`/visualizations` is a registry-driven hub of 13 IGCSE scenes. It has its own
contract; follow it rather than inventing a parallel structure.

```
app/visualizations/page.jsx          Topic registry + shell (search, tabs, sidebar)
components/visualizations/
  VisualizationHUD.jsx               Overlay: schema-driven controls, concepts, quiz
  scene-kit.jsx                      SceneCanvas, lights, VectorArrow, Bond, labels
  media.js                           Refractive indices (plain data, no three import)
  PhysicsCanvas.jsx                  5 scenes + dispatcher
  ChemistryCanvas.jsx                5 scenes + dispatcher
  BiologyCanvas.jsx                  3 scenes + dispatcher
  BinaryTree3D.jsx                   PARKED — compiles, not routed (no CS category)
```

**Data flow.** `page.jsx` owns all parameter state, keyed per topic. The HUD
renders each topic's declarative `controls` array. Scenes are **pure functions
of `params`** and own no UI state. Adding a visualizer is one registry entry,
one scene component, one line in that category's `SCENES` map.

A topic entry needs: `id, category, icon, title, blurb, syllabus, keywords,
defaults, controls[], concepts[3], quiz[2]`. Control types are `slider`,
`toggle`, `choice`, `action` (a counter the scene watches, for one-shot
animations). A control may declare `patch(value, params)` to write several keys
at once — that's how picking "Glass" sets both the medium and its refractive
index.

### R3F rules that will bite you

- **`useFrame` only works below `<Canvas>`.** A scene component that *renders*
  `<SceneCanvas>` cannot call `useFrame` itself — it throws
  *"R3F: Hooks can only be used within the Canvas component"* and white-screens
  the page. Put the animation in a child component. This has already happened
  once, in `CrystalLatticeScene`.
- **Never `setState` per frame.** Mutate refs inside `useFrame`. If a value must
  reach React (a live readout), throttle it to ~10 Hz with an accumulator.
- **Scenes must be client-only.** They're loaded with
  `dynamic(..., { ssr: false })`; rendering a `<Canvas>` on the server throws.
  Keeping this correct is also what keeps `/visualizations` prerendered static
  with three.js in lazily-fetched per-category chunks. If the build output shows
  that route's first-load JS jumping by ~100 kB, something started importing
  three at module scope in the page bundle.
- **Don't create geometries inline in JSX** (`args={[new THREE.BoxGeometry(...)]}`)
  in a component that re-renders. Memoize and dispose.
- **Physics must be correct, not merely plausible.** Every scene's numbers are
  derived from real equations (Snell, thin-lens, Faraday, Boyle). If you change
  the maths, verify against hand-computed values before claiming it works.

---

## Verifying your work

The Browser pane tooling drives a real browser against the dev server — use it,
don't ask the user to check manually.

1. `npm run build` must pass. It is the only typecheck.
2. Load the page and read the DOM (`read_page` / console) — confirm the change,
   not just that the page loaded.
3. Check `read_console_messages` and `preview_logs` for errors.
4. For visual/3D work, screenshot it. **If the Browser pane is hidden the page
   stops compositing frames** — screenshots time out, canvases report 300×150,
   and `useFrame` doesn't run. A `window.dispatchEvent(new Event('resize'))`
   fixes the sizing for DOM assertions, but you genuinely cannot confirm
   *appearance* or *animation* in that state. Say so plainly rather than
   implying you saw it.
5. Report honestly: if something is unverified, name it.

## Git

Nothing in this hub has been committed yet — it is all untracked working-tree
work. Commit or push **only when explicitly asked**, and branch rather than
committing to `main`.
