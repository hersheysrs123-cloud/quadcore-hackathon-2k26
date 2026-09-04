import { db, DEMO_SEED_KEY } from "./db.js";
import { DEMO_NOTES } from "./demoNotes.js";
import { cleanZeroWidth } from "./editorCaret.js";

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

function sanitizeBlockForStorage(b) {
  if (!b) return b;
  const cleanB = { ...b };
  if (typeof cleanB.content === "string") cleanB.content = cleanZeroWidth(cleanB.content);
  if (typeof cleanB.title === "string") cleanB.title = cleanZeroWidth(cleanB.title);
  if (typeof cleanB.details === "string") cleanB.details = cleanZeroWidth(cleanB.details);
  if (typeof cleanB.formula === "string") cleanB.formula = cleanZeroWidth(cleanB.formula);
  if (typeof cleanB.caption === "string") cleanB.caption = cleanZeroWidth(cleanB.caption);
  if (Array.isArray(cleanB.columnsData)) {
    cleanB.columnsData = cleanB.columnsData.map((c) => ({
      ...c,
      title: typeof c.title === "string" ? cleanZeroWidth(c.title) : c.title,
      content: typeof c.content === "string" ? cleanZeroWidth(c.content) : c.content,
    }));
  }
  if (cleanB.tableData && typeof cleanB.tableData === "object") {
    const td = { ...cleanB.tableData };
    if (Array.isArray(td.headers)) {
      td.headers = td.headers.map((h) => (typeof h === "string" ? cleanZeroWidth(h) : h));
    }
    if (Array.isArray(td.rows)) {
      td.rows = td.rows.map((row) =>
        Array.isArray(row)
          ? row.map((cell) => (typeof cell === "string" ? cleanZeroWidth(cell) : cell))
          : row
      );
    }
    cleanB.tableData = td;
  }
  return cleanB;
}

/**
 * ─── NOTES CRUD ─────────────────────────────────────────────────────────────
 */

export async function getAllNotes() {
  if (typeof window === "undefined") return [];
  const notes = await db.notes.toArray();
  return notes
    .map((note) => ({
      ...note,
      blocks: note.blocks || [],
    }))
    .sort(
      (a, b) =>
        (a.order ?? 0) - (b.order ?? 0) ||
        (a.createdAt || "").localeCompare(b.createdAt || "") ||
        (a.id || "").localeCompare(b.id || "")
    );
}

export async function getNotesBySpace(spaceId) {
  if (typeof window === "undefined") return [];
  if (!spaceId) return await getAllNotes();
  const notes = await db.notes.where("spaceId").equals(spaceId).toArray();
  return notes
    .map((note) => ({
      ...note,
      blocks: note.blocks || [],
    }))
    .sort(
      (a, b) =>
        (a.order ?? 0) - (b.order ?? 0) ||
        (a.createdAt || "").localeCompare(b.createdAt || "") ||
        (a.id || "").localeCompare(b.id || "")
    );
}

export async function getNoteById(id) {
  if (typeof window === "undefined" || !id) return null;
  return await db.notes.get(id);
}

export async function saveNote(noteData) {
  if (typeof window === "undefined" || !noteData) return null;

  const id = noteData.id || `note_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const targetSpace = noteData.spaceId || noteData.space || "School";

  let existingNote = null;
  if (noteData.id) {
    try {
      existingNote = await db.notes.get(noteData.id);
    } catch (e) {}
  }

  let finalOrder = 0;
  if (typeof noteData.order === "number") {
    finalOrder = noteData.order;
  } else if (existingNote && typeof existingNote.order === "number") {
    finalOrder = existingNote.order;
  } else {
    try {
      finalOrder = await db.notes.where("spaceId").equals(targetSpace).count();
    } catch (e) {
      finalOrder = 0;
    }
  }

  const rawTitle = noteData.title || "Untitled Note";
  const cleanTitle = typeof rawTitle === "string" ? cleanZeroWidth(rawTitle) : rawTitle;
  const rawBlocks = noteData.blocks || [];
  const cleanBlocks = Array.isArray(rawBlocks) ? rawBlocks.map(sanitizeBlockForStorage) : [];

  const updatedNote = {
    id,
    spaceId: targetSpace,
    title: cleanTitle || "Untitled Note",
    blocks: cleanBlocks,
    banner: noteData.banner || null,
    emoji: noteData.emoji || "📝",
    fontStyle: noteData.fontStyle || existingNote?.fontStyle || "sans",
    fullWidth: Boolean(noteData.fullWidth ?? existingNote?.fullWidth ?? false),
    isLocked: Boolean(noteData.isLocked ?? existingNote?.isLocked ?? false),
    isFavorite: Boolean(noteData.isFavorite),
    order: finalOrder,
    createdAt: noteData.createdAt || existingNote?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await db.notes.put(updatedNote);
  return updatedNote;
}

export async function saveNotesOrder(spaceId, orderedNotes) {
  if (typeof window === "undefined" || !orderedNotes || orderedNotes.length === 0) return;

  const updates = orderedNotes.map((note, index) => ({
    ...note,
    spaceId: spaceId || note.spaceId || note.space || "School",
    order: index,
    updatedAt: new Date().toISOString(),
  }));

  try {
    await db.notes.bulkPut(updates);
  } catch (err) {
    console.error("Failed to persist notes order to IndexedDB:", err);
  }
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
  const sessions = await db.studySessions.toArray();
  // Non-destructive backwards compatibility: ensure every historical session has a resolved space
  return sessions.map((s) => ({
    ...s,
    space: s.space || s.spaceId || "School",
  }));
}

export async function recordStudySession(sessionData) {
  if (typeof window === "undefined" || !sessionData) return null;

  const id = sessionData.id || `session_${Date.now()}`;
  const session = {
    id,
    noteId: sessionData.noteId || "general",
    noteTitle: sessionData.noteTitle || "",
    space: sessionData.space || sessionData.spaceId || "School",
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

export async function clearStudySessions(targetSpace = null) {
  if (typeof window === "undefined") return;
  if (!targetSpace || targetSpace === "all") {
    await db.studySessions.clear();
  } else {
    const all = await db.studySessions.toArray();
    const toDelete = all
      .filter((s) => (s.space || s.spaceId || "School") === targetSpace)
      .map((s) => s.id);
    if (toDelete.length > 0) {
      await db.studySessions.bulkDelete(toDelete);
    }
  }
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

  const spaceOrderCounters = {};
  const demoItems = DEMO_NOTES.map((dn) => {
    const sp = dn.spaceId || dn.space || "School";
    if (spaceOrderCounters[sp] === undefined) {
      spaceOrderCounters[sp] = 0;
    }
    const order = typeof dn.order === "number" ? dn.order : spaceOrderCounters[sp]++;
    return {
      id: dn.id,
      spaceId: sp,
      space: sp,
      title: dn.title,
      blocks: dn.blocks || [],
      banner: dn.banner || null,
      emoji: dn.emoji || "📝",
      isFavorite: Boolean(dn.isFavorite),
      order,
      createdAt: dn.createdAt || new Date().toISOString(),
      updatedAt: dn.updatedAt || new Date().toISOString(),
    };
  });

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

/**
 * ─── QUIZZES CRUD & TRASH ───────────────────────────────────────────────────
 */

export async function getAllQuizzes() {
  if (typeof window === "undefined" || !db.quizzes) return [];
  return await db.quizzes.toArray();
}

export async function getQuizzesBySpace(spaceId) {
  if (typeof window === "undefined" || !db.quizzes) return [];
  if (!spaceId) return await getAllQuizzes();
  return await db.quizzes.where("spaceId").equals(spaceId).toArray();
}

export async function getQuizById(id) {
  if (typeof window === "undefined" || !id || !db.quizzes) return null;
  return await db.quizzes.get(id);
}

export async function saveQuiz(quizData) {
  if (typeof window === "undefined" || !quizData || !db.quizzes) return null;

  const id = quizData.id || `quiz_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const updatedQuiz = {
    id,
    spaceId: quizData.spaceId || quizData.space || "School",
    noteId: quizData.noteId || null,
    noteTitle: quizData.noteTitle || "",
    noteIds: Array.isArray(quizData.noteIds)
      ? quizData.noteIds
      : quizData.noteId
        ? [quizData.noteId]
        : [],
    noteTitles: Array.isArray(quizData.noteTitles)
      ? quizData.noteTitles
      : quizData.noteTitle
        ? [quizData.noteTitle]
        : [],
    title: quizData.title || "Custom Quiz",
    difficulty: quizData.difficulty || "medium", // easy | medium | hard | mastery
    scope: quizData.scope || "whole", // whole | heading | blocks | custom
    focusText: quizData.focusText || "",
    questionCounts: quizData.questionCounts || { mcq: 5, shortAnswer: 3, longAnswer: 0 },
    questions: Array.isArray(quizData.questions) ? quizData.questions : [],
    status: quizData.status || "pending", // pending | in_progress | completed
    result: quizData.result || null, // { score, summary, heatmap, gradedAnswers, completedAt }
    userAnswers: quizData.userAnswers || {},
    draftAnswers: quizData.draftAnswers !== undefined ? quizData.draftAnswers : null,
    draftIndex: typeof quizData.draftIndex === "number" ? quizData.draftIndex : 0,
    createdAt: quizData.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await db.quizzes.put(updatedQuiz);
  return updatedQuiz;
}

export async function deleteQuizToTrash(id) {
  if (typeof window === "undefined" || !id || !db.quizzes || !db.quizTrash) return;

  await db.transaction("rw", [db.quizzes, db.quizTrash], async () => {
    const quiz = await db.quizzes.get(id);
    if (quiz) {
      await db.quizTrash.put({
        ...quiz,
        deletedAt: new Date().toISOString(),
      });
      await db.quizzes.delete(id);
    }
  });
}

export async function getTrashQuizzes() {
  if (typeof window === "undefined" || !db.quizTrash) return [];

  const now = Date.now();
  const allTrashed = await db.quizTrash.toArray();
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

  if (expiredIds.length > 0) {
    db.quizTrash.bulkDelete(expiredIds).catch((err) => console.error("Error purging quiz trash:", err));
  }

  return validTrash;
}

export async function recoverQuiz(id) {
  if (typeof window === "undefined" || !id || !db.quizzes || !db.quizTrash) return;

  await db.transaction("rw", [db.quizzes, db.quizTrash], async () => {
    const trashedItem = await db.quizTrash.get(id);
    if (trashedItem) {
      const { deletedAt, ...restoredQuiz } = trashedItem;
      await db.quizzes.put({
        ...restoredQuiz,
        updatedAt: new Date().toISOString(),
      });
      await db.quizTrash.delete(id);
    }
  });
}

export async function permanentlyDeleteQuiz(id) {
  if (typeof window === "undefined" || !id || !db.quizTrash || !db.quizzes) return;
  await db.transaction("rw", [db.quizzes, db.quizTrash], async () => {
    await db.quizTrash.delete(id);
    await db.quizzes.delete(id);
  });
}

export async function clearQuizTrash() {
  if (typeof window === "undefined" || !db.quizTrash) return;
  await db.quizTrash.clear();
}

export async function resetQuizData() {
  if (typeof window === "undefined" || !db.quizzes) return;
  await db.transaction("rw", [db.quizzes, db.quizTrash], async () => {
    await db.quizzes.clear();
    await db.quizTrash.clear();
  });
}

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
  if (target === "quizzes") {
    return await resetQuizData();
  }

  // Target 'all' or default: wipe all tables & cache
  const tables = [db.notes, db.trash, db.calendarEvents, db.studySessions, db.alarms, db.settings];
  if (db.folders) tables.push(db.folders);
  if (db.bookmarks) tables.push(db.bookmarks);
  if (db.quizzes) tables.push(db.quizzes);
  if (db.quizTrash) tables.push(db.quizTrash);
  if (db.spaceDocuments) tables.push(db.spaceDocuments);
  if (db.spaceSettings) tables.push(db.spaceSettings);

  await db.transaction("rw", tables, async () => {
    await db.notes.clear();
    await db.trash.clear();
    await db.calendarEvents.clear();
    await db.studySessions.clear();
    await db.alarms.clear();
    await db.settings.clear();
    if (db.folders) await db.folders.clear();
    if (db.bookmarks) await db.bookmarks.clear();
    if (db.quizzes) await db.quizzes.clear();
    if (db.quizTrash) await db.quizTrash.clear();
    if (db.spaceDocuments) await db.spaceDocuments.clear();
    if (db.spaceSettings) await db.spaceSettings.clear();
  });

  const savedTheme = localStorage.getItem("socratic_theme");
  localStorage.clear();
  if (savedTheme) localStorage.setItem("socratic_theme", savedTheme);
  localStorage.setItem(DEMO_SEED_KEY, "true");

  return true;
}

/**
 * ─── SPACE DOCUMENTS & SPACE SETTINGS ───────────────────────────────────────
 */

export async function getSpaceDocuments(spaceId) {
  if (typeof window === "undefined" || !db?.spaceDocuments || !spaceId) return [];
  try {
    const docs = await db.spaceDocuments.where("spaceId").equals(spaceId).toArray();
    return docs.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  } catch (err) {
    console.error("Failed to get space documents:", err);
    return [];
  }
}

export async function addSpaceDocument(spaceId, { name, text, size, active = true }) {
  if (typeof window === "undefined" || !db?.spaceDocuments || !spaceId) return null;
  const doc = {
    id: `doc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    spaceId,
    name: name || "Untitled Document",
    text: String(text ?? "").trim(),
    size: size || (text ? text.length : 0),
    active: Boolean(active),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await db.spaceDocuments.put(doc);
  return doc;
}

export async function updateSpaceDocument(id, updates) {
  if (typeof window === "undefined" || !db?.spaceDocuments || !id) return null;
  const existing = await db.spaceDocuments.get(id);
  if (!existing) return null;
  const updated = {
    ...existing,
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  await db.spaceDocuments.put(updated);
  return updated;
}

export async function toggleSpaceDocumentActive(id, active) {
  if (typeof window === "undefined" || !db?.spaceDocuments || !id) return false;
  await db.spaceDocuments.update(id, {
    active: Boolean(active),
    updatedAt: new Date().toISOString(),
  });
  return true;
}

export async function deleteSpaceDocument(id) {
  if (typeof window === "undefined" || !db?.spaceDocuments || !id) return;
  await db.spaceDocuments.delete(id);
}

export async function getActiveSyllabusForSpace(spaceId) {
  if (typeof window === "undefined" || !db?.spaceDocuments || !spaceId) return "";
  try {
    const docs = await db.spaceDocuments.where("spaceId").equals(spaceId).toArray();
    const activeDocs = docs.filter((d) => d.active && d.text && d.text.trim());
    if (activeDocs.length === 0) return "";
    return activeDocs
      .map((d) => `=== Document: "${d.name}" ===\n${d.text.trim()}`)
      .join("\n\n----------------------------------------\n\n");
  } catch (err) {
    console.error("Failed to get active syllabus for space:", err);
    return "";
  }
}

export async function getSpaceSettings(spaceId) {
  if (typeof window === "undefined" || !db?.spaceSettings || !spaceId) return null;
  try {
    return await db.spaceSettings.get(spaceId);
  } catch (err) {
    console.error("Failed to get space settings:", err);
    return null;
  }
}

export async function saveSpaceSettings(spaceId, settings) {
  if (typeof window === "undefined" || !db?.spaceSettings || !spaceId) return;
  try {
    const existing = (await db.spaceSettings.get(spaceId)) || {};
    const updated = {
      ...existing,
      ...settings,
      spaceId,
      updatedAt: new Date().toISOString(),
    };
    await db.spaceSettings.put(updated);
    return updated;
  } catch (err) {
    console.error("Failed to save space settings:", err);
  }
}

export async function getAllSpaceSettings() {
  if (typeof window === "undefined" || !db?.spaceSettings) return {};
  try {
    const list = await db.spaceSettings.toArray();
    const map = {};
    list.forEach((s) => {
      if (s.spaceId) map[s.spaceId] = s;
    });
    return map;
  } catch (err) {
    console.error("Failed to get all space settings:", err);
    return {};
  }
}

export async function getSyllabusStatement(spaceId = null) {
  if (typeof window === "undefined") return { statement: "", enabled: true };
  try {
    // 1. If spaceId is provided, check if space has active documents
    if (spaceId && db?.spaceDocuments) {
      const activeText = await getActiveSyllabusForSpace(spaceId);
      if (activeText) {
        return { statement: activeText, enabled: true };
      }
    }

    // 2. Check global fallback settings
    if (db?.settings) {
      const textItem = await db.settings.get("socratic_syllabus_statement");
      const enabledItem = await db.settings.get("socratic_syllabus_enabled");
      const statement = textItem?.value || "";
      const enabled = enabledItem ? enabledItem.value !== "false" : true;
      return { statement, enabled };
    }
    return { statement: "", enabled: true };
  } catch (err) {
    console.error("Failed to get syllabus statement:", err);
    return { statement: "", enabled: true };
  }
}

export async function saveSyllabusStatement(statement, enabled = true) {
  if (typeof window === "undefined" || !db?.settings) return;
  try {
    await db.settings.put({ key: "socratic_syllabus_statement", value: String(statement ?? "").trim() });
    await db.settings.put({ key: "socratic_syllabus_enabled", value: String(enabled) });
  } catch (err) {
    console.error("Failed to save syllabus statement:", err);
  }
}

