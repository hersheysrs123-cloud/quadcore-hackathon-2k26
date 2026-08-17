import { db, DEMO_SEED_KEY } from "./db.js";
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
    blocks: note.blocks || [],
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
  await db.transaction("rw", [db.notes, db.trash], async () => {
    await db.trash.delete(id);
    await db.notes.delete(id);
  });
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
    noteTitle: sessionData.noteTitle || "",
    space: sessionData.space || "School",
    concept: sessionData.concept || "",
    mode: sessionData.mode || "",
    score: typeof sessionData.score === "number" ? sessionData.score : 0,
    summary: sessionData.summary || "",
    // `heatmap` is the field name every reader (lib/mastery.js, the Mastery
    // Dashboard) expects. `topics` is kept only as a fallback for any
    // caller still using the old name, so a round trip through this
    // function never silently drops the per-subtopic grading data.
    heatmap: Array.isArray(sessionData.heatmap)
      ? sessionData.heatmap
      : Array.isArray(sessionData.topics)
        ? sessionData.topics
        : [],
    createdAt: sessionData.createdAt || new Date().toISOString(),
  };

  await db.studySessions.put(session);
  return session;
}

export async function clearStudySessions() {
  if (typeof window === "undefined") return;
  await db.studySessions.clear();
}

export async function resetNotesData() {
  if (typeof window === "undefined") return;
  await db.transaction("rw", [db.notes, db.trash], async () => {
    await db.notes.clear();
    await db.trash.clear();
  });
  localStorage.removeItem("socratic_notes_by_space");
  localStorage.removeItem("socratic_trash_notes");
  localStorage.setItem(DEMO_SEED_KEY, "true");
  return true;
}

export async function seedDemoContent({ overwrite = false } = {}) {
  if (typeof window === "undefined") return { notes: 0, folders: 0, bookmarks: 0 };
  const { DEMO_FOLDERS, DEMO_BOOKMARKS } = await import("./db.js");

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

  if (overwrite) {
    await db.notes.bulkPut(demoItems);
    if (db.folders && DEMO_FOLDERS) await db.folders.bulkPut(DEMO_FOLDERS);
    if (db.bookmarks && DEMO_BOOKMARKS) await db.bookmarks.bulkPut(DEMO_BOOKMARKS);
  } else {
    for (const note of demoItems) {
      const exists = await db.notes.get(note.id);
      if (!exists) await db.notes.put(note);
    }
    if (db.folders && DEMO_FOLDERS) {
      for (const folder of DEMO_FOLDERS) {
        const exists = await db.folders.get(folder.id);
        if (!exists) await db.folders.put(folder);
      }
    }
    if (db.bookmarks && DEMO_BOOKMARKS) {
      for (const bm of DEMO_BOOKMARKS) {
        const exists = await db.bookmarks.get(bm.id);
        if (!exists) await db.bookmarks.put(bm);
      }
    }
  }

  localStorage.setItem(DEMO_SEED_KEY, "true");
  return {
    notes: demoItems.length,
    folders: DEMO_FOLDERS ? DEMO_FOLDERS.length : 0,
    bookmarks: DEMO_BOOKMARKS ? DEMO_BOOKMARKS.length : 0,
  };
}

export async function resetCalendarData() {
  if (typeof window === "undefined") return;
  await db.transaction("rw", [db.calendarEvents, db.alarms], async () => {
    await db.calendarEvents.clear();
    await db.alarms.clear();
  });
  return true;
}

/**
 * ─── WEB SAVER FOLDERS & BOOKMARKS ──────────────────────────────────────────
 */

export async function getAllFolders() {
  if (typeof window === "undefined" || !db.folders) return [];
  return await db.folders.toArray();
}

export async function getFoldersBySpace(spaceId) {
  if (typeof window === "undefined" || !db.folders) return [];
  if (!spaceId || spaceId === "All") return await getAllFolders();
  return await db.folders.where("spaceId").equals(spaceId).toArray();
}

export async function createFolder({ name, spaceId = "School", parentId = null, id = null }) {
  if (typeof window === "undefined" || !db.folders) return null;
  const folderId = id || `f_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const folder = {
    id: folderId,
    parentId: parentId || null,
    spaceId: spaceId || "School",
    name: (name || "New Folder").trim(),
    createdAt: new Date().toISOString(),
  };
  await db.folders.put(folder);
  return folder;
}

export async function renameFolder(id, newName) {
  if (typeof window === "undefined" || !db.folders || !id) return null;
  const trimmed = (newName || "Untitled Folder").trim();
  await db.folders.update(id, { name: trimmed });
  return await db.folders.get(id);
}

export async function moveFolder(id, targetParentId) {
  if (typeof window === "undefined" || !db.folders || !id) return null;
  // Guard against making a folder its own parent
  if (id === targetParentId) return null;
  await db.folders.update(id, { parentId: targetParentId || null });
  return await db.folders.get(id);
}

export async function deleteFolder(id, recursive = true) {
  if (typeof window === "undefined" || !db.folders || !id) return;

  await db.transaction("rw", [db.folders, db.bookmarks], async () => {
    const allFolders = await db.folders.toArray();
    
    // Find all descendant folder IDs if recursive
    const folderIdsToDelete = new Set([id]);
    if (recursive) {
      let addedMore = true;
      while (addedMore) {
        addedMore = false;
        for (const f of allFolders) {
          if (f.parentId && folderIdsToDelete.has(f.parentId) && !folderIdsToDelete.has(f.id)) {
            folderIdsToDelete.add(f.id);
            addedMore = true;
          }
        }
      }
    }

    const idsArray = Array.from(folderIdsToDelete);
    
    // Delete folders
    await db.folders.bulkDelete(idsArray);

    // Delete or re-parent bookmarks belonging to these folders
    const bookmarks = await db.bookmarks.toArray();
    const bookmarkIdsToDelete = [];
    bookmarks.forEach(bm => {
      if (bm.folderId && folderIdsToDelete.has(bm.folderId)) {
        bookmarkIdsToDelete.push(bm.id);
      }
    });

    if (bookmarkIdsToDelete.length > 0) {
      await db.bookmarks.bulkDelete(bookmarkIdsToDelete);
    }
  });
}

export async function getAllBookmarks() {
  if (typeof window === "undefined" || !db.bookmarks) return [];
  return await db.bookmarks.toArray();
}

export async function getBookmarksBySpace(spaceId) {
  if (typeof window === "undefined" || !db.bookmarks) return [];
  if (!spaceId || spaceId === "All") return await getAllBookmarks();
  return await db.bookmarks.where("spaceId").equals(spaceId).toArray();
}

export async function getBookmarksByFolder(folderId, spaceId = null) {
  if (typeof window === "undefined" || !db.bookmarks) return [];
  let collection = db.bookmarks.toCollection();
  if (spaceId && spaceId !== "All") {
    collection = db.bookmarks.where("spaceId").equals(spaceId);
  }
  const bookmarks = await collection.toArray();
  return bookmarks.filter(b => b.folderId === (folderId || null));
}

export async function getBookmarkById(id) {
  if (typeof window === "undefined" || !db.bookmarks || !id) return null;
  return await db.bookmarks.get(id);
}

export async function createBookmark(data) {
  if (typeof window === "undefined" || !db.bookmarks || !data) return null;

  const id = data.id || `bm_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const url = (data.url || "").trim();
  const domain = url.replace(/^(?:https?:\/\/)?(?:www\.)?/i, "").split("/")[0] || "link";
  const title = (data.title || domain || "Saved Website").trim();
  const favicon = data.favicon || `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;

  const newBookmark = {
    id,
    folderId: data.folderId || null,
    spaceId: data.spaceId || "School",
    url,
    title,
    favicon,
    notes: data.notes || "",
    tags: Array.isArray(data.tags) ? data.tags.filter(Boolean).map(t => String(t).trim().toLowerCase()) : [],
    createdAt: data.createdAt || new Date().toISOString(),
  };

  await db.bookmarks.put(newBookmark);
  return newBookmark;
}

export async function updateBookmark(id, updates) {
  if (typeof window === "undefined" || !db.bookmarks || !id || !updates) return null;
  const existing = await db.bookmarks.get(id);
  if (!existing) return null;

  const updated = {
    ...existing,
    ...updates,
    tags: updates.tags !== undefined
      ? (Array.isArray(updates.tags) ? updates.tags.filter(Boolean).map(t => String(t).trim().toLowerCase()) : [])
      : existing.tags,
  };

  await db.bookmarks.put(updated);
  return updated;
}

export async function moveBookmark(id, targetFolderId) {
  if (typeof window === "undefined" || !db.bookmarks || !id) return null;
  await db.bookmarks.update(id, { folderId: targetFolderId || null });
  return await db.bookmarks.get(id);
}

export async function deleteBookmark(id) {
  if (typeof window === "undefined" || !db.bookmarks || !id) return;
  await db.bookmarks.delete(id);
}

export async function searchBookmarks(query, spaceId = null) {
  if (typeof window === "undefined" || !db.bookmarks) return [];
  const all = spaceId && spaceId !== "All"
    ? await db.bookmarks.where("spaceId").equals(spaceId).toArray()
    : await db.bookmarks.toArray();

  if (!query || !query.trim()) return all;
  const q = query.trim().toLowerCase();

  return all.filter(bm => {
    const titleMatch = (bm.title || "").toLowerCase().includes(q);
    const urlMatch = (bm.url || "").toLowerCase().includes(q);
    const notesMatch = (bm.notes || "").toLowerCase().includes(q);
    const tagsMatch = Array.isArray(bm.tags) && bm.tags.some(t => t.toLowerCase().includes(q));
    return titleMatch || urlMatch || notesMatch || tagsMatch;
  });
}

export async function resetWebSaverData() {
  if (typeof window === "undefined" || !db.folders || !db.bookmarks) return;
  await db.transaction("rw", [db.folders, db.bookmarks], async () => {
    await db.folders.clear();
    await db.bookmarks.clear();
  });
  return true;
}

export async function clearSpaceBookmarks(spaceId = null) {
  if (typeof window === "undefined" || !db.folders || !db.bookmarks) return false;
  await db.transaction("rw", [db.folders, db.bookmarks], async () => {
    if (spaceId && spaceId !== "All") {
      await db.folders.where("spaceId").equals(spaceId).delete();
      await db.bookmarks.where("spaceId").equals(spaceId).delete();
    } else {
      await db.folders.clear();
      await db.bookmarks.clear();
    }
  });
  return true;
}

/**
 * ─── FACTORY RESET ──────────────────────────────────────────────────────────
 */

export async function factoryResetWorkspace(target) {
  if (typeof window === "undefined") return;

  if (target === "notes") {
    return await resetNotesData();
  }
  if (target === "calendar") {
    return await resetCalendarData();
  }
  if (target === "websaver") {
    return await resetWebSaverData();
  }

  // Target 'all' or default: wipe all tables & cache
  await db.transaction("rw", [db.notes, db.trash, db.calendarEvents, db.studySessions, db.alarms, db.settings, db.folders, db.bookmarks], async () => {
    await db.notes.clear();
    await db.trash.clear();
    await db.calendarEvents.clear();
    await db.studySessions.clear();
    await db.alarms.clear();
    await db.settings.clear();
    if (db.folders) await db.folders.clear();
    if (db.bookmarks) await db.bookmarks.clear();
  });

  const savedTheme = localStorage.getItem("socratic_theme");
  localStorage.clear();
  if (savedTheme) localStorage.setItem("socratic_theme", savedTheme);
  localStorage.setItem(DEMO_SEED_KEY, "true");

  return true;
}
