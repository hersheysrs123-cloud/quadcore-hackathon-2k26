import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("TopicSelectorDropdown & 3D Top Bar Clean-up", () => {
  const visDir = path.resolve(__dirname, "../../components/visualizations");
  const topicsFile = path.join(visDir, "topics.js");
  const dropdownFile = path.join(visDir, "TopicSelectorDropdown.jsx");
  const threeDViewFile = path.resolve(__dirname, "../../components/ThreeDView.jsx");
  const visPageFile = path.resolve(__dirname, "../../app/visualizations/page.jsx");

  it("verifies TopicSelectorDropdown.jsx exists and has subject grouping, search, and click-outside logic", () => {
    assert.ok(fs.existsSync(dropdownFile), "TopicSelectorDropdown.jsx must exist");
    const content = fs.readFileSync(dropdownFile, "utf8");

    assert.ok(content.includes("groupedSections"), "Must group topics into subject sections");
    assert.ok(content.includes("SUBJECTS"), "Must filter subjects");
    assert.ok(content.includes("handleClickOutside"), "Must handle click outside to close dropdown");
    assert.ok(content.includes("Escape"), "Must handle Escape key to close");
    assert.ok(content.includes("Search"), "Must include search input filter");
    assert.ok(content.includes('role="listbox"'), "Must have accessible role listbox");
  });

  it("verifies all 35 topics are grouped under valid subject categories in topics.js", () => {
    const topicsContent = fs.readFileSync(topicsFile, "utf8");

    // Extract categories
    assert.ok(topicsContent.includes('id: "physics"'), "Must have physics category");
    assert.ok(topicsContent.includes('id: "chemistry"'), "Must have chemistry category");
    assert.ok(topicsContent.includes('id: "biology"'), "Must have biology category");
    assert.ok(topicsContent.includes('id: "cs"'), "Must have cs category");
    assert.ok(topicsContent.includes('id: "math"'), "Must have math category");

    // Extract all topic IDs and their categories from TOPICS array
    const topicsSection = topicsContent.split("export const TOPICS = [")[1];
    const topicBlocks = topicsSection.split(/\{\s*id:\s*"/).slice(1);
    const validSubjectIds = ["physics", "chemistry", "biology", "cs", "math"];
    const counts = { physics: 0, chemistry: 0, biology: 0, cs: 0, math: 0 };

    for (const block of topicBlocks) {
      const id = block.split('"')[0];
      const catMatch = block.match(/category:\s*"([^"]+)"/);
      assert.ok(catMatch, `Topic ${id} should have a category definition`);
      const category = catMatch[1];
      assert.ok(validSubjectIds.includes(category), `Topic ${id} has invalid category: ${category}`);
      counts[category] = (counts[category] || 0) + 1;
    }

    const totalTopics = Object.values(counts).reduce((a, b) => a + b, 0);
    assert.strictEqual(totalTopics, 35, "Must have exactly 35 topics");
    assert.strictEqual(counts.physics, 17, "Must have 17 physics topics");
    assert.strictEqual(counts.chemistry, 7, "Must have 7 chemistry topics");
    assert.strictEqual(counts.biology, 6, "Must have 6 biology topics");
    assert.strictEqual(counts.cs, 2, "Must have 2 cs topics");
    assert.strictEqual(counts.math, 3, "Must have 3 math topics");
  });

  it("verifies ThreeDView.jsx integrates TopicSelectorDropdown and removes legacy horizontal scroll strip", () => {
    const content = fs.readFileSync(threeDViewFile, "utf8");

    assert.ok(content.includes("TopicSelectorDropdown"), "ThreeDView must import and render TopicSelectorDropdown");
    assert.ok(!content.includes("Category & Topic Quick Switch Strip"), "ThreeDView must not contain legacy category strip");
    assert.ok(!content.includes("overflow-x-auto flex items-center justify-between gap-2 no-scrollbar"), "Legacy scroll strip styling removed");
  });

  it("verifies app/visualizations/page.jsx integrates TopicSelectorDropdown and removes legacy horizontal scroll strip", () => {
    const content = fs.readFileSync(visPageFile, "utf8");

    assert.ok(content.includes("TopicSelectorDropdown"), "page.jsx must import and render TopicSelectorDropdown");
    assert.ok(!content.includes("Category & Topic Quick Switch Strip"), "page.jsx must not contain legacy category strip");
    assert.ok(!content.includes("overflow-x-auto flex items-center justify-between gap-2 no-scrollbar"), "Legacy scroll strip styling removed");
  });
});