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

/**
 * localStorage flag that gates demo-note seeding. Exported so any code that
 * resets the workspace (see resetNotesData/factoryResetWorkspace in
 * storageService.js) can mark the seed as "already planted" using the exact
 * key this checks — writing a different key silently leaves this one unset,
 * which makes the demo notes reappear after the very reset that was supposed
 * to clear them.
 */
export const DEMO_SEED_KEY = "socratic_demo_seeded_v8";

export const DEMO_FOLDERS = [
  { id: "f_school_math", parentId: null, spaceId: "School", name: "Mathematics & Calculus", createdAt: "2026-07-24T10:00:00.000Z" },
  { id: "f_school_cs", parentId: null, spaceId: "School", name: "Computer Science", createdAt: "2026-07-24T10:00:00.000Z" },
  { id: "f_school_physics", parentId: null, spaceId: "School", name: "Physics & Science", createdAt: "2026-07-24T10:00:00.000Z" },
  { id: "f_personal_reading", parentId: null, spaceId: "Personal", name: "Deep Reading & Research", createdAt: "2026-07-24T10:00:00.000Z" },
];

export const DEMO_BOOKMARKS = [
  {
    id: "bm_3b1b",
    folderId: "f_school_math",
    spaceId: "School",
    url: "https://www.3blue1brown.com",
    title: "3Blue1Brown — Animated Math",
    favicon: "https://www.google.com/s2/favicons?domain=3blue1brown.com&sz=64",
    notes: "Essential visual explanations for calculus and linear algebra.",
    tags: ["math", "visual", "calculus"],
    createdAt: "2026-07-24T10:05:00.000Z",
  },
  {
    id: "bm_desmos",
    folderId: "f_school_math",
    spaceId: "School",
    url: "https://www.desmos.com/calculator",
    title: "Desmos Graphing Calculator",
    favicon: "https://www.google.com/s2/favicons?domain=desmos.com&sz=64",
    notes: "Interactive graphing tool for visualizing functions and geometric transformations.",
    tags: ["math", "tools", "graphing"],
    createdAt: "2026-07-24T10:06:00.000Z",
  },
  {
    id: "bm_mdn",
    folderId: "f_school_cs",
    spaceId: "School",
    url: "https://developer.mozilla.org",
    title: "MDN Web Docs",
    favicon: "https://www.google.com/s2/favicons?domain=developer.mozilla.org&sz=64",
    notes: "Authoritative documentation for JavaScript, Web APIs, CSS, and HTML standards.",
    tags: ["cs", "web", "docs"],
    createdAt: "2026-07-24T10:07:00.000Z",
  },
  {
    id: "bm_ocw",
    folderId: "f_school_physics",
    spaceId: "School",
    url: "https://ocw.mit.edu",
    title: "MIT OpenCourseWare",
    favicon: "https://www.google.com/s2/favicons?domain=ocw.mit.edu&sz=64",
    notes: "Free university lecture notes, problem sets, and exams across STEM disciplines.",
    tags: ["stem", "lectures", "physics"],
    createdAt: "2026-07-24T10:08:00.000Z",
  },
  {
    id: "bm_arxiv",
    folderId: "f_personal_reading",
    spaceId: "Personal",
    url: "https://arxiv.org",
    title: "arXiv.org E-Print Archive",
    favicon: "https://www.google.com/s2/favicons?domain=arxiv.org&sz=64",
    notes: "Open-access research papers in CS, physics, and machine learning.",
    tags: ["papers", "research"],
    createdAt: "2026-07-24T10:09:00.000Z",
  },
  {
    id: "bm_khan",
    folderId: null,
    spaceId: "School",
    url: "https://www.khanacademy.org",
    title: "Khan Academy",
    favicon: "https://www.google.com/s2/favicons?domain=khanacademy.org&sz=64",
    notes: "Practice exercises and instructional videos across all subjects.",
    tags: ["study", "general"],
    createdAt: "2026-07-24T10:10:00.000Z",
  },
];

/**
 * Auto-seeding & migration helper:
 * Populates IndexedDB on first boot if notes or bookmarks store is empty.
 */
export async function initAndSeedDatabase() {
  if (typeof window === "undefined") return;

  try {
    const seeded = localStorage.getItem(DEMO_SEED_KEY);
    const notesCount = await db.notes.count();
    const shouldSeedNotes = !seeded || notesCount === 0;

    if (shouldSeedNotes) {
      const demoItems = DEMO_NOTES.map((dn) => ({
        id: dn.id,
        spaceId: dn.spaceId || dn.space || "School",
        space: dn.spaceId || dn.space || "School",
        title: dn.title,
        blocks: dn.blocks || [],
        banner: dn.banner || null,
        emoji: dn.emoji || "📝",
        isFavorite: Boolean(dn.isFavorite),
        createdAt: dn.createdAt || new Date().toISOString(),
        updatedAt: dn.updatedAt || new Date().toISOString(),
      }));

      await db.notes.bulkPut(demoItems);
    }

    if (db.folders && db.bookmarks) {
      const foldersCount = await db.folders.count();
      const bookmarksCount = await db.bookmarks.count();
      if (!seeded || foldersCount === 0) {
        await db.folders.bulkPut(DEMO_FOLDERS);
      }
      if (!seeded || bookmarksCount === 0) {
        await db.bookmarks.bulkPut(DEMO_BOOKMARKS);
      }
    }

    localStorage.setItem(DEMO_SEED_KEY, "true");
    console.log("Successfully auto-seeded SocraticOS_LocalDB with complete demo notes and bookmarks.");
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
