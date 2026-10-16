import { db } from "./db.js";

/**
 * .socratic workspace backups.
 *
 * v1 held seven stores. Every store added since (quizzes and their trash,
 * per-space syllabus documents and AI settings, Literature poems, app
 * settings) and the custom space list were silently left out, so a restore
 * lost them. v2 carries all of them; v1 files still import.
 *
 * The pure halves (`buildBackup`, `planImport`) do all the deciding and are
 * unit-tested; `exportWorkspaceToJSON` and `importWorkspaceFromJSON` only
 * read and write IndexedDB and localStorage around them.
 */

export const BACKUP_FORMAT = "socratic-backup-v2";

/** Settings rows never written to a backup file, nor read back from one. */
export const SECRET_SETTING_KEYS = new Set(["gemini_api_key"]);

const noteSpace = (r) => r.spaceId || r.space || "School";

/**
 * Every store a backup carries. `space` reads the space a row belongs to;
 * `null` marks a workspace-wide store (Saved bookmarks and folders show in
 * every space, and alarms and settings belong to no space), which travels
 * only in an all-spaces backup and is only restored, never copied into a
 * single space. `key` is the primary key when it is not `id`.
 */
export const BACKUP_TABLES = {
  notes: { space: noteSpace, setSpace: (r, s) => ({ ...r, spaceId: s, space: s }) },
  trash: { space: noteSpace, setSpace: (r, s) => ({ ...r, spaceId: s, space: s }) },
  studySessions: { space: (r) => r.space || r.spaceId || "School", setSpace: (r, s) => ({ ...r, space: s }) },
  calendarEvents: { space: (r) => r.space || "School", setSpace: (r, s) => ({ ...r, space: s }) },
  quizzes: { space: (r) => r.spaceId || "School", setSpace: (r, s) => ({ ...r, spaceId: s }) },
  quizTrash: { space: (r) => r.spaceId || "School", setSpace: (r, s) => ({ ...r, spaceId: s }) },
  spaceDocuments: { space: (r) => r.spaceId, setSpace: (r, s) => ({ ...r, spaceId: s }) },
  spaceSettings: { key: "spaceId", space: (r) => r.spaceId, setSpace: (r, s) => ({ ...r, spaceId: s }) },
  poems: { space: (r) => r.spaceId || "School", setSpace: (r, s) => ({ ...r, spaceId: s }) },
  folders: { space: null },
  bookmarks: { space: null },
  alarms: { space: null },
  settings: { key: "key", space: null },
};

export const BACKUP_TABLE_NAMES = Object.keys(BACKUP_TABLES);

const keyOf = (name) => BACKUP_TABLES[name].key || "id";
const isAllSpaces = (space) => !space || space === "All" || space === "Original";

function isValidRow(name, row) {
  if (!row || typeof row !== "object" || Array.isArray(row)) return false;
  const key = row[keyOf(name)];
  if (typeof key !== "string" || !key) return false;
  if (name === "settings" && SECRET_SETTING_KEYS.has(key)) return false;
  return true;
}

/**
 * The backup object for `tables` (store name → rows).
 * `targetSpace` "All" (or empty) keeps everything; a space name keeps that
 * space's rows and drops the workspace-wide stores.
 * `spaces` is the space list ({ name, icon, blurb }) to carry along.
 */
export function buildBackup(tables, { targetSpace = "All", spaces = [], exportedAt = new Date().toISOString() } = {}) {
  const single = !isAllSpaces(targetSpace);
  const data = {};
  for (const name of BACKUP_TABLE_NAMES) {
    const rows = Array.isArray(tables?.[name]) ? tables[name] : [];
    const { space } = BACKUP_TABLES[name];
    if (single && !space) continue;
    let kept = rows.filter((r) => isValidRow(name, r));
    if (single) kept = kept.filter((r) => space(r) === targetSpace);
    data[name] = kept;
  }
  const spaceList = (Array.isArray(spaces) ? spaces : []).filter((s) => s && typeof s.name === "string" && s.name);
  return {
    format: BACKUP_FORMAT,
    exportedAt,
    version: "2.0.0",
    targetSpace: single ? targetSpace : "All",
    spaces: single ? spaceList.filter((s) => s.name === targetSpace) : spaceList,
    data,
  };
}

/** Parse and check a backup file's text; throws a readable error. */
export function parseBackup(text) {
  let backup;
  try {
    backup = JSON.parse(text);
  } catch {
    throw new Error("Invalid backup format: Content is not a JSON object.");
  }
  if (!backup || typeof backup !== "object" || Array.isArray(backup)) {
    throw new Error("Invalid backup format: Content is not a JSON object.");
  }
  if (typeof backup.format !== "string" || !backup.format.startsWith("socratic-backup")) {
    throw new Error("Invalid backup file: Unrecognized SocraticOS file format.");
  }
  return backup;
}

/** Calls `fn` on every page block in a (possibly nested) block tree. */
function mapPageBlocks(value, fn) {
  if (Array.isArray(value)) return value.map((v) => mapPageBlocks(v, fn));
  if (!value || typeof value !== "object") return value;
  let out = value;
  for (const [k, v] of Object.entries(value)) {
    if (v && typeof v === "object") {
      const next = mapPageBlocks(v, fn);
      if (next !== v) out = out === value ? { ...value, [k]: next } : Object.assign(out, { [k]: next });
    }
  }
  if (out.type === "page" && typeof out.pageId === "string") {
    const pageId = fn(out.pageId);
    if (pageId !== out.pageId) out = { ...out, pageId };
  }
  return out;
}

/**
 * What an import will write, without touching the database.
 *
 * - `targetSpace` "Original" (or "All") restores rows as they are, keeping
 *   their ids, so a row already here is replaced by the backup's copy.
 * - Any other space COPIES the backup's per-space content into that space.
 *   An id already used here gets a new one (and every reference to it, from
 *   sub-pages, page blocks, quizzes and study sessions, follows), so the
 *   originals are never moved or overwritten. Workspace-wide stores are not
 *   copied.
 * - `overwrite` first clears what the import replaces: everything, or only
 *   one space when the import (or the backup) is scoped to one.
 *
 * `existing` maps store name → Set of primary keys already in the database.
 * `idSuffix` makes the new ids unique to this import.
 */
export function planImport(backup, { targetSpace = "Original", overwrite = false, existing = {}, idSuffix = Date.now().toString(36) } = {}) {
  const payload = backup?.data && typeof backup.data === "object" ? backup.data : {};
  const reassign = !isAllSpaces(targetSpace);
  const present = BACKUP_TABLE_NAMES.filter((name) => Array.isArray(payload[name]));

  const rows = {};
  for (const name of present) {
    if (reassign && !BACKUP_TABLES[name].space) continue;
    rows[name] = payload[name].filter((r) => isValidRow(name, r));
  }

  // What overwrite clears: null = whole stores, a name = that space's rows.
  const backupScope = !isAllSpaces(backup?.targetSpace) ? backup.targetSpace : null;
  const clearScope = reassign ? targetSpace : backupScope;
  const clear = overwrite ? { scope: clearScope, tables: Object.keys(rows) } : null;

  if (reassign) {
    const has = (name, id) => Boolean(existing[name]?.has(id));
    const fresh = (id) => `${id}_c${idSuffix}`;
    const noteIds = new Map();
    const quizIds = new Map();
    for (const name of ["notes", "trash"]) {
      for (const r of rows[name] || []) if (has("notes", r.id) || has("trash", r.id)) noteIds.set(r.id, fresh(r.id));
    }
    for (const name of ["quizzes", "quizTrash"]) {
      for (const r of rows[name] || []) if (has("quizzes", r.id) || has("quizTrash", r.id)) quizIds.set(r.id, fresh(r.id));
    }
    const note = (id) => (typeof id === "string" && noteIds.get(id)) || id;
    const own = (name, r) => (has(name, r.id) ? fresh(r.id) : r.id);

    for (const name of Object.keys(rows)) {
      const { setSpace } = BACKUP_TABLES[name];
      rows[name] = rows[name].map((r) => {
        let out = setSpace(r, targetSpace);
        if (name === "notes" || name === "trash") {
          out = { ...out, id: note(r.id), parentId: r.parentId ? note(r.parentId) : r.parentId ?? null };
          if (Array.isArray(out.blocks)) out.blocks = mapPageBlocks(out.blocks, note);
        } else if (name === "quizzes" || name === "quizTrash") {
          out = {
            ...out,
            id: quizIds.get(r.id) || r.id,
            noteId: r.noteId ? note(r.noteId) : r.noteId ?? null,
            noteIds: Array.isArray(r.noteIds) ? r.noteIds.map(note) : r.noteIds,
          };
        } else if (name === "studySessions") {
          out = { ...out, id: own(name, r), noteId: note(r.noteId) };
        } else if (name !== "spaceSettings") {
          out = { ...out, id: own(name, r) };
        }
        return out;
      });
    }
    // A space keeps its own AI settings unless the import replaces them.
    if (rows.spaceSettings) {
      rows.spaceSettings = overwrite || !has("spaceSettings", targetSpace) ? rows.spaceSettings.slice(0, 1) : [];
    }
  }

  // Spaces the imported rows live in, so none of them is left invisible.
  const used = new Set();
  for (const [name, list] of Object.entries(rows)) {
    const { space } = BACKUP_TABLES[name];
    if (space) list.forEach((r) => used.add(space(r)));
  }
  const metas = new Map(
    (Array.isArray(backup?.spaces) ? backup.spaces : [])
      .filter((s) => s && typeof s.name === "string" && s.name)
      .map((s) => [s.name, { name: s.name, icon: s.icon || "📂", blurb: s.blurb || "" }])
  );
  if (!reassign) metas.forEach((_, name) => used.add(name));
  if (reassign) used.add(targetSpace);
  const spaces = [...used].filter(Boolean).map((name) => metas.get(name) || { name, icon: "📂", blurb: "" });

  const counts = Object.fromEntries(Object.entries(rows).map(([name, list]) => [name, list.length]));
  return { rows, clear, spaces, counts };
}

/** Space names first, then any the import adds, in that order. */
export function mergeSpaceLists(local, incoming) {
  const out = (Array.isArray(local) ? local : []).filter((s) => s?.name);
  const names = new Set(out.map((s) => s.name));
  for (const s of incoming || []) {
    if (s?.name && !names.has(s.name)) {
      out.push(s);
      names.add(s.name);
    }
  }
  return out;
}

const liveTables = () => BACKUP_TABLE_NAMES.filter((name) => db[name]);

/**
 * Export SocraticOS workspace data from IndexedDB into a .socratic backup file
 * and trigger the download. `targetSpace` "All" (default) or one space's name.
 */
export async function exportWorkspaceToJSON(targetSpace = "All") {
  try {
    const tables = {};
    for (const name of liveTables()) tables[name] = await db[name].toArray();
    let spaces = [];
    try {
      const { getSavedSpaces } = await import("./storageService.js");
      spaces = await getSavedSpaces();
    } catch {
      // the backup still carries every row; spaces are rebuilt from them on import
    }

    const backupData = buildBackup(tables, { targetSpace, spaces });
    const isSpecificSpace = backupData.targetSpace !== "All";

    const jsonString = JSON.stringify(backupData, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const spaceSlug = isSpecificSpace ? targetSpace.replace(/[^a-z0-9_-]/gi, "_") : "AllSpaces";
    const filename = `SocraticOS-Backup-${spaceSlug}-${new Date().toISOString().split("T")[0]}.socratic`;

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();

    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    return { success: true, filename, count: backupData.data.notes.length, targetSpace };
  } catch (error) {
    console.error("Export workspace error:", error);
    throw new Error(`Failed to export workspace backup: ${error.message}`);
  }
}

/**
 * Import a .socratic backup file into IndexedDB (see `planImport` for what
 * each target space means). Resolves with the imported notes and per-store
 * counts.
 *
 * @param {File|Blob} file - The uploaded .socratic / .json file.
 * @param {Object} options - { targetSpace: "Original" | space name, overwrite: boolean }
 */
export async function importWorkspaceFromJSON(file, options = { targetSpace: "Original", overwrite: false }) {
  const targetSpace = options.targetSpace || "Original";
  try {
    const backup = parseBackup(await file.text());
    const tables = liveTables();
    let plan = null;

    await db.transaction("rw", tables.map((name) => db[name]), async () => {
      const { clear } = planImport(backup, { ...options, targetSpace });
      if (clear) {
        for (const name of clear.tables) {
          if (!db[name]) continue;
          const { space } = BACKUP_TABLES[name];
          if (!clear.scope) {
            await db[name].clear();
          } else if (space) {
            // a one-space restore never clears a workspace-wide store
            const all = await db[name].toArray();
            const doomed = all.filter((r) => space(r) === clear.scope).map((r) => r[keyOf(name)]);
            if (doomed.length) await db[name].bulkDelete(doomed);
          }
        }
      }

      const existing = {};
      for (const name of tables) existing[name] = new Set(await db[name].toCollection().primaryKeys());
      plan = planImport(backup, { ...options, targetSpace, existing });

      for (const [name, list] of Object.entries(plan.rows)) {
        if (db[name] && list.length) await db[name].bulkPut(list);
      }
    });

    if (plan.spaces.length) {
      const { getSavedSpaces, saveAllSpaces } = await import("./storageService.js");
      const local = await getSavedSpaces();
      const merged = mergeSpaceLists(local, plan.spaces);
      if (merged.length !== local.length) await saveAllSpaces(merged);
    }

    return {
      success: true,
      targetSpace,
      notes: plan.rows.notes || [],
      imported: { ...Object.fromEntries(BACKUP_TABLE_NAMES.map((n) => [n, 0])), ...plan.counts },
    };
  } catch (error) {
    console.error("Import backup error:", error);
    throw new Error(`Failed to import workspace backup: ${error.message}`);
  }
}
