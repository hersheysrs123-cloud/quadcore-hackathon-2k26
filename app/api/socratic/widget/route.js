import { NextResponse } from "next/server";
import {
  errorPayload,
  generate,
  hasApiKey,
  readJson,
  readUsage,
} from "@/lib/gemini";
import {
  OBJECT_KINDS,
  RECOMMENDED_WIDGETS,
  WIDGET_SCHEMA,
  WIDGET_TYPES,
} from "@/lib/schemas";

export const dynamic = "force-dynamic";

/** What the diagnostic asked for -> the canvas mode that usually delivers it. */
const WIDGET_PREFERENCE = {
  "3d_vector_simulation": "3D_ROTATING_MODEL",
  physics_sandbox: "PARAMETRIC_SLIDER",
  interactive_quiz: "CONCEPT_GRAPH",
};

const SYSTEM_PROMPT = `You design interactive learning widgets for SocraticOS.

You receive a concept and the specific sub-topics a learner got WRONG in a
Socratic diagnostic. You return a configuration that a WebGL/Three.js canvas
renders directly. You are not writing prose — every field you emit becomes
geometry, a slider, or a caption.

Design rules:
- Build the widget around the gaps, not around the concept as a whole. A learner
  who understands 80% of a topic should see a scene about the other 20%.
- Every red sub-topic must be visible on the canvas: an object carrying
  gapStatus "red", a control that isolates it, or both. A gap the learner cannot
  manipulate is a gap the widget does not fix.
- Controls must change something observable. A slider whose motion produces no
  visible consequence is worse than no slider.
- Choose ranges so the misconception breaks somewhere inside them. If the
  learner thinks a force is constant, the range must include where it plainly
  is not.
- Keep the scene readable: 2-8 objects, 1-4 controls. Coordinates roughly -5..5.
- Colour by meaning, not decoration. Red-gap objects should draw the eye.
- explanationKey entries point at what to notice. They never state the answer —
  the learner has to see it happen.
- Do not include internal or system XML tags in your response.`;

/** Accepts ["Torque"] or [{ subtopic, feedback }] — both come off the heatmap. */
function normalizeGaps(input) {
  if (!Array.isArray(input)) return [];
  return input
    .map((item) => {
      if (typeof item === "string") return { subtopic: item.trim(), feedback: "" };
      if (item && typeof item === "object" && item.subtopic) {
        return {
          subtopic: String(item.subtopic).trim(),
          feedback: String(item.feedback ?? "").trim(),
        };
      }
      return null;
    })
    .filter((gap) => gap && gap.subtopic.length > 0);
}

const num = (value, fallback = 0) =>
  Number.isFinite(Number(value)) ? Number(value) : fallback;

const triple = (value) => {
  const arr = Array.isArray(value) ? value : [];
  return [num(arr[0]), num(arr[1]), num(arr[2])];
};

/**
 * Structured outputs guarantee the shape, not the values. This makes the config
 * safe to hand straight to a canvas: no NaN coordinates, no slider whose default
 * sits outside its own range, no zero-width range.
 */
function normalizeWidget(raw, fallbackType) {
  const state = raw.initialState ?? {};

  const objects = (state.objects ?? [])
    .filter((o) => o?.id)
    .map((o, i) => ({
      id: String(o.id),
      label: String(o.label ?? `Object ${i + 1}`),
      kind: OBJECT_KINDS.includes(o.kind) ? o.kind : "point",
      position: triple(o.position),
      vector: triple(o.vector),
      color: /^#[0-9a-f]{3,8}$/i.test(o.color ?? "") ? o.color : "#f0c04a",
      gapStatus: ["red", "yellow", "none"].includes(o.gapStatus)
        ? o.gapStatus
        : "none",
    }));

  const axisLabels = Array.isArray(state.axisLabels)
    ? state.axisLabels.slice(0, 3).map(String)
    : [];
  while (axisLabels.length < 3) axisLabels.push(["x", "y", "z"][axisLabels.length]);

  const interactiveControls = (raw.interactiveControls ?? [])
    .filter((c) => c?.name)
    .map((c, i) => {
      let min = num(c.min, 0);
      let max = num(c.max, 1);
      if (max <= min) max = min + 1; // a zero-width slider is unusable
      const step = Math.max(num(c.step, (max - min) / 100), 1e-6);
      return {
        name: String(c.name),
        key: String(c.key || `control${i}`),
        min,
        max,
        step,
        default: Math.max(min, Math.min(max, num(c.default, min))),
        unit: String(c.unit ?? ""),
        targetsSubtopic: String(c.targetsSubtopic ?? ""),
      };
    });

  return {
    widgetType: WIDGET_TYPES.includes(raw.widgetType) ? raw.widgetType : fallbackType,
    initialState: {
      cameraZoom: Math.max(0.2, Math.min(4, num(state.cameraZoom, 1))),
      rotationSpeed: Math.max(0, Math.min(3, num(state.rotationSpeed, 0.25))),
      backgroundColor: /^#[0-9a-f]{3,8}$/i.test(state.backgroundColor ?? "")
        ? state.backgroundColor
        : "#101216",
      axisLabels,
      objects,
    },
    interactiveControls,
    explanationKey: (raw.explanationKey ?? [])
      .filter((e) => e?.subtopic)
      .map((e) => ({
        subtopic: String(e.subtopic),
        hint: String(e.hint ?? ""),
        watchFor: String(e.watchFor ?? ""),
      })),
  };
}

/**
 * POST /api/socratic/widget
 *
 * Body: { concept, redSubtopics, recommendedWidget }
 *   redSubtopics accepts ["Torque"] or [{ subtopic, feedback }].
 *
 * 200 -> { widget: { widgetType, initialState, interactiveControls, explanationKey } }
 */
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }

  const { concept, redSubtopics, recommendedWidget } = body ?? {};

  if (!concept || typeof concept !== "string" || !concept.trim()) {
    return NextResponse.json(
      { error: "`concept` is required." },
      { status: 400 },
    );
  }

  const gaps = normalizeGaps(redSubtopics);
  if (gaps.length === 0) {
    return NextResponse.json(
      {
        error:
          "`redSubtopics` must contain at least one gap — there is nothing to build a widget around otherwise.",
      },
      { status: 400 },
    );
  }

  const requested = RECOMMENDED_WIDGETS.includes(recommendedWidget)
    ? recommendedWidget
    : "3d_vector_simulation";
  const preferredType = WIDGET_PREFERENCE[requested];

  if (!(await hasApiKey())) {
    return NextResponse.json(
      {
        error:
          "GOOGLE_API_KEY is not set. Add it to .env.local and restart the dev server.",
      },
      { status: 503 },
    );
  }

  const gapList = gaps
    .map((g, i) => `${i + 1}. ${g.subtopic}${g.feedback ? ` — ${g.feedback}` : ""}`)
    .join("\n");

  const userPrompt = `Concept: ${concept.trim()}

The diagnostic recommended a "${requested}", which usually maps to widgetType
"${preferredType}". Override that only if the gaps below clearly call for a
different mode.

Sub-topics the learner got wrong:
${gapList}

Build the widget that makes those specific errors visible and manipulable.`;

  try {
    const payload = await generate({
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
      schema: WIDGET_SCHEMA,
      // Scene layout benefits from some inventiveness, but not so much that
      // coordinates drift somewhere unrenderable.
      temperature: 0.6,
    });

    return NextResponse.json({
      widget: normalizeWidget(readJson(payload), preferredType),
      usage: readUsage(payload),
    });
  } catch (error) {
    const { status, body: payload } = errorPayload(error);
    return NextResponse.json(payload, { status });
  }
}
