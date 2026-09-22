# SocraticOS Assistant Rules & Documentation Maintenance Directives

Whenever you make changes to the codebase (features, components, architecture, design tokens, bug fixes), you must maintain documentation integrity by updating the relevant documentation files as part of your task.

---

## 📋 Mandatory Documentation Rules for All Tasks

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
- When you want to run `npm run build`:
  1. First check if a server on port 3000 is running.
  2. If active, terminate/kill the server process on port 3000 to prevent Next.js lock/cache corruption.
  3. Execute `npm run build` as a background task.
  4. **After launching the build, set a 30-second timer before checking the build status. Do NOT poll or call `manage_task status` repeatedly in a tight loop — wait the full 30 seconds first, then check once.**
  5. After the build finishes successfully, start the production server via `npm run start`.

### 5. Excluded Files & Artifacts
- **DISREGARD `BUGFIX_REPORT.md`**: Do not update or modify this file.
- **NEVER GENERATE WALKTHROUGHS**: Do not create, write, or update `walkthrough.md` or any walkthrough artifacts under any circumstances.
