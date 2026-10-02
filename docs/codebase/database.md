# Local-first database

> Part of the [SocraticOS codebase reference](../../CODEBASE_SUMMARY.md). Dexie schema v9, all 13 object stores, and where the network is used.

## 🗄️ 4. Local-First Database Architecture (`lib/db.js` & `lib/storageService.js`)

SocraticOS operates entirely local-first using **Dexie.js** (IndexedDB database name: `SocraticOS_LocalDB`, version 9 — v8 adds the `parentId` index for nested sub-pages and back-fills `parentId = null` on existing notes and trash items; v9 adds the `poems` store for the Literature section).

### IndexedDB Object Stores (13 Total):
1. `notes`: Primary note documents.
   - *Index*: `id, spaceId, parentId, title, isFavorite, emoji, updatedAt`
   - *Fields*: `id`, `spaceId`, `parentId` (`null` for top-level notes; the id of the note that embeds this one as a `page` card otherwise — always in the same space as the parent), `title`, `blocks` (Array of 20 block objects), `banner`, `emoji`, `fontStyle`, `fullWidth`, `isLocked`, `isFavorite`, `order` (position within its sibling group), `createdAt`, `updatedAt`
2. `folders`: Web Saver folder hierarchies.
   - *Index*: `id, parentId, spaceId, name, createdAt`
   - *Fields*: `id`, `parentId`, `spaceId`, `name`, `createdAt`
3. `bookmarks`: Web Saver bookmark records.
   - *Index*: `id, folderId, spaceId, url, title, favicon, notes, tags, createdAt`
   - *Fields*: `id`, `folderId`, `spaceId`, `url`, `title`, `favicon`, `notes`, `tags` (Array of strings), `createdAt`
4. `trash`: Soft-deleted notes pending 24-hour auto-purge.
   - *Index*: `id, parentId, deletedAt`
   - *Fields*: Complete note document + `deletedAt` ISO timestamp (a trashed subtree shares one `deletedAt`, so it expires together)
5. `calendarEvents`: Scheduled study events.
   - *Index*: `id, date, time`
   - *Fields*: `id`, `title`, `date`, `time`, `type`, `space`, `updatedAt`
6. `studySessions`: Graded quiz session records.
   - *Index*: `id, noteId, timestamp, score`
   - *Fields*: `id`, `noteId`, `noteTitle`, `space`, `concept`, `mode`, `score`, `summary`, `heatmap` (Array of `{ subtopic, status, feedback }`), `createdAt`
7. `alarms`: Custom scheduled recurring study alarms.
   - *Index*: `id, time, enabled`
   - *Fields*: `id`, `title`, `time` (24h "HH:MM"), `days` (Array of weekday numbers 0-6), `enabled`, `sound`, `createdAt`, `updatedAt`
8. `settings`: Key-value application settings.
   - *Index*: `key, value`
   - *Keys*: `gemini_api_key`, `gfx_graphicsPreset`, `gfx_targetFps`, `gfx_pixelRatio`, `gfx_enableShadows`, `gfx_enableAntialias`, `gfx_autoPauseHidden`, `editor_click_to_append`, `space_switcher_layout`, `socratic_syllabus_statement`, `socratic_syllabus_enabled` (`socratic_theme` is stored in `localStorage`)
9. `quizzes`: Saved exam and quiz objects.
   - *Index*: `id, spaceId, noteId, title, difficulty, status, createdAt, updatedAt`
   - *Fields*: `id`, `spaceId`, `noteId`, `noteIds` (Array of string note IDs), `title`, `difficulty`, `questions` (Array of question objects across 7 question types), `status` ("pending" | "in_progress" | "completed"), `result` (`{ score, summary, heatmap, gradedAnswers, completedAt }`), `draftAnswers` (Object map of answer states), `draftIndex` (Integer current question index), `createdAt`, `updatedAt`
10. `quizTrash`: Soft-deleted quizzes pending 24-hour auto-purge.
    - *Index*: `id, deletedAt`
    - *Fields*: Complete quiz document + `deletedAt` ISO timestamp
11. `spaceDocuments`: Per-space uploaded syllabus and curriculum documents for AI feeding.
    - *Index*: `id, spaceId, name, active, createdAt, updatedAt`
    - *Fields*: `id`, `spaceId`, `name`, `text`, `size`, `active` (boolean toggle), `createdAt`, `updatedAt`
12. `spaceSettings`: Per-space Space Hub settings (added in v7).
    - *Index*: `spaceId, updatedAt`
    - *Fields*: `spaceId`, `academicLevel`, `aiPersona`, `strictness`, `icon` and `blurb` (custom space emoji and tagline), `updatedAt`
13. `poems`: Literature poems with their annotations and essay drafts (added in v9). One poem is one row; nothing is normalised out.
    - *Index*: `id, spaceId, title, updatedAt, createdAt`
    - *Fields*: `id`, `spaceId`, `title`, `lines` (array of strings, `""` = stanza break), `intro`, `conclusion`, `annotations`, `sample`, numeric `created`/`updated` (used for deterministic ordering) and ISO `createdAt`/`updatedAt`
    - *Annotation shape*: `{ id, ranges: [{ startLine, startChar, endLine, endChar }], text, label, created, updated }`. **The end of a range is exclusive, line/char are 0-based, and `ranges` is an ARRAY** so one piece of analysis can attach to several non-contiguous phrases. See [literature.md](literature.md).
    - v9 is purely additive: no existing store is touched and no upgrade callback is needed.

### Where the network is used:
The only server code is the five AI routes (`/api/explain`, `/api/quiz/generate`, `/api/quiz/grade`, `/api/reformat`, `/api/tutor/chat`). Each one calls Gemini with `GOOGLE_API_KEY` from `.env.local` and returns HTTP `503` with a readable message when no key is configured. The client (`lib/aiService.js`) first tries Gemini directly from the browser with the personal key stored in the `settings` store, then falls back to these routes, and the note reformatter finally falls back to a local heuristic. There are no other API routes; everything else is browser-local.
