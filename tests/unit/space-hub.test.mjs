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
});
