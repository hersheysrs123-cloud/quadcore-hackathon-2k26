// ─── Guardrail 5.3 — no private engines in tests ────────────────────
// A unit test that reimplements the thing it is testing proves nothing.
//
// This is finding X3. tests/unit/respiratory-mechanics.test.mjs imported
// nothing from the application: it defined its own breathing engine at the
// top of the file and asserted against that. It passed for as long as it
// existed, whatever the scene did -- and the scene had drifted to three
// mutually inconsistent copies of the numbers by the time it was found.
//
// The rule: a test that declares a body of its own logic has to be reading
// the shipped engine from lib/. Helpers that only read files or shape
// assertions are fine; an arithmetic model of the subject is not.
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { ROOT } from "../helpers/source-registry.mjs";

const UNIT_DIR = path.join(ROOT, "tests", "unit");
const files = fs.readdirSync(UNIT_DIR).filter((f) => f.endsWith(".test.mjs")).sort();

/** Declarations at column zero: the file's own top-level logic. */
const topLevelFunctions = (src) => [
  ...src.matchAll(/^(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/gm),
  ...src.matchAll(/^const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:function\b|\([^)]*\)\s*=>|[A-Za-z_$][\w$]*\s*=>)/gm),
].map((m) => m[1]);

const importsFromLib = (src) => /from\s+["'](?:\.\.\/)+lib\/|from\s+["']@\/lib\//.test(src);

/**
 * Tests that legitimately declare helpers without touching lib/.
 *
 * Each of these tests a surface that is not an engine: the guardrails read
 * source files, and the UI tests assert on markup and registry shape. They
 * are allowed helpers because their helpers parse or assert -- they do not
 * model the subject.
 */
const STRUCTURAL = new Set([
  "legend-fidelity.test.mjs",
  "no-private-engines.test.mjs",
  "readout-parity.test.mjs",
  "dead-parameters.test.mjs",
]);

/** The ceiling the audit set: more than this is an engine, not a helper. */
const MAX_HELPERS = 2;

/**
 * Known violations, quarantined -- NOT approved.
 *
 * These are the "two out-of-scope instances" the audit predicted, plus one
 * more the scan turned up. Each defines a working model of its subject and
 * asserts against that model, so each currently proves nothing about the
 * code that ships. They are listed rather than deleted so that the rule can
 * be enforced for every other file today, and so the debt is named instead
 * of passing silently.
 *
 * Clearing one means extracting the real engine into lib/, pointing the
 * application at it, and pointing the test at it too -- the same move
 * lib/respiratory.js made for X3.
 */
const QUARANTINE = new Map([
  [
    "physics-solvers.test.mjs",
    "Nine private engines (solveRefraction, solveThinLens, solveRayOptics, solveGasLaw, " +
      "solveInduction, …). getHydrocarbonFormula also duplicates lib/organic.js's formulaFor, " +
      "so the two can disagree and only one of them ships.",
  ],
  [
    "quiz-grading.test.mjs",
    "gradeObjectively / fallbackHeatmap / normalizeQuizResult are reimplemented here; the " +
      "application grades elsewhere.",
  ],
  [
    "timer-store.test.mjs",
    "calculateSecondsRemaining / startTimer / pauseTimer / resetTimer are reimplemented here; " +
      "lib/timerStore.js holds the shipping logic.",
  ],
]);

describe("no test carries a private copy of the engine it is testing", () => {
  it("scans a real set of unit tests", () => {
    assert.ok(files.length > 50, `only ${files.length} unit tests found`);
  });

  for (const file of files) {
    if (STRUCTURAL.has(file) || QUARANTINE.has(file)) continue;

    it(`${file}`, () => {
      const src = fs.readFileSync(path.join(UNIT_DIR, file), "utf8");
      const helpers = topLevelFunctions(src);
      if (helpers.length <= MAX_HELPERS) return;

      assert.ok(
        importsFromLib(src),
        `${file} declares ${helpers.length} top-level functions ` +
          `(${helpers.slice(0, 6).join(", ")}${helpers.length > 6 ? ", …" : ""}) ` +
          `but imports nothing from lib/. If those are a model of the subject, the test is ` +
          `asserting against itself — import the shipped engine instead. If they are ` +
          `genuinely structural helpers, add the file to STRUCTURAL with a reason.`,
      );
    });
  }
});

describe("the quarantine stays honest", () => {
  // A quarantine that outlives the problem is just a lie with a comment on
  // it, so the list is checked in both directions.
  for (const [file, reason] of QUARANTINE) {
    it(`${file} still has the problem it was quarantined for`, () => {
      const full = path.join(UNIT_DIR, file);
      assert.ok(fs.existsSync(full), `${file} is gone — remove it from QUARANTINE`);
      const src = fs.readFileSync(full, "utf8");
      const helpers = topLevelFunctions(src);
      assert.ok(
        helpers.length > MAX_HELPERS && !importsFromLib(src),
        `${file} now reads from lib/ (or has shed its private engine). ` +
          `Delete it from QUARANTINE so the rule applies to it. Reason it was listed: ${reason}`,
      );
    });
  }

  it("does not quarantine more than the three known instances", () => {
    assert.equal(
      QUARANTINE.size,
      3,
      "the quarantine has grown — a new test was excused instead of fixed",
    );
  });
});

describe("the respiratory test in particular", () => {
  // The one that made the rule.
  it("reads its numbers from the shipping engine", () => {
    const src = fs.readFileSync(path.join(UNIT_DIR, "respiratory-mechanics.test.mjs"), "utf8");
    assert.match(src, /from\s+["']\.\.\/\.\.\/lib\/respiratory\.js["']/);
    assert.match(src, /from\s+["']\.\.\/\.\.\/lib\/respiratoryCredits\.js["']/);
    assert.ok(
      !/^function breathAt|^const breathAt\s*=/m.test(src),
      "the test has grown its own breathAt again",
    );
  });
});
