/** Mirrors the spaces_name_check constraint in supabase/schema.sql. */
export const SPACES = [
  { name: "School", icon: "🎓", blurb: "Courses, lectures, problem sets" },
  { name: "Personal", icon: "🌱", blurb: "Reading, ideas, side quests" },
  { name: "Misc", icon: "📦", blurb: "Everything else" },
];

/** Mirrors the public.block_type enum. */
export const BLOCK_TYPES = ["text", "heading", "media", "socratic"];

/** Shape of content_json per block_type, so the editor and API agree. */
export const BLOCK_CONTENT_SHAPES = {
  text: { text: "" },
  heading: { text: "", level: 2 },
  media: { url: "", caption: "", kind: "image" },
  socratic: { concept: "", prompt: "", sessionId: null },
};

export const SOCRATIC_STATUSES = ["active", "completed"];

/** Fractional index gap — see the order_index comment in schema.sql. */
export const ORDER_INDEX_STEP = 1024;
