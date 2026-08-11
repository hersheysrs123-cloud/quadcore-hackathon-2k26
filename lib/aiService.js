"use client";

import { generate, readJson, readText, readUsage, getEffectiveApiKey } from "./gemini";
import {
  DIAGNOSTIC_SCHEMA,
  EXPLAIN_SCHEMA,
  HEATMAP_STATUSES,
  OBJECT_KINDS,
  QUIZ_RESULT_SCHEMA,
  QUIZ_SCHEMA,
  RECOMMENDED_WIDGETS,
  WIDGET_SCHEMA,
  WIDGET_TYPES,
} from "./schemas";

// ─────────────────────────────────────────────────────────────────────
// Helper: Check if client should call local/direct AI or use backend fallback
// ─────────────────────────────────────────────────────────────────────
export async function shouldUseClientAI() {
  if (typeof window === "undefined") return false;
  const key = await getEffectiveApiKey();
  return Boolean(key) || !navigator.onLine;
}

// ─────────────────────────────────────────────────────────────────────
// 1. Socratic Chat Logic
// ─────────────────────────────────────────────────────────────────────
const SOCRATIC_PERSONA = `You are the Socratic Rubber Duck inside SocraticOS.

A learner explains a concept to you. Your job is to find the exact edge of what
they actually understand — using the Feynman technique — and never to teach.

Non-negotiable:
- NEVER state the answer, supply the missing step, or complete their reasoning.
  If they are one inch from it, ask the question that closes the inch themselves.
- NEVER confirm correctness ("exactly", "right", "good"). If they are correct,
  move to a harder case. Praise ends the diagnostic.
- Target mechanism, not vocabulary. "Why does that step work?" beats "what is
  the definition of X?"
- When an answer is vague, ask for a concrete instance rather than pointing out
  that it was vague.
- Prefer the edge case that would break a memorised answer but not an understood
  one.
- Plain language. No jargon the learner has not used first.
- Do not include internal or system XML tags in your response.`;

const SOCRATIC_TURN = `This is a normal turn.

Ask 1-2 probing questions and nothing else. No preamble, no summary of what they
just said, no encouragement. If you ask two, the second must depend on the first
rather than opening a new thread.

Keep the whole reply under 60 words.`;

const SOCRATIC_FINAL = `This is the final turn. Stop asking questions and
score the session.

Judge ONLY what the learner said in this conversation. Never credit them for
knowledge a typical learner would have, and never penalise them for something
you never probed.

- score: 0-100, calibrated to explanation quality, not effort or politeness.
- summary: exactly two sentences, addressed to the learner as "you".
- heatmap: one entry per sub-topic you actually probed. green = explained the
  mechanism unprompted; yellow = correct but recited, or needed leading;
  red = wrong, absent, or collapsed under a follow-up. Each feedback line names
  the specific gap and still withholds the answer.
- recommendedWidget: pick the one whose interaction would expose the largest
  red or yellow gap.`;

function buildSocraticPrompt({ concept, noteContent, isFinalTurn }) {
  const sections = [SOCRATIC_PERSONA, `Concept under examination: ${concept}`];
  if (noteContent?.trim()) {
    sections.push(
      `The learner's own notes on this concept are below. Use them to spot what
they wrote down but cannot explain — that gap is the most valuable thing you can
find. Do not quote the notes back to them as an answer.

<learner_notes>
${noteContent.trim()}
</learner_notes>`
    );
  }
  sections.push(isFinalTurn ? SOCRATIC_FINAL : SOCRATIC_TURN);
  return sections.join("\n\n");
}

function normalizeDiagnostic(raw) {
  const clamp = (n) => Math.max(0, Math.min(100, Math.round(Number(n) || 0)));
  return {
    score: clamp(raw.score),
    summary: String(raw.summary ?? "").trim(),
    heatmap: (raw.heatmap ?? [])
      .filter((entry) => entry?.subtopic)
      .map((entry) => ({
        subtopic: String(entry.subtopic),
        status: HEATMAP_STATUSES.includes(entry.status) ? entry.status : "yellow",
        feedback: String(entry.feedback ?? ""),
      })),
    recommendedWidget: RECOMMENDED_WIDGETS.includes(raw.recommendedWidget)
      ? raw.recommendedWidget
      : "interactive_quiz",
  };
}

export async function socraticChat({ noteContent, concept, conversationHistory, isFinalTurn = false }) {
  const history = (Array.isArray(conversationHistory) ? conversationHistory : [])
    .filter((m) => m && (m.role === "user" || m.role === "assistant"))
    .map((m) => ({ role: m.role, content: String(m.content ?? "").trim() }))
    .filter((m) => m.content.length > 0);

  const messages = history.length
    ? history
    : [{ role: "user", content: `I want to be examined on: ${concept.trim()}. Ask me your first question.` }];

  const system = buildSocraticPrompt({ concept: concept.trim(), noteContent, isFinalTurn });
  const payload = await generate({
    system,
    messages,
    temperature: isFinalTurn ? 0.3 : 0.9,
    schema: isFinalTurn ? DIAGNOSTIC_SCHEMA : null,
  });

  const usage = readUsage(payload);
  if (isFinalTurn) {
    return {
      type: "diagnostic",
      diagnostic: normalizeDiagnostic(readJson(payload)),
      usage,
    };
  }
  return {
    type: "question",
    reply: readText(payload),
    usage,
  };
}

// ─────────────────────────────────────────────────────────────────────
// 2. Socratic Widget Generator Logic
// ─────────────────────────────────────────────────────────────────────
const WIDGET_PREFERENCE = {
  "3d_vector_simulation": "3D_ROTATING_MODEL",
  physics_sandbox: "PARAMETRIC_SLIDER",
  interactive_quiz: "CONCEPT_GRAPH",
};

const WIDGET_SYSTEM = `You design interactive learning widgets for SocraticOS.

You receive a concept and the specific sub-topics a learner got WRONG in a
Socratic diagnostic. You return a configuration that a WebGL/Three.js canvas
renders directly. You are not writing prose — every field you emit becomes
geometry, a slider, or a caption.

Design rules:
- Build the widget around the gaps, not around the concept as a whole.
- Every red sub-topic must be visible on the canvas.
- Controls must change something observable.
- Keep the scene readable: 2-8 objects, 1-4 controls. Coordinates roughly -5..5.
- Do not include internal or system XML tags in your response.`;

function normalizeWidget(raw, fallbackType) {
  const state = raw.initialState ?? {};
  const num = (v, fb = 0) => (Number.isFinite(Number(v)) ? Number(v) : fb);
  const triple = (v) => {
    const arr = Array.isArray(v) ? v : [];
    return [num(arr[0]), num(arr[1]), num(arr[2])];
  };

  const objects = (state.objects ?? [])
    .filter((o) => o?.id)
    .map((o, i) => ({
      id: String(o.id),
      label: String(o.label ?? `Object ${i + 1}`),
      kind: OBJECT_KINDS.includes(o.kind) ? o.kind : "point",
      position: triple(o.position),
      vector: triple(o.vector),
      color: /^#[0-9a-f]{3,8}$/i.test(o.color ?? "") ? o.color : "#f0c04a",
      gapStatus: ["red", "yellow", "none"].includes(o.gapStatus) ? o.gapStatus : "none",
    }));

  const axisLabels = Array.isArray(state.axisLabels)
    ? state.axisLabels.slice(0, 3).map(String)
    : ["x", "y", "z"];

  const interactiveControls = (raw.interactiveControls ?? [])
    .filter((c) => c?.name)
    .map((c, i) => {
      let min = num(c.min, 0);
      let max = num(c.max, 1);
      if (max <= min) max = min + 1;
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

export async function socraticWidget({ concept, redSubtopics, recommendedWidget }) {
  const gaps = (Array.isArray(redSubtopics) ? redSubtopics : [])
    .map((item) => {
      if (typeof item === "string") return { subtopic: item.trim(), feedback: "" };
      if (item && typeof item === "object" && item.subtopic) {
        return { subtopic: String(item.subtopic).trim(), feedback: String(item.feedback ?? "").trim() };
      }
      return null;
    })
    .filter(Boolean);

  const requested = RECOMMENDED_WIDGETS.includes(recommendedWidget) ? recommendedWidget : "3d_vector_simulation";
  const preferredType = WIDGET_PREFERENCE[requested];

  const gapList = gaps.map((g, i) => `${i + 1}. ${g.subtopic}${g.feedback ? ` — ${g.feedback}` : ""}`).join("\n");
  const userPrompt = `Concept: ${concept.trim()}\n\nSub-topics the learner got wrong:\n${gapList}\n\nBuild the widget.`;

  const payload = await generate({
    system: WIDGET_SYSTEM,
    messages: [{ role: "user", content: userPrompt }],
    schema: WIDGET_SCHEMA,
    temperature: 0.6,
  });

  return {
    widget: normalizeWidget(readJson(payload), preferredType),
    usage: readUsage(payload),
  };
}

// ─────────────────────────────────────────────────────────────────────
// 3. Quiz Generation Logic
// ─────────────────────────────────────────────────────────────────────
const QUIZ_PERSONA = `You are the examiner inside SocraticOS, a study workspace.
You write short diagnostic quizzes from a learner's own notes. Test mechanisms, edge cases, and consequences.
Do not include internal or system XML tags in your response.`;

function normalizeQuiz(raw, fallbackTopic) {
  const questions = (Array.isArray(raw.questions) ? raw.questions : [])
    .map((q, i) => {
      const type = q?.type === "short_answer" ? "short_answer" : "multiple_choice";
      const options = (Array.isArray(q?.options) ? q.options : [])
        .map((o) => String(o ?? "").trim())
        .filter(Boolean);

      const usable = type === "multiple_choice" && options.length >= 2;
      const index = Number(q?.correctIndex);

      return {
        id: `q${i}`,
        subtopic: String(q?.subtopic ?? "").trim() || "General",
        type: usable ? "multiple_choice" : "short_answer",
        prompt: String(q?.prompt ?? "").trim(),
        options: usable ? options : [],
        correctIndex: usable && Number.isInteger(index) && index >= 0 && index < options.length ? index : -1,
        expectedAnswer: String(q?.expectedAnswer ?? "").trim(),
      };
    })
    .filter((q) => q.prompt);

  return {
    topic: String(raw.topic ?? "").trim() || fallbackTopic,
    questions,
  };
}

export async function quizGenerate({ concept, noteContent }) {
  const system = `${QUIZ_PERSONA}\n\nTopic: ${concept.trim()}\n\n<learner_notes>\n${String(noteContent).trim()}\n</learner_notes>`;
  const payload = await generate({
    system,
    messages: [{ role: "user", content: "Write the quiz on my notes. Order the questions easiest to hardest." }],
    temperature: 0.8,
    schema: QUIZ_SCHEMA,
  });

  return {
    quiz: normalizeQuiz(readJson(payload), concept.trim()),
    usage: readUsage(payload),
  };
}

// ─────────────────────────────────────────────────────────────────────
// 4. Quiz Grading Logic
// ─────────────────────────────────────────────────────────────────────
const GRADE_PERSONA = `You are the examiner inside SocraticOS, grading a learner's quiz.
Grade what they wrote, not what they probably meant.`;

function gradeObjectively(questions, responses) {
  return questions.map((question, i) => {
    const response = responses[i];
    const answer = response?.answer;

    if (question.type === "multiple_choice") {
      const picked = Number(answer);
      const answered = Number.isInteger(picked) && picked >= 0;
      return {
        answered,
        objective: answered ? picked === question.correctIndex : false,
        display: answered ? question.options?.[picked] ?? "" : "",
      };
    }

    const text = String(answer ?? "").trim();
    return { answered: text.length > 0, objective: null, display: text };
  });
}

function buildQuizTranscript(questions, graded) {
  return questions
    .map((question, i) => {
      const { answered, objective, display } = graded[i];
      const lines = [`Question ${i}. [${question.subtopic}] (${question.type})`, question.prompt];
      if (question.type === "multiple_choice") {
        lines.push(
          question.options.map((option, oi) => `  ${oi === question.correctIndex ? "*" : " "} ${oi}. ${option}`).join("\n"),
          `Learner picked: ${answered ? display : "— left blank —"}`,
          `ESTABLISHED FACT: this answer is ${objective ? "CORRECT" : "INCORRECT"}.`
        );
      } else {
        lines.push(
          `Model answer: ${question.expectedAnswer || "(none)"}`,
          `Learner wrote: ${answered ? display : "— left blank —"}`
        );
      }
      return lines.join("\n");
    })
    .join("\n\n---\n\n");
}

function normalizeQuizResult(raw, questions, graded) {
  const clamp = (n) => Math.max(0, Math.min(100, Math.round(Number(n) || 0)));
  const byIndex = new Map(
    (Array.isArray(raw.gradedAnswers) ? raw.gradedAnswers : []).map((entry) => [Number(entry?.questionIndex), entry])
  );

  const gradedAnswers = questions.map((question, i) => {
    const fromModel = byIndex.get(i);
    const { answered, objective, display } = graded[i];
    const correct = question.type === "multiple_choice" ? objective : answered && Boolean(fromModel?.correct);

    return {
      questionIndex: i,
      subtopic: question.subtopic,
      type: question.type,
      prompt: question.prompt,
      options: question.options,
      correctIndex: question.correctIndex,
      expectedAnswer: question.expectedAnswer,
      yourAnswer: display,
      answered,
      correct,
      feedback: String(fromModel?.feedback ?? "").trim(),
    };
  });

  const correctCount = gradedAnswers.filter((a) => a.correct).length;
  return {
    score: clamp((correctCount / Math.max(1, gradedAnswers.length)) * 100),
    summary: String(raw.summary ?? "").trim(),
    correctCount,
    totalCount: gradedAnswers.length,
    gradedAnswers,
    heatmap: raw.heatmap || [],
  };
}

export async function quizGrade({ concept, noteContent, questions, responses }) {
  const graded = gradeObjectively(questions, responses);
  const system = `${GRADE_PERSONA}\n\nTopic: ${String(concept ?? "").trim() || "this note"}`;

  const payload = await generate({
    system,
    messages: [{ role: "user", content: `Grade my quiz.\n\n${buildQuizTranscript(questions, graded)}` }],
    temperature: 0.2,
    schema: QUIZ_RESULT_SCHEMA,
  });

  return {
    result: normalizeQuizResult(readJson(payload), questions, graded),
    usage: readUsage(payload),
  };
}

// ─────────────────────────────────────────────────────────────────────
// 5. Concept Explainer Logic
// ─────────────────────────────────────────────────────────────────────
const EXPLAIN_PERSONA = `You are the Explainer inside SocraticOS, a study workspace.
Explain the concept clearly and concisely matching the schema.`;

function normalizeExplanation(raw) {
  const str = (v) => String(v ?? "").trim();
  const list = (v) => (Array.isArray(v) ? v : []);

  return {
    concept: str(raw.concept),
    tldr: str(raw.tldr),
    keyIdeas: list(raw.keyIdeas)
      .filter((idea) => idea?.heading || idea?.body)
      .map((idea) => ({ heading: str(idea.heading), body: str(idea.body) })),
    analogy: {
      title: str(raw.analogy?.title),
      body: str(raw.analogy?.body),
      breaksDown: str(raw.analogy?.breaksDown),
    },
    misconceptions: list(raw.misconceptions)
      .filter((m) => m?.claim)
      .map((m) => ({ claim: str(m.claim), correction: str(m.correction) })),
    workedExample: {
      title: str(raw.workedExample?.title),
      steps: list(raw.workedExample?.steps).map(str).filter(Boolean),
    },
    checkYourself: list(raw.checkYourself).map(str).filter(Boolean),
  };
}

export async function explainConcept({ concept, noteContent, focus }) {
  const system = `${EXPLAIN_PERSONA}\n\nConcept to explain: ${concept}\n\n<learner_notes>\n${noteContent || ""}\n</learner_notes>`;
  const payload = await generate({
    system,
    messages: [{ role: "user", content: `Explain "${concept}"` }],
    temperature: 0.4,
    schema: EXPLAIN_SCHEMA,
  });

  return {
    explanation: normalizeExplanation(readJson(payload)),
    usage: readUsage(payload),
  };
}
