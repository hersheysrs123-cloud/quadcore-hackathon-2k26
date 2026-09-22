import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  annotationLocation,
  annotationParts,
  bucketAnnotationsByLine,
  buildLineSegments,
  countPhrases,
  makeAnnotation,
  migrate,
  orderAnnotations,
  rangeText,
  remapAnnotations,
  sampleData,
  trimRange,
} from "../../lib/literature.js";

/**
 * The range / overlap logic behind the Literature section. Ported from the
 * standalone app's own suite, which is the reason this file exists: these are
 * the invariants that make overlapping annotations survive line editing, and
 * every one of them is easy to break by accident.
 */

const lines = [
  "The lonely moon watches over me",
  "dark and silent footsteps fall",
  "",
  "the moon again, the moon",
];

describe("Literature — range extraction & trimming", () => {
  it("reads the text of a single-line range", () => {
    assert.equal(
      rangeText(lines, { startLine: 0, startChar: 4, endLine: 0, endChar: 15 }),
      "lonely moon"
    );
  });

  it("reads across a line break, joining with a newline", () => {
    assert.equal(
      rangeText(lines, { startLine: 0, startChar: 24, endLine: 1, endChar: 4 }),
      "over me\ndark"
    );
  });

  it("shaves whitespace off both ends of a selection", () => {
    assert.deepEqual(trimRange(lines, { startLine: 0, startChar: 3, endLine: 0, endChar: 16 }), {
      startLine: 0,
      startChar: 4,
      endLine: 0,
      endChar: 15,
    });
  });

  it("keeps a span that crosses a blank stanza line", () => {
    assert.deepEqual(trimRange(lines, { startLine: 1, startChar: 25, endLine: 3, endChar: 3 }), {
      startLine: 1,
      startChar: 26,
      endLine: 3,
      endChar: 3,
    });
  });

  it("returns null for a whitespace-only selection", () => {
    assert.equal(trimRange(lines, { startLine: 0, startChar: 3, endLine: 0, endChar: 4 }), null);
  });

  it("rolls back a selection that ends at the start of the next line", () => {
    assert.deepEqual(trimRange(lines, { startLine: 0, startChar: 4, endLine: 1, endChar: 0 }), {
      startLine: 0,
      startChar: 4,
      endLine: 0,
      endChar: 31,
    });
  });

  it("clamps an out-of-bounds selection instead of failing", () => {
    assert.notEqual(
      trimRange(lines, { startLine: 0, startChar: 0, endLine: 99, endChar: 999 }),
      null
    );
  });
});

describe("Literature — overlap segmentation", () => {
  it("splits two overlapping annotations into a shared segment", () => {
    const A = makeAnnotation([{ startLine: 1, startChar: 0, endLine: 1, endChar: 15 }], "A");
    const B = makeAnnotation([{ startLine: 1, startChar: 9, endLine: 1, endChar: 25 }], "B");
    const segs = buildLineSegments(1, lines[1], [A, B]);
    assert.deepEqual(
      segs.segments.map((s) => [s.text, s.ids.length]),
      [
        ["dark and ", 1],
        ["silent", 2],
        [" footsteps", 1],
        [" fall", 0],
      ]
    );
    assert.deepEqual(segs.markers.map((m) => m.at), [15, 25]);
  });

  it("stacks two annotations on identical ranges rather than replacing one", () => {
    const D1 = makeAnnotation([{ startLine: 0, startChar: 4, endLine: 0, endChar: 15 }], "one");
    const D2 = makeAnnotation([{ startLine: 0, startChar: 4, endLine: 0, endChar: 15 }], "two");
    const s2 = buildLineSegments(0, lines[0], [D1, D2]);
    assert.deepEqual(
      s2.segments.map((s) => [s.text, s.ids.length]),
      [
        ["The ", 0],
        ["lonely moon", 2],
        [" watches over me", 0],
      ]
    );
    assert.equal(s2.markers.length, 2);
  });

  it("distinguishes repeated identical words by position", () => {
    const r1 = { startLine: 3, startChar: 4, endLine: 3, endChar: 8 };
    const r2 = { startLine: 3, startChar: 20, endLine: 3, endChar: 24 };
    assert.equal(rangeText(lines, r1), "moon");
    assert.equal(rangeText(lines, r2), "moon");
    const s3 = buildLineSegments(3, lines[3], [
      makeAnnotation([r1], "first"),
      makeAnnotation([r2], "second"),
    ]);
    assert.deepEqual(
      s3.segments.filter((s) => s.ids.length).map((s) => [s.start, s.ids.length]),
      [
        [4, 1],
        [20, 1],
      ]
    );
  });

  it("covers whole middle lines of a multi-line annotation, with one end marker", () => {
    const ML = makeAnnotation([{ startLine: 0, startChar: 21, endLine: 3, endChar: 4 }], "x");
    assert.deepEqual(
      buildLineSegments(1, lines[1], [ML]).segments.map((s) => [s.start, s.end, s.ids.length]),
      [[0, 30, 1]]
    );
    assert.equal(buildLineSegments(1, lines[1], [ML]).markers.length, 0);
    assert.equal(buildLineSegments(3, lines[3], [ML]).markers.length, 1);
  });
});

describe("Literature — multi-part annotations", () => {
  const RH = makeAnnotation(
    [
      { startLine: 0, startChar: 11, endLine: 0, endChar: 15 },
      { startLine: 3, startChar: 20, endLine: 3, endChar: 24 },
    ],
    "rhyme"
  );

  it("quotes every part of one annotation", () => {
    assert.deepEqual(annotationParts(lines, RH), ["moon", "moon"]);
  });

  it("reports every location of one annotation", () => {
    assert.equal(annotationLocation(RH), "line 1, line 4");
  });

  it("marks each part with its own part index", () => {
    assert.deepEqual(buildLineSegments(0, lines[0], [RH]).markers.map((m) => m.partIndex), [0]);
    assert.deepEqual(buildLineSegments(3, lines[3], [RH]).markers.map((m) => m.partIndex), [1]);
  });

  it("counts phrases separately from annotations", () => {
    const poem = { lines, annotations: [RH, makeAnnotation([{ startLine: 0, startChar: 0, endLine: 0, endChar: 3 }], "x")] };
    assert.equal(countPhrases(poem), 3);
  });
});

describe("Literature — numbering & bucketing", () => {
  it("numbers annotations in reading order, not insertion order", () => {
    const anns = [
      makeAnnotation([{ startLine: 3, startChar: 0, endLine: 3, endChar: 3 }], "z"),
      makeAnnotation([{ startLine: 0, startChar: 0, endLine: 0, endChar: 3 }], "a"),
    ];
    assert.deepEqual(orderAnnotations(anns).map((o) => o.ann.text), ["a", "z"]);
  });

  it("buckets an annotation onto every line it touches, exactly once", () => {
    const ML = makeAnnotation([{ startLine: 0, startChar: 21, endLine: 3, endChar: 4 }], "x");
    const byLine = bucketAnnotationsByLine({ lines, annotations: [ML] });
    assert.deepEqual(byLine.map((b) => (b ? b.length : 0)), [1, 1, 1, 1]);
  });
});

describe("Literature — remapping after line edits", () => {
  const poemLines = ["one", "two", "three", "four"];
  const an = [
    makeAnnotation([{ startLine: 1, startChar: 0, endLine: 1, endChar: 3 }], "on two"),
    makeAnnotation([{ startLine: 3, startChar: 0, endLine: 3, endChar: 4 }], "on four"),
  ];

  it("follows a reordered line and drops nothing", () => {
    const rm = remapAnnotations(an, [0, 2, 1, 3], ["one", "three", "two", "four"]);
    assert.equal(rm.annotations[0].ranges[0].startLine, 2);
    assert.equal(rm.droppedParts, 0);
  });

  it("removes an annotation whose line was deleted, and shifts the survivor", () => {
    const rm = remapAnnotations(an, [0, -1, 1, 2], ["one", "three", "four"]);
    assert.equal(rm.annotations.length, 1);
    assert.equal(rm.droppedAnns, 1);
    assert.equal(rm.annotations[0].ranges[0].startLine, 2);
  });

  it("clamps char offsets to a shortened line", () => {
    const rm = remapAnnotations(an, [0, 1, 2, 3], ["one", "tw", "three", "four"]);
    assert.equal(rm.annotations[0].ranges[0].endChar, 2);
  });
});

describe("Literature — import sanitising", () => {
  it("keeps valid annotations, accepts the legacy single `range`, drops impossible ones", () => {
    const bad = {
      poems: [
        {
          title: "T",
          lines: ["hello world"],
          annotations: [
            { text: "keep", ranges: [{ startLine: 0, startChar: 0, endLine: 0, endChar: 5 }] },
            { text: "legacy single range", range: { startLine: 0, startChar: 6, endLine: 0, endChar: 11 } },
            { text: "drop me", ranges: [{ startLine: 9, startChar: 0, endLine: 9, endChar: 2 }] },
            { text: "empty", ranges: [] },
          ],
        },
      ],
    };
    assert.deepEqual(
      migrate(bad).poems[0].annotations.map((a) => a.text),
      ["keep", "legacy single range"]
    );
  });

  it("rejects a file that is not a Literature backup", () => {
    assert.throws(() => migrate({ nope: 1 }), /poems/);
  });

  it("round-trips the bundled sample without losing an annotation", () => {
    const round = migrate(JSON.parse(JSON.stringify(sampleData())));
    assert.equal(round.poems[0].annotations.length, 6);
  });

  it("repairs duplicate poem ids", () => {
    const dm = migrate({
      poems: [
        { id: "x", title: "a", lines: ["aa"] },
        { id: "x", title: "b", lines: ["bb"] },
      ],
    });
    assert.notEqual(dm.poems[0].id, dm.poems[1].id);
  });
});

describe("Literature — the bundled sample", () => {
  it("demonstrates overlap, a repeated reading and a multi-part annotation", () => {
    const poem = sampleData().poems[0];
    // two annotations attached to exactly the same words
    const identical = poem.annotations.filter(
      (a) => a.ranges.length === 1 && a.ranges[0].startLine === 10 && a.ranges[0].startChar === 0
    );
    assert.equal(identical.length, 2);
    // one annotation spanning two separate places
    assert.ok(poem.annotations.some((a) => a.ranges.length === 2));
    // an overlap on line 4
    const onLine4 = poem.annotations.filter((a) => a.ranges.some((r) => r.startLine === 4));
    assert.equal(onLine4.length, 2);
    // numbering is deterministic because `created` is distinct per annotation
    assert.equal(new Set(poem.annotations.map((a) => a.created)).size, poem.annotations.length);
  });
});
