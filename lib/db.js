import Dexie from "dexie";
import { DEMO_NOTES } from "./demoNotes.js";

/**
 * SocraticOS_LocalDB — Local-first IndexedDB Database powered by Dexie.js
 * 100% offline, private, and local browser storage.
 */
export const db = new Dexie("SocraticOS_LocalDB");

db.version(1).stores({
  notes: "id, spaceId, title, isFavorite, emoji, updatedAt",
  trash: "id, deletedAt",
  calendarEvents: "id, date, time",
  studySessions: "id, noteId, timestamp, score",
});

db.version(2).stores({
  notes: "id, spaceId, title, isFavorite, emoji, updatedAt",
  trash: "id, deletedAt",
  calendarEvents: "id, date, time",
  studySessions: "id, noteId, timestamp, score",
  settings: "key, value",
});

db.version(3).stores({
  notes: "id, spaceId, title, isFavorite, emoji, updatedAt",
  trash: "id, deletedAt",
  calendarEvents: "id, date, time",
  studySessions: "id, noteId, timestamp, score",
  settings: "key, value",
  alarms: "id, time, enabled",
});

db.version(4).stores({
  notes: "id, spaceId, title, isFavorite, emoji, updatedAt",
  trash: "id, deletedAt",
  calendarEvents: "id, date, time",
  studySessions: "id, noteId, timestamp, score",
  settings: "key, value",
  alarms: "id, time, enabled",
}).upgrade(async tx => {
  await tx.notes.toCollection().modify(note => {
    // 1. Default safely missing attributes
    if (note.banner === undefined) note.banner = null;
    if (note.spaceId === undefined) note.spaceId = note.space || "School";
    
    // 2. Predictable block structures
    if (note.blocks && Array.isArray(note.blocks)) {
      note.blocks.forEach(b => {
        if (!b.id) b.id = `blk_mig_${Math.random().toString(36).substr(2, 9)}`;
        if (b.type === "canvas") {
          if (b.bgType === undefined) b.bgType = "dots";
        }
      });
    }
  });

  // 3. Fallback settings keys
  const hasGfxPreset = await tx.settings.get("gfx_graphicsPreset");
  if (!hasGfxPreset) {
    await tx.settings.put({ key: "gfx_graphicsPreset", value: "auto" });
  }
});

db.version(5).stores({
  notes: "id, spaceId, title, isFavorite, emoji, updatedAt",
  trash: "id, deletedAt",
  calendarEvents: "id, date, time",
  studySessions: "id, noteId, timestamp, score",
  settings: "key, value",
  alarms: "id, time, enabled",
  folders: "id, parentId, spaceId, name, createdAt",
  bookmarks: "id, folderId, spaceId, url, title, favicon, notes, tags, createdAt",
});

db.version(6).stores({
  notes: "id, spaceId, title, isFavorite, emoji, updatedAt",
  trash: "id, deletedAt",
  calendarEvents: "id, date, time",
  studySessions: "id, noteId, timestamp, score",
  settings: "key, value",
  alarms: "id, time, enabled",
  folders: "id, parentId, spaceId, name, createdAt",
  bookmarks: "id, folderId, spaceId, url, title, favicon, notes, tags, createdAt",
  quizzes: "id, spaceId, noteId, title, difficulty, status, createdAt, updatedAt",
  quizTrash: "id, deletedAt",
});

db.version(7).stores({
  notes: "id, spaceId, title, isFavorite, emoji, updatedAt",
  trash: "id, deletedAt",
  calendarEvents: "id, date, time",
  studySessions: "id, noteId, timestamp, score",
  settings: "key, value",
  alarms: "id, time, enabled",
  folders: "id, parentId, spaceId, name, createdAt",
  bookmarks: "id, folderId, spaceId, url, title, favicon, notes, tags, createdAt",
  quizzes: "id, spaceId, noteId, title, difficulty, status, createdAt, updatedAt",
  quizTrash: "id, deletedAt",
  spaceDocuments: "id, spaceId, name, active, createdAt, updatedAt",
  spaceSettings: "spaceId, updatedAt",
}).upgrade(async tx => {
  // Migrate any existing global syllabus statement into the default "School" space
  try {
    const textItem = await tx.settings.get("socratic_syllabus_statement");
    const enabledItem = await tx.settings.get("socratic_syllabus_enabled");
    if (textItem?.value && textItem.value.trim()) {
      const isEnabled = enabledItem ? enabledItem.value !== "false" : true;
      await tx.spaceDocuments.put({
        id: `doc_migrated_${Date.now()}`,
        spaceId: "School",
        name: "Imported Syllabus.txt",
        text: textItem.value.trim(),
        size: textItem.value.length,
        active: isEnabled,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
  } catch (err) {
    console.warn("Migration to db v7 spaceDocuments notice:", err);
  }
});

db.version(8).stores({
  // v8: Notion-style nested sub-pages. `parentId` (null for top-level notes)
  // links a note to the note it lives inside; the parent embeds it as a
  // `page` block. Indexed on both `notes` and `trash` so cascade delete /
  // restore can find whole subtrees quickly.
  notes: "id, spaceId, parentId, title, isFavorite, emoji, updatedAt",
  trash: "id, parentId, deletedAt",
  calendarEvents: "id, date, time",
  studySessions: "id, noteId, timestamp, score",
  settings: "key, value",
  alarms: "id, time, enabled",
  folders: "id, parentId, spaceId, name, createdAt",
  bookmarks: "id, folderId, spaceId, url, title, favicon, notes, tags, createdAt",
  quizzes: "id, spaceId, noteId, title, difficulty, status, createdAt, updatedAt",
  quizTrash: "id, deletedAt",
  spaceDocuments: "id, spaceId, name, active, createdAt, updatedAt",
  spaceSettings: "spaceId, updatedAt",
}).upgrade(async tx => {
  // Existing notes are all top-level: default the new field so lookups are predictable.
  try {
    await tx.notes.toCollection().modify(note => {
      if (note.parentId === undefined) note.parentId = null;
    });
    await tx.trash.toCollection().modify(item => {
      if (item.parentId === undefined) item.parentId = null;
    });
  } catch (err) {
    console.warn("Migration to db v8 parentId notice:", err);
  }
});

db.version(9).stores({
  // v9: the Literature section. A poem is one row: its lines, its annotations
  // (each owning an ARRAY of ranges so one analysis can span several phrases),
  // and its intro/conclusion essays. Space-scoped like `quizzes` and
  // `bookmarks`, so a poem lives in the space you were in when you added it.
  notes: "id, spaceId, parentId, title, isFavorite, emoji, updatedAt",
  trash: "id, parentId, deletedAt",
  calendarEvents: "id, date, time",
  studySessions: "id, noteId, timestamp, score",
  settings: "key, value",
  alarms: "id, time, enabled",
  folders: "id, parentId, spaceId, name, createdAt",
  bookmarks: "id, folderId, spaceId, url, title, favicon, notes, tags, createdAt",
  quizzes: "id, spaceId, noteId, title, difficulty, status, createdAt, updatedAt",
  quizTrash: "id, deletedAt",
  spaceDocuments: "id, spaceId, name, active, createdAt, updatedAt",
  spaceSettings: "spaceId, updatedAt",
  poems: "id, spaceId, title, updatedAt, createdAt",
});

/**
 * localStorage flag that gates demo-note seeding. Exported so any code that
 * resets the workspace (see resetNotesData/factoryResetWorkspace in
 * storageService.js) can mark the seed as "already planted" using the exact
 * key this checks — writing a different key silently leaves this one unset,
 * which makes the demo notes reappear after the very reset that was supposed
 * to clear them.
 */
export const DEMO_SEED_KEY = "socratic_demo_seeded_v14";

export const DEMO_FOLDERS = [];
export const DEMO_BOOKMARKS = [];

/**
 * Auto-seeding & migration helper:
 * Populates IndexedDB on first boot with curated notes only.
 * Web Saver folders and bookmarks are strictly excluded so users manage their own links.
 * Guarantees that existing user notes are NEVER destroyed or deleted.
 */
export async function initAndSeedDatabase() {
  if (typeof window === "undefined") return;

  try {
    const seeded = localStorage.getItem(DEMO_SEED_KEY);

    // Safe seeding: runs once per DEMO_SEED_KEY version without deleting any existing user notes
    if (!seeded) {
      let deletedNotes = [];
      try {
        deletedNotes = JSON.parse(localStorage.getItem("socratic_deleted_notes") || "[]");
      } catch (e) {}
      const deletedSet = new Set(Array.isArray(deletedNotes) ? deletedNotes : []);

      const demoItems = DEMO_NOTES.filter((dn) => !deletedSet.has(dn.id)).map((dn) => ({
        id: dn.id,
        spaceId: dn.spaceId || dn.space || "School",
        space: dn.spaceId || dn.space || "School",
        title: dn.title,
        blocks: dn.blocks || [],
        banner: dn.banner || null,
        emoji: dn.emoji || "📝",
        isFavorite: Boolean(dn.isFavorite),
        parentId: null,
        createdAt: dn.createdAt || new Date().toISOString(),
        updatedAt: dn.updatedAt || new Date().toISOString(),
      }));

      // Non-destructive put: preserve existing notes; only insert missing or upgrade note_quantum
      for (const item of demoItems) {
        const existing = await db.notes.get(item.id);
        if (!existing) {
          await db.notes.put(item);
        } else if (item.id === "note_quantum") {
          // Upgrade note_quantum to clean block suite (canvas stripped) while preserving user space & favorite choices
          const hasCanvas = (existing.blocks || []).some((b) => b.type === "canvas" || b.type === "drawing" || b.id === "qua_canvas_bloch");
          if (hasCanvas || !existing.blocks || existing.blocks.length < item.blocks.length) {
            await db.notes.put({
              ...existing,
              title: item.title,
              emoji: item.emoji,
              banner: item.banner,
              blocks: item.blocks,
              updatedAt: new Date().toISOString(),
            });
          }
        }
      }

      localStorage.setItem(DEMO_SEED_KEY, "true");
      console.log("Successfully auto-seeded SocraticOS_LocalDB with complete demo notes (existing notes preserved; web saver excluded).");
    }
  } catch (err) {
    console.error("Error seeding SocraticOS_LocalDB:", err);
  }
}

export const DEFAULT_GRAPHICS_SETTINGS = {
  graphicsPreset: "auto",
  targetFps: 60,
  pixelRatio: 1.5,
  enableShadows: true,
  enableAntialias: true,
  autoPauseHidden: true,
};

export function detectHardwareGraphics() {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return DEFAULT_GRAPHICS_SETTINGS;
  }

  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const cores = navigator.hardwareConcurrency || 4;
  const memory = navigator.deviceMemory || 4; // deviceMemory is in GB, typically Chrome only

  if (isMobile) {
    if (cores >= 6 && memory >= 4) {
      // High-end mobile
      return { targetFps: 60, pixelRatio: 1.5, enableShadows: true, enableAntialias: false };
    } else {
      // Low-end mobile
      return { targetFps: 30, pixelRatio: 1.0, enableShadows: false, enableAntialias: false };
    }
  } else {
    // Desktop
    if (cores >= 8 && memory >= 8) {
      // High-end desktop
      return { targetFps: 60, pixelRatio: 2.0, enableShadows: true, enableAntialias: true };
    } else if (cores >= 4) {
      // Mid-range desktop
      return { targetFps: 60, pixelRatio: 1.5, enableShadows: true, enableAntialias: false };
    } else {
      // Low-end desktop
      return { targetFps: 30, pixelRatio: 1.0, enableShadows: false, enableAntialias: false };
    }
  }
}

export async function getGraphicsSettings() {
  const keys = Object.keys(DEFAULT_GRAPHICS_SETTINGS);
  const settings = {};
  let hasSavedSettings = false;

  const prefixedKeys = keys.map((key) => `gfx_${key}`);
  const items = await db.settings.bulkGet(prefixedKeys);

  keys.forEach((key, index) => {
    const item = items[index];
    if (item !== undefined) {
      settings[key] = item.value;
      hasSavedSettings = true;
    }
  });

  // Apply auto-detection if no settings are saved, or if the preset is set to 'auto'
  if (!hasSavedSettings || settings.graphicsPreset === "auto") {
    const hardwareSpecs = detectHardwareGraphics();
    return { ...DEFAULT_GRAPHICS_SETTINGS, ...settings, ...hardwareSpecs, graphicsPreset: "auto" };
  }

  // Merge loaded settings with defaults for any missing keys
  return { ...DEFAULT_GRAPHICS_SETTINGS, ...settings };
}

export async function saveGraphicsSettings(settings) {
  const entries = Object.entries(settings).map(([key, value]) => ({
    key: `gfx_${key}`,
    value
  }));
  await db.settings.bulkPut(entries);
}
