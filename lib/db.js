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

/**
 * Auto-seeding & migration helper:
 * Populates IndexedDB on first boot if notes store is empty.
 */
export async function initAndSeedDatabase() {
  if (typeof window === "undefined") return;

  try {
    const count = await db.notes.count();
    if (count > 0) return;

    await db.transaction("rw", db.notes, async () => {
      const demoItems = DEMO_NOTES.map((dn) => ({
        id: dn.id,
        spaceId: dn.space || "School",
        title: dn.title,
        blocks: (dn.blocks || []).filter((b) => b?.type !== "action"),
        banner: dn.banner || null,
        emoji: dn.emoji || "📝",
        isFavorite: Boolean(dn.isFavorite),
        createdAt: dn.createdAt || new Date().toISOString(),
        updatedAt: dn.updatedAt || new Date().toISOString(),
      }));

      await db.notes.bulkPut(demoItems);
    });

    console.log("Successfully auto-seeded SocraticOS_LocalDB with demo notes.");
  } catch (err) {
    console.error("Error seeding SocraticOS_LocalDB:", err);
  }
}

