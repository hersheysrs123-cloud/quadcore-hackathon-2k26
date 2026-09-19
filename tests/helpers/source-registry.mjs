// ─── Source registry ────────────────────────────────────────────────
// Shared parsing for the Phase 5 guardrails.
//
// The four guardrail tests all need the same three things: what topics
// exist and what parameters they declare, which scene file each topic
// dispatches to, and what the HUD builds for that topic. None of that can
// be imported directly -- topics.js and VisualizationHUD.jsx are JSX using
// the "@/" alias, which node cannot resolve -- so it is read as text, the
// way tests/unit/topic-animation-speed.test.mjs already does.
//
// Text parsing is a means, not the point. Everything below is structural:
// it matches balanced braces rather than guessing at line shapes, so it
// fails loudly if the files are restructured instead of quietly passing.
// ─────────────────────────────────────────────────────────────────────

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, "../..");

const cache = new Map();

export function readSource(relative) {
  if (!cache.has(relative)) {
    cache.set(relative, fs.readFileSync(path.join(ROOT, relative), "utf8"));
  }
  return cache.get(relative);
}

export const exists = (relative) => fs.existsSync(path.join(ROOT, relative));

/**
 * Index just past the brace/bracket opening at `open`.
 *
 * Understands strings, template literals (including `${}` re-entering code),
 * regex-free comments and nesting -- enough to walk real source.
 */
export function matchBrace(s, open) {
  const pairs = { "{": "}", "[": "]", "(": ")" };
  const closer = pairs[s[open]];
  if (!closer) throw new Error(`matchBrace: '${s[open]}' at ${open} is not an opener`);
  const stack = [s[open]];
  let i = open + 1;
  while (i < s.length) {
    const c = s[i];
    const top = stack[stack.length - 1];
    if (top === '"' || top === "'") {
      if (c === "\\") { i += 2; continue; }
      if (c === top) stack.pop();
    } else if (top === "`") {
      if (c === "\\") { i += 2; continue; }
      if (c === "`") stack.pop();
      else if (c === "$" && s[i + 1] === "{") { stack.push("{"); i += 2; continue; }
    } else {
      if (c === "/" && s[i + 1] === "*") { const e = s.indexOf("*/", i + 2); i = e === -1 ? s.length : e + 2; continue; }
      if (c === "/" && s[i + 1] === "/") { const e = s.indexOf("\n", i); i = e === -1 ? s.length : e + 1; continue; }
      if (c === '"' || c === "'" || c === "`") stack.push(c);
      else if (c === "{" || c === "[" || c === "(") stack.push(c);
      else if (c === "}" || c === "]" || c === ")") {
        stack.pop();
        if (stack.length === 0) return i + 1;
      }
    }
    i += 1;
  }
  throw new Error(`matchBrace: unterminated from ${open}`);
}

/** Every `#rrggbb` literal in a blob, lowercased. */
export const hexLiterals = (s) =>
  new Set((s.match(/#[0-9a-fA-F]{6}\b/g) || []).map((c) => c.toLowerCase()));

// ─── topics.js ──────────────────────────────────────────────────────

let topicsCache = null;

/**
 * Every topic, with the parameter keys it declares.
 *
 * `defaults` and `controls` are read as key lists rather than evaluated --
 * the guardrails only ever compare which keys exist on each side.
 */
export function parseTopics() {
  if (topicsCache) return topicsCache;
  const src = readSource("components/visualizations/topics.js");
  const topics = [];

  const idRe = /^\s{4}id: "([a-z0-9_]+)",$/gm;
  let m;
  while ((m = idRe.exec(src))) {
    const id = m[1];
    // The entry runs from its opening brace to the matching close.
    const entryOpen = src.lastIndexOf("{", m.index);
    const entryEnd = matchBrace(src, entryOpen);
    const entry = src.slice(entryOpen, entryEnd);

    const category = (entry.match(/\bcategory: "([a-z]+)"/) || [])[1] ?? null;
    const ownHud = /\bownHud: true/.test(entry);

    const defaults = [];
    const dIdx = entry.indexOf("defaults: {");
    if (dIdx !== -1) {
      const open = entry.indexOf("{", dIdx);
      const block = entry.slice(open + 1, matchBrace(entry, open) - 1);
      for (const dm of block.matchAll(/(?:^|,)\s*([A-Za-z_$][\w$]*)\s*:/g)) defaults.push(dm[1]);
    }

    const controls = [];
    const cIdx = entry.indexOf("controls: [");
    if (cIdx !== -1) {
      const open = entry.indexOf("[", cIdx);
      const block = entry.slice(open, matchBrace(entry, open));
      for (const cm of block.matchAll(/\bkey: "([A-Za-z_$][\w$]*)"/g)) controls.push(cm[1]);
    }

    topics.push({ id, category, ownHud, defaults, controls, source: entry });
  }

  topicsCache = topics;
  return topics;
}

// ─── Category canvases ──────────────────────────────────────────────

const CATEGORY_CANVAS = {
  physics: "components/visualizations/PhysicsCanvas.jsx",
  chemistry: "components/visualizations/ChemistryCanvas.jsx",
  biology: "components/visualizations/BiologyCanvas.jsx",
  cs: "components/visualizations/CSCanvas.jsx",
  math: "components/visualizations/MathCanvas.jsx",
};

/** Where an identifier imported by `file` comes from, as a repo-relative path. */
function resolveImport(file, name) {
  const src = readSource(file);
  const re = new RegExp(
    `import\\s+(?:${name}\\s*,\\s*)?(?:\\{[^}]*\\b${name}\\b[^}]*\\}|${name})\\s*from\\s*["']([^"']+)["']`,
  );
  const m = src.match(re);
  if (!m) return null;
  let spec = m[1];
  if (spec.startsWith("@/")) spec = spec.slice(2);
  else if (spec.startsWith(".")) spec = path.posix.join(path.posix.dirname(file), spec);
  else return null; // a node_modules package
  for (const ext of ["", ".jsx", ".js", "/index.jsx", "/index.js"]) {
    if (exists(spec + ext) && fs.statSync(path.join(ROOT, spec + ext)).isFile()) return spec + ext;
  }
  return null;
}

/** The body of a top-level component/function declaration, or null. */
function declarationBody(src, name) {
  const mod = "(?:export\\s+(?:default\\s+)?)?";
  const patterns = [
    new RegExp(`^${mod}function ${name}\\s*\\(`, "m"),
    new RegExp(`^${mod}const ${name}\\s*=\\s*(?:function\\s*)?\\(`, "m"),
    new RegExp(`^${mod}const ${name}\\s*=\\s*(?:React\\.)?(?:memo|forwardRef)\\s*\\(`, "m"),
  ];
  for (const re of patterns) {
    const m = src.match(re);
    if (!m) continue;
    // m[0] ends on the '(' of the parameter list. Step over the whole list
    // before looking for the body, or a destructured parameter such as
    // `({ params = {} })` is mistaken for the function body.
    const paren = m.index + m[0].length - 1;
    try {
      const afterParams = matchBrace(src, paren);
      const open = src.indexOf("{", afterParams);
      if (open === -1) continue;
      return src.slice(open, matchBrace(src, open));
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * The initialiser of a top-level `const NAME = {...}` / `[...]`, or null.
 *
 * Scenes keep their colour tables in module-scope constants as often as they
 * inline them, so a closure that only walks function bodies would call those
 * colours undrawn.
 */
function declarationValue(src, name) {
  const m = src.match(new RegExp(`^(?:export\\s+)?const ${name}\\s*=\\s*`, "m"));
  if (!m) return null;
  const at = m.index + m[0].length;
  const opener = src[at];
  if (opener !== "{" && opener !== "[") return null;
  try {
    return src.slice(at, matchBrace(src, at));
  } catch {
    return null;
  }
}

/**
 * A component's body plus every same-file component it renders, transitively.
 *
 * Several scenes share one category canvas -- BiologyCanvas holds enzyme, dna,
 * cell and protein -- so using the whole file would let one scene's colours
 * vouch for another's. The closure keeps each scene answerable for what it
 * actually draws.
 */
export function componentClosure(file, root) {
  const src = readSource(file);
  const seen = new Set();
  const bodies = [];
  const queue = [root];

  while (queue.length) {
    const name = queue.shift();
    if (seen.has(name)) continue;
    seen.add(name);
    const body = declarationBody(src, name) ?? declarationValue(src, name);
    if (!body) continue;
    bodies.push(body);
    // Components rendered as JSX, helpers called by name, and the module-scope
    // tables the body reads colours out of.
    const referenceRe = /<([A-Z][\w$]*)|\b([A-Z][\w$]*)\s*\(|\b([A-Z][A-Z0-9_]{2,}|[A-Z][\w$]*)(?=\s*[.[])/g;
    for (const m of body.matchAll(referenceRe)) {
      const referenced = m[1] || m[2] || m[3];
      if (referenced && !seen.has(referenced)) queue.push(referenced);
    }
  }
  return { bodies, names: [...seen] };
}

let sceneCache = null;

/**
 * topic id -> { canvas, component, defining, modules }.
 *
 * `modules` is the lib/ and scene-kit sources the defining file imports --
 * where PALETTE and the lib colour tables legitimately keep their literals.
 * Sibling scene files are deliberately excluded.
 */
export function parseScenes() {
  if (sceneCache) return sceneCache;
  const out = new Map();

  for (const [category, canvas] of Object.entries(CATEGORY_CANVAS)) {
    if (!exists(canvas)) continue;
    const src = readSource(canvas);
    const idx = src.indexOf("const SCENES = {");
    if (idx === -1) continue;
    const open = src.indexOf("{", idx);
    const block = src.slice(open + 1, matchBrace(src, open) - 1);

    for (const m of block.matchAll(/(?:^|,)\s*([A-Za-z_$][\w$]*)\s*:\s*([A-Za-z_$][\w$]*)/g)) {
      const [, topicId, component] = m;
      const defining = resolveImport(canvas, component) ?? canvas;
      const modules = new Set();

      // Shared colour vocabularies -- lib/ engines and the scene helper
      // modules (scene-kit's PALETTE, arm-rig, cell-organelles, energy-bars).
      // A sibling *Canvas file is another scene, not shared vocabulary, so it
      // is excluded: one scene's colours must not vouch for another's.
      for (const im of readSource(defining).matchAll(/from\s*["']@\/(lib\/[^"']+|components\/visualizations\/[^"']+)["']/g)) {
        const spec = im[1];
        if (/Canvas$|Canvas\.jsx$/.test(spec)) continue;
        for (const ext of ["", ".jsx", ".js"]) {
          if (exists(spec + ext) && fs.statSync(path.join(ROOT, spec + ext)).isFile()) {
            modules.add(spec + ext);
            break;
          }
        }
      }
      out.set(topicId, { category, canvas, component, defining, modules: [...modules] });
    }
  }

  sceneCache = out;
  return out;
}

// ─── VisualizationHUD.jsx ───────────────────────────────────────────

let hudCache = null;

/**
 * topic id -> the `case` body the HUD builds its panels from, with the
 * legend's colour expressions pulled out.
 *
 * Colours are split into literals and references. A reference such as
 * `BASE_COLOURS.A` is safe by construction -- the scene and the HUD import
 * the same constant -- so only the literals need checking against the scene.
 */
export function parseHud() {
  if (hudCache) return hudCache;
  const src = readSource("components/visualizations/VisualizationHUD.jsx");
  const out = new Map();

  // Only the topic dispatch, not the control-type switch above it.
  const dispatchAt = src.indexOf("let legend = { title:");
  const caseRe = /^\s{4}case "([a-z0-9_]+)": \{$/gm;
  caseRe.lastIndex = dispatchAt;

  let m;
  while ((m = caseRe.exec(src))) {
    const topicId = m[1];
    const open = src.indexOf("{", m.index + m[0].length - 1);
    const body = src.slice(open, matchBrace(src, open));

    const literals = new Set();
    const references = new Set();

    // Each `legend = { ... }` assignment in this case body.
    let at = body.indexOf("legend = {");
    while (at !== -1) {
      const lOpen = body.indexOf("{", at);
      const block = body.slice(lOpen, matchBrace(body, lOpen));
      // A colour value can be a ternary, so take the whole expression up to
      // the next top-level comma and harvest every literal inside it. Reading
      // only the first token would let `cond ? "#aaa" : "#bbb"` slip past.
      for (const cm of block.matchAll(/\bcolou?r:\s*/g)) {
        const from = cm.index + cm[0].length;
        let depth = 0;
        let i = from;
        for (; i < block.length; i += 1) {
          const c = block[i];
          if ("{[(".includes(c)) depth += 1;
          else if ("}])".includes(c)) {
            if (depth === 0) break;
            depth -= 1;
          } else if (c === "," && depth === 0) break;
        }
        const expr = block.slice(from, i);
        for (const hex of expr.match(/#[0-9a-fA-F]{6}\b/g) || []) literals.add(hex.toLowerCase());
        for (const ref of expr.match(/\b[A-Z][A-Z0-9_]*(?:\.[\w$]+|\[[^\]]+\])+/g) || []) references.add(ref);
      }
      at = body.indexOf("legend = {", lOpen + 1);
    }

    out.set(topicId, { body, literals: [...literals], references: [...references] });
  }

  hudCache = out;
  return out;
}
