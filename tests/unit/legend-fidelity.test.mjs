// ─── Guardrail 5.1 — legend fidelity ────────────────────────────────
// Every colour the Details panel's key names must be a colour the scene it
// sits beside can actually draw.
//
// This is the single assertion that would have caught B3, B11, B17, B21,
// B22, B27, C5, C8 and C11 -- nine defects, including the worst one in the
// report: the graphite key named a "Delocalised Electron" and an
// "Interlayer Force" and the scene drew neither, so the gold swatch pointed
// at what were really the middle layer's carbon atoms.
//
// A key that names a colour nothing on screen uses is worse than no key at
// all, because the reader trusts it.
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  componentClosure,
  hexLiterals,
  parseHud,
  parseScenes,
  parseTopics,
  readSource,
} from "../helpers/source-registry.mjs";

const scenes = parseScenes();
const hud = parseHud();
const topics = parseTopics();

/**
 * Every colour the scene for `topicId` can put on screen: the literals in
 * its own component closure, plus those in the shared colour tables it
 * imports (lib/* and scene-kit's PALETTE).
 */
function paletteOf(topicId) {
  const scene = scenes.get(topicId);
  const closure = componentClosure(scene.defining, scene.component);
  const palette = hexLiterals(closure.bodies.join("\n"));
  for (const mod of scene.modules) {
    for (const hex of hexLiterals(readSource(mod))) palette.add(hex);
  }
  return palette;
}

/** Topics that have both a HUD legend and a scene to check it against. */
const CHECKABLE = [...hud.keys()].filter((id) => scenes.has(id));

describe("the parser sees the suite it is meant to guard", () => {
  it("finds the topic registry, the scenes and the HUD cases", () => {
    assert.ok(topics.length > 40, `only ${topics.length} topics parsed`);
    assert.ok(scenes.size > 40, `only ${scenes.size} scenes parsed`);
    assert.ok(hud.size > 40, `only ${hud.size} HUD cases parsed`);
    assert.ok(CHECKABLE.length > 40, `only ${CHECKABLE.length} topics checkable`);
  });

  it("resolves each scene to a non-empty component closure", () => {
    for (const id of CHECKABLE) {
      const scene = scenes.get(id);
      const closure = componentClosure(scene.defining, scene.component);
      assert.ok(
        closure.bodies.length > 0,
        `${id}: could not find the body of <${scene.component}> in ${scene.defining}`,
      );
    }
  });
});

describe("every legend colour is a colour the scene draws", () => {
  for (const id of CHECKABLE) {
    const { literals } = hud.get(id);
    if (literals.length === 0) continue;

    it(`${id}`, () => {
      const palette = paletteOf(id);
      const scene = scenes.get(id);
      const orphans = literals.filter((c) => !palette.has(c));
      assert.deepEqual(
        orphans,
        [],
        `${id}: the Details panel keys ${orphans.join(", ")}, which <${scene.component}> ` +
          `never draws. Either the scene changed colour and the key was not updated, or the ` +
          `key is pointing at something that is not there.`,
      );
    });
  }
});

describe("every legend colour reference is one the scene shares", () => {
  for (const id of CHECKABLE) {
    const { references } = hud.get(id);
    if (references.length === 0) continue;

    it(`${id}`, () => {
      const scene = scenes.get(id);
      const closure = componentClosure(scene.defining, scene.component);
      const sceneSource = readSource(scene.defining) + scene.modules.map(readSource).join("\n");
      const unshared = [];

      const hudBody = hud.get(id).body;
      const mentions = (name) =>
        new RegExp(`\\b${name}\\b`).test(closure.bodies.join("\n")) ||
        new RegExp(`\\b${name}\\b`).test(sceneSource);

      for (const ref of references) {
        // The table the colour comes from, e.g. ENZYME_COLOURS of
        // ENZYME_COLOURS.substrate. Referencing a shared table is the safe
        // pattern -- it is only safe if the SCENE uses that table too.
        const root = ref.split(/[.[]/)[0];

        // The HUD often aliases a table first: `const PK = PARTICLE_KINDS[k]`.
        // Follow one hop, and judge the names the initialiser actually uses.
        const alias = hudBody.match(new RegExp(`\\bconst ${root}\\s*=\\s*([^;\\n]+)`));
        const candidates = alias
          ? (alias[1].match(/\b[A-Za-z_$][\w$]*\b/g) || []).filter((n) => /^[A-Z]/.test(n) || /For$|Of$/.test(n))
          : [root];

        if (candidates.length > 0 && !candidates.some(mentions)) unshared.push(ref);
      }

      assert.deepEqual(
        unshared,
        [],
        `${id}: the Details panel keys colours from ${unshared.join(", ")}, but neither ` +
          `<${scene.component}> nor the modules it imports reference that table.`,
      );
    });
  }
});

describe("the shared colour tables are the preferred form", () => {
  // Not a failure -- a direction of travel. Phase 1 moved eleven topics onto
  // shared tables; this records how far that has spread so a regression is
  // visible rather than silent.
  it("keeps at least the eleven extracted topics free of literal legend colours", () => {
    const EXTRACTED = [
      "bohr", "organic", "distillation", "lattice", "electrolysis", "vsepr",
      "energetics", "enzyme", "dna", "cell", "protein",
    ];
    const regressed = EXTRACTED.filter((id) => hud.has(id) && hud.get(id).literals.length > 0);
    assert.deepEqual(
      regressed,
      [],
      `${regressed.join(", ")} went back to hard-coded legend colours; they should read ` +
        `their colours from the lib/ table the scene draws with.`,
    );
  });
});
