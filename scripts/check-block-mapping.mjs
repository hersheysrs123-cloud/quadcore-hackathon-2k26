/**
 * Round-trip guard for lib/blockMapping.js — run with `npm run check:blocks`.
 *
 * The editor and the database disagree about what a block is, and the mapping
 * between them is easy to break silently: add an enum value and forget the
 * editor case, or rename a content_json field and lose a media URL on save.
 * This asserts the invariant that actually matters — a row survives a trip
 * through the editor unchanged.
 *
 * Plain Node, no test framework. Exits non-zero on failure so CI can use it.
 */

import {
  DB_BLOCK_TYPES,
  EDITOR_TYPES,
  toDbBlock,
  toEditorBlock,
} from "../lib/blockMapping.js";
import { BLOCK_CONTENT_SHAPES, BLOCK_TYPES } from "../lib/constants.js";

let failures = 0;

// Order-insensitive: jsonb does not preserve key order, so comparing raw
// stringify output would fail on a difference Postgres cannot even represent.
const stable = (value) =>
  JSON.stringify(value, (_key, val) =>
    val && typeof val === "object" && !Array.isArray(val)
      ? Object.fromEntries(
          Object.entries(val).sort(([a], [b]) => a.localeCompare(b)),
        )
      : val,
  );

function check(name, actual, expected) {
  const a = stable(actual);
  const e = stable(expected);
  if (a === e) {
    console.log(`  ok   ${name}`);
  } else {
    failures++;
    console.log(`  FAIL ${name}\n       got      ${a}\n       expected ${e}`);
  }
}

// One representative row per block type, with non-default payloads so a
// dropped field shows up as a failure rather than passing on empty defaults.
const rows = [
  { block_type: "text", content_json: { text: "plain paragraph" } },
  { block_type: "heading", content_json: { text: "Big", level: 1 } },
  { block_type: "heading", content_json: { text: "Medium", level: 2 } },
  { block_type: "heading", content_json: { text: "Small", level: 3 } },
  { block_type: "heading", content_json: { text: "Sub", level: 4 } },
  { block_type: "bullet", content_json: { text: "a list item" } },
  { block_type: "number", content_json: { text: "first ordered step" } },
  { block_type: "todo", content_json: { text: "complete task", checked: true } },
  { block_type: "quote", content_json: { text: "famous quote" } },
  { block_type: "callout", content_json: { text: "important note", icon: "💡" } },
  { block_type: "divider", content_json: {} },
  { block_type: "site", content_json: { url: "https://wikipedia.org" } },
  { block_type: "code", content_json: { text: "const x = 1;", language: "js" } },
  {
    block_type: "media",
    content_json: { url: "https://x/i.png", caption: "Lecture 7", kind: "image" },
  },
  {
    block_type: "socratic",
    content_json: {
      concept: "Eigenvectors",
      prompt: "why one direction?",
      sessionId: "s-1",
    },
  },
];

console.log("\n1. DB -> editor -> DB is lossless");
for (const row of rows) {
  const level = row.content_json.level;
  check(
    `${row.block_type}${level ? ` L${level}` : ""}`,
    toDbBlock(toEditorBlock({ id: "b1", ...row })),
    row,
  );
}

console.log("\n2. every editor type maps to a valid enum value");
for (const type of EDITOR_TYPES) {
  const { block_type } = toDbBlock({ id: "x", type, content: "sample" });
  check(`${type} -> ${block_type}`, DB_BLOCK_TYPES.includes(block_type), true);
}

console.log("\n3. retyping a flattened block drops the stale payload");
const socraticRow = rows.find((r) => r.block_type === "socratic");
const flattenedSocratic = toEditorBlock({ id: "s", ...socraticRow });
check("socratic flattens to text", flattenedSocratic.type, "text");
check(
  "socratic retyped to h2 becomes a real heading",
  toDbBlock({ ...flattenedSocratic, type: "h2" }),
  { block_type: "heading", content_json: { text: "Eigenvectors — why one direction?", level: 2 } },
);

console.log("\n4. constants stay in sync with the mapping");
check("BLOCK_TYPES === DB_BLOCK_TYPES", BLOCK_TYPES, DB_BLOCK_TYPES);
check(
  "every enum value has a content shape",
  DB_BLOCK_TYPES.filter((type) => !BLOCK_CONTENT_SHAPES[type]),
  [],
);

console.log("\n5. edge cases");
check("missing row falls back to text", toEditorBlock(undefined, 0).type, "text");
check(
  "unknown enum value falls back to text",
  toEditorBlock({ block_type: "wat" }).type,
  "text",
);
check(
  "unknown editor type falls back to text",
  toDbBlock({ type: "wat", content: "z" }).block_type,
  "text",
);

console.log(failures === 0 ? "\nALL PASS\n" : `\n${failures} FAILURE(S)\n`);
process.exit(failures === 0 ? 0 : 1);
