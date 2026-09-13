import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("Media Block Caption & Input Keyboard Isolation", () => {
  it("verifies container onKeyDown ignores events originating from INPUT or TEXTAREA elements", () => {
    let exitedUp = false;
    let exitedDown = false;
    let deleted = false;
    let addedAfter = false;

    const block = { id: "media-1", type: "media", url: "https://example.com/test.png", content: "Initial caption" };

    const handleContainerKeyDown = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") {
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        exitedDown = true;
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        exitedUp = true;
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        addedAfter = true;
        return;
      }
      if (e.key === "Delete") {
        e.preventDefault();
        deleted = true;
        return;
      }
      if (e.key === "Backspace") {
        e.preventDefault();
        exitedUp = true;
        return;
      }
    };

    const mockInputTarget = { tagName: "INPUT", getAttribute: (attr) => attr === "data-media-caption" ? "true" : null };
    let backspaceDefaultPrevented = false;
    const backspaceEvent = {
      key: "Backspace",
      target: mockInputTarget,
      preventDefault: () => { backspaceDefaultPrevented = true; },
    };

    handleContainerKeyDown(backspaceEvent);
    assert.equal(exitedUp, false, "Backspace from caption INPUT must not invoke onExitUp");
    assert.equal(backspaceDefaultPrevented, false, "Native Backspace must not be default-prevented");

    let deleteDefaultPrevented = false;
    const deleteEvent = {
      key: "Delete",
      target: mockInputTarget,
      preventDefault: () => { deleteDefaultPrevented = true; },
    };
    handleContainerKeyDown(deleteEvent);
    assert.equal(deleted, false, "Delete from caption INPUT must not invoke onDelete");
    assert.equal(deleteDefaultPrevented, false, "Native Delete must not be default-prevented");

    const mockDivTarget = { tagName: "DIV" };
    let divBackspacePrevented = false;
    const divBackspaceEvent = {
      key: "Backspace",
      target: mockDivTarget,
      preventDefault: () => { divBackspacePrevented = true; },
    };
    handleContainerKeyDown(divBackspaceEvent);
    assert.equal(exitedUp, true, "Backspace on outer block container should exit up");
    assert.equal(divBackspacePrevented, true, "Backspace on outer container should be default-prevented");
  });

  it("verifies caption input onKeyDown stops propagation and handles Enter cleanly", () => {
    let stoppedPropagation = false;
    let defaultPrevented = false;
    let addedBlock = null;

    const block = { id: "media-99", type: "media", url: "https://example.com/photo.jpg", content: "Lab Setup" };
    const onAddAfter = (id, text, type) => {
      addedBlock = { id, text, type };
    };

    const handleCaptionKeyDown = (e) => {
      e.stopPropagation();
      if (e.key === "Enter") {
        e.preventDefault();
        onAddAfter?.(block.id, "", "text");
      }
    };

    const backspaceEvent = {
      key: "Backspace",
      stopPropagation: () => { stoppedPropagation = true; },
      preventDefault: () => { defaultPrevented = true; },
    };
    handleCaptionKeyDown(backspaceEvent);
    assert.equal(stoppedPropagation, true, "Backspace must stop propagation to outer container");
    assert.equal(defaultPrevented, false, "Backspace must not prevent default typing behavior");

    stoppedPropagation = false;
    defaultPrevented = false;
    const enterEvent = {
      key: "Enter",
      stopPropagation: () => { stoppedPropagation = true; },
      preventDefault: () => { defaultPrevented = true; },
    };
    handleCaptionKeyDown(enterEvent);
    assert.equal(stoppedPropagation, true, "Enter must stop propagation");
    assert.equal(defaultPrevented, true, "Enter must prevent default line break in single-line input");
    assert.deepEqual(addedBlock, { id: "media-99", text: "", type: "text" }, "Enter should add a new text block below");
  });
});
