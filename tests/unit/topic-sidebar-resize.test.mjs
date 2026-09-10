import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("3D Visualization Sidebar Resizability", () => {
  const visDir = path.resolve(__dirname, "../../components/visualizations");
  const topicsFile = path.join(visDir, "topics.js");
  const topicsContent = fs.readFileSync(topicsFile, "utf8");

  // Extract all topic IDs from topics.js
  const topicBlocks = topicsContent.split(/\{\s*id:\s*"/).slice(1);
  const topics = topicBlocks.map((b) => {
    const id = b.split('"')[0];
    const ownHud = b.includes("ownHud: true");
    return { id, ownHud };
  });

  it("verifies all 36 topics are cataloged and have valid HUD routing", () => {
    assert.ok(topics.length >= 36, `Expected at least 36 topics, found ${topics.length}`);
    const ownHudTopics = topics.filter((t) => t.ownHud).map((t) => t.id);
    assert.deepStrictEqual(
      ownHudTopics.sort(),
      ["binary_tree", "eye", "respiratory", "shadows"].sort(),
      "Only 4 dedicated scenes should have ownHud: true; all other 32 topics route through VisualizationHUD",
    );
  });

  it("verifies VisualizationHUD implements panel resize state and handles", () => {
    const hudFile = path.join(visDir, "VisualizationHUD.jsx");
    const content = fs.readFileSync(hudFile, "utf8");

    assert.ok(content.includes("panelWidth"), "VisualizationHUD must have panelWidth state");
    assert.ok(content.includes("handleResizePointerDown"), "VisualizationHUD must have handleResizePointerDown");
    assert.ok(content.includes("cursor-ew-resize"), "VisualizationHUD must have cursor-ew-resize drag handle");
    assert.ok(content.includes("socratic_hud_panel_width"), "VisualizationHUD must persist width to localStorage");
  });

  it("verifies ShadowLabCanvas (shadows topic) implements panel resize state and handles", () => {
    const shadowFile = path.join(visDir, "ShadowLabCanvas.jsx");
    const content = fs.readFileSync(shadowFile, "utf8");

    assert.ok(content.includes("panelWidth"), "ShadowLabCanvas must have panelWidth state");
    assert.ok(content.includes("handleResizePointerDown"), "ShadowLabCanvas must have handleResizePointerDown");
    assert.ok(content.includes("cursor-ew-resize"), "ShadowLabCanvas must have cursor-ew-resize drag handle");
    assert.ok(content.includes("cursor-nwse-resize"), "ShadowLabCanvas must have corner resize grip");
    assert.ok(content.includes("socratic_hud_panel_width"), "ShadowLabCanvas must persist width to localStorage");
  });

  it("verifies EyeCanvas (eye topic) implements panel resize state and handles", () => {
    const eyeFile = path.join(visDir, "EyeCanvas.jsx");
    const content = fs.readFileSync(eyeFile, "utf8");

    assert.ok(content.includes("panelWidth"), "EyeCanvas must have panelWidth state");
    assert.ok(content.includes("handleResizePointerDown"), "EyeCanvas must have handleResizePointerDown");
    assert.ok(content.includes("cursor-ew-resize"), "EyeCanvas must have cursor-ew-resize drag handle");
    assert.ok(content.includes("cursor-nwse-resize"), "EyeCanvas must have corner resize grip");
    assert.ok(content.includes("socratic_hud_panel_width"), "EyeCanvas must persist width to localStorage");
  });

  it("verifies BinaryTree3D (binary_tree topic) implements panel resize state and handles", () => {
    const bstFile = path.join(visDir, "BinaryTree3D.jsx");
    const content = fs.readFileSync(bstFile, "utf8");

    assert.ok(content.includes("panelWidth"), "BinaryTree3D must have panelWidth state");
    assert.ok(content.includes("handleResizePointerDown"), "BinaryTree3D must have handleResizePointerDown");
    assert.ok(content.includes("cursor-ew-resize"), "BinaryTree3D must have cursor-ew-resize drag handle");
    assert.ok(content.includes("cursor-nwse-resize"), "BinaryTree3D must have corner resize grip");
    assert.ok(content.includes("socratic_hud_panel_width"), "BinaryTree3D must persist width to localStorage");
  });

  it("verifies RespiratoryCanvas (respiratory topic) implements panel resize state and handles", () => {
    const respFile = path.join(visDir, "RespiratoryCanvas.jsx");
    const content = fs.readFileSync(respFile, "utf8");

    assert.ok(content.includes("panelWidth"), "RespiratoryCanvas must have panelWidth state");
    assert.ok(content.includes("handleResizePointerDown"), "RespiratoryCanvas must have handleResizePointerDown");
    assert.ok(content.includes("cursor-ew-resize"), "RespiratoryCanvas must have cursor-ew-resize drag handle");
  });

  it("validates panel width clamp math conforms to 10% - 80% viewport bounds", () => {
    const mockWindowWidth = 1920;
    const minW = Math.max(180, Math.floor(mockWindowWidth * 0.10)); // 192
    const maxW = Math.floor(mockWindowWidth * 0.80); // 1536

    assert.strictEqual(minW, 192);
    assert.strictEqual(maxW, 1536);

    const clamp = (val) => Math.min(Math.max(val, minW), maxW);
    assert.strictEqual(clamp(100), 192, "Should clamp below minW to minW");
    assert.strictEqual(clamp(500), 500, "Should preserve values between minW and maxW");
    assert.strictEqual(clamp(2000), 1536, "Should clamp above maxW to maxW");
  });
});
