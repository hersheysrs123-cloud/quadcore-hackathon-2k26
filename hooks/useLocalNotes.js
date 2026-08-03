"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../lib/db.js";

/**
 * Hook to reactively query and manipulate notes in IndexedDB.
 * @param {string} [spaceId] - Optional space filter. If omitted or null, returns all notes.
 */
export function useNotes(spaceId = null) {
  const notes = useLiveQuery(async () => {
    if (!spaceId) {
      return await db.notes.toArray();
    }
    return await db.notes.where("spaceId").equals(spaceId).toArray();
  }, [spaceId]);

  const createNote = async (space = "School", title = "Untitled Note", initialBlocks = []) => {
    const id = `note_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newNote = {
      id,
      spaceId: space,
      title,
      blocks: initialBlocks,
      banner: null,
      emoji: "📝",
      isFavorite: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await db.notes.put(newNote);
    return newNote;
  };

  const updateNote = async (id, changes) => {
    await db.notes.update(id, {
      ...changes,
      updatedAt: new Date().toISOString(),
    });
  };

  const deleteNote = async (id) => {
    await db.transaction("rw", [db.notes, db.whiteboards, db.studySessions], async () => {
      await db.notes.delete(id);
      await db.whiteboards.where("noteId").equals(id).delete();
      await db.studySessions.where("noteId").equals(id).delete();
    });
  };

  const toggleFavorite = async (id) => {
    const note = await db.notes.get(id);
    if (note) {
      await db.notes.update(id, {
        isFavorite: !note.isFavorite,
        updatedAt: new Date().toISOString(),
      });
    }
  };

  const moveSpace = async (id, newSpaceId) => {
    await db.notes.update(id, {
      spaceId: newSpaceId,
      updatedAt: new Date().toISOString(),
    });
  };

  return {
    notes: notes ?? [],
    isLoading: notes === undefined,
    createNote,
    updateNote,
    deleteNote,
    toggleFavorite,
    moveSpace,
  };
}

/**
 * Hook to reactively query a single note by ID.
 */
export function useNote(noteId) {
  const note = useLiveQuery(async () => {
    if (!noteId) return null;
    return await db.notes.get(noteId);
  }, [noteId]);

  const update = async (changes) => {
    if (!noteId) return;
    await db.notes.update(noteId, {
      ...changes,
      updatedAt: new Date().toISOString(),
    });
  };

  return {
    note,
    isLoading: note === undefined,
    update,
  };
}

/**
 * Hook to reactively get all unique spaces from existing notes.
 */
export function useSpaces() {
  const spaces = useLiveQuery(async () => {
    const allNotes = await db.notes.toArray();
    const uniqueSpaces = new Set(allNotes.map((n) => n.spaceId || "School"));
    return Array.from(uniqueSpaces);
  }, []);

  return spaces ?? ["School"];
}

/**
 * Hook for whiteboard stroke data associated with a note.
 */
export function useWhiteboard(noteId) {
  const whiteboard = useLiveQuery(async () => {
    if (!noteId) return null;
    return await db.whiteboards.where("noteId").equals(noteId).first();
  }, [noteId]);

  const saveWhiteboard = async (strokeData, thumbnail = null) => {
    if (!noteId) return;
    const existing = await db.whiteboards.where("noteId").equals(noteId).first();
    const id = existing ? existing.id : `wb_${noteId}_${Date.now()}`;

    await db.whiteboards.put({
      id,
      noteId,
      strokeData,
      thumbnail,
      updatedAt: new Date().toISOString(),
    });
  };

  return {
    whiteboard,
    strokeData: whiteboard?.strokeData ?? null,
    thumbnail: whiteboard?.thumbnail ?? null,
    saveWhiteboard,
  };
}

/**
 * Hook for study sessions and mastery heatmap tracking.
 */
export function useStudySessions(noteId = null) {
  const sessions = useLiveQuery(async () => {
    if (noteId) {
      return await db.studySessions.where("noteId").equals(noteId).toArray();
    }
    return await db.studySessions.toArray();
  }, [noteId]);

  const recordSession = async (sessionData) => {
    const id = sessionData.id || `session_${Date.now()}`;
    const newSession = {
      id,
      noteId: sessionData.noteId || noteId || "general",
      score: typeof sessionData.score === "number" ? sessionData.score : 0,
      topics: sessionData.topics || sessionData.heatmap || [],
      timestamp: new Date().toISOString(),
    };
    await db.studySessions.put(newSession);
    return newSession;
  };

  return {
    sessions: sessions ?? [],
    recordSession,
  };
}

/**
 * Hook for calendar events.
 */
export function useCalendarEvents() {
  const events = useLiveQuery(async () => {
    return await db.calendarEvents.toArray();
  }, []);

  const addEvent = async (eventData) => {
    const id = `evt_${Date.now()}`;
    const newEvent = {
      id,
      title: eventData.title || "Study Session",
      date: eventData.date || new Date().toISOString().split("T")[0],
      time: eventData.time || "10:00",
    };
    await db.calendarEvents.put(newEvent);
    return newEvent;
  };

  const deleteEvent = async (id) => {
    await db.calendarEvents.delete(id);
  };

  return {
    events: events ?? [],
    addEvent,
    deleteEvent,
  };
}
