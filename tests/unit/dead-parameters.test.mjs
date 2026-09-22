// ─── Guardrail 5.4 — no dead parameters ─────────────────────────────
// Every key a topic declares in `defaults` has to be something: a control
// the user can move, a value the scene reads, or a value the Details panel
// derives from. A key that is none of those is a promise nothing keeps.
//
// This catches B4 and B33. `energetics.defaults` carried `showReverse`,
// which had no control, no reader and no effect -- it was clearly meant to
// toggle a reverse-activation arrow that was never built, and it sat there
// looking like a working feature.
//
// The reverse direction matters just as much: a control whose key is not in
// `defaults` starts undefined, so the scene renders one frame of whatever
// `undefined` does before the first interaction.
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  componentClosure,
  parseHud,
  parseScenes,
  parseTopics,
  readSource,
} from "../helpers/source-registry.mjs";

const topics = parseTopics();
const scenes = parseScenes();
const hud = parseHud();

/**
 * Keys every topic gets for free.
 *
 * `speed` is written by the HUD's universal Animation Speed slider, so a
 * topic declares it in `defaults` without ever listing a control for it.
 */
const UNIVERSAL = new Set(["speed"]);

/** Where a topic's parameter could legitimately be read. */
function readersFor(topicId) {
  const scene = scenes.get(topicId);
  const parts = [];
  if (scene) {
    parts.push(componentClosure(scene.defining, scene.component).bodies.join("\n"));
    // Scenes commonly pass `params` straight into a helper in the same file.
    parts.push(readSource(scene.defining));
    for (const mod of scene.modules) parts.push(readSource(mod));
  }
  if (hud.has(topicId)) parts.push(hud.get(topicId).body);
  return parts.join("\n");
}

const isRead = (source, key) =>
  new RegExp(`\\b${key}\\b`).test(source);

describe("the registry is parsed", () => {
  it("finds every topic with an id, a category and a defaults block", () => {
    assert.ok(topics.length > 40, `only ${topics.length} topics parsed`);
    for (const t of topics) {
      assert.match(t.id, /^[a-z0-9_]+$/);
      assert.ok(t.category, `${t.id} has no category`);
    }
  });
});

describe("every declared default is used", () => {
  for (const topic of topics) {
    if (topic.defaults.length === 0) continue;

    it(`${topic.id}`, () => {
      const controls = new Set(topic.controls);
      const source = readersFor(topic.id);
      const dead = topic.defaults.filter(
        (key) => !UNIVERSAL.has(key) && !controls.has(key) && !isRead(source, key),
      );

      assert.deepEqual(
        dead,
        [],
        `${topic.id}: defaults declares ${dead.join(", ")}, but there is no control for it, ` +
          `the scene never reads it, and the Details panel never derives from it. Either wire ` +
          `it up or delete it — as it stands it looks like a working feature and is not one.`,
      );
    });
  }
});

describe("every control has a default to start from", () => {
  for (const topic of topics) {
    if (topic.controls.length === 0) continue;

    it(`${topic.id}`, () => {
      const defaults = new Set(topic.defaults);
      // An action control fires a handler; it holds no value of its own.
      const entry = topic.source;
      const valueless = new Set();
      for (const m of entry.matchAll(/\{\s*type:\s*"(action)"[^}]*?\bkey:\s*"([\w$]+)"/g)) {
        valueless.add(m[2]);
      }

      const undeclared = topic.controls.filter((k) => !defaults.has(k) && !valueless.has(k));
      assert.deepEqual(
        undeclared,
        [],
        `${topic.id}: controls ${undeclared.join(", ")} have no entry in defaults, so they ` +
          `start undefined and the scene renders once with no value for them.`,
      );
    });
  }
});
