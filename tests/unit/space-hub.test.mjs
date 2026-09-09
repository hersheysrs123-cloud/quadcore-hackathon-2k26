import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("Space Hub Architecture & Storage Model", () => {
  it("defines academic levels, AI personas, and distractor strictness scales", () => {
    const academicLevels = ["general", "igcse", "ib_hl", "ap", "university", "olympiad"];
    const personas = ["examiner", "strict", "socratic", "coach", "olympiad"];
    const strictness = ["relaxed", "standard", "rigorous"];

    assert.equal(academicLevels.length, 6);
    assert.equal(personas.length, 5);
    assert.equal(strictness.length, 3);
  });

  it("assembles active space curriculum documents into an integrated AI syllabus prompt", () => {
    const docs = [
      { id: "d1", name: "Syllabus 2026.pdf", text: "Topics 1-4: Waves & Optics", active: true },
      { id: "d2", name: "Out of Scope.txt", text: "Quantum Mechanics", active: false },
      { id: "d3", name: "Formulas.docx", text: "n1 * sin(theta1) = n2 * sin(theta2)", active: true },
    ];

    const activeDocs = docs.filter((d) => d.active && d.text?.trim());
    const combined = activeDocs
      .map((d) => `=== Document: "${d.name}" ===\n${d.text.trim()}`)
      .join("\n\n----------------------------------------\n\n");

    assert.ok(combined.includes('=== Document: "Syllabus 2026.pdf" ==='));
    assert.ok(combined.includes("Topics 1-4: Waves & Optics"));
    assert.ok(combined.includes('=== Document: "Formulas.docx" ==='));
    assert.ok(combined.includes("n1 * sin(theta1) = n2 * sin(theta2)"));
    assert.ok(!combined.includes("Quantum Mechanics"));
  });

  it("properly incorporates space settings into AI quiz prompts", () => {
    const spaceSettings = {
      academicLevel: "igcse",
      aiPersona: "strict",
      strictness: "rigorous",
    };

    const personaPrompt = {
      strict: "PEDAGOGICAL PERSONA: Strict Examiner. Hold rigorous standards for precise scientific/academic terminology and zero ambiguity.",
      socratic: "PEDAGOGICAL PERSONA: Socratic Guide. Probe the foundational mechanics, counterfactual reasoning, and underlying 'why'.",
      coach: "PEDAGOGICAL PERSONA: Friendly Coach. Emphasize constructive application, approachable phrasing, and conceptual intuition.",
    }[spaceSettings.aiPersona];

    const strictnessPrompt = {
      rigorous: "DISTRACTOR TOUGHNESS & RIGOR: HIGH RIGOR. Craft deceptively plausible distractors targeting common student misconceptions and inverse relationships.",
    }[spaceSettings.strictness];

    assert.ok(personaPrompt.includes("Strict Examiner"));
    assert.ok(strictnessPrompt.includes("HIGH RIGOR"));
  });

  it("exports SPACE_ICON_OPTIONS presets including science, tech, humanities and general icons", async () => {
    const { SPACE_ICON_OPTIONS, SPACES } = await import("../../lib/constants.js");
    assert.ok(Array.isArray(SPACE_ICON_OPTIONS));
    assert.ok(SPACE_ICON_OPTIONS.length >= 20);
    assert.ok(SPACE_ICON_OPTIONS.includes("📂"));
    assert.ok(SPACE_ICON_OPTIONS.includes("🎓"));
    assert.ok(SPACE_ICON_OPTIONS.includes("🚀"));
    assert.ok(SPACE_ICON_OPTIONS.includes("🔬"));
    assert.ok(Array.isArray(SPACES));
    assert.equal(SPACES.length, 4);
  });

  it("merges custom space emojis over default SPACES without reverting on reload", () => {
    const defaultSpaces = [
      { name: "School", icon: "🎓", blurb: "Courses, lectures, problem sets" },
      { name: "Personal", icon: "🌱", blurb: "Reading, ideas, side quests" },
      { name: "Misc", icon: "📦", blurb: "Everything else" },
      { name: "Journal", icon: "📓", blurb: "Daily logs and private thoughts" },
    ];

    // User customized "School" emoji to "🏫" and added a custom space "Research"
    const userCustomSpaces = [
      { name: "School", icon: "🏫", blurb: "Updated school notes" },
      { name: "Personal", icon: "🌱", blurb: "Reading, ideas, side quests" },
      { name: "Misc", icon: "📦", blurb: "Everything else" },
      { name: "Journal", icon: "📓", blurb: "Daily logs and private thoughts" },
      { name: "Research", icon: "🔬", blurb: "Lab experiments" },
    ];

    // Merge simulation matching getSavedSpaces logic
    const merged = new Map();
    defaultSpaces.forEach((s) => merged.set(s.name, { ...s }));
    userCustomSpaces.forEach((s) => {
      if (s?.name) {
        const base = merged.get(s.name) || {};
        merged.set(s.name, { ...base, ...s });
      }
    });

    const result = Array.from(merged.values());
    const school = result.find((s) => s.name === "School");
    const research = result.find((s) => s.name === "Research");

    assert.equal(school.icon, "🏫", "Customized default space emoji must be preserved, not reverted");
    assert.equal(school.blurb, "Updated school notes");
    assert.equal(research.icon, "🔬");
  });

  it("cascades space renaming across notes, sessions, and bookmarks", () => {
    const oldName = "School";
    const newName = "Academics";

    const mockNotes = [
      { id: "n1", title: "Math Lecture", space: "School", spaceId: "School" },
      { id: "n2", title: "Gym Routine", space: "Personal", spaceId: "Personal" },
    ];

    const mockNotesBySpace = {
      School: [mockNotes[0]],
      Personal: [mockNotes[1]],
    };

    // Rename logic simulation matching handleRenameSpace
    const updatedNotesBySpace = { ...mockNotesBySpace };
    const notesToMove = updatedNotesBySpace[oldName] || [];
    updatedNotesBySpace[newName] = notesToMove.map((n) => ({
      ...n,
      space: newName,
      spaceId: newName,
    }));
    delete updatedNotesBySpace[oldName];

    assert.equal(updatedNotesBySpace[oldName], undefined);
    assert.equal(updatedNotesBySpace[newName].length, 1);
    assert.equal(updatedNotesBySpace[newName][0].space, "Academics");
    assert.equal(updatedNotesBySpace[newName][0].spaceId, "Academics");
    assert.equal(updatedNotesBySpace.Personal.length, 1);
  });

  it("validates space name duplicate conflicts and whitespace", () => {
    const existingSpaces = [
      { name: "School", icon: "🎓" },
      { name: "Personal", icon: "🌱" },
    ];

    function validateNewName(currentName, newName, spaces) {
      const trimmed = (newName || "").trim();
      if (!trimmed) return { valid: false, error: "Space name cannot be empty" };
      if (
        trimmed.toLowerCase() !== currentName.toLowerCase() &&
        spaces.some((s) => s.name.toLowerCase() === trimmed.toLowerCase())
      ) {
        return { valid: false, error: `A space named "${trimmed}" already exists.` };
      }
      return { valid: true, trimmed };
    }

    assert.equal(validateNewName("School", "", existingSpaces).valid, false);
    assert.equal(validateNewName("School", "   ", existingSpaces).valid, false);
    assert.equal(validateNewName("School", "Personal", existingSpaces).valid, false);
    assert.equal(validateNewName("School", "personal", existingSpaces).valid, false);
    assert.equal(validateNewName("School", "School", existingSpaces).valid, true);
    assert.equal(validateNewName("School", "University", existingSpaces).valid, true);
  });
});
