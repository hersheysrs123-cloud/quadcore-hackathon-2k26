export const SPACES = [
  { name: "School", icon: "🎓", blurb: "Courses, lectures, problem sets" },
  { name: "Personal", icon: "🌱", blurb: "Reading, ideas, side quests" },
  { name: "Misc", icon: "📦", blurb: "Everything else" },
  { name: "Journal", icon: "📓", blurb: "Daily logs and private thoughts" },
];

export const SPACE_ICON_OPTIONS = [
  "📂", "🎓", "🌱", "📦", "📓", "🧪", "🎨", "🏋️", "💼", "🎯",
  "🔬", "💻", "📚", "💡", "⚡", "🚀", "🧠", "🌎", "🎵", "🛠️",
  "🪐", "🧬", "📐", "📝", "☕", "🎮"
];

export const BLOCK_CONTENT_SHAPES = {
  text: { text: "" },
  math: { text: "" },
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
