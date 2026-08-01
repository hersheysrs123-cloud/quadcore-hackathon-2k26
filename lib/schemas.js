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

export const WIDGET_TYPES = [
  "3D_ROTATING_MODEL",
  "PARAMETRIC_SLIDER",
  "CONCEPT_GRAPH",
];

export const OBJECT_KINDS = ["vector", "point", "plane", "node", "edge"];

export const QUESTION_TYPES = ["multiple_choice", "short_answer"];

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
          correction: {
            type: "STRING",
            description: "One or two sentences on what is actually true, and why.",
          },
        },
        required: ["claim", "correction"],
        propertyOrdering: ["claim", "correction"],
      },
    },
    workedExample: {
      type: "OBJECT",
      description:
        "One concrete instance carried all the way through. If the concept " +
        "is not procedural, trace a specific real case instead.",
      properties: {
        title: { type: "STRING" },
        steps: {
          type: "ARRAY",
          minItems: 2,
          maxItems: 6,
          description: "One action per step, each naming why it is taken.",
          items: { type: "STRING" },
        },
      },
      required: ["title", "steps"],
      propertyOrdering: ["title", "steps"],
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
 * `options` and `correctIndex` only carry meaning for multiple_choice.
 * Gemini's dialect has no conditional requirements, so short_answer sends an
 * empty options array and correctIndex -1 — the route normalises both.
 */
export const QUIZ_SCHEMA = {
  type: "OBJECT",
  properties: {
    topic: { type: "STRING", description: "Short title-case label for the quiz." },
    questions: {
      type: "ARRAY",
      minItems: 5,
      maxItems: 6,
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
              "The question. Test the mechanism or an edge case, never a " +
              "definition the notes state verbatim.",
          },
          options: {
            type: "ARRAY",
            maxItems: 4,
            description:
              "Exactly 4 for multiple_choice, empty for short_answer. Every " +
              "distractor must be a mistake a real learner would make, not " +
              "filler.",
            items: { type: "STRING" },
          },
          correctIndex: {
            type: "NUMBER",
            description:
              "0-based index into options for multiple_choice; -1 for " +
              "short_answer. Vary the position across questions.",
          },
          expectedAnswer: {
            type: "STRING",
            description:
              "For short_answer, the model answer to grade against. For " +
              "multiple_choice, one sentence on why the correct option is right.",
          },
        },
        required: ["subtopic", "type", "prompt", "options", "correctIndex", "expectedAnswer"],
        propertyOrdering: [
          "subtopic",
          "type",
          "prompt",
          "options",
          "correctIndex",
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

/** Output of /api/socratic/widget. Consumed directly by <WidgetCanvas />. */
export const WIDGET_SCHEMA = {
  type: "OBJECT",
  properties: {
    widgetType: {
      type: "STRING",
      enum: WIDGET_TYPES,
      description:
        "3D_ROTATING_MODEL for spatial relationships; PARAMETRIC_SLIDER when " +
        "the insight comes from varying a quantity; CONCEPT_GRAPH for " +
        "dependencies between ideas.",
    },

    initialState: {
      type: "OBJECT",
      description: "Opening state of the canvas.",
      properties: {
        cameraZoom: {
          type: "NUMBER",
          description: "1 = default framing. ~0.5 pulls back, ~2 moves in.",
        },
        rotationSpeed: {
          type: "NUMBER",
          description: "Radians per second, 0 to 1.5. Use 0 to start frozen.",
        },
        backgroundColor: {
          type: "STRING",
          description: "Hex string. Use #101216 unless there is a reason not to.",
        },
        axisLabels: {
          type: "ARRAY",
          minItems: 3,
          maxItems: 3,
          description: "Labels for the x, y and z axes, in that order.",
          items: { type: "STRING" },
        },
        objects: {
          type: "ARRAY",
          minItems: 2,
          maxItems: 8,
          description:
            "Renderable elements. Anything tied to a red or yellow gap must " +
            "carry the matching gapStatus so the canvas can highlight it.",
          items: {
            type: "OBJECT",
            properties: {
              id: { type: "STRING", description: "Unique, kebab-case." },
              label: { type: "STRING", description: "Short on-canvas caption." },
              kind: { type: "STRING", enum: OBJECT_KINDS },
              position: {
                type: "ARRAY",
                minItems: 3,
                maxItems: 3,
                description: "[x, y, z] origin, each roughly -5 to 5.",
                items: { type: "NUMBER" },
              },
              vector: {
                type: "ARRAY",
                minItems: 3,
                maxItems: 3,
                description:
                  "[x, y, z] direction and magnitude for kind 'vector'. Use " +
                  "[0, 0, 0] for every other kind.",
                items: { type: "NUMBER" },
              },
              color: { type: "STRING", description: "Hex string." },
              gapStatus: {
                type: "STRING",
                enum: ["red", "yellow", "none"],
                description:
                  "Links this element to a diagnostic gap, or 'none' if it is " +
                  "scaffolding the learner already understands.",
              },
            },
            required: ["id", "label", "kind", "position", "vector", "color", "gapStatus"],
            propertyOrdering: ["id", "label", "kind", "position", "vector", "color", "gapStatus"],
          },
        },
      },
      required: ["cameraZoom", "rotationSpeed", "backgroundColor", "axisLabels", "objects"],
      propertyOrdering: ["cameraZoom", "rotationSpeed", "backgroundColor", "axisLabels", "objects"],
    },

    interactiveControls: {
      type: "ARRAY",
      minItems: 1,
      maxItems: 4,
      description: "Each slider should make a specific gap visible when moved.",
      items: {
        type: "OBJECT",
        properties: {
          name: { type: "STRING", description: "Human label, e.g. 'Gravity'." },
          key: {
            type: "STRING",
            description: "camelCase identifier the frontend binds to.",
          },
          min: { type: "NUMBER" },
          max: { type: "NUMBER" },
          step: { type: "NUMBER", description: "Slider granularity." },
          default: { type: "NUMBER", description: "Must sit between min and max." },
          unit: { type: "STRING", description: "Empty string if unitless." },
          targetsSubtopic: {
            type: "STRING",
            description:
              "The gap this control exposes. Match it to an object's label so " +
              "the canvas can wire the two together.",
          },
        },
        required: ["name", "key", "min", "max", "step", "default", "unit", "targetsSubtopic"],
        propertyOrdering: ["name", "key", "min", "max", "step", "default", "unit", "targetsSubtopic"],
      },
    },

    explanationKey: {
      type: "ARRAY",
      minItems: 1,
      maxItems: 6,
      description: "One hint per gap. Points at the gap; never closes it.",
      items: {
        type: "OBJECT",
        properties: {
          subtopic: { type: "STRING" },
          hint: {
            type: "STRING",
            description:
              "One sentence naming what to notice. Must not state the answer.",
          },
          watchFor: {
            type: "STRING",
            description:
              "Concrete instruction, e.g. 'Drag Gravity to 0 and watch the " +
              "normal force'.",
          },
        },
        required: ["subtopic", "hint", "watchFor"],
        propertyOrdering: ["subtopic", "hint", "watchFor"],
      },
    },
  },
  required: ["widgetType", "initialState", "interactiveControls", "explanationKey"],
  propertyOrdering: ["widgetType", "initialState", "interactiveControls", "explanationKey"],
};
