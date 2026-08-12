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

/**
 * localStorage flag that gates demo-note seeding. Exported so any code that
 * resets the workspace (see resetNotesData/factoryResetWorkspace in
 * storageService.js) can mark the seed as "already planted" using the exact
 * key this checks — writing a different key silently leaves this one unset,
 * which makes the demo notes reappear after the very reset that was supposed
 * to clear them.
 */
export const DEMO_SEED_KEY = "socratic_demo_seeded_v7";

/**
 * Auto-seeding & migration helper:
 * Populates IndexedDB on first boot if notes store is empty.
 */
export async function initAndSeedDatabase() {
  if (typeof window === "undefined") return;

  try {
    const seeded = localStorage.getItem(DEMO_SEED_KEY);
    if (!seeded) {
      // Re-seed DB with complete block types
      await db.transaction("rw", db.notes, async () => {
        const demoItems = DEMO_NOTES.map((dn) => ({
          id: dn.id,
          spaceId: dn.space || "School",
          title: dn.title,
          blocks: dn.blocks || [],
          banner: dn.banner || null,
          emoji: dn.emoji || "📝",
          isFavorite: Boolean(dn.isFavorite),
          createdAt: dn.createdAt || new Date().toISOString(),
          updatedAt: dn.updatedAt || new Date().toISOString(),
        }));

        await db.notes.bulkPut(demoItems);
      });

      localStorage.setItem(DEMO_SEED_KEY, "true");
      console.log("Successfully auto-seeded SocraticOS_LocalDB with complete demo notes.");
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
  
  for (const key of keys) {
    const item = await db.settings.get(`gfx_${key}`);
    if (item !== undefined) {
      settings[key] = item.value;
      hasSavedSettings = true;
    }
  }

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
