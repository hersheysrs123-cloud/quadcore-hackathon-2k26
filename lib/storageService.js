import { db } from "./db.js";
import { DEMO_NOTES } from "./demoNotes.js";

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

/**
 * ─── NOTES CRUD ─────────────────────────────────────────────────────────────
 */

export async function getAllNotes() {
  if (typeof window === "undefined") return [];
  const notes = await db.notes.toArray();
  return notes.map((note) => ({
    ...note,
    blocks: (note.blocks || []).filter((b) => b?.type !== "action"),
  }));
}

export async function getNotesBySpace(spaceId) {
  if (typeof window === "undefined") return [];
  if (!spaceId) return await getAllNotes();
  return await db.notes.where("spaceId").equals(spaceId).toArray();
}

export async function getNoteById(id) {
  if (typeof window === "undefined" || !id) return null;
  return await db.notes.get(id);
}

export async function saveNote(noteData) {
  if (typeof window === "undefined" || !noteData) return null;

  const id = noteData.id || `note_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const updatedNote = {
    id,
    spaceId: noteData.spaceId || noteData.space || "School",
    title: noteData.title || "Untitled Note",
    blocks: noteData.blocks || [],
    banner: noteData.banner || null,
    emoji: noteData.emoji || "📝",
    isFavorite: Boolean(noteData.isFavorite),
    createdAt: noteData.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await db.notes.put(updatedNote);
  return updatedNote;
}

export async function deleteNoteToTrash(id) {
  if (typeof window === "undefined" || !id) return;

  await db.transaction("rw", [db.notes, db.trash], async () => {
    const note = await db.notes.get(id);
    if (note) {
      await db.trash.put({
        ...note,
        deletedAt: new Date().toISOString(),
      });
      await db.notes.delete(id);
    }
  });
}

export async function getTrashNotes() {
  if (typeof window === "undefined") return [];

  const now = Date.now();
  const allTrashed = await db.trash.toArray();
  const validTrash = [];
  const expiredIds = [];

  allTrashed.forEach((item) => {
    const deletedTime = new Date(item.deletedAt || 0).getTime();
    if (now - deletedTime > TWENTY_FOUR_HOURS_MS) {
      expiredIds.push(item.id);
    } else {
      validTrash.push(item);
    }
  });

  // Auto-purge expired 24h items in background
  if (expiredIds.length > 0) {
    db.trash.bulkDelete(expiredIds).catch((err) => console.error("Error purging trash:", err));
  }

  return validTrash;
}

export async function recoverNote(id) {
  if (typeof window === "undefined" || !id) return;

  await db.transaction("rw", [db.notes, db.trash], async () => {
    const trashedItem = await db.trash.get(id);
    if (trashedItem) {
      const { deletedAt, ...restoredNote } = trashedItem;
      await db.notes.put({
        ...restoredNote,
        updatedAt: new Date().toISOString(),
      });
      await db.trash.delete(id);
    }
  });
}

export async function permanentlyDeleteNote(id) {
  if (typeof window === "undefined" || !id) return;
  await db.trash.delete(id);
}

export async function clearTrash() {
  if (typeof window === "undefined") return;
  await db.trash.clear();
}

/**
 * ─── CALENDAR EVENTS ────────────────────────────────────────────────────────
 */

export async function getCalendarEvents() {
  if (typeof window === "undefined") return [];
  return await db.calendarEvents.toArray();
}

export async function saveCalendarEvent(eventData) {
  if (typeof window === "undefined" || !eventData) return null;

  const id = eventData.id || `evt_${Date.now()}`;
  const newEvent = {
    id,
    title: eventData.title || "Study Session",
    date: eventData.date || new Date().toISOString().split("T")[0],
    time: eventData.time || "10:00 AM",
    type: eventData.type || "socratic",
    space: eventData.space || "School",
    updatedAt: new Date().toISOString(),
  };

  await db.calendarEvents.put(newEvent);
  return newEvent;
}

export async function deleteCalendarEvent(id) {
  if (typeof window === "undefined" || !id) return;
  await db.calendarEvents.delete(id);
}

/**
 * ─── REGULAR ALARMS ─────────────────────────────────────────────────────────
 */

export async function getAlarms() {
  if (typeof window === "undefined") return [];
  return await db.alarms.toArray();
}

export async function saveAlarm(alarmData) {
  if (typeof window === "undefined" || !alarmData) return null;

  const id = alarmData.id || `alarm_${Date.now()}`;
  const newAlarm = {
    id,
    title: alarmData.title || "Study Alarm",
    time: alarmData.time || "08:00", // "HH:MM" 24h format for easy matching
    days: Array.isArray(alarmData.days) ? alarmData.days : [0, 1, 2, 3, 4, 5, 6], // 0 = Sun, 1 = Mon ... 6 = Sat
    enabled: alarmData.enabled !== undefined ? Boolean(alarmData.enabled) : true,
    sound: alarmData.sound || "chime",
    createdAt: alarmData.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await db.alarms.put(newAlarm);
  return newAlarm;
}

export async function deleteAlarm(id) {
  if (typeof window === "undefined" || !id) return;
  await db.alarms.delete(id);
}

export async function toggleAlarm(id, enabledState) {
  if (typeof window === "undefined" || !id) return;
  const existing = await db.alarms.get(id);
  if (existing) {
    const nextEnabled = enabledState !== undefined ? Boolean(enabledState) : !existing.enabled;
    await db.alarms.update(id, { enabled: nextEnabled, updatedAt: new Date().toISOString() });
  }
}

/**
 * ─── STUDY SESSIONS & MASTERY ───────────────────────────────────────────────
 */

export async function getStudySessions() {
  if (typeof window === "undefined") return [];
  return await db.studySessions.toArray();
}

export async function recordStudySession(sessionData) {
  if (typeof window === "undefined" || !sessionData) return null;

  const id = sessionData.id || `session_${Date.now()}`;
  const session = {
    id,
    noteId: sessionData.noteId || "general",
    score: typeof sessionData.score === "number" ? sessionData.score : 0,
    topics: sessionData.topics || sessionData.heatmap || [],
    timestamp: new Date().toISOString(),
  };

  await db.studySessions.put(session);
  return session;
}

/**
 * ─── FACTORY RESET ──────────────────────────────────────────────────────────
 */

export async function factoryResetWorkspace() {
  if (typeof window === "undefined") return;

  await db.transaction("rw", [db.notes, db.trash, db.calendarEvents, db.studySessions, db.alarms], async () => {
    await db.notes.clear();
    await db.trash.clear();
    await db.calendarEvents.clear();
    await db.studySessions.clear();
    await db.alarms.clear();

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

  return true;
}
