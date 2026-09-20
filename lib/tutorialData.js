/**
 * 🎓 SocraticOS Tutorial Registry & Feature Metadata
 * Authoritative registry of all 9 onboarding chapters and 19 editor blocks.
 */

export const ALL_19_BLOCKS = [
  { type: "text", cat: "Text", name: "Paragraph", syntax: "Normal typing", desc: "Body text with smart paste & KaTeX." },
  { type: "h1", cat: "Text", name: "Heading 1", syntax: "# + Space", desc: "Large section title." },
  { type: "h2", cat: "Text", name: "Heading 2", syntax: "## + Space", desc: "Medium subsection heading." },
  { type: "h3", cat: "Text", name: "Heading 3", syntax: "### + Space", desc: "Small sub-topic heading." },
  { type: "h4", cat: "Text", name: "Heading 4", syntax: "#### + Space", desc: "Compact sub-heading." },
  { type: "bullet", cat: "Lists", name: "Bullet List", syntax: "- or * + Space", desc: "Hierarchical sub-bullets (Levels 0-4)." },
  { type: "number", cat: "Lists", name: "Numbered List", syntax: "1. + Space", desc: "Hierarchical numbering (1., a., i., A.)." },
  { type: "todo", cat: "Lists", name: "To-Do Checklist", syntax: "[] + Space", desc: "Interactive tasks with strikethrough." },
  { type: "toggle", cat: "Lists", name: "Toggle Accordion", syntax: "> + Space", desc: "Collapsible answers & disclosure blocks." },
  { type: "callout", cat: "Containers", name: "Callout Box", syntax: "/callout", desc: "Accent highlighted box with 8 emoji presets." },
  { type: "columns", cat: "Containers", name: "2-5 Columns Grid", syntax: "/2-5 columns", desc: "Multi-column split layouts with responsive cards." },
  { type: "table", cat: "Containers", name: "Table Grid", syntax: "/table", desc: "Notion-style grid with drag handles & math cells." },
  { type: "quote", cat: "Containers", name: "Blockquote", syntax: "| or \" + Space", desc: "Indented quote with accent border." },
  { type: "divider", cat: "Containers", name: "Horizontal Divider", syntax: "---", desc: "Subtle section separator line." },
  { type: "math", cat: "Math & Code", name: "LaTeX Equation", syntax: "$$ or /math", desc: "Centered math with formula templates tray." },
  { type: "inlinemath", cat: "Math & Code", name: "Inline Formula", syntax: "$E=mc^2$", desc: "In-sentence math with borderless styling." },
  { type: "code", cat: "Math & Code", name: "Code Snippet", syntax: "``` or /code", desc: "10-language syntax highlighting & copy." },
  { type: "media", cat: "Media & Web", name: "Image & YouTube", syntax: "/media", desc: "Visuals & YouTube embeds with 25/50/100% resize." },
  { type: "site", cat: "Media & Web", name: "Site Bookmark", syntax: "/site", desc: "Live web card with Google favicon resolution." },
];

export const TUTORIAL_STEPS_META = [
  {
    id: "philosophy",
    category: "Philosophy & Architecture",
    shortTitle: "Philosophy",
    badgeEmoji: "🦆",
    title: "Welcome to SocraticOS — The Active Learning OS",
    description:
      "SocraticOS is built on one core cognitive science principle: rereading is an illusion of competence. True learning happens when you are actively quizzed, interrogated on mechanisms, and forced to retrieve knowledge.",
  },
  {
    id: "editor",
    category: "Note Taking Studio",
    shortTitle: "19 Blocks",
    badgeEmoji: "✍️",
    title: "19-Block Notion-Grade Studio, KaTeX & Fonts",
    description:
      "Type '/' on any line to open the 22-item slash menu. Format notes with 19 distinct block types, drag the 6-dots handle (⠿) to reorder, add cover banners, and write formulas like $E=mc^2$.",
  },
  {
    id: "ai_suite",
    category: "AI Learning Engine",
    shortTitle: "AI Study Suite",
    badgeEmoji: "🤖",
    title: "AI Tutor, Explain Panel & Diagnostic Quizzes",
    description:
      "Study side-by-side with your notes without losing context. Open the persistent study drawer to interrogate doubts, get structured 4-part explanations, or run instant quizzes.",
  },
  {
    id: "quizzes",
    category: "Assessments & Exams",
    shortTitle: "Quizzes Studio",
    badgeEmoji: "🎯",
    title: "Quizzes Studio: 2-Column Exam Runner & 7 Question Types",
    description:
      "Take full-length diagnostic exams synthesized across multiple notes or curriculum docs. Features question matrix navigation, draft auto-saving, rubric grading, and 7 question types.",
  },
  {
    id: "spacehub",
    category: "Curriculum Management",
    shortTitle: "Space Hub",
    badgeEmoji: "⚙️",
    title: "Space Hub: Per-Space Syllabus Documents & Pedagogy",
    description:
      "Upload full course syllabi (.pdf, .docx, .txt, .md) to strictly anchor AI quizzes within your grade level. Never get penalised for Grade 12 content when you're in Grade 10.",
  },
  {
    id: "visualizations",
    category: "3D Scientific Studio",
    shortTitle: "3D Studio",
    badgeEmoji: "🌌",
    title: "50+ Interactive 3D Simulations Across 5 STEM Domains",
    description:
      "Interact with real-time WebGL models featuring OrbitControls, parameter sliders, clinical CT respiratory kinematics, optical benches, and dynamic physics equations.",
  },
  {
    id: "timers",
    category: "Time Management",
    shortTitle: "Timers & Calendar",
    badgeEmoji: "📅",
    title: "Multi-Timer HUD, Pomodoro Rhythm & Study Calendar",
    description:
      "Keep study momentum going with zero idle CPU timers. Run Pomodoro focus blocks (25m), short breaks (5m), or custom countdowns with animated browser tab pulse notifications (🦆 ↔ ❗️).",
  },
  {
    id: "websaver",
    category: "Research Management",
    shortTitle: "Web Saver",
    badgeEmoji: "🔖",
    title: "Dual-Pane Web Saver & Netscape Bookmark Manager",
    description:
      "Bookmark reference articles and documentation alongside your notes. Organize links in nested drag-and-drop folders, with live Google Favicon resolution and Netscape HTML import/export.",
  },
  {
    id: "shortcuts",
    category: "Pro Features & Shortcuts",
    shortTitle: "Power Shortcuts",
    badgeEmoji: "⚡",
    title: "Bulk Actions, 24h Auto-Purge Trash & Power Shortcuts",
    description:
      "Bulk select notes to star, duplicate, or move. Restore soft-deleted notes within 24 hours, and navigate the entire OS using global keyboard shortcuts.",
  },
];
