import { db } from "./db.js";

/**
 * Export the entire SocraticOS workspace from IndexedDB into a structured .socratic JSON backup file.
 * Automatically triggers browser download.
 */
export async function exportWorkspaceToJSON() {
  try {
    const notes = db.notes ? await db.notes.toArray() : [];
    const trash = db.trash ? await db.trash.toArray() : [];
    const studySessions = db.studySessions ? await db.studySessions.toArray() : [];
    const calendarEvents = db.calendarEvents ? await db.calendarEvents.toArray() : [];
    const alarms = db.alarms ? await db.alarms.toArray() : [];

    const backupData = {
      format: "socratic-backup-v1",
      exportedAt: new Date().toISOString(),
      version: "1.0.0",
      data: {
        notes,
        trash,
        studySessions,
        calendarEvents,
        alarms,
      },
    };

    const jsonString = JSON.stringify(backupData, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const filename = `SocraticOS-Backup-${new Date().toISOString().split("T")[0]}.socratic`;

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();

    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    return { success: true, filename, count: notes.length };
  } catch (error) {
    console.error("Export workspace error:", error);
    throw new Error(`Failed to export workspace backup: ${error.message}`);
  }
}

/**
 * Import and validate a .socratic JSON backup file into IndexedDB.
 * @param {File|Blob} file - The uploaded .socratic / .json file.
 * @param {Object} options - Options for import: { overwrite: boolean }
 */
export async function importWorkspaceFromJSON(file, options = { overwrite: true }) {
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
        const notes = Array.isArray(payload.notes) ? payload.notes : [];
        const trash = Array.isArray(payload.trash) ? payload.trash : [];
        const studySessions = Array.isArray(payload.studySessions) ? payload.studySessions : [];
        const calendarEvents = Array.isArray(payload.calendarEvents) ? payload.calendarEvents : [];
        const alarms = Array.isArray(payload.alarms) ? payload.alarms : [];

        const activeTables = [db.notes, db.trash, db.studySessions, db.calendarEvents, db.alarms].filter(Boolean);

        await db.transaction("rw", activeTables, async () => {
          if (options.overwrite) {
            if (db.notes) await db.notes.clear();
            if (db.trash) await db.trash.clear();
            if (db.studySessions) await db.studySessions.clear();
            if (db.calendarEvents) await db.calendarEvents.clear();
            if (db.alarms) await db.alarms.clear();
          }

          if (notes.length > 0 && db.notes) await db.notes.bulkPut(notes);
          if (trash.length > 0 && db.trash) await db.trash.bulkPut(trash);
          if (studySessions.length > 0 && db.studySessions) await db.studySessions.bulkPut(studySessions);
          if (calendarEvents.length > 0 && db.calendarEvents) await db.calendarEvents.bulkPut(calendarEvents);
          if (alarms.length > 0 && db.alarms) await db.alarms.bulkPut(alarms);
        });

        resolve({
          success: true,
          imported: {
            notes: notes.length,
            trash: trash.length,
            studySessions: studySessions.length,
            calendarEvents: calendarEvents.length,
            alarms: alarms.length,
          },
        });
      } catch (err) {
        console.error("Import workspace error:", err);
        reject(err);
      }
    };

    reader.onerror = () => {
      reject(new Error("Failed to read the selected backup file."));
    };

    reader.readAsText(file);
  });
}
