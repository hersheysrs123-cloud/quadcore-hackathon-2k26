import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  BACKUP_FORMAT,
  BACKUP_TABLE_NAMES,
  buildBackup,
  mergeSpaceLists,
  parseBackup,
  planImport,
} from "../../lib/backup.js";

const workspace = () => ({
  notes: [
    { id: "n_parent", spaceId: "School", title: "Parent", parentId: null, blocks: [{ id: "b1", type: "page", pageId: "n_child" }] },
    { id: "n_child", spaceId: "School", title: "Child", parentId: "n_parent", blocks: [] },
    { id: "n_lab", spaceId: "Lab", title: "Custom space note", blocks: [] },
  ],
  trash: [{ id: "n_old", spaceId: "School", parentId: "n_parent", deletedAt: 1 }],
  studySessions: [{ id: "s1", noteId: "n_child", space: "School", score: 80 }],
  calendarEvents: [{ id: "e1", space: "School", date: "2026-10-16" }],
  quizzes: [{ id: "q1", spaceId: "School", noteId: "n_parent", noteIds: ["n_parent", "n_child"] }],
  quizTrash: [{ id: "q_old", spaceId: "School", noteId: "n_child", deletedAt: "x" }],
  spaceDocuments: [{ id: "doc1", spaceId: "School", name: "syllabus.pdf" }],
  spaceSettings: [{ spaceId: "School", academicLevel: "ib_hl" }, { spaceId: "Lab", academicLevel: "olympiad" }],
  poems: [{ id: "p1", spaceId: "School", title: "Ozymandias" }],
  folders: [{ id: "f1", spaceId: "Global", parentId: null }],
  bookmarks: [{ id: "bm1", spaceId: "Global", folderId: "f1", url: "https://example.com" }],
  alarms: [{ id: "a1", time: "07:00" }],
  settings: [
    { key: "gemini_api_key", value: "secret" },
    { key: "editor_click_to_append", value: "true" },
  ],
});
const spaces = [
  { name: "School", icon: "🎓", blurb: "" },
  { name: "Lab", icon: "🧪", blurb: "Experiments" },
];

describe("buildBackup", () => {
  it("carries every store and the space list in an all-spaces backup", () => {
    const b = buildBackup(workspace(), { targetSpace: "All", spaces });
    assert.equal(b.format, BACKUP_FORMAT);
    assert.deepEqual(Object.keys(b.data).sort(), [...BACKUP_TABLE_NAMES].sort());
    for (const name of ["quizzes", "quizTrash", "spaceDocuments", "spaceSettings", "poems", "settings"]) {
      assert.ok(b.data[name].length > 0, `${name} missing`);
    }
    assert.deepEqual(b.spaces.map((s) => s.name), ["School", "Lab"]);
  });

  it("never writes the Gemini API key", () => {
    const b = buildBackup(workspace(), { targetSpace: "All", spaces });
    assert.deepEqual(b.data.settings.map((s) => s.key), ["editor_click_to_append"]);
    assert.doesNotMatch(JSON.stringify(b), /secret/);
  });

  it("keeps only one space's rows, and no workspace-wide stores, for a one-space backup", () => {
    const b = buildBackup(workspace(), { targetSpace: "Lab", spaces });
    assert.equal(b.targetSpace, "Lab");
    assert.deepEqual(b.data.notes.map((n) => n.id), ["n_lab"]);
    assert.deepEqual(b.data.spaceSettings.map((s) => s.spaceId), ["Lab"]);
    for (const name of ["folders", "bookmarks", "alarms", "settings"]) assert.equal(b.data[name], undefined);
    assert.deepEqual(b.spaces, [{ name: "Lab", icon: "🧪", blurb: "Experiments" }]);
  });
});

describe("parseBackup", () => {
  it("rejects non-JSON and foreign JSON", () => {
    assert.throws(() => parseBackup("nope"), /not a JSON object/);
    assert.throws(() => parseBackup("[]"), /not a JSON object/);
    assert.throws(() => parseBackup('{"format":"other"}'), /Unrecognized/);
    assert.equal(parseBackup('{"format":"socratic-backup-v1","data":{}}').format, "socratic-backup-v1");
  });
});

describe("planImport — restoring to the original spaces", () => {
  const backup = buildBackup(workspace(), { targetSpace: "All", spaces });
  const existing = { notes: new Set(["n_parent"]) };

  it("keeps ids so the backup's copy replaces what is here", () => {
    const plan = planImport(backup, { targetSpace: "Original", existing });
    assert.deepEqual(plan.rows.notes.map((n) => n.id), ["n_parent", "n_child", "n_lab"]);
    assert.equal(plan.rows.notes[1].parentId, "n_parent");
    assert.equal(plan.clear, null);
  });

  it("restores every store, including the workspace-wide ones", () => {
    const plan = planImport(backup, { targetSpace: "Original" });
    for (const name of BACKUP_TABLE_NAMES) assert.ok(plan.counts[name] > 0, `${name} not restored`);
  });

  it("brings back custom spaces with their icon", () => {
    const plan = planImport(backup, { targetSpace: "Original" });
    assert.deepEqual(plan.spaces.find((s) => s.name === "Lab"), { name: "Lab", icon: "🧪", blurb: "Experiments" });
  });

  it("still reads a v1 backup, and makes a space for every note it holds", () => {
    const v1 = {
      format: "socratic-backup-v1",
      targetSpace: "All",
      data: { notes: [{ id: "x", spaceId: "Old custom" }], trash: [], alarms: [] },
    };
    const plan = planImport(v1, { targetSpace: "Original" });
    assert.equal(plan.counts.notes, 1);
    assert.deepEqual(plan.spaces, [{ name: "Old custom", icon: "📂", blurb: "" }]);
    assert.equal(plan.rows.quizzes, undefined);
  });

  it("drops rows that are not records", () => {
    const bad = { format: BACKUP_FORMAT, data: { notes: [null, [], { title: "no id" }, { id: "" }, { id: "ok", spaceId: "School" }] } };
    assert.deepEqual(planImport(bad).rows.notes.map((n) => n.id), ["ok"]);
  });

  it("ignores an API key inside a hand-edited backup", () => {
    const sneaky = { format: BACKUP_FORMAT, data: { settings: [{ key: "gemini_api_key", value: "x" }, { key: "a", value: "1" }] } };
    assert.deepEqual(planImport(sneaky).rows.settings.map((s) => s.key), ["a"]);
  });
});

describe("planImport — copying into another space", () => {
  const backup = buildBackup(workspace(), { targetSpace: "School", spaces });
  // The same backup going back into this workspace, so every id collides.
  const existing = {
    notes: new Set(["n_parent", "n_child"]),
    trash: new Set(["n_old"]),
    studySessions: new Set(["s1"]),
    calendarEvents: new Set(["e1"]),
    quizzes: new Set(["q1"]),
    quizTrash: new Set(["q_old"]),
    spaceDocuments: new Set(["doc1"]),
    poems: new Set(["p1"]),
    spaceSettings: new Set(["School"]),
  };
  const plan = planImport(backup, { targetSpace: "Personal", existing, idSuffix: "T" });

  it("never reuses an id that is already here, so the originals stay put", () => {
    for (const [name, rows] of Object.entries(plan.rows)) {
      for (const r of rows) {
        if (name === "spaceSettings") continue;
        assert.ok(!existing[name]?.has(r.id), `${name} ${r.id} would overwrite the original`);
      }
    }
    assert.equal(plan.rows.notes[0].id, "n_parent_cT");
  });

  it("moves every copied row into the target space", () => {
    assert.ok(plan.rows.notes.every((n) => n.spaceId === "Personal" && n.space === "Personal"));
    assert.ok(plan.rows.quizzes.every((q) => q.spaceId === "Personal"));
    assert.ok(plan.rows.studySessions.every((s) => s.space === "Personal"));
    assert.ok(plan.rows.poems.every((p) => p.spaceId === "Personal"));
  });

  it("keeps sub-pages, page blocks, quizzes and sessions pointing at the copies", () => {
    const [parent, child] = plan.rows.notes;
    assert.equal(child.parentId, parent.id);
    assert.equal(parent.blocks[0].pageId, child.id);
    assert.equal(plan.rows.trash[0].parentId, parent.id);
    assert.deepEqual(plan.rows.quizzes[0].noteIds, [parent.id, child.id]);
    assert.equal(plan.rows.quizzes[0].noteId, parent.id);
    assert.equal(plan.rows.quizTrash[0].noteId, child.id);
    assert.equal(plan.rows.studySessions[0].noteId, child.id);
  });

  it("keeps an id that is free, and leaves the original backup untouched", () => {
    const fresh = planImport(backup, { targetSpace: "Personal", existing: {}, idSuffix: "T" });
    assert.equal(fresh.rows.notes[0].id, "n_parent");
    assert.equal(backup.data.notes[0].spaceId, "School");
    assert.equal(backup.data.notes[0].blocks[0].pageId, "n_child");
  });

  it("does not copy workspace-wide stores into a space", () => {
    const all = buildBackup(workspace(), { targetSpace: "All", spaces });
    const p = planImport(all, { targetSpace: "Personal" });
    for (const name of ["folders", "bookmarks", "alarms", "settings"]) assert.equal(p.rows[name], undefined);
  });

  it("keeps the target space's own AI settings unless overwriting", () => {
    const keep = planImport(backup, { targetSpace: "Personal", existing: { spaceSettings: new Set(["Personal"]) } });
    assert.deepEqual(keep.rows.spaceSettings, []);
    const replace = planImport(backup, { targetSpace: "Personal", overwrite: true, existing: { spaceSettings: new Set(["Personal"]) } });
    assert.deepEqual(replace.rows.spaceSettings.map((s) => s.spaceId), ["Personal"]);
  });

  it("lists the target space so it exists after the import", () => {
    assert.deepEqual(plan.spaces.map((s) => s.name), ["Personal"]);
  });
});

describe("planImport — overwrite scope", () => {
  it("clears only the target space when copying into one", () => {
    const b = buildBackup(workspace(), { targetSpace: "All", spaces });
    assert.equal(planImport(b, { targetSpace: "Lab", overwrite: true }).clear.scope, "Lab");
  });

  it("clears only the backup's space when restoring a one-space backup", () => {
    const b = buildBackup(workspace(), { targetSpace: "School", spaces });
    const plan = planImport(b, { targetSpace: "Original", overwrite: true });
    assert.equal(plan.clear.scope, "School");
  });

  it("clears whole stores only for an all-spaces restore, and only stores the file has", () => {
    const v1 = { format: "socratic-backup-v1", targetSpace: "All", data: { notes: [], trash: [] } };
    assert.deepEqual(planImport(v1, { targetSpace: "Original", overwrite: true }).clear, { scope: null, tables: ["notes", "trash"] });
  });
});

describe("mergeSpaceLists", () => {
  it("adds missing spaces after the local ones and never replaces a local one", () => {
    const merged = mergeSpaceLists([{ name: "School", icon: "🎓" }], [{ name: "School", icon: "📂" }, { name: "Lab", icon: "🧪" }]);
    assert.deepEqual(merged, [{ name: "School", icon: "🎓" }, { name: "Lab", icon: "🧪" }]);
  });
});
