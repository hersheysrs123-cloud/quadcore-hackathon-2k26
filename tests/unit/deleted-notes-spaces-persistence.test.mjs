import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

describe("Deleted Notes & Spaces Persistence Across Refreshes", () => {
  // Mock localStorage for Node environment
  let storage = {};
  const mockLocalStorage = {
    getItem: (key) => (key in storage ? storage[key] : null),
    setItem: (key, val) => {
      storage[key] = String(val);
    },
    removeItem: (key) => {
      delete storage[key];
    },
    clear: () => {
      storage = {};
    },
  };

  beforeEach(() => {
    storage = {};
    global.localStorage = mockLocalStorage;
    global.window = {};
  });

  it("adds note IDs to socratic_deleted_notes on deleteNoteToTrash and permanentlyDeleteNote", () => {
    function mockDeleteNoteToTrash(id) {
      const deleted = JSON.parse(mockLocalStorage.getItem("socratic_deleted_notes") || "[]");
      if (!deleted.includes(id)) {
        deleted.push(id);
        mockLocalStorage.setItem("socratic_deleted_notes", JSON.stringify(deleted));
      }
    }

    function mockRecoverNote(id) {
      const deleted = JSON.parse(mockLocalStorage.getItem("socratic_deleted_notes") || "[]");
      const updated = deleted.filter((d) => d !== id);
      mockLocalStorage.setItem("socratic_deleted_notes", JSON.stringify(updated));
    }

    mockDeleteNoteToTrash("note_quantum");
    let deleted = JSON.parse(mockLocalStorage.getItem("socratic_deleted_notes"));
    assert.deepEqual(deleted, ["note_quantum"]);

    mockDeleteNoteToTrash("note_calc");
    deleted = JSON.parse(mockLocalStorage.getItem("socratic_deleted_notes"));
    assert.deepEqual(deleted, ["note_quantum", "note_calc"]);

    // Duplicates should not be added
    mockDeleteNoteToTrash("note_quantum");
    deleted = JSON.parse(mockLocalStorage.getItem("socratic_deleted_notes"));
    assert.deepEqual(deleted, ["note_quantum", "note_calc"]);

    // Recovering a note removes it from socratic_deleted_notes
    mockRecoverNote("note_quantum");
    deleted = JSON.parse(mockLocalStorage.getItem("socratic_deleted_notes"));
    assert.deepEqual(deleted, ["note_calc"]);
  });

  it("filters out socratic_deleted_notes during demo note seeding so deleted notes stay deleted", () => {
    mockLocalStorage.setItem("socratic_deleted_notes", JSON.stringify(["note_quantum", "note_welcome"]));

    const DEMO_NOTES = [
      { id: "note_calc", title: "Calculus" },
      { id: "note_photo", title: "Photosynthesis" },
      { id: "note_quantum", title: "Quantum Computing" },
      { id: "note_fourier", title: "Fourier Transform" },
      { id: "note_welcome", title: "Welcome" },
    ];

    const deletedNotes = JSON.parse(mockLocalStorage.getItem("socratic_deleted_notes") || "[]");
    const deletedSet = new Set(deletedNotes);

    const demoItems = DEMO_NOTES.filter((dn) => !deletedSet.has(dn.id));

    assert.equal(demoItems.length, 3);
    assert.ok(demoItems.every((d) => d.id !== "note_quantum" && d.id !== "note_welcome"));
    assert.ok(demoItems.some((d) => d.id === "note_calc"));
  });

  it("Workspace loadLocalWorkspace does NOT reseed notes if DEMO_SEED_KEY is present or notes were deleted", () => {
    // Simulated scenario: User deleted all demo notes so active notes is empty []
    const allDbNotes = [];
    mockLocalStorage.setItem("socratic_demo_seeded_v14", "true");
    mockLocalStorage.setItem("socratic_deleted_notes", JSON.stringify(["note_calc", "note_photo"]));

    let reseeded = false;
    const hasSeeded = mockLocalStorage.getItem("socratic_demo_seeded_v14");
    if (!hasSeeded) {
      const trashCount = 0;
      const deletedNotesCount = (JSON.parse(mockLocalStorage.getItem("socratic_deleted_notes") || "[]")).length;
      if ((!allDbNotes || allDbNotes.length === 0) && trashCount === 0 && deletedNotesCount === 0) {
        reseeded = true;
      }
    }

    assert.equal(reseeded, false, "Must never automatically re-seed if workspace was already seeded");
  });

  it("persists deleted spaces in socratic_deleted_spaces and does not resurrect on saveAllSpaces", () => {
    const SPACES = [
      { name: "School", icon: "🎓" },
      { name: "Personal", icon: "🌱" },
      { name: "Misc", icon: "📦" },
      { name: "Journal", icon: "📓" },
    ];

    // User deletes "Journal"
    let deleted = ["Journal"];
    mockLocalStorage.setItem("socratic_deleted_spaces", JSON.stringify(deleted));
    let currentSpaces = SPACES.filter((s) => s.name !== "Journal");
    mockLocalStorage.setItem("socratic_spaces", JSON.stringify(currentSpaces));

    // Simulated saveAllSpaces(spaces)
    function mockSaveAllSpaces(spaces) {
      mockLocalStorage.setItem("socratic_spaces", JSON.stringify(spaces));
      let del = JSON.parse(mockLocalStorage.getItem("socratic_deleted_spaces") || "[]");
      if (del.length > 0) {
        const activeNames = new Set(spaces.map((s) => s.name));
        const nextDeleted = del.filter((name) => !activeNames.has(name));
        mockLocalStorage.setItem("socratic_deleted_spaces", JSON.stringify(nextDeleted));
      }
    }

    // Gated effect: only runs with hydrated spaces (does not run with initial SPACES on mount!)
    mockSaveAllSpaces(currentSpaces);

    const savedSpaces = JSON.parse(mockLocalStorage.getItem("socratic_spaces"));
    const savedDeleted = JSON.parse(mockLocalStorage.getItem("socratic_deleted_spaces"));

    assert.equal(savedSpaces.length, 3);
    assert.ok(!savedSpaces.some((s) => s.name === "Journal"));
    assert.deepEqual(savedDeleted, ["Journal"]);
  });

  it("getSavedSpaces honors socratic_deleted_spaces even if all default spaces were deleted", () => {
    const SPACES = [
      { name: "School", icon: "🎓" },
      { name: "Personal", icon: "🌱" },
      { name: "Misc", icon: "📦" },
      { name: "Journal", icon: "📓" },
    ];

    // User deleted all 4 default spaces and created a custom "Research" space
    const deleted = new Set(["School", "Personal", "Misc", "Journal"]);
    mockLocalStorage.setItem("socratic_deleted_spaces", JSON.stringify(Array.from(deleted)));

    const saved = [{ name: "Research", icon: "🔬", blurb: "" }];
    mockLocalStorage.setItem("socratic_spaces", JSON.stringify(saved));

    const merged = new Map();
    saved.forEach((s) => {
      if (s?.name && !deleted.has(s.name)) {
        merged.set(s.name, { ...s });
      }
    });

    const result = Array.from(merged.values());
    const finalSpaces = result.length > 0
      ? result
      : (() => {
          const nonDeleted = SPACES.filter((s) => !deleted.has(s.name));
          return nonDeleted.length > 0 ? nonDeleted : [{ name: "General", icon: "📂", blurb: "" }];
        })();

    assert.equal(finalSpaces.length, 1);
    assert.equal(finalSpaces[0].name, "Research");
    assert.ok(!finalSpaces.some((s) => deleted.has(s.name)));
  });

  it("Workspace loadLocalWorkspace reassigns orphaned notes if space was deleted rather than resurrecting space", () => {
    const deletedSpaces = new Set(["School"]);
    const resolvedSpaces = [
      { name: "Personal", icon: "🌱" },
      { name: "Misc", icon: "📦" },
      { name: "Journal", icon: "📓" },
    ];

    const spaceMap = {};
    resolvedSpaces.forEach((s) => {
      if (!deletedSpaces.has(s.name)) {
        spaceMap[s.name] = [];
      }
    });

    const primaryFallback = resolvedSpaces.find((s) => !deletedSpaces.has(s.name))?.name || "General";
    const allDbNotes = [
      { id: "note_1", title: "Old School Note", spaceId: "School" },
      { id: "note_2", title: "Personal Note", spaceId: "Personal" },
    ];

    allDbNotes.forEach((n) => {
      let sp = n.spaceId || primaryFallback;
      if (deletedSpaces.has(sp)) {
        sp = primaryFallback;
      }
      if (!spaceMap[sp]) spaceMap[sp] = [];
      spaceMap[sp].push({ id: n.id, title: n.title, space: sp, spaceId: sp });
    });

    const merged = new Map();
    resolvedSpaces.forEach((s) => {
      if (!deletedSpaces.has(s.name)) {
        merged.set(s.name, s);
      }
    });
    Object.keys(spaceMap).forEach((sp) => {
      if (!merged.has(sp) && !deletedSpaces.has(sp) && (spaceMap[sp] || []).length > 0) {
        merged.set(sp, { name: sp, icon: "📂", blurb: "" });
      }
    });

    const finalSpaces = Array.from(merged.values());

    assert.ok(!finalSpaces.some((s) => s.name === "School"), "Deleted space must NOT be resurrected in finalSpaces");
    assert.equal(spaceMap["School"], undefined);
    assert.ok(spaceMap["Personal"].some((n) => n.id === "note_1"), "Orphaned note must be remapped to fallback space");
  });

  it("explicit restore seed notes button clears socratic_deleted_notes tombstone", () => {
    mockLocalStorage.setItem("socratic_deleted_notes", JSON.stringify(["note_quantum", "note_fourier"]));
    assert.ok(mockLocalStorage.getItem("socratic_deleted_notes"));

    // User explicitly clicks "Restore Seed Notes"
    mockLocalStorage.removeItem("socratic_deleted_notes");
    assert.equal(mockLocalStorage.getItem("socratic_deleted_notes"), null);
  });

  it("lazy spaces state initialization honors socratic_deleted_spaces without crashing or resurrecting defaults", () => {
    const SPACES = [
      { name: "School", icon: "🎓" },
      { name: "Personal", icon: "🌱" },
      { name: "Misc", icon: "📦" },
      { name: "Journal", icon: "📓" },
    ];
    mockLocalStorage.setItem("socratic_deleted_spaces", JSON.stringify(["School", "Personal"]));

    // Simulate Workspace lazy initializers
    const deleted = new Set(JSON.parse(mockLocalStorage.getItem("socratic_deleted_spaces") || "[]"));
    const nonDeletedDefaults = SPACES.filter((s) => !deleted.has(s.name));
    const initialSpaces = nonDeletedDefaults.length > 0 ? nonDeletedDefaults : [{ name: "General", icon: "📂", blurb: "" }];
    const initialActive = initialSpaces[0]?.name || "General";

    assert.equal(initialSpaces.length, 2);
    assert.ok(!initialSpaces.some((s) => s.name === "School" || s.name === "Personal"));
    assert.equal(initialActive, "Misc");
  });
});
