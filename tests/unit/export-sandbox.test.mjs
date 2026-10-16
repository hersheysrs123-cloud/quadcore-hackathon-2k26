import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { blocksToHTMLLossy, safeExportUrl } from "../../lib/exportImport.js";
import { MAX_PREVIEW_HEIGHT, addPreviewBridge, readPreviewMessage } from "../../lib/previewBridge.js";

describe("HTML export escaping", () => {
  it("escapes a callout icon", () => {
    const html = blocksToHTMLLossy([{ id: "c", type: "callout", content: "Note", calloutIcon: "<img src=x onerror=alert(1)>" }], "T", "📝");
    assert.doesNotMatch(html, /<img src=x/);
    assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  });

  it("escapes the title emoji", () => {
    const html = blocksToHTMLLossy([], "T", '"><script>alert(1)</script>');
    assert.doesNotMatch(html, /<script>alert/);
  });

  it("drops a javascript: link from a site block but keeps web links", () => {
    const bad = blocksToHTMLLossy([{ id: "s", type: "site", url: "javascript:alert(1)", title: "x" }], "T", "📝");
    assert.doesNotMatch(bad, /href="javascript:/i);
    const good = blocksToHTMLLossy([{ id: "s", type: "site", url: "https://example.com", title: "x" }], "T", "📝");
    assert.match(good, /href="https:\/\/example\.com"/);
  });

  it("keeps a data: image in a media block and drops a data: page", () => {
    const img = blocksToHTMLLossy([{ id: "m", type: "media", mediaKind: "image", url: "data:image/png;base64,AAAA" }], "T", "📝");
    assert.match(img, /src="data:image\/png;base64,AAAA"/);
    const page = blocksToHTMLLossy([{ id: "m", type: "media", mediaKind: "image", url: "data:text/html,<b>x</b>" }], "T", "📝");
    assert.doesNotMatch(page, /data:text\/html/);
  });
});

describe("safeExportUrl", () => {
  it("passes web, mail, bare and relative URLs", () => {
    for (const u of ["https://a.com", "http://a.com/x?y=1", "mailto:a@b.c", "example.com/page", "/img/a.png", "#top"]) {
      assert.equal(safeExportUrl(u), u, u);
    }
  });

  it("rejects script and other schemes, including ones split by whitespace", () => {
    for (const u of ["javascript:alert(1)", " JavaScript:x", "java\nscript:x", "java\tscript:x", "vbscript:x", "data:text/html,x", "file:///etc/passwd"]) {
      assert.equal(safeExportUrl(u), "", JSON.stringify(u));
    }
  });

  it("allows data: media only where media is expected", () => {
    assert.equal(safeExportUrl("data:video/mp4;base64,AA", { media: true }), "data:video/mp4;base64,AA");
    assert.equal(safeExportUrl("data:image/png;base64,AA"), "");
  });
});

describe("preview bridge", () => {
  it("adds the reporting script just before </body>", () => {
    const out = addPreviewBridge("<html><body><p>x</p></body></html>", "pv_abc");
    assert.match(out, /<p>x<\/p><script>.*"pv_abc".*<\/script><\/body><\/html>$/s);
  });

  it("appends the script when there is no </body>", () => {
    assert.match(addPreviewBridge("<p>x</p>", "pv_abc"), /^<p>x<\/p><script>/);
  });

  it("never lets the token close the script element", () => {
    const out = addPreviewBridge("<body></body>", "</script><b>");
    assert.equal(out.match(/<\/script>/g).length, 1);
  });

  it("accepts only messages from the preview window with this preview's token", () => {
    const win = {};
    const msg = (source, data) => ({ source, data });
    assert.deepEqual(readPreviewMessage(msg(win, { socraticPreview: "t", height: 900 }), win, "t"), { height: 900 });
    assert.equal(readPreviewMessage(msg({}, { socraticPreview: "t", height: 900 }), win, "t"), null);
    assert.equal(readPreviewMessage(msg(win, { socraticPreview: "other", height: 900 }), win, "t"), null);
    assert.equal(readPreviewMessage(msg(win, "height:900"), win, "t"), null);
    assert.equal(readPreviewMessage(msg(win, { socraticPreview: "t" }), null, "t"), null);
  });

  it("checks and clamps the numbers", () => {
    const win = {};
    const read = (data) => readPreviewMessage({ source: win, data: { socraticPreview: "t", ...data } }, win, "t");
    assert.deepEqual(read({ height: 1e9 }), { height: MAX_PREVIEW_HEIGHT });
    assert.deepEqual(read({ height: -5, wheel: "x" }), {});
    assert.deepEqual(read({ height: NaN, wheel: 1e6 }), { wheel: 5000 });
  });
});
