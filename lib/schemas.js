/**
 * Response schemas for Gemini structured output.
 *
 * These use Gemini's dialect, which is a subset of OpenAPI 3.0 rather than
 * standard JSON Schema. Three differences that matter if you edit them:
 *
 *   1. `type` values are UPPERCASE ("OBJECT", "ARRAY", "STRING", "NUMBER").
 *   2. `additionalProperties` is NOT supported and must be omitted. Field
 *      tightness comes from `required` instead.
 *   3. `minItems` / `maxItems` ARE supported, so array-length rules are
 *      enforced by the API rather than merely requested in prose.
 *
 * `propertyOrdering` is honoured by Gemini and worth setting — it makes the
 * generated JSON deterministic in field order, which keeps diffs and logs
 * readable.
 */

export const HEATMAP_STATUSES = ["green", "yellow", "red"];

export const RECOMMENDED_WIDGETS = [
  "3d_vector_simulation",
  "interactive_quiz",
  "physics_sandbox",
];


export const QUESTION_TYPES = [
  "multiple_choice",
  "multi_select",
  "short_answer",
  "long_answer",
  "value_input",
  "code_input",
  "step_ordering",
];

/** Output of /api/explain. Rendered by <ExplainPanel />. */
export const EXPLAIN_SCHEMA = {
  type: "OBJECT",
  properties: {
    concept: {
      type: "STRING",
      description: "The concept being explained, as a short title-case label.",
    },
    tldr: {
      type: "STRING",
      description:
        "One sentence, under 30 words, that a smart 14-year-old would " +
        "understand. No jargon, no hedging, no 'in essence'.",
    },
    keyIdeas: {
      type: "ARRAY",
      minItems: 3,
      maxItems: 5,
      description:
        "The load-bearing ideas, in the order someone should meet them. " +
        "Build each on the previous one.",
      items: {
        type: "OBJECT",
        properties: {
          heading: { type: "STRING", description: "Under 8 words." },
          body: {
            type: "STRING",
            description:
              "Two or three sentences explaining the mechanism — why it " +
              "works, not just that it does.",
          },
        },
        required: ["heading", "body"],
        propertyOrdering: ["heading", "body"],
      },
    },
    analogy: {
      type: "OBJECT",
      description:
        "One concrete analogy from everyday life. Say where it breaks, " +
        "because an analogy the learner over-trusts is worse than none.",
      properties: {
        title: { type: "STRING", description: "e.g. 'Like a revolving door'." },
        body: { type: "STRING", description: "Two or three sentences." },
        breaksDown: {
          type: "STRING",
          description: "One sentence on where the analogy stops being true.",
        },
      },
      required: ["title", "body", "breaksDown"],
      propertyOrdering: ["title", "body", "breaksDown"],
    },
    misconceptions: {
      type: "ARRAY",
      minItems: 1,
      maxItems: 3,
      description:
        "Mistakes a learner is most likely to make on THIS topic. Prefer " +
        "ones the learner's own notes hint at.",
      items: {
        type: "OBJECT",
        properties: {
          claim: {
            type: "STRING",
            description: "The wrong belief, stated plainly as someone would think it.",
          },
          whyItsWrong: {
            type: "STRING",
            description: "One sentence on the flaw in that reasoning.",
          },
        },
        required: ["claim", "whyItsWrong"],
        propertyOrdering: ["claim", "whyItsWrong"],
      },
    },
    workedExample: {
      type: "OBJECT",
      description:
        "One complete walkthrough of applying the concept to a specific " +
        "case. Concrete numbers or a tangible scenario.",
      properties: {
        problem: {
          type: "STRING",
          description: "The question or scenario being worked through.",
        },
        steps: {
          type: "ARRAY",
          minItems: 2,
          maxItems: 4,
          description: "The reasoning step by step.",
          items: {
            type: "OBJECT",
            properties: {
              step: { type: "STRING", description: "Under 6 words." },
              explanation: {
                type: "STRING",
                description: "One or two sentences on what happens in this step.",
              },
            },
            required: ["step", "explanation"],
            propertyOrdering: ["step", "explanation"],
          },
        },
        takeaway: {
          type: "STRING",
          description: "The principle this example illustrates, in one sentence.",
        },
      },
      required: ["problem", "steps", "takeaway"],
      propertyOrdering: ["problem", "steps", "takeaway"],
    },
    checkYourself: {
      type: "ARRAY",
      minItems: 2,
      maxItems: 3,
      description:
        "Questions that would expose whether the learner truly has this. " +
        "Never answerable by repeating a definition.",
      items: { type: "STRING" },
    },
  },
  required: [
    "concept",
    "tldr",
    "keyIdeas",
    "analogy",
    "misconceptions",
    "workedExample",
    "checkYourself",
  ],
  propertyOrdering: [
    "concept",
    "tldr",
    "keyIdeas",
    "analogy",
    "misconceptions",
    "workedExample",
    "checkYourself",
  ],
};

/**
 * Output of /api/quiz/generate.
 *
 * Supports multiple question types:
 * - multiple_choice: options array with 4 items, correctIndex is 0-based index.
 * - multi_select: options array with 4 items, correctIndices is array of 0-based indices.
 * - short_answer / long_answer: options empty, correctIndex -1.
 * - value_input: exact numeric or LaTeX math expression in expectedAnswer, tolerance number.
 * - code_input: starterCode string, language string, model code in expectedAnswer.
 * - step_ordering: steps array in correct logical sequence, options array with scrambled steps.
 */
export const QUIZ_SCHEMA = {
  type: "OBJECT",
  properties: {
    topic: { type: "STRING", description: "Short title-case label for the quiz." },
    questions: {
      type: "ARRAY",
      description:
        "Ordered easiest to hardest. Every question must be answerable from " +
        "the learner's notes; none may be answerable by pattern-matching a " +
        "phrase in them.",
      items: {
        type: "OBJECT",
        properties: {
          subtopic: {
            type: "STRING",
            description:
              "The sub-topic being tested, 2-4 words. Reuse the same label " +
              "across questions that probe the same thing — this is what the " +
              "heatmap groups by.",
          },
          type: { type: "STRING", enum: QUESTION_TYPES },
          prompt: {
            type: "STRING",
            description:
              "The question. Test the mechanism, deep reasoning, or an edge case, never a " +
              "definition the notes state verbatim.",
          },
          options: {
            type: "ARRAY",
            description:
              "Exactly 4 for multiple_choice and multi_select. Scrambled steps for step_ordering. Empty array for short_answer, long_answer, value_input, code_input.",
            items: { type: "STRING" },
          },
          correctIndex: {
            type: "NUMBER",
            description:
              "0-based index into options for multiple_choice; -1 for other question types.",
          },
          correctIndices: {
            type: "ARRAY",
            description:
              "Array of 0-based indices into options for multi_select (e.g. [0, 2]); empty array for other types.",
            items: { type: "NUMBER" },
          },
          steps: {
            type: "ARRAY",
            description:
              "The correct sequence of steps for step_ordering in proper order; empty array for other types.",
            items: { type: "STRING" },
          },
          starterCode: {
            type: "STRING",
            description:
              "Initial starter code skeleton for code_input; empty string for other types.",
          },
          language: {
            type: "STRING",
            description:
              "Programming or script language for code_input (e.g. python, pseudocode, javascript); empty string for other types.",
          },
          tolerance: {
            type: "NUMBER",
            description:
              "Numerical tolerance for value_input (e.g. 0.05 or 0 for exact match); 0 for other types.",
          },
          expectedAnswer: {
            type: "STRING",
            description:
              "For short_answer/long_answer, the model answer/rubric. For multiple_choice/multi_select, explanation of the correct choices. For value_input, the exact LaTeX/numeric solution. For code_input, the model code. For step_ordering, explanation of the proper sequence.",
          },
        },
        required: [
          "subtopic",
          "type",
          "prompt",
          "options",
          "correctIndex",
          "correctIndices",
          "steps",
          "starterCode",
          "language",
          "tolerance",
          "expectedAnswer",
        ],
        propertyOrdering: [
          "subtopic",
          "type",
          "prompt",
          "options",
          "correctIndex",
          "correctIndices",
          "steps",
          "starterCode",
          "language",
          "tolerance",
          "expectedAnswer",
        ],
      },
    },
  },
  required: ["topic", "questions"],
  propertyOrdering: ["topic", "questions"],
};

/** Output of /api/quiz/grade. Shares the heatmap shape with DIAGNOSTIC_SCHEMA. */
export const QUIZ_RESULT_SCHEMA = {
  type: "OBJECT",
  properties: {
    score: {
      type: "NUMBER",
      description:
        "Integer 0-100. Anchor it to the multiple-choice results you were " +
        "given as fact, then adjust for short-answer quality.",
    },
    summary: {
      type: "STRING",
      description:
        "Exactly two sentences addressed to the learner as 'you'. First what " +
        "held up, then where it broke.",
    },
    gradedAnswers: {
      type: "ARRAY",
      description: "One entry per question, in the order asked.",
      items: {
        type: "OBJECT",
        properties: {
          questionIndex: { type: "NUMBER", description: "0-based." },
          correct: {
            type: "BOOLEAN",
            description:
              "For multiple choice this must match the fact you were given. " +
              "For short answer, true only if the mechanism is right — " +
              "wording need not match.",
          },
          feedback: {
            type: "STRING",
            description:
              "One sentence. Name what they missed and why it matters. On a " +
              "correct answer, add the nuance they did not mention.",
          },
        },
        required: ["questionIndex", "correct", "feedback"],
        propertyOrdering: ["questionIndex", "correct", "feedback"],
      },
    },
    heatmap: {
      type: "ARRAY",
      minItems: 2,
      maxItems: 6,
      description:
        "One entry per distinct subtopic across the questions. Use the exact " +
        "subtopic labels from the questions.",
      items: {
        type: "OBJECT",
        properties: {
          subtopic: { type: "STRING" },
          status: {
            type: "STRING",
            enum: HEATMAP_STATUSES,
            description:
              "green = answered correctly with real reasoning; yellow = " +
              "correct but thin, or right for the wrong reason; red = wrong " +
              "or absent.",
          },
          feedback: {
            type: "STRING",
            description: "One sentence naming the specific gap.",
          },
        },
        required: ["subtopic", "status", "feedback"],
        propertyOrdering: ["subtopic", "status", "feedback"],
      },
    },
  },
  required: ["score", "summary", "gradedAnswers", "heatmap"],
  propertyOrdering: ["score", "summary", "gradedAnswers", "heatmap"],
};

/** Final-turn output of /api/socratic/chat. */
export const DIAGNOSTIC_SCHEMA = {
  type: "OBJECT",
  properties: {
    score: {
      type: "NUMBER",
      description:
        "Integer 0-100. How completely the learner explained the concept in " +
        "their own words. Score only what they actually said.",
    },
    summary: {
      type: "STRING",
      description:
        "Exactly two sentences. First: what they clearly hold. Second: where " +
        "the explanation broke down. Address the learner as 'you'.",
    },
    heatmap: {
      type: "ARRAY",
      minItems: 3,
      maxItems: 6,
      description: "One entry per sub-topic probed during the session.",
      items: {
        type: "OBJECT",
        properties: {
          subtopic: { type: "STRING" },
          status: {
            type: "STRING",
            enum: HEATMAP_STATUSES,
            description:
              "green = explained the mechanism unprompted; yellow = correct " +
              "but recited or needed leading; red = wrong, absent, or could " +
              "not survive a follow-up.",
          },
          feedback: {
            type: "STRING",
            description:
              "One sentence naming the specific gap. Quote or paraphrase what " +
              "they said. Never supply the missing answer.",
          },
        },
        required: ["subtopic", "status", "feedback"],
        propertyOrdering: ["subtopic", "status", "feedback"],
      },
    },
    recommendedWidget: {
      type: "STRING",
      enum: RECOMMENDED_WIDGETS,
      description:
        "3d_vector_simulation for spatial/geometric gaps; physics_sandbox for " +
        "dynamics and cause-and-effect gaps; interactive_quiz when the gaps " +
        "are definitional rather than mechanical.",
    },
  },
  required: ["score", "summary", "heatmap", "recommendedWidget"],
  propertyOrdering: ["score", "summary", "heatmap", "recommendedWidget"],
};


/** Allowed block types during intelligent note reformatting. */
export const REFORMAT_BLOCK_TYPES = [
  "text",
  "h1",
  "h2",
  "h3",
  "h4",
  "bullet",
  "number",
  "todo",
  "toggle",
  "callout",
  "quote",
  "divider",
  "code",
  "math",
  "inlinemath",
  "site",
  "table",
];

/** Output of /api/reformat. Consumed by BlockNoteEditor for note restructuring. */
export const REFORMAT_SCHEMA = {
  type: "OBJECT",
  properties: {
    title: {
      type: "STRING",
      description: "Clean, high-yield academic title for the note.",
    },
    emoji: {
      type: "STRING",
      description: "Single appropriate emoji symbol capturing the subject (e.g. ⚛️, 📐, 🧬, 💻, 🧠, 📚, ⚡, 🌌).",
    },
    blocks: {
      type: "ARRAY",
      description: "Ordered structured blocks composing the reformatted note.",
      items: {
        type: "OBJECT",
        properties: {
          type: {
            type: "STRING",
            enum: REFORMAT_BLOCK_TYPES,
            description: "SocraticOS block type.",
          },
          content: {
            type: "STRING",
            description: "Primary textual, markdown, or LaTeX formula content for the block. For table, can contain markdown table format | Col 1 | Col 2 |.",
          },
          level: {
            type: "INTEGER",
            description: "Indentation/nesting level for bullet list blocks (0 for top-level bullet, 1 for sub-bullet, 2 for sub-sub-bullet, etc.). Defaults to 0.",
          },
          calloutIcon: {
            type: "STRING",
            description: "Emoji icon for callout blocks (e.g. 💡, ⚠️, 📌, 🎯, ✨, 🧠, ⚡). Empty string if not a callout.",
          },
          details: {
            type: "STRING",
            description: "Collapsible body content for toggle blocks. Empty string if not a toggle.",
          },
          language: {
            type: "STRING",
            description: "Programming language for code blocks (e.g. python, javascript, cpp, rust, sql, html, json). Empty string if not code.",
          },
          checked: {
            type: "BOOLEAN",
            description: "Checklist state for todo blocks (true or false).",
          },
          url: {
            type: "STRING",
            description: "URL destination for site bookmark blocks.",
          },
          tableHeaders: {
            type: "ARRAY",
            items: { type: "STRING" },
            description: "Column headers if type is 'table'.",
          },
          tableRows: {
            type: "ARRAY",
            items: {
              type: "ARRAY",
              items: { type: "STRING" },
            },
            description: "2D array of string cells for rows if type is 'table'.",
          },
        },
        required: ["type", "content"],
        propertyOrdering: ["type", "content", "level", "calloutIcon", "details", "language", "checked", "url", "tableHeaders", "tableRows"],
      },
    },
  },
  required: ["title", "emoji", "blocks"],
  propertyOrdering: ["title", "emoji", "blocks"],
};


