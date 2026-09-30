// The cardiac scene ships a heart adapted from BodyParts3D (CC BY 4.0). The
// licence allows commercial use only with the credit and a note of changes,
// so these pin the credit to the file that ships, the GLB itself and the UI.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { HEART_MODEL_CREDIT } from "../../lib/heartCredits.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

describe("heart model credit", () => {
  it("names the source, the licence and the licensor's own credit line", () => {
    assert.equal(HEART_MODEL_CREDIT.source, "BodyParts3D");
    assert.equal(HEART_MODEL_CREDIT.license, "CC BY 4.0");
    assert.equal(HEART_MODEL_CREDIT.commercialUse, true);
    assert.match(HEART_MODEL_CREDIT.attribution, /BodyParts3D, © The Database Center for Life Science/);
    assert.match(HEART_MODEL_CREDIT.attribution, /Attribution 4\.0 International/);
    assert.ok(HEART_MODEL_CREDIT.changes.length > 40, "CC BY requires indicating the changes made");
  });

  it("is embedded in the GLB that ships", () => {
    const glb = fs.readFileSync(path.join(ROOT, "public/models/heart.glb"));
    assert.equal(glb.readUInt32LE(0), 0x46546c67, "not a GLB");
    const json = JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString("utf8"));
    assert.match(json.asset.copyright, /BodyParts3D/);
    assert.match(json.asset.copyright, /CC BY 4\.0/);
  });

  it("is shown by the scene", () => {
    const src = fs.readFileSync(path.join(ROOT, "components/visualizations/CardiacCycleCanvas.jsx"), "utf8");
    assert.match(src, /HEART_MODEL_CREDIT/);
    assert.match(src, /<HeartCredits \/>/);
  });
});

describe("arm model", () => {
  // The arm both nerve-and-muscle scenes draw is modelled in-house
  // (scripts/arm-model), so it must carry no third-party data and the scenes
  // need no Credits panel for it.
  const readGlb = () => {
    const glb = fs.readFileSync(path.join(ROOT, "public/models/arm.glb"));
    assert.equal(glb.readUInt32LE(0), 0x46546c67, "not a GLB");
    return JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString("utf8"));
  };
  const meshOf = (json, name) => json.meshes[json.nodes.find((n) => n.name === name).mesh];

  it("is our own model, not an adapted scan", () => {
    const json = readGlb();
    assert.match(json.asset.generator, /scripts\/arm-model/);
    assert.doesNotMatch(json.asset.copyright, /BodyParts3D/);
    const names = json.nodes.map((n) => n.name).sort();
    assert.deepEqual(names, ["biceps", "forearm", "girdle", "hand", "humerus", "muscles", "triceps"]);
  });

  it("carries the bend weights, fibre directions and morphs the shaders read", () => {
    const json = readGlb();
    for (const name of ["biceps", "triceps", "muscles"]) {
      const attrs = meshOf(json, name).primitives[0].attributes;
      assert.ok("_BEND" in attrs, `${name} has no _BEND`);
      assert.ok("_FIBRE" in attrs, `${name} has no _FIBRE`);
    }
    for (const name of ["hand", "muscles"]) {
      assert.ok("_SEG" in meshOf(json, name).primitives[0].attributes, `${name} has no _SEG (it would not follow the fingers)`);
    }
    const morph = (name) => meshOf(json, name).extras?.targetNames;
    assert.deepEqual(morph("biceps"), ["contract"]);
    assert.deepEqual(morph("triceps"), ["stretch"]);
    assert.deepEqual(morph("muscles"), ["flex"]);
    const src = fs.readFileSync(path.join(ROOT, "components/visualizations/arm-model.jsx"), "utf8");
    assert.match(src, /attribute vec4 _bend;/);
    assert.match(src, /attribute vec4 _seg;/);
  });

  it("is what both arm scenes draw, with no Credits panel", () => {
    for (const scene of ["ReflexArcCanvas", "AntagonisticMusclesCanvas"]) {
      const src = fs.readFileSync(path.join(ROOT, `components/visualizations/${scene}.jsx`), "utf8");
      assert.match(src, /<ModelledArm/, `${scene} does not draw the modelled arm`);
      assert.doesNotMatch(src, /ModelCredits/);
    }
  });
});
