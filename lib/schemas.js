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
