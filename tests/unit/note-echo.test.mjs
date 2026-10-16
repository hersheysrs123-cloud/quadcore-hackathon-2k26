import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { SENT_HISTORY_LIMIT, isExternalPropChange, rememberSent } from "../../lib/noteEcho.js";

describe("rememberSent", () => {
  it("appends a new value and skips a repeat of the last one", () => {
    assert.deepEqual(rememberSent(["a"], "b"), ["a", "b"]);
    const list = ["a", "b"];
    assert.equal(rememberSent(list, "b"), list);
  });

  it("keeps only the most recent values", () => {
    let list = [];
    for (let i = 0; i < SENT_HISTORY_LIMIT + 10; i++) list = rememberSent(list, `t${i}`);
    assert.equal(list.length, SENT_HISTORY_LIMIT);
    assert.equal(list[0], "t10");
    assert.equal(list.at(-1), `t${SENT_HISTORY_LIMIT + 9}`);
  });

  it("tracks null (no banner, no emoji) like any other value", () => {
    assert.deepEqual(rememberSent(["x"], null), ["x", null]);
  });
});

describe("isExternalPropChange", () => {
  it("ignores the echo of a save that has since been typed past", () => {
    // typed "Ener", saved; typed on to "Energy"; the "Ener" save comes back
    let sent = rememberSent(["Untitled"], "Ener");
    assert.equal(isExternalPropChange("Ener", "Energy", sent), false);
    sent = rememberSent(sent, "Energy");
    assert.equal(isExternalPropChange("Energy", "Energy", sent), false);
  });

  it("adopts a rename made outside the editor", () => {
    const sent = rememberSent(["Untitled"], "Energy");
    assert.equal(isExternalPropChange("Energy transfer", "Energy", sent), true);
  });

  it("adopts a banner or emoji removed elsewhere", () => {
    assert.equal(isExternalPropChange(null, "sunset", ["sunset"]), true);
    assert.equal(isExternalPropChange(null, null, ["sunset"]), false);
  });
});
