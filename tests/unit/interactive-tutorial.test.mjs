import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { TUTORIAL_STEPS_META, ALL_19_BLOCKS } from "../../lib/tutorialData.js";

describe("Interactive Onboarding Tutorial Architecture & Feature Registry", () => {
  it("defines exactly 9 comprehensive tutorial steps covering all core pillars", () => {
    assert.equal(TUTORIAL_STEPS_META.length, 9, "Tutorial must define exactly 9 comprehensive steps");

    const expectedStepIds = [
      "philosophy",
      "editor",
      "ai_suite",
      "quizzes",
      "spacehub",
      "visualizations",
      "timers",
      "websaver",
      "shortcuts",
    ];

    expectedStepIds.forEach((id, index) => {
      const step = TUTORIAL_STEPS_META[index];
      assert.equal(step.id, id, `Step ${index} must have id "${id}"`);
      assert.ok(step.category && step.category.trim().length > 0, `Step ${id} must have a non-empty category`);
      assert.ok(step.shortTitle && step.shortTitle.trim().length > 0, `Step ${id} must have a shortTitle`);
      assert.ok(step.badgeEmoji && step.badgeEmoji.trim().length > 0, `Step ${id} must have a badgeEmoji`);
      assert.ok(step.title && step.title.trim().length > 0, `Step ${id} must have a non-empty title`);
      assert.ok(step.description && step.description.trim().length > 0, `Step ${id} must have a descriptive body`);
    });
  });

  it("covers all 19 Notion-style editor block types in ALL_19_BLOCKS", () => {
    assert.equal(ALL_19_BLOCKS.length, 19, "ALL_19_BLOCKS must define all 19 supported block types");

    const expectedBlocks = [
      "text",
      "h1",
      "h2",
      "h3",
      "h4",
      "bullet",
      "number",
      "todo",
      "toggle",
      "callout",
      "columns",
      "table",
      "quote",
      "divider",
      "math",
      "inlinemath",
      "code",
      "media",
      "site",
    ];

    const definedTypes = ALL_19_BLOCKS.map((b) => b.type);
    expectedBlocks.forEach((type) => {
      assert.ok(definedTypes.includes(type), `ALL_19_BLOCKS must include block type "${type}"`);
    });

    ALL_19_BLOCKS.forEach((b) => {
      assert.ok(b.cat, `Block ${b.type} must define a category`);
      assert.ok(b.name, `Block ${b.type} must define a human-readable name`);
      assert.ok(b.syntax, `Block ${b.type} must document syntax/shortcut`);
      assert.ok(b.desc, `Block ${b.type} must document description`);
    });
  });

  it("ensures step 1 highlights active recall and 100% local-first IndexedDB", () => {
    const step1 = TUTORIAL_STEPS_META.find((s) => s.id === "philosophy");
    assert.ok(step1, "Step 1 must exist");
    assert.ok(
      step1.description.toLowerCase().includes("rereading") ||
      step1.description.toLowerCase().includes("active"),
      "Step 1 must emphasize active retrieval over passive rereading"
    );
  });

  it("ensures step 3 covers AI Tutor, structured Explain, and diagnostic quizzes without Feynman dialogue", () => {
    const step3 = TUTORIAL_STEPS_META.find((s) => s.id === "ai_suite");
    assert.ok(step3, "Step 3 must exist");
    assert.ok(step3.title.includes("AI Tutor"), "Step 3 title must include AI Tutor");
    assert.ok(step3.title.includes("Explain"), "Step 3 title must include Explain");
    assert.ok(step3.title.includes("Quizzes"), "Step 3 title must include Quizzes");
    assert.ok(!step3.description.toLowerCase().includes("feynman"), "Step 3 description must not mention Feynman");
  });

  it("ensures step 4 covers Quizzes Studio and the 7 diagnostic question types", () => {
    const step4 = TUTORIAL_STEPS_META.find((s) => s.id === "quizzes");
    assert.ok(step4, "Step 4 must exist");
    assert.ok(step4.title.includes("Quizzes Studio"), "Step 4 title must mention Quizzes Studio");
    assert.ok(step4.title.includes("7 Question Types"), "Step 4 title must mention 7 Question Types");
  });

  it("ensures step 5 covers Space Hub and syllabus document grounding", () => {
    const step5 = TUTORIAL_STEPS_META.find((s) => s.id === "spacehub");
    assert.ok(step5, "Step 5 must exist");
    assert.ok(step5.title.includes("Space Hub"), "Step 5 title must mention Space Hub");
    assert.ok(step5.title.includes("Syllabus"), "Step 5 title must mention Syllabus");
  });

  it("ensures step 6 covers 50+ 3D simulations across all 5 STEM domains", () => {
    const step6 = TUTORIAL_STEPS_META.find((s) => s.id === "visualizations");
    assert.ok(step6, "Step 6 must exist");
    assert.ok(step6.title.includes("50+"), "Step 6 title must mention 50+ simulations");
    assert.ok(step6.title.includes("5 STEM Domains"), "Step 6 title must mention 5 STEM Domains");
  });

  it("ensures step 7 covers Pomodoro rhythm and multi-timer HUD", () => {
    const step7 = TUTORIAL_STEPS_META.find((s) => s.id === "timers");
    assert.ok(step7, "Step 7 must exist");
    assert.ok(step7.title.includes("Pomodoro"), "Step 7 title must mention Pomodoro");
    assert.ok(step7.title.includes("Multi-Timer HUD"), "Step 7 title must mention Multi-Timer HUD");
    assert.ok(
      step7.description.includes("25m") && step7.description.includes("5m"),
      "Step 7 must document 25m focus and 5m short break intervals"
    );
  });

  it("ensures step 8 covers Web Saver and Netscape HTML bookmarks", () => {
    const step8 = TUTORIAL_STEPS_META.find((s) => s.id === "websaver");
    assert.ok(step8, "Step 8 must exist");
    assert.ok(step8.title.includes("Web Saver"), "Step 8 title must mention Web Saver");
    assert.ok(step8.description.includes("Netscape HTML"), "Step 8 must document Netscape HTML bookmarks");
  });

  it("ensures step 9 covers power shortcuts, bulk actions, and 24h trash", () => {
    const step9 = TUTORIAL_STEPS_META.find((s) => s.id === "shortcuts");
    assert.ok(step9, "Step 9 must exist");
    assert.ok(step9.title.includes("Power Shortcuts"), "Step 9 title must mention Power Shortcuts");
    assert.ok(step9.title.includes("24h Auto-Purge Trash"), "Step 9 title must mention 24h Auto-Purge Trash");
  });
});
