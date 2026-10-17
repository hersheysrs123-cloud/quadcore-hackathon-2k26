# SocraticOS Assistant Rules & Documentation Maintenance Directives

Documentation must match the code, but update it **once per branch, not after every change**. Do the docs pass when the work on a branch is finished: right before opening a PR, or when the user asks for it. Don't touch docs mid-task unless the user asks. A docs pass covers every change on the branch, so check `git diff main...HEAD` to see what needs documenting.

---

## 📋 Documentation Rules (apply during the end-of-branch docs pass)

### 1. Codebase Architecture & Feature Changes (`CODEBASE_SUMMARY.md` & `README.md`)
- The technical reference is split by topic. `CODEBASE_SUMMARY.md` is only the index; the detail lives in `docs/codebase/`.
- If you modify, add, or refactor components, routes, database schemas, or storage services:
  - **UPDATE the matching file under [`docs/codebase/`](docs/codebase)** (find it in the index table in [`CODEBASE_SUMMARY.md`](CODEBASE_SUMMARY.md)): the file map for new or renamed files, the topic file for behaviour, `database.md` for schema changes, a gotchas file for new pitfalls. Update the index only if you add or remove a file.
  - **UPDATE [`docs/FEATURES.md`](docs/FEATURES.md)** if a user-facing capability changed.
  - **UPDATE [`README.md`](README.md)** only if setup steps, the topic list, the shortcuts table or the documentation map changed. Keep it short (about 100–150 lines); detail belongs in the files above.

### 2. UI & Design Token Changes (`DESIGN_SYSTEM.md`)
- `DESIGN_SYSTEM.md` holds the colour tokens and typography; component specs, conventions and per-scene 3D tokens live in [`docs/design/`](docs/design).
- If you add, modify, or refactor colors, typography, layout tokens, theme classes, or UI component conventions:
  - **UPDATE [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md)** for colour, theme or typography changes (define new colour steps in both themes in `app/globals.css`; Tailwind generates nothing for an undefined step).
  - **UPDATE the matching file under [`docs/design/`](docs/design)** for component specs, conventions and 3D scene tokens.

### 3. Bug Fixes (`ANTIGRAVITY_BUG_FIXES.md`)
- If you fix a bug, resolve an edge case, or solve a regression:
  - **UPDATE [`ANTIGRAVITY_BUG_FIXES.md`](ANTIGRAVITY_BUG_FIXES.md)** documenting the root cause, problem statement, and resolution.

### 4. Build & Production Server Protocol (`npm run build` & `npm run start`)
- **Only run `npm run build` when it's actually needed**: before opening a PR, when the user asks, or to debug a build-only failure. For routine changes, run `npm run lint` or the relevant tests instead, or check in the dev server.
- When reading build output, look at the end and any errors only (e.g. `tail` it). Don't read the whole log.
- When you do run `npm run build`:
  1. First check if a server on port 3000 is running.
  2. If active, terminate/kill the server process on port 3000 to prevent Next.js lock/cache corruption.
  3. Execute `npm run build` as a background task.
  4. **After launching the build, set a 30-second timer before checking the build status. Do NOT poll or call `manage_task status` repeatedly in a tight loop — wait the full 30 seconds first, then check once.**
  5. After the build finishes successfully, start the production server via `npm run start`.

### 5. Excluded Files & Artifacts
- **DISREGARD `BUGFIX_REPORT.md`**: Do not update or modify this file.
- **NEVER GENERATE WALKTHROUGHS**: Do not create, write, or update `walkthrough.md` or any walkthrough artifacts under any circumstances.
