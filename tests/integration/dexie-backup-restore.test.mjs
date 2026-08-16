import { describe, it } from "node:test";
import assert from "node:assert/strict";

/**
 * ─── BACKUP & RESTORE SERIALIZATION LOGIC UNDER TEST ────────────────
 * Extracted from lib/backup.js
 */

export function buildBackupPayload({ notes = [], trash = [], studySessions = [], calendarEvents = [], alarms = [] }, targetSpace = "All") {
  const isSpecificSpace = targetSpace && targetSpace !== "All";

  const filteredNotes = isSpecificSpace
    ? notes.filter((n) => (n.spaceId || n.space || "School") === targetSpace)
    : notes;

  const filteredTrash = isSpecificSpace
    ? trash.filter((n) => (n.spaceId || n.space || "School") === targetSpace)
    : trash;

  const filteredSessions = isSpecificSpace
    ? studySessions.filter((s) => (s.space || "School") === targetSpace)
    : studySessions;

  const filteredEvents = isSpecificSpace
    ? calendarEvents.filter((c) => (c.space || "School") === targetSpace)
    : calendarEvents;

  const filteredAlarms = isSpecificSpace ? [] : alarms;

  return {
    format: "socratic-backup-v1",
    exportedAt: new Date().toISOString(),
    version: "1.0.0",
    targetSpace: targetSpace || "All",
    data: {
      notes: filteredNotes,
      trash: filteredTrash,
      studySessions: filteredSessions,
      calendarEvents: filteredEvents,
      alarms: filteredAlarms,
    },
  };
}

export function validateAndProcessImport(rawJsonString, options = { targetSpace: "Original", overwrite: false }) {
  let backup;
  try {
    backup = JSON.parse(rawJsonString);
  } catch {
    throw new Error("Invalid backup format: Content is not a JSON object.");
  }

  if (!backup || typeof backup !== "object" || !backup.format?.startsWith("socratic-backup")) {
    throw new Error("Invalid backup file: Unrecognized SocraticOS file format.");
  }

  const payload = backup.data || {};
  let notes = Array.isArray(payload.notes) ? payload.notes : [];
  let trash = Array.isArray(payload.trash) ? payload.trash : [];
  let studySessions = Array.isArray(payload.studySessions) ? payload.studySessions : [];
  let calendarEvents = Array.isArray(payload.calendarEvents) ? payload.calendarEvents : [];
  let alarms = Array.isArray(payload.alarms) ? payload.alarms : [];

  const targetSpace = options.targetSpace || "Original";
  const isReassigningSpace = targetSpace && targetSpace !== "Original" && targetSpace !== "All";

  if (isReassigningSpace) {
    notes = notes.map((n) => ({ ...n, spaceId: targetSpace, space: targetSpace }));
    trash = trash.map((t) => ({ ...t, spaceId: targetSpace, space: targetSpace }));
    studySessions = studySessions.map((s) => ({ ...s, space: targetSpace }));
    calendarEvents = calendarEvents.map((c) => ({ ...c, space: targetSpace }));
  }

  return {
    success: true,
    targetSpace,
    imported: {
      notes: notes.length,
      trash: trash.length,
      studySessions: studySessions.length,
      calendarEvents: calendarEvents.length,
      alarms: alarms.length,
    },
    data: { notes, trash, studySessions, calendarEvents, alarms },
  };
}

// ─── TEST SUITE ─────────────────────────────────────────────────────────────

describe("Dexie Workspace Backup & Restore Engine (lib/backup.js)", () => {
  const mockWorkspace = {
    notes: [
      { id: "n1", title: "Physics Note", space: "School" },
      { id: "n2", title: "Habit Tracker", space: "Personal" },
      { id: "n3", title: "Misc Ideas", space: "Misc" },
    ],
    trash: [
      { id: "t1", title: "Old Chem", space: "School", deletedAt: "2026-08-16T00:00:00Z" },
    ],
    studySessions: [
      { id: "s1", noteTitle: "Physics Note", space: "School", score: 90 },
    ],
    calendarEvents: [
      { id: "c1", title: "Study Physics", space: "School", date: "2026-08-20" },
    ],
    alarms: [
      { id: "a1", label: "Morning Study", time: "08:00" },
    ],
  };

  it("exports entire multi-space workspace when targetSpace is 'All'", () => {
    const backup = buildBackupPayload(mockWorkspace, "All");
    assert.strictEqual(backup.format, "socratic-backup-v1");
    assert.strictEqual(backup.data.notes.length, 3);
    assert.strictEqual(backup.data.trash.length, 1);
    assert.strictEqual(backup.data.studySessions.length, 1);
    assert.strictEqual(backup.data.calendarEvents.length, 1);
    assert.strictEqual(backup.data.alarms.length, 1);
  });

  it("filters notes and records strictly by selected space when exporting a single space", () => {
    const backup = buildBackupPayload(mockWorkspace, "Personal");
    assert.strictEqual(backup.data.notes.length, 1);
    assert.strictEqual(backup.data.notes[0].title, "Habit Tracker");
    assert.strictEqual(backup.data.trash.length, 0);
    assert.strictEqual(backup.data.alarms.length, 0); // alarms are global, excluded from space backups
  });

  it("validates and restores .socratic backup preserving original space assignments", () => {
    const backup = buildBackupPayload(mockWorkspace, "All");
    const jsonStr = JSON.stringify(backup);

    const result = validateAndProcessImport(jsonStr, { targetSpace: "Original" });
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.imported.notes, 3);
    assert.strictEqual(result.data.notes[0].space, "School");
    assert.strictEqual(result.data.notes[1].space, "Personal");
  });

  it("reassigns all imported notes and study records when importing into a target space", () => {
    const backup = buildBackupPayload(mockWorkspace, "All");
    const jsonStr = JSON.stringify(backup);

    const result = validateAndProcessImport(jsonStr, { targetSpace: "School" });
    assert.strictEqual(result.success, true);
    // All 3 notes should now have space = "School"
    for (const note of result.data.notes) {
      assert.strictEqual(note.space, "School");
    }
  });

  it("rejects corrupted or non-Socratic JSON files cleanly", () => {
    assert.throws(() => validateAndProcessImport("not a json string"), /Invalid backup format/);
    assert.throws(() => validateAndProcessImport(JSON.stringify({ some: "other_format" })), /Unrecognized SocraticOS file format/);
  });
});
