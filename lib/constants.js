/** Mirrors the spaces_name_check constraint in supabase/schema.sql. */
export const SPACES = [
  { name: "School", icon: "🎓", blurb: "Courses, lectures, problem sets" },
  { name: "Personal", icon: "🌱", blurb: "Reading, ideas, side quests" },
  { name: "Misc", icon: "📦", blurb: "Everything else" },
  { name: "Journal", icon: "📓", blurb: "Daily logs and private thoughts" },
];

/**
 * Mirrors the public.block_type enum.
 *
 * Re-exported from lib/blockMapping.js, which owns the editor <-> database
 * translation, so there is exactly one list to keep in sync with schema.sql.
 */
// Extension is required: Node's ESM resolver does not guess it the way the
// Next bundler does, and this module gets imported by plain-node tooling.
export { DB_BLOCK_TYPES as BLOCK_TYPES } from "./blockMapping.js";

export const BLOCK_CONTENT_SHAPES = {
  text: { text: "" },
  math: { text: "" },
  inlinemath: { text: "" },
  heading: { text: "", level: 2 },
  bullet: { text: "" },
  number: { text: "" },
  todo: { text: "", checked: false },
  toggle: { text: "", open: true },
  callout: { text: "", icon: "💡" },
  quote: { text: "" },
  divider: {},
  site: { url: "" },
  code: { text: "", language: null },
  media: { url: "", caption: "", kind: "image" },
  socratic: { concept: "", prompt: "", sessionId: null },
  canvas: { text: "Canvas Drawing", drawingData: null, bgType: "dots" },
};

export const SOCRATIC_STATUSES = ["active", "completed"];

/** Fractional index gap — see the order_index comment in schema.sql. */
export const ORDER_INDEX_STEP = 1024;
