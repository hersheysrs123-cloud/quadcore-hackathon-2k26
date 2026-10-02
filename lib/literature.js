/**
 * literature.js — pure data logic for the Literature revision section.
 *
 * Ported from the standalone Literature Revision app (`js/core.js`) into an
 * ES module. NOTHING here touches the DOM, Dexie or React: it is ranges,
 * overlap segmentation, numbering, remapping and validation, so it can be
 * unit-tested under plain Node (see tests/unit/literature-core.test.mjs).
 *
 * The one concept worth loading into your head before reading on:
 *
 *   A **range** is { startLine, startChar, endLine, endChar }. Line indices
 *   are 0-based, char offsets are 0-based and THE END IS EXCLUSIVE. Ranges
 *   may span any number of lines.
 *
 *   An **annotation owns an ARRAY of ranges** ("parts"), so one piece of
 *   analysis can be attached to several non-contiguous phrases — a pair of
 *   rhyme words on different lines is one annotation, not two.
 */

export const LITERATURE_SCHEMA = 1;

/* ── small helpers ───────────────────────────────────────────── */

export function uid(prefix = "id") {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function clamp(n, lo, hi) {
  return n < lo ? lo : n > hi ? hi : n;
}

export function uniq(arr) {
  const seen = Object.create(null);
  const out = [];
  for (const item of arr) {
    if (!seen[item]) {
      seen[item] = 1;
      out.push(item);
    }
  }
  return out;
}

/* ── positions & ranges ──────────────────────────────────────── */

export function cmpPos(aLine, aChar, bLine, bChar) {
  return aLine - bLine || aChar - bChar;
}

export function cmpRange(a, b) {
  return (
    cmpPos(a.startLine, a.startChar, b.startLine, b.startChar) ||
    cmpPos(a.endLine, a.endChar, b.endLine, b.endChar)
  );
}

export function isEmptyRange(r) {
  return !r || cmpPos(r.startLine, r.startChar, r.endLine, r.endChar) >= 0;
}

/**
 * Clamp a raw selection to the poem, then shave whitespace and empty lines
 * off both ends. Returns null when nothing real is selected — which is what
 * makes a stray triple-click or a drag across a stanza gap harmless.
 */
export function trimRange(lines, r) {
  if (!r || !lines.length) return null;
  let sl = clamp(r.startLine | 0, 0, lines.length - 1);
  let el = clamp(r.endLine | 0, 0, lines.length - 1);
  let sc = clamp(r.startChar | 0, 0, lines[sl].length);
  let ec = clamp(r.endChar | 0, 0, lines[el].length);
  let guard = 0;

  while (guard++ < 100000) {
    if (cmpPos(sl, sc, el, ec) >= 0) return null;
    if (sc >= lines[sl].length) {
      sl++;
      sc = 0;
      continue;
    }
    if (/\s/.test(lines[sl].charAt(sc))) {
      sc++;
      continue;
    }
    break;
  }
  guard = 0;
  while (guard++ < 100000) {
    if (cmpPos(sl, sc, el, ec) >= 0) return null;
    if (ec <= 0) {
      el--;
      if (el < 0) return null;
      ec = lines[el].length;
      continue;
    }
    if (/\s/.test(lines[el].charAt(ec - 1))) {
      ec--;
      continue;
    }
    break;
  }
  if (cmpPos(sl, sc, el, ec) >= 0) return null;
  return { startLine: sl, startChar: sc, endLine: el, endChar: ec };
}

/** The literal text a range covers, lines joined by \n. */
export function rangeText(lines, r) {
  if (!r) return "";
  const sl = clamp(r.startLine, 0, lines.length - 1);
  const el = clamp(r.endLine, 0, lines.length - 1);
  if (sl === el) {
    return (lines[sl] || "").slice(
      clamp(r.startChar, 0, lines[sl].length),
      clamp(r.endChar, 0, lines[sl].length)
    );
  }
  const out = [(lines[sl] || "").slice(clamp(r.startChar, 0, lines[sl].length))];
  for (let i = sl + 1; i < el; i++) out.push(lines[i] || "");
  out.push((lines[el] || "").slice(0, clamp(r.endChar, 0, lines[el].length)));
  return out.join("\n");
}

export function annotationParts(lines, ann) {
  return (ann.ranges || []).map((r) => rangeText(lines, r));
}

/** One-line display quote for an annotation (all parts joined). */
export function annotationQuote(lines, ann) {
  return annotationParts(lines, ann)
    .map((t) => t.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("  ·  ");
}

export function rangeLabel(r) {
  return r.startLine === r.endLine
    ? `line ${r.startLine + 1}`
    : `lines ${r.startLine + 1}–${r.endLine + 1}`;
}

export function annotationLocation(ann) {
  return (ann.ranges || []).map(rangeLabel).join(", ");
}

function firstPos(ann) {
  let best = null;
  (ann.ranges || []).forEach((r) => {
    if (!best || cmpPos(r.startLine, r.startChar, best.startLine, best.startChar) < 0) best = r;
  });
  return best || { startLine: 1e9, startChar: 1e9 };
}

/**
 * Annotations numbered in reading order. The number is DERIVED, never stored,
 * so inserting an annotation halfway up a poem renumbers everything below it
 * without a migration.
 */
export function orderAnnotations(annotations) {
  const list = (annotations || []).slice().sort((a, b) => {
    const pa = firstPos(a);
    const pb = firstPos(b);
    return (
      cmpPos(pa.startLine, pa.startChar, pb.startLine, pb.startChar) ||
      (a.created || 0) - (b.created || 0) ||
      String(a.id).localeCompare(String(b.id))
    );
  });
  return list.map((ann, i) => ({ ann, n: i + 1 }));
}

export function numberMap(ordered) {
  const m = Object.create(null);
  ordered.forEach((o) => {
    m[o.ann.id] = o.n;
  });
  return m;
}

/**
 * Segmentation: turn one line + all annotations into a list of
 * non-overlapping pieces, each tagged with every annotation id covering it.
 *
 * This is the whole trick behind stacked/overlapping annotations: the text is
 * never wrapped in nested elements (which would be impossible for partial
 * overlaps), it is cut at every boundary and each piece records its own
 * coverage depth.
 */
export function buildLineSegments(lineIndex, lineText, annotations) {
  const len = lineText.length;
  const cuts = { 0: true };
  cuts[len] = true;
  const covers = [];
  const markers = [];

  (annotations || []).forEach((ann) => {
    (ann.ranges || []).forEach((r, partIndex) => {
      if (lineIndex < r.startLine || lineIndex > r.endLine) return;
      const s = lineIndex === r.startLine ? clamp(r.startChar, 0, len) : 0;
      const e = lineIndex === r.endLine ? clamp(r.endChar, 0, len) : len;
      if (e <= s) return; // nothing visible on this line
      cuts[s] = true;
      cuts[e] = true;
      covers.push({ id: ann.id, s, e });
      if (lineIndex === r.endLine) {
        markers.push({ id: ann.id, at: e, partIndex, multi: (ann.ranges || []).length > 1 });
      }
    });
  });

  const points = Object.keys(cuts)
    .map(Number)
    .sort((a, b) => a - b);
  const segs = [];
  for (let i = 0; i < points.length - 1; i++) {
    const s = points[i];
    const e = points[i + 1];
    if (e <= s) continue;
    const ids = [];
    for (const c of covers) {
      if (c.s <= s && c.e >= e) ids.push(c.id);
    }
    segs.push({ start: s, end: e, text: lineText.slice(s, e), ids: uniq(ids) });
  }
  if (!segs.length && len > 0) {
    segs.push({ start: 0, end: len, text: lineText, ids: [] });
  }
  markers.sort((a, b) => a.at - b.at);
  return { segments: segs, markers };
}

/** Every annotation touching a given line (for cheap per-line work). */
export function annotationsOnLine(annotations, lineIndex) {
  return (annotations || []).filter((ann) =>
    (ann.ranges || []).some((r) => lineIndex >= r.startLine && lineIndex <= r.endLine)
  );
}

/**
 * Bucket annotations by the lines they touch, so rendering a poem is one pass
 * instead of one scan of every annotation per line.
 */
export function bucketAnnotationsByLine(poem) {
  const byLine = new Array(poem.lines.length).fill(null);
  (poem.annotations || []).forEach((ann) => {
    (ann.ranges || []).forEach((r) => {
      const hi = Math.min(r.endLine, poem.lines.length - 1);
      for (let i = Math.max(0, r.startLine); i <= hi; i++) {
        if (!byLine[i]) byLine[i] = [];
        if (byLine[i].indexOf(ann) < 0) byLine[i].push(ann);
      }
    });
  });
  return byLine;
}

/**
 * Remap annotations after the line editor changes the poem.
 * lineMap[oldIndex] = newIndex, or -1 when the line was deleted.
 */
export function remapAnnotations(annotations, lineMap, newLines) {
  let droppedParts = 0;
  let droppedAnns = 0;
  const kept = [];

  (annotations || []).forEach((ann) => {
    const ranges = [];
    (ann.ranges || []).forEach((r) => {
      const ns = lineMap[r.startLine];
      const ne = lineMap[r.endLine];
      if (ns === undefined || ne === undefined || ns < 0 || ne < 0 || ns > ne) {
        droppedParts++;
        return;
      }
      const moved = {
        startLine: ns,
        startChar: clamp(r.startChar, 0, (newLines[ns] || "").length),
        endLine: ne,
        endChar: clamp(r.endChar, 0, (newLines[ne] || "").length),
      };
      const trimmed = trimRange(newLines, moved);
      if (!trimmed) {
        droppedParts++;
        return;
      }
      ranges.push(trimmed);
    });
    if (!ranges.length) {
      droppedAnns++;
      return;
    }
    kept.push({ ...ann, ranges });
  });

  return { annotations: kept, droppedParts, droppedAnns };
}

/* ── model constructors & validation ─────────────────────────── */

export function makePoem(title, lines) {
  return {
    id: uid("poem"),
    title: title || "Untitled poem",
    lines: lines && lines.length ? lines.slice() : [""],
    intro: "",
    conclusion: "",
    annotations: [],
    created: Date.now(),
    updated: Date.now(),
  };
}

export function makeAnnotation(ranges, text, label) {
  return {
    id: uid("ann"),
    ranges: (ranges || []).slice(),
    text: text || "",
    label: label || "",
    created: Date.now(),
    updated: Date.now(),
  };
}

export function sanitizeRange(r) {
  if (!r || typeof r !== "object") return null;
  const o = {
    startLine: Math.max(0, parseInt(r.startLine, 10) || 0),
    startChar: Math.max(0, parseInt(r.startChar, 10) || 0),
    endLine: Math.max(0, parseInt(r.endLine, 10) || 0),
    endChar: Math.max(0, parseInt(r.endChar, 10) || 0),
  };
  if (isEmptyRange(o)) return null;
  return o;
}

export function sanitizePoem(p) {
  if (!p || typeof p !== "object") return null;
  let lines = Array.isArray(p.lines)
    ? p.lines.map((l) => (typeof l === "string" ? l : String(l == null ? "" : l)))
    : typeof p.text === "string"
    ? p.text.split("\n")
    : [""];
  if (!lines.length) lines = [""];

  let annotations = Array.isArray(p.annotations) ? p.annotations : [];
  annotations = annotations
    .map((a) => {
      if (!a || typeof a !== "object") return null;
      let ranges = [];
      if (Array.isArray(a.ranges)) {
        ranges = a.ranges.map(sanitizeRange).filter(Boolean);
      } else if (a.range) {
        const one = sanitizeRange(a.range);
        if (one) ranges = [one];
      }
      /* An imported range that points outside the poem is DROPPED rather than
         clamped, so a corrupt file can never invent a highlight. */
      ranges = ranges
        .filter(
          (r) =>
            r.startLine < lines.length &&
            r.endLine < lines.length &&
            r.startChar <= lines[r.startLine].length &&
            r.endChar <= lines[r.endLine].length
        )
        .map((r) => trimRange(lines, r))
        .filter(Boolean)
        .sort(cmpRange);
      if (!ranges.length) return null;
      return {
        id: typeof a.id === "string" && a.id ? a.id : uid("ann"),
        ranges,
        text: typeof a.text === "string" ? a.text : "",
        label: typeof a.label === "string" ? a.label : "",
        created: Number(a.created) || Date.now(),
        updated: Number(a.updated) || Date.now(),
      };
    })
    .filter(Boolean);

  /* de-duplicate ids defensively */
  const seen = Object.create(null);
  annotations.forEach((a) => {
    if (seen[a.id]) a.id = uid("ann");
    seen[a.id] = 1;
  });

  return {
    id: typeof p.id === "string" && p.id ? p.id : uid("poem"),
    title: typeof p.title === "string" && p.title.trim() ? p.title : "Untitled poem",
    lines,
    intro: typeof p.intro === "string" ? p.intro : "",
    conclusion: typeof p.conclusion === "string" ? p.conclusion : "",
    annotations,
    sample: Boolean(p.sample),
    created: Number(p.created) || Date.now(),
    updated: Number(p.updated) || Date.now(),
  };
}

/**
 * Accepts a raw parsed JSON blob (from a Literature backup file, or from the
 * standalone app's localStorage) and returns a valid document, or throws.
 * Backups written by the original standalone app import unchanged.
 */
export function migrate(raw) {
  if (!raw || typeof raw !== "object") throw new Error("Not a valid data file.");
  const poems = Array.isArray(raw.poems) ? raw.poems : Array.isArray(raw) ? raw : null;
  if (!poems) throw new Error('No "poems" array found in the file.');
  const clean = poems.map(sanitizePoem).filter(Boolean);
  const ids = Object.create(null);
  clean.forEach((p) => {
    if (ids[p.id]) p.id = uid("poem");
    ids[p.id] = 1;
  });
  return { schema: LITERATURE_SCHEMA, app: "literature-revision", poems: clean };
}

export function countAnnotations(poem) {
  return poem && poem.annotations ? poem.annotations.length : 0;
}

/** Total highlighted phrases across a poem (an annotation may own several). */
export function countPhrases(poem) {
  return (poem?.annotations || []).reduce((sum, a) => sum + (a.ranges || []).length, 0);
}

/* ── sample content (public domain) ──────────────────────────── */

/**
 * Ozymandias, included to demonstrate the three things that are hard to
 * discover on your own: overlapping annotations, two different readings of
 * exactly the same words, and one annotation attached to two separate places.
 */
export function sampleData() {
  const lines = [
    "I met a traveller from an antique land,",
    'Who said—"Two vast and trunkless legs of stone',
    "Stand in the desert. . . . Near them, on the sand,",
    "Half sunk a shattered visage lies, whose frown,",
    "And wrinkled lip, and sneer of cold command,",
    "Tell that its sculptor well those passions read",
    "Which yet survive, stamped on these lifeless things,",
    "The hand that mocked them, and the heart that fed;",
    "And on the pedestal, these words appear:",
    "My name is Ozymandias, King of Kings;",
    "Look on my Works, ye Mighty, and despair!",
    "Nothing beside remains. Round the decay",
    "Of that colossal Wreck, boundless and bare",
    'The lone and level sands stretch far away."',
  ];

  /* Locate phrases by search so the sample can never drift out of sync. */
  function span(lineIndex, phrase) {
    const i = lines[lineIndex].indexOf(phrase);
    if (i < 0) throw new Error(`sample phrase not found: ${phrase}`);
    return { startLine: lineIndex, startChar: i, endLine: lineIndex, endChar: i + phrase.length };
  }
  function across(l1, from, l2, to) {
    const a = lines[l1].indexOf(from);
    const b = lines[l2].indexOf(to);
    return { startLine: l1, startChar: a, endLine: l2, endChar: b + to.length };
  }

  const ann = [
    {
      ranges: [across(1, "Two vast", 2, "the desert")],
      label: "Enjambment",
      text:
        "The enjambment across the line break forces the reader onward, mimicking the traveller’s eye moving over an expanse the sonnet form cannot contain. The delayed verb \"Stand\" isolates the ruin, and \"trunkless\" denies the statue a body, so authority is introduced already fragmented.",
    },
    {
      ranges: [span(4, "wrinkled lip, and sneer")],
      label: "Contempt",
      text:
        "The asyndetic catalogue of facial fragments reduces the tyrant to disconnected parts. \"Sneer\" fixes contempt permanently into stone, so the only surviving expression of his power is disdain for those he ruled.",
    },
    {
      ranges: [span(4, "sneer of cold command")],
      label: "Tyranny",
      text:
        "OVERLAPS the annotation above on the word \"sneer\" — notice the double underline. The tactile adjective \"cold\" fuses emotional absence with the literal chill of stone, while the plosive alliteration of \"cold command\" enacts the clipped brutality of absolute rule.",
    },
    {
      ranges: [span(10, "Look on my Works")],
      label: "Imperative",
      text:
        "Reading one: the imperative assumes an audience that must obey. The capitalised \"Works\" claims a permanence usually reserved for the divine, and the hubris of that claim is the engine of the sonnet’s irony.",
    },
    {
      ranges: [span(10, "Look on my Works")],
      label: "Dramatic irony",
      text:
        "Reading two, attached to exactly the same words. The command now addresses us, who look and see only sand. The boast survives while its referent has vanished, so language outlasts the power it was built to serve.",
    },
    {
      ranges: [span(10, "despair"), span(12, "bare")],
      label: "Rhyme",
      text:
        "A single annotation attached to two separate places. The rhyme binds the tyrant’s command to the emptiness that answers it, so the sound pattern itself delivers the poem’s verdict before the final line does.",
    },
  ];

  const poem = makePoem("Ozymandias — Percy Bysshe Shelley", lines);
  poem.sample = true;
  poem.intro =
    "Shelley’s \"Ozymandias\" (1818) presents tyranny as something already in ruins. Through a doubly distanced narrative frame, an ironic inscription and a sonnet form that refuses to resolve, the poem argues that political power is temporary while art and time are not.\n\n(This is sample text. Replace it with your own introduction.)";
  poem.conclusion =
    "Ultimately the poem leaves the reader with sand rather than monument. The sculptor’s art outlives the ruler it served, and Shelley uses that survival to suggest where lasting authority actually resides.\n\n(This is sample text. Replace it with your own conclusion.)";
  poem.annotations = ann.map((a) => makeAnnotation(a.ranges, a.text, a.label));
  /* keep created order stable & distinct so numbering is deterministic */
  poem.annotations.forEach((a, i) => {
    a.created = poem.created + i;
  });

  return { schema: LITERATURE_SCHEMA, app: "literature-revision", poems: [poem] };
}
