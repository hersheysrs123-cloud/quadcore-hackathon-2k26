/**
 * literatureService.js — Dexie persistence for the Literature section.
 *
 * Mirrors the conventions in storageService.js: every function guards against
 * SSR (`typeof window === "undefined"`) and a missing table, ids are
 * `prefix_timestamp_random`, and rows carry ISO `createdAt`/`updatedAt`
 * alongside the numeric `created`/`updated` the pure logic in lib/literature.js
 * uses for deterministic ordering.
 *
 * A stored poem row is exactly the shape lib/literature.js produces, plus a
 * `spaceId`. That keeps the on-disk model identical to the standalone app's
 * JSON, so its backups import — and our exports restore into it — unchanged.
 */

import { db } from "./db.js";
import {
  LITERATURE_SCHEMA,
  makePoem,
  makeAnnotation,
  migrate,
  remapAnnotations,
  sanitizePoem,
  trimRange,
  cmpRange,
  uid,
} from "./literature.js";

/**
 * The standalone app persisted everything under this localStorage key. Both
 * apps' dev servers default to port 3000, so a user who ran the standalone
 * Literature app on this machine very likely has real work sitting here.
 */
const LEGACY_DATA_KEY = "literature-revision/v1";
const LEGACY_ADOPTED_KEY = "socratic_literature_adopted_v1";
const SAMPLE_SEED_KEY = "socratic_literature_sample_seeded_v1";

/** UI preferences (mode, tab, selection) — per-browser, never synced. */
const UI_KEY = "socratic_literature_ui";

const DEFAULT_UI = {
  selectedPoemId: null,
  mode: "normal", // 'normal' | 'test'
  tab: "intro", // 'intro' | 'conclusion'
  annPanelOpen: false,
};

/* ── reads ───────────────────────────────────────────────────── */

export async function getAllPoems() {
  if (typeof window === "undefined" || !db.poems) return [];
  const rows = await db.poems.toArray();
  return rows.sort((a, b) => (a.created || 0) - (b.created || 0));
}

export async function getPoemsBySpace(spaceId) {
  if (typeof window === "undefined" || !db.poems) return [];
  const rows = await db.poems.where("spaceId").equals(spaceId || "School").toArray();
  return rows.sort((a, b) => (a.created || 0) - (b.created || 0));
}

export async function getPoemById(id) {
  if (typeof window === "undefined" || !db.poems || !id) return null;
  return (await db.poems.get(id)) || null;
}

/* ── poem writes ─────────────────────────────────────────────── */

function stamp(poem) {
  return {
    ...poem,
    updated: Date.now(),
    updatedAt: new Date().toISOString(),
  };
}

export async function createPoem({ title, lines, spaceId = "School" } = {}) {
  if (typeof window === "undefined" || !db.poems) return null;
  const poem = makePoem(title, lines);
  const row = {
    ...poem,
    spaceId: spaceId || "School",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await db.poems.put(row);
  return row;
}

export async function savePoem(poem) {
  if (typeof window === "undefined" || !db.poems || !poem?.id) return null;
  const row = stamp(poem);
  await db.poems.put(row);
  return row;
}

export async function deletePoem(id) {
  if (typeof window === "undefined" || !db.poems || !id) return false;
  await db.poems.delete(id);
  return true;
}

/**
 * Apply a line-editor result. `lineMap[oldIndex] = newIndex` (or -1 when the
 * line was deleted); annotations follow their lines and are dropped only when
 * the text they pointed at is genuinely gone. Returns the remap report so the
 * caller can tell the user what it cost them.
 */
export async function updatePoemContent(id, title, lines, lineMap) {
  if (typeof window === "undefined" || !db.poems || !id) return null;
  const poem = await db.poems.get(id);
  if (!poem) return null;

  const remap = remapAnnotations(poem.annotations || [], lineMap, lines);
  const row = stamp({
    ...poem,
    title: title && title.trim() ? title.trim() : "Untitled poem",
    lines: lines.slice(),
    annotations: remap.annotations,
  });
  await db.poems.put(row);
  return { poem: row, ...remap };
}

export async function setEssay(id, field, value) {
  if (typeof window === "undefined" || !db.poems || !id) return null;
  if (field !== "intro" && field !== "conclusion") return null;
  const poem = await db.poems.get(id);
  if (!poem || poem[field] === value) return poem || null;
  const row = stamp({ ...poem, [field]: value });
  await db.poems.put(row);
  return row;
}

/* ── annotation writes ───────────────────────────────────────── */

export async function addAnnotation(poemId, ranges, text, label) {
  if (typeof window === "undefined" || !db.poems || !poemId) return null;
  const poem = await db.poems.get(poemId);
  if (!poem) return null;

  const clean = (ranges || [])
    .map((r) => trimRange(poem.lines, r))
    .filter(Boolean)
    .sort(cmpRange);
  if (!clean.length) return null;

  const ann = makeAnnotation(clean, text, label);
  const row = stamp({ ...poem, annotations: [...(poem.annotations || []), ann] });
  await db.poems.put(row);
  return { poem: row, annotation: ann };
}

export async function updateAnnotation(poemId, annId, patch = {}) {
  if (typeof window === "undefined" || !db.poems || !poemId) return null;
  const poem = await db.poems.get(poemId);
  if (!poem) return null;
  const existing = (poem.annotations || []).find((a) => a.id === annId);
  if (!existing) return null;

  const next = { ...existing };
  if (patch.ranges) {
    const clean = patch.ranges
      .map((r) => trimRange(poem.lines, r))
      .filter(Boolean)
      .sort(cmpRange);
    if (!clean.length) return null;
    next.ranges = clean;
  }
  if (typeof patch.text === "string") next.text = patch.text;
  if (typeof patch.label === "string") next.label = patch.label;
  next.updated = Date.now();

  const row = stamp({
    ...poem,
    annotations: (poem.annotations || []).map((a) => (a.id === annId ? next : a)),
  });
  await db.poems.put(row);
  return { poem: row, annotation: next };
}

export async function deleteAnnotation(poemId, annId) {
  if (typeof window === "undefined" || !db.poems || !poemId) return null;
  const poem = await db.poems.get(poemId);
  if (!poem) return null;
  const annotations = (poem.annotations || []).filter((a) => a.id !== annId);
  if (annotations.length === (poem.annotations || []).length) return poem;
  const row = stamp({ ...poem, annotations });
  await db.poems.put(row);
  return row;
}

/* ── import / export ─────────────────────────────────────────── */

/**
 * The export payload is byte-compatible with the standalone app's backups:
 * same `schema`/`app`/`poems` keys, and `spaceId` rides along as an extra
 * field that the standalone app's sanitiser simply ignores.
 */
export async function buildExportPayload(spaceId = null) {
  const poems = spaceId ? await getPoemsBySpace(spaceId) : await getAllPoems();
  return {
    schema: LITERATURE_SCHEMA,
    app: "literature-revision",
    exported: new Date().toISOString(),
    poems,
  };
}

export async function exportPoemsJson(spaceId = null) {
  const payload = await buildExportPayload(spaceId);
  return JSON.stringify(payload, null, 2);
}

/**
 * `mode` is "merge" (add alongside what is already here) or "replace"
 * (clear this space's poems first). Replace never touches other spaces, and
 * never touches any other table.
 */
export async function importPoems(raw, mode = "merge", spaceId = "School") {
  if (typeof window === "undefined" || !db.poems) return 0;
  const incoming = migrate(raw); // throws on a file that is not a backup

  if (mode === "replace") {
    const existing = await getPoemsBySpace(spaceId);
    await db.poems.bulkDelete(existing.map((p) => p.id));
  } else {
    const existingIds = new Set((await getAllPoems()).map((p) => p.id));
    incoming.poems.forEach((p) => {
      if (existingIds.has(p.id)) p.id = uid("poem");
    });
  }

  const now = new Date().toISOString();
  const rows = incoming.poems.map((p) => ({
    ...p,
    spaceId: p.spaceId || spaceId || "School",
    createdAt: p.createdAt || now,
    updatedAt: now,
  }));
  await db.poems.bulkPut(rows);
  return rows.length;
}

/* ── seeding & legacy adoption ───────────────────────────────── */

/**
 * One-time, additive boot step.
 *
 * 1. If the standalone app's localStorage blob is present and has not been
 *    adopted yet, pull those poems into Dexie. Nothing is deleted: the
 *    localStorage key is left exactly where it is, so the standalone app
 *    keeps working, and a flag stops us importing twice.
 * 2. Otherwise, if there are no poems at all, plant the Ozymandias sample so
 *    a first-time user can see what overlapping annotations look like.
 *
 * Both steps are guarded by their own localStorage flag, so deleting the
 * sample (or every poem) does not make it grow back.
 */
export async function initLiteratureData(spaceId = "School") {
  if (typeof window === "undefined" || !db.poems) return { adopted: 0, seeded: 0 };
  let adopted = 0;
  let seeded = 0;

  try {
    if (!localStorage.getItem(LEGACY_ADOPTED_KEY)) {
      const legacy = localStorage.getItem(LEGACY_DATA_KEY);
      if (legacy) {
        try {
          const parsed = migrate(JSON.parse(legacy));
          const existingIds = new Set((await getAllPoems()).map((p) => p.id));
          const fresh = parsed.poems.filter((p) => !existingIds.has(p.id));
          if (fresh.length) {
            const now = new Date().toISOString();
            await db.poems.bulkPut(
              fresh.map((p) => ({
                ...p,
                spaceId: spaceId || "School",
                createdAt: now,
                updatedAt: now,
              }))
            );
            adopted = fresh.length;
          }
        } catch (err) {
          console.warn("Literature: legacy localStorage data could not be read.", err);
        }
      }
      localStorage.setItem(LEGACY_ADOPTED_KEY, "true");
      // Adopting counts as seeding: never plant the sample on top of real work.
      if (adopted > 0) localStorage.setItem(SAMPLE_SEED_KEY, "true");
    }

    if (!localStorage.getItem(SAMPLE_SEED_KEY)) {
      const count = await db.poems.count();
      if (count === 0) {
        const { sampleData } = await import("./literature.js");
        const now = new Date().toISOString();
        const rows = sampleData().poems.map((p) => ({
          ...p,
          spaceId: spaceId || "School",
          createdAt: now,
          updatedAt: now,
        }));
        await db.poems.bulkPut(rows);
        seeded = rows.length;
      }
      localStorage.setItem(SAMPLE_SEED_KEY, "true");
    }
  } catch (err) {
    console.error("Literature: init failed.", err);
  }

  return { adopted, seeded };
}

export async function resetLiteratureData() {
  if (typeof window === "undefined" || !db.poems) return false;
  await db.poems.clear();
  try {
    localStorage.setItem(SAMPLE_SEED_KEY, "true");
  } catch (err) {
    /* storage blocked — the reset still happened */
  }
  return true;
}

/** Delete every poem in one space, leaving the other spaces alone. */
export async function clearSpacePoems(spaceId) {
  if (typeof window === "undefined" || !db.poems) return 0;
  const rows = await getPoemsBySpace(spaceId);
  await db.poems.bulkDelete(rows.map((p) => p.id));
  return rows.length;
}

/** Follow a space rename, so poems do not orphan themselves. */
export async function movePoemsToSpace(fromSpace, toSpace) {
  if (typeof window === "undefined" || !db.poems) return 0;
  const rows = await getPoemsBySpace(fromSpace);
  if (!rows.length) return 0;
  await db.poems.bulkPut(rows.map((p) => ({ ...p, spaceId: toSpace })));
  return rows.length;
}

/* ── UI preferences ──────────────────────────────────────────── */

export function loadLiteratureUI() {
  if (typeof window === "undefined") return { ...DEFAULT_UI };
  try {
    const raw = localStorage.getItem(UI_KEY);
    if (!raw) return { ...DEFAULT_UI };
    const u = JSON.parse(raw);
    return {
      selectedPoemId: typeof u?.selectedPoemId === "string" ? u.selectedPoemId : null,
      mode: u?.mode === "test" ? "test" : "normal",
      tab: u?.tab === "conclusion" ? "conclusion" : "intro",
      annPanelOpen: Boolean(u?.annPanelOpen),
    };
  } catch (err) {
    return { ...DEFAULT_UI };
  }
}

export function saveLiteratureUI(ui) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(UI_KEY, JSON.stringify({ ...DEFAULT_UI, ...ui }));
  } catch (err) {
    /* private browsing / storage blocked — preferences are not worth a toast */
  }
}

export { sanitizePoem, migrate };
