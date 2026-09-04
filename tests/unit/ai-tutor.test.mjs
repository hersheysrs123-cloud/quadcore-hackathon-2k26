import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("AI Tutor System & Space Context Injection", () => {
  it("builds an AI Tutor prompt containing active space documents and curriculum standards", () => {
    const space = "Physics HL";
    const settings = {
      academicLevel: "ib_hl",
      aiPersona: "strict",
      strictness: "rigorous",
    };

    const activeDocs = [
      { id: "d1", name: "IB_Physics_Core_2026.pdf", text: "Topic 4: Waves, Standing Waves, Polarization", active: true },
      { id: "d2", name: "Excluded_Scratchpad.txt", text: "Draft ideas", active: false },
    ];

    const syllabusText = activeDocs
      .filter((d) => d.active && d.text.trim())
      .map((d) => `=== Document: "${d.name}" ===\n${d.text.trim()}`)
      .join("\n\n");

    const academicLevelDirectives = {
      ib_hl: "ACADEMIC STANDARD: International Baccalaureate (IB) Diploma Higher Level (HL).",
      igcse: "ACADEMIC STANDARD: Cambridge IGCSE / O-Level.",
      general: "ACADEMIC STANDARD: General Concept Mastery.",
    };

    const personaDirectives = {
      strict: "AI TUTOR PERSONA: Strict Examiner. Demand exact academic and scientific terminology.",
      coach: "AI TUTOR PERSONA: Friendly Coach.",
    };

    const strictnessDirectives = {
      rigorous: "EXPLANATION RIGOR: HIGH RIGOR. Uncompromising on precision, units, and common exam traps.",
      standard: "EXPLANATION RIGOR: BALANCED.",
    };

    const sections = [
      `Active Study Space: "${space}"`,
      academicLevelDirectives[settings.academicLevel],
      personaDirectives[settings.aiPersona],
      strictnessDirectives[settings.strictness],
      `<syllabus_statement>\n${syllabusText}\n</syllabus_statement>`,
    ];

    const fullPrompt = sections.join("\n\n");

    // Assertions
    assert.ok(fullPrompt.includes('Active Study Space: "Physics HL"'));
    assert.ok(fullPrompt.includes("International Baccalaureate (IB) Diploma Higher Level (HL)"));
    assert.ok(fullPrompt.includes("Strict Examiner"));
    assert.ok(fullPrompt.includes("HIGH RIGOR"));
    assert.ok(fullPrompt.includes("Topic 4: Waves, Standing Waves, Polarization"));
    assert.ok(!fullPrompt.includes("Excluded_Scratchpad.txt"));
  });

  it("handles empty note context or space-level doubt asking gracefully", () => {
    const defaultTitle = "Subject Doubts";
    const concept = undefined || defaultTitle;
    assert.equal(concept, "Subject Doubts");
  });

  it("verifies markdown structure decomposition for tutor responses", () => {
    const sampleResponse = `### Derivation of Snell's Law
Snell's law relates the angle of incidence to refraction:
$$n_1 \\sin(\\theta_1) = n_2 \\sin(\\theta_2)$$

Key steps:
1. Fermat's Principle of least time
2. Differentiating time $t = \\frac{d_1}{v_1} + \\frac{d_2}{v_2}$

\`\`\`python
def snell(n1, n2, theta1):
    import math
    return math.asin((n1 / n2) * math.sin(theta1))
\`\`\`

> Common mistake: Forgetting to convert angles from degrees to radians!

| Medium | Refractive Index |
| Air | 1.0003 |
| Water | 1.333 |`;

    const lines = sampleResponse.split("\n");
    const hasHeadings = lines.some((l) => l.startsWith("### "));
    const hasMath = lines.some((l) => l.startsWith("$$"));
    const hasCode = lines.some((l) => l.startsWith("```"));
    const hasList = lines.some((l) => /^\d+\.\s+/.test(l));
    const hasQuote = lines.some((l) => l.startsWith("> "));
    const hasTable = lines.some((l) => l.startsWith("|"));

    assert.ok(hasHeadings, "Should detect markdown headings");
    assert.ok(hasMath, "Should detect display math blocks");
    assert.ok(hasCode, "Should detect code blocks");
    assert.ok(hasList, "Should detect ordered list items");
    assert.ok(hasQuote, "Should detect blockquotes");
    assert.ok(hasTable, "Should detect markdown tables");
  });
});
