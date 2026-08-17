import { db } from "./db.js";

/**
 * Export SocraticOS workspace data from IndexedDB into a structured .socratic JSON backup file.
 * Allows filtering by a specific space (e.g., "School", "Personal", "Misc", or "All").
 * Automatically triggers browser download.
 * 
 * @param {string} [targetSpace="All"] - Optional space to export. If "All" or null, exports all spaces.
 */
export async function exportWorkspaceToJSON(targetSpace = "All") {
  try {
    const allNotes = db.notes ? await db.notes.toArray() : [];
    const allTrash = db.trash ? await db.trash.toArray() : [];
    const allStudySessions = db.studySessions ? await db.studySessions.toArray() : [];
    const allCalendarEvents = db.calendarEvents ? await db.calendarEvents.toArray() : [];
    const allAlarms = db.alarms ? await db.alarms.toArray() : [];
    const allFolders = db.folders ? await db.folders.toArray() : [];
    const allBookmarks = db.bookmarks ? await db.bookmarks.toArray() : [];

    const isSpecificSpace = targetSpace && targetSpace !== "All";

    const notes = isSpecificSpace
      ? allNotes.filter((n) => (n.spaceId || n.space || "School") === targetSpace)
      : allNotes;

    const trash = isSpecificSpace
      ? allTrash.filter((n) => (n.spaceId || n.space || "School") === targetSpace)
      : allTrash;

    const studySessions = isSpecificSpace
      ? allStudySessions.filter((s) => (s.space || "School") === targetSpace)
      : allStudySessions;

    const calendarEvents = isSpecificSpace
      ? allCalendarEvents.filter((c) => (c.space || "School") === targetSpace)
      : allCalendarEvents;

    const folders = isSpecificSpace
      ? allFolders.filter((f) => (f.spaceId || "School") === targetSpace)
      : allFolders;

    const bookmarks = isSpecificSpace
      ? allBookmarks.filter((b) => (b.spaceId || "School") === targetSpace)
      : allBookmarks;

    const alarms = isSpecificSpace ? [] : allAlarms;

    const backupData = {
      format: "socratic-backup-v1",
      exportedAt: new Date().toISOString(),
      version: "1.0.0",
      targetSpace: targetSpace || "All",
      data: {
        notes,
        trash,
        studySessions,
        calendarEvents,
        alarms,
        folders,
        bookmarks,
      },
    };

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

    return { success: true, filename, count: notes.length, targetSpace };
  } catch (error) {
    console.error("Export workspace error:", error);
    throw new Error(`Failed to export workspace backup: ${error.message}`);
  }
}

/**
 * Import and validate a .socratic JSON backup file into IndexedDB.
 * Allows re-assigning imported notes to a specific target space if chosen.
 * 
 * @param {File|Blob} file - The uploaded .socratic / .json file.
 * @param {Object} options - Options: { targetSpace: "Original" | "School" | ..., overwrite: boolean }
 */
export async function importWorkspaceFromJSON(file, options = { targetSpace: "Original", overwrite: false }) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const text = e.target.result;
        const backup = JSON.parse(text);

        // Validation checks
        if (!backup || typeof backup !== "object") {
          throw new Error("Invalid backup format: Content is not a JSON object.");
        }

        if (!backup.format || !backup.format.startsWith("socratic-backup")) {
          throw new Error("Invalid backup file: Unrecognized SocraticOS file format.");
        }

        const payload = backup.data || {};
        let notes = Array.isArray(payload.notes) ? payload.notes : [];
        let trash = Array.isArray(payload.trash) ? payload.trash : [];
        let studySessions = Array.isArray(payload.studySessions) ? payload.studySessions : [];
        let calendarEvents = Array.isArray(payload.calendarEvents) ? payload.calendarEvents : [];
        let alarms = Array.isArray(payload.alarms) ? payload.alarms : [];
        let folders = Array.isArray(payload.folders) ? payload.folders : [];
        let bookmarks = Array.isArray(payload.bookmarks) ? payload.bookmarks : [];

        const targetSpace = options.targetSpace || "Original";
        const isReassigningSpace = targetSpace && targetSpace !== "Original" && targetSpace !== "All";

        // Reassign space for imported items if requested
        if (isReassigningSpace) {
          notes = notes.map((n) => ({
            ...n,
            spaceId: targetSpace,
            space: targetSpace,
          }));
          trash = trash.map((t) => ({
            ...t,
            spaceId: targetSpace,
            space: targetSpace,
          }));
          studySessions = studySessions.map((s) => ({
            ...s,
            space: targetSpace,
          }));
          calendarEvents = calendarEvents.map((c) => ({
            ...c,
            space: targetSpace,
          }));
          folders = folders.map((f) => ({
            ...f,
            spaceId: targetSpace,
          }));
          bookmarks = bookmarks.map((b) => ({
            ...b,
            spaceId: targetSpace,
          }));
        }

        const activeTables = [db.notes, db.trash, db.studySessions, db.calendarEvents, db.alarms, db.folders, db.bookmarks].filter(Boolean);

        await db.transaction("rw", activeTables, async () => {
          // If overwriting and restoring all spaces
          if (options.overwrite && !isReassigningSpace) {
            if (db.notes) await db.notes.clear();
            if (db.trash) await db.trash.clear();
            if (db.studySessions) await db.studySessions.clear();
            if (db.calendarEvents) await db.calendarEvents.clear();
            if (db.alarms) await db.alarms.clear();
            if (db.folders) await db.folders.clear();
            if (db.bookmarks) await db.bookmarks.clear();
          }

          if (notes.length > 0 && db.notes) await db.notes.bulkPut(notes);
          if (trash.length > 0 && db.trash) await db.trash.bulkPut(trash);
          if (studySessions.length > 0 && db.studySessions) await db.studySessions.bulkPut(studySessions);
          if (calendarEvents.length > 0 && db.calendarEvents) await db.calendarEvents.bulkPut(calendarEvents);
          if (alarms.length > 0 && db.alarms) await db.alarms.bulkPut(alarms);
          if (folders.length > 0 && db.folders) await db.folders.bulkPut(folders);
          if (bookmarks.length > 0 && db.bookmarks) await db.bookmarks.bulkPut(bookmarks);
        });

        resolve({
          success: true,
          targetSpace,
          imported: {
            notes: notes.length,
            trash: trash.length,
            studySessions: studySessions.length,
            calendarEvents: calendarEvents.length,
            alarms: alarms.length,
            folders: folders.length,
            bookmarks: bookmarks.length,
          },
        });
      } catch (error) {
        console.error("Import backup error:", error);
        reject(new Error(`Failed to import workspace backup: ${error.message}`));
      }
    };

    reader.onerror = () => {
      reject(new Error("Failed to read file for backup import."));
    };

    reader.readAsText(file);
  });
}
