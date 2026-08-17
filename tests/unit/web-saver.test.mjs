import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeUrl,
  isValidUrl,
  extractDomain,
  getFaviconUrl,
  generateFallbackTitle,
} from "../../lib/urlUtils.js";
import {
  generateNetscapeBookmarksHtml,
  parseNetscapeBookmarksHtml,
} from "../../lib/exportImport.js";

describe("Web Saver — URL & Favicon Utilities (lib/urlUtils.js)", () => {
  it("normalizes URLs with missing protocols and whitespace", () => {
    assert.equal(normalizeUrl("github.com/facebook/react"), "https://github.com/facebook/react");
    assert.equal(normalizeUrl("  https://developer.mozilla.org/en-US/  "), "https://developer.mozilla.org/en-US/");
    assert.equal(normalizeUrl("http://example.com"), "http://example.com/");
    assert.equal(normalizeUrl("//cdn.example.com/lib.js"), "https://cdn.example.com/lib.js");
  });

  it("guards against dangerous URI schemes", () => {
    assert.equal(normalizeUrl("javascript:alert(1)"), "");
    assert.equal(normalizeUrl("data:text/html,<script>"), "");
    assert.equal(normalizeUrl("vbscript:msgbox"), "");
    assert.equal(normalizeUrl(""), "");
    assert.equal(normalizeUrl(null), "");
    assert.equal(isValidUrl("javascript:void(0)"), false);
    assert.equal(isValidUrl("https://socraticos.org"), true);
  });

  it("extracts clean hostnames and domains without www prefix", () => {
    assert.equal(extractDomain("https://www.youtube.com/watch?v=123"), "youtube.com");
    assert.equal(extractDomain("https://docs.github.com/en/rest/reference"), "docs.github.com");
    assert.equal(extractDomain("3blue1brown.com"), "3blue1brown.com");
    assert.equal(extractDomain(""), "");
  });

  it("generates automated high-resolution Google favicon URLs", () => {
    assert.equal(
      getFaviconUrl("https://github.com", 64),
      "https://www.google.com/s2/favicons?domain=github.com&sz=64"
    );
    assert.equal(
      getFaviconUrl("https://www.wikipedia.org", 32),
      "https://www.google.com/s2/favicons?domain=wikipedia.org&sz=32"
    );
    assert.equal(getFaviconUrl(""), "");
  });

  it("derives readable fallback titles from URL paths and domains", () => {
    assert.equal(
      generateFallbackTitle("https://github.com/facebook/react"),
      "React — Github"
    );
    assert.equal(
      generateFallbackTitle("https://en.wikipedia.org/wiki/Calculus"),
      "Calculus — Wikipedia"
    );
    assert.equal(
      generateFallbackTitle("https://3blue1brown.com"),
      "3blue1brown"
    );
  });
});

describe("Web Saver — Netscape HTML Bookmarks Export & Import (lib/exportImport.js)", () => {
  const sampleFolders = [
    { id: "f_math", parentId: null, spaceId: "School", name: "Mathematics", createdAt: "2026-08-01T00:00:00.000Z" },
    { id: "f_calc", parentId: "f_math", spaceId: "School", name: "Calculus Deep Dive", createdAt: "2026-08-01T00:00:00.000Z" },
    { id: "f_cs", parentId: null, spaceId: "School", name: "Computer Science", createdAt: "2026-08-01T00:00:00.000Z" },
  ];

  const sampleBookmarks = [
    {
      id: "bm_1",
      folderId: "f_calc",
      spaceId: "School",
      url: "https://www.3blue1brown.com/topics/calculus",
      title: "Essence of Calculus",
      favicon: "https://www.google.com/s2/favicons?domain=3blue1brown.com&sz=64",
      notes: "Series on limits, derivatives, and Taylor series.",
      tags: ["math", "calculus", "visual"],
      createdAt: "2026-08-01T00:00:00.000Z",
    },
    {
      id: "bm_2",
      folderId: "f_cs",
      spaceId: "School",
      url: "https://developer.mozilla.org",
      title: "MDN Web Docs",
      favicon: "https://www.google.com/s2/favicons?domain=developer.mozilla.org&sz=64",
      notes: "Web standards reference.",
      tags: ["web", "docs"],
      createdAt: "2026-08-01T00:00:00.000Z",
    },
    {
      id: "bm_3",
      folderId: null,
      spaceId: "School",
      url: "https://desmos.com/calculator",
      title: "Desmos Graphing Calculator",
      favicon: "https://www.google.com/s2/favicons?domain=desmos.com&sz=64",
      notes: "Plotting functions in real-time.",
      tags: ["tools"],
      createdAt: "2026-08-01T00:00:00.000Z",
    },
  ];

  it("exports structured Netscape Bookmark standard HTML with hierarchy, icons, tags, and notes", () => {
    const { html, count } = generateNetscapeBookmarksHtml(sampleBookmarks, sampleFolders, "School");
    assert.equal(count, 3);
    assert.ok(html.includes("<!DOCTYPE NETSCAPE-Bookmark-file-1>"));
    assert.ok(html.includes("<TITLE>SocraticOS Bookmarks — School</TITLE>"));
    assert.ok(html.includes(">Mathematics</H3>"));
    assert.ok(html.includes(">Calculus Deep Dive</H3>"));
    assert.ok(html.includes('HREF="https://www.3blue1brown.com/topics/calculus"'));
    assert.ok(html.includes('TAGS="math,calculus,visual"'));
    assert.ok(html.includes('ICON="https://www.google.com/s2/favicons?domain=3blue1brown.com&amp;sz=64"'));
    assert.ok(html.includes("<DD>Series on limits, derivatives, and Taylor series."));
  });

  it("parses Netscape HTML bookmarks losslessly back into folders and bookmarks", () => {
    const { html } = generateNetscapeBookmarksHtml(sampleBookmarks, sampleFolders, "School");
    const parsed = parseNetscapeBookmarksHtml(html, "School");

    assert.ok(parsed.folders.length >= 3);
    assert.equal(parsed.bookmarks.length, 3);

    const calcBm = parsed.bookmarks.find((b) => b.url === "https://www.3blue1brown.com/topics/calculus");
    assert.ok(calcBm);
    assert.equal(calcBm.title, "Essence of Calculus");
    assert.deepEqual(calcBm.tags, ["math", "calculus", "visual"]);
    assert.equal(calcBm.notes, "Series on limits, derivatives, and Taylor series.");

    const desmosBm = parsed.bookmarks.find((b) => b.url === "https://desmos.com/calculator");
    assert.ok(desmosBm);
    assert.equal(desmosBm.folderId, null);
  });

  it("handles empty or malformed bookmark HTML gracefully", () => {
    const emptyResult = parseNetscapeBookmarksHtml("", "School");
    assert.deepEqual(emptyResult, { folders: [], bookmarks: [] });

    const nullResult = parseNetscapeBookmarksHtml(null, "School");
    assert.deepEqual(nullResult, { folders: [], bookmarks: [] });

    const plainText = parseNetscapeBookmarksHtml("Just plain text with no bookmark tags", "School");
    assert.deepEqual(plainText, { folders: [], bookmarks: [] });
  });
});
