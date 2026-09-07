"use client";

import { generate, readJson, readText, readUsage, getEffectiveApiKey } from "./gemini.js";
import { db } from "./db.js";
import {
  DIAGNOSTIC_SCHEMA,
  EXPLAIN_SCHEMA,
  HEATMAP_STATUSES,
  OBJECT_KINDS,
  QUIZ_RESULT_SCHEMA,
  QUIZ_SCHEMA,
  RECOMMENDED_WIDGETS,
  REFORMAT_BLOCK_TYPES,
  REFORMAT_SCHEMA,
  WIDGET_SCHEMA,
  WIDGET_TYPES,
} from "./schemas.js";
import { blocksToMarkdownLossy, tryParseMarkdownToBlocks, getNormalizedTableData } from "./exportImport.js";
import { sanitizeMathText } from "./mathUtils.js";

import { getActiveSyllabusForSpace, getSpaceSettings } from "./storageService.js";

async function getEffectiveSyllabus(providedSyllabus, spaceId = null) {
  if (providedSyllabus !== undefined && providedSyllabus !== null && String(providedSyllabus).trim()) {
    return String(providedSyllabus).trim();
  }
  if (typeof window === "undefined") return "";
  try {
    if (spaceId) {
      const spaceDocs = await getActiveSyllabusForSpace(spaceId);
      const settings = await getSpaceSettings(spaceId);
      const parts = [];
      if (spaceDocs) {
        parts.push(spaceDocs);
      }
      if (settings?.academicLevel && settings.academicLevel !== "general") {
        parts.push(`Curriculum Academic Level: ${settings.academicLevel.toUpperCase()}`);
      }
      if (parts.length > 0) return parts.join("\n\n");
    }

    if (db?.settings) {
      const enabledItem = await db.settings.get("socratic_syllabus_enabled");
      if (enabledItem && enabledItem.value === "false") return "";
      const textItem = await db.settings.get("socratic_syllabus_statement");
      return textItem?.value ? String(textItem.value).trim() : "";
    }
  } catch (e) {
    return "";
  }
  return "";
}




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
If multiple notes are provided (demarcated by "=== Source Note: ... ==="), synthesize concepts across them and test connections, comparisons, and mechanisms across all selected notes.
Do not include internal or system XML tags in your response.`;

function normalizeQuiz(raw, fallbackTopic) {
  const validTypes = [
    "multiple_choice",
    "multi_select",
    "short_answer",
    "long_answer",
    "value_input",
    "code_input",
    "step_ordering",
  ];

  const questions = (Array.isArray(raw?.questions) ? raw.questions : [])
    .map((q, i) => {
      let type = q?.type;
      if (!validTypes.includes(type)) {
        type = "multiple_choice";
      }
      const options = (Array.isArray(q?.options) ? q.options : [])
        .map((o) => String(o ?? "").trim())
        .filter(Boolean);

      let steps = (Array.isArray(q?.steps) ? q.steps : [])
        .map((s) => String(s ?? "").trim())
        .filter(Boolean);

      if (type === "step_ordering") {
        if (steps.length < 2 && options.length >= 2) {
          steps = [...options];
        }
        if (steps.length < 2) {
          type = "short_answer";
        }
      }

      let scrambledOptions = options;
      if (type === "step_ordering" && steps.length >= 2) {
        if (scrambledOptions.length !== steps.length || scrambledOptions.every((s, idx) => s === steps[idx])) {
          scrambledOptions = [...steps].reverse();
        }
      }

      let correctIndices = [];
      if (type === "multi_select") {
        if (Array.isArray(q?.correctIndices)) {
          correctIndices = q.correctIndices
            .map(Number)
            .filter((idx) => Number.isInteger(idx) && idx >= 0 && idx < options.length);
        }
        if (correctIndices.length === 0 && Number.isInteger(Number(q?.correctIndex)) && Number(q.correctIndex) >= 0) {
          correctIndices = [Number(q.correctIndex)];
        }
        if (options.length < 2 || correctIndices.length === 0) {
          type = options.length >= 2 ? "multiple_choice" : "short_answer";
        }
      }

      const usable = type === "multiple_choice" && options.length >= 2;
      const finalType = type === "multiple_choice" ? (usable ? "multiple_choice" : "short_answer") : type;
      const index = Number(q?.correctIndex);

      const tolerance =
        finalType === "value_input" && !isNaN(Number(q?.tolerance))
          ? Math.max(0, Number(q.tolerance))
          : 0;

      const starterCode = finalType === "code_input" ? String(q?.starterCode ?? "").trim() : "";
      const language =
        finalType === "code_input" ? String(q?.language ?? "python").trim().toLowerCase() : "";

      return {
        id: `q${i}`,
        subtopic: String(q?.subtopic ?? "").trim() || "General",
        type: finalType,
        prompt: String(q?.prompt ?? "").trim(),
        options:
          finalType === "multiple_choice" || finalType === "multi_select"
            ? options
            : finalType === "step_ordering"
            ? scrambledOptions
            : [],
        correctIndex:
          finalType === "multiple_choice" && Number.isInteger(index) && index >= 0 && index < options.length
            ? index
            : -1,
        correctIndices: finalType === "multi_select" ? correctIndices : [],
        steps: finalType === "step_ordering" ? steps : [],
        starterCode,
        language,
        tolerance,
        expectedAnswer: String(q?.expectedAnswer ?? "").trim(),
      };
    })
    .filter((q) => q.prompt);

  return {
    topic: String(raw?.topic ?? "").trim() || fallbackTopic,
    questions,
  };
}

export async function quizGenerate({
  concept,
  noteContent,
  focus,
  difficulty = "medium",
  mcqCount,
  multiSelectCount,
  valueInputCount,
  stepOrderingCount,
  codeInputCount,
  shortAnswerCount,
  longAnswerCount,
  title,
  syllabus,
  spaceId,
  aiPersona,
  strictness,
  academicLevel,
}) {
  const difficultyPrompt = {
    easy: "Difficulty Level: EASY / FOUNDATIONAL. Test core definitions, clear fundamental relationships, and direct applications.",
    medium: "Difficulty Level: MEDIUM / STANDARD. Test mechanisms, analytical problems, and standard exam-style questions.",
    hard: "Difficulty Level: HARD / ADVANCED. Test edge cases, subtle distinctions, plausible distractors, and multi-step synthesis.",
    mastery: "Difficulty Level: MASTERY / EXPERT. Test deep conceptual derivations, structural evaluation, and counter-intuitive scenarios.",
  }[difficulty] || "Difficulty Level: MEDIUM.";

  let spaceConfig = null;
  if (spaceId) {
    try {
      spaceConfig = await getSpaceSettings(spaceId);
    } catch (e) {}
  }

  const effectivePersona = aiPersona || spaceConfig?.aiPersona || "examiner";
  const effectiveStrictness = strictness || spaceConfig?.strictness || "standard";
  const effectiveLevel = academicLevel || spaceConfig?.academicLevel || "igcse_grade_10";

  const personaPrompt = {
    strict: "PEDAGOGICAL PERSONA: Strict Examiner. Hold rigorous standards for precise scientific/academic terminology and zero ambiguity.",
    socratic: "PEDAGOGICAL PERSONA: Socratic Guide. Probe the foundational mechanics, counterfactual reasoning, and underlying 'why'.",
    coach: "PEDAGOGICAL PERSONA: Friendly Coach. Emphasize constructive application, approachable phrasing, and conceptual intuition.",
    olympiad: "PEDAGOGICAL PERSONA: Olympiad Mentor. Challenge with non-routine problem solving, multi-variable logic, and synthesis across topics.",
    examiner: "PEDAGOGICAL PERSONA: Standard Examiner. Produce balanced, high-fidelity diagnostic assessment questions.",
  }[effectivePersona] || "";

  const strictnessPrompt = {
    rigorous: "DISTRACTOR TOUGHNESS & RIGOR: HIGH RIGOR. Craft deceptively plausible distractors targeting common student misconceptions and inverse relationships.",
    relaxed: "DISTRACTOR TOUGHNESS & RIGOR: RELAXED / FOUNDATIONAL. Make correct answers distinctly verifiable with straightforward distractors.",
    standard: "DISTRACTOR TOUGHNESS & RIGOR: STANDARD. Balanced distractors representing realistic student errors without trick phrasing.",
  }[effectiveStrictness] || "";

  const countsSpecified =
    mcqCount !== undefined ||
    multiSelectCount !== undefined ||
    valueInputCount !== undefined ||
    stepOrderingCount !== undefined ||
    codeInputCount !== undefined ||
    shortAnswerCount !== undefined ||
    longAnswerCount !== undefined;

  const numMCQ = Number.isInteger(Number(mcqCount)) ? Math.max(0, Number(mcqCount)) : 3;
  const numMulti = Number.isInteger(Number(multiSelectCount)) ? Math.max(0, Number(multiSelectCount)) : 1;
  const numValue = Number.isInteger(Number(valueInputCount)) ? Math.max(0, Number(valueInputCount)) : 2;
  const numStep = Number.isInteger(Number(stepOrderingCount)) ? Math.max(0, Number(stepOrderingCount)) : 1;
  const numCode = Number.isInteger(Number(codeInputCount)) ? Math.max(0, Number(codeInputCount)) : 0;
  const numShort = Number.isInteger(Number(shortAnswerCount)) ? Math.max(0, Number(shortAnswerCount)) : 1;
  const numLong = Number.isInteger(Number(longAnswerCount)) ? Math.max(0, Number(longAnswerCount)) : 0;
  const totalCount = numMCQ + numMulti + numValue + numStep + numCode + numShort + numLong;

  const distributionPrompt = countsSpecified
    ? `Generate exactly ${totalCount} question(s):
- ${numMCQ} 'multiple_choice' (single correct option out of 4)
- ${numMulti} 'multi_select' (check-all-that-apply; 2 or 3 correct options out of 4, with 0-based indices in 'correctIndices')
- ${numValue} 'value_input' (exact numerical or LaTeX formula calculation with 'expectedAnswer' and 'tolerance')
- ${numStep} 'step_ordering' (3-6 steps in 'steps' array in CORRECT order, scrambled in 'options')
- ${numCode} 'code_input' (algorithm task with 'starterCode' skeleton and 'language')
- ${numShort} 'short_answer'
- ${numLong} 'long_answer'`
    : `Generate exactly 5 'multiple_choice', 1 'multi_select', and 2 'short_answer' questions. Total 8 questions.`;

  const focusPrompt = focus && String(focus).trim()
    ? `Target section: "${String(focus).trim()}".`
    : "";

  const effectiveSyllabus = await getEffectiveSyllabus(syllabus, spaceId);
  const syllabusPrompt = effectiveSyllabus
    ? `ACADEMIC SYLLABUS & CURRICULUM BOUNDARIES (STRICT CONSTRAINT):
<syllabus_statement>
${effectiveSyllabus}
</syllabus_statement>
CRITICAL REQUIREMENT: Confine all question concepts, definitions, difficulty depth, and expected answers strictly within the learner's syllabus statement above. DO NOT generate questions requiring out-of-syllabus mechanisms, higher-grade concepts, or college-level depth.`
    : "";

  const system = `${QUIZ_PERSONA}

Topic: ${concept.trim()}
${title ? `Title: ${title.trim()}` : ""}
${personaPrompt}
${strictnessPrompt}
Academic Standard: ${effectiveLevel.toUpperCase()} (Calibrate to Cambridge IGCSE Grade 10 standards in Math 0580/0607, CS 0478, Sciences).
${difficultyPrompt}
${distributionPrompt}
${focusPrompt}
${syllabusPrompt}

<learner_notes>
${String(noteContent).trim()}
</learner_notes>`;

  const payload = await generate({
    system,
    messages: [{ role: "user", content: "Write the quiz on my notes following the exact difficulty and question type distribution requested." }],
    temperature: 0.8,
    schema: QUIZ_SCHEMA,
  });

  const fallbackTopic = title || concept.trim();
  return {
    quiz: normalizeQuiz(readJson(payload), fallbackTopic),
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
      const isProvided = answer !== null && answer !== undefined && answer !== "";
      const picked = isProvided ? Number(answer) : NaN;
      const answered = Number.isInteger(picked) && picked >= 0;
      return {
        answered,
        objective: answered ? picked === question.correctIndex : false,
        display: answered ? (question.options?.[picked] ?? "") : "",
      };
    }

    if (question.type === "multi_select") {
      const pickedArr = Array.isArray(answer)
        ? answer.map(Number).filter((n) => Number.isInteger(n) && n >= 0)
        : [];
      const answered = pickedArr.length > 0;
      const correctSet = new Set(question.correctIndices || []);
      const pickedSet = new Set(pickedArr);
      const isExactMatch =
        correctSet.size > 0 &&
        correctSet.size === pickedSet.size &&
        [...pickedSet].every((v) => correctSet.has(v));
      const display = pickedArr
        .map((idx) => question.options?.[idx] ?? `Option ${idx + 1}`)
        .join(", ");
      return {
        answered,
        objective: isExactMatch,
        display: answered ? display : "",
      };
    }

    if (question.type === "step_ordering") {
      const studentSteps = Array.isArray(answer)
        ? answer.map((s) => String(s ?? "").trim()).filter(Boolean)
        : [];
      const answered = studentSteps.length >= 2;
      const expectedSteps = (question.steps || []).map((s) => String(s ?? "").trim());
      const isExactMatch =
        answered &&
        expectedSteps.length > 0 &&
        studentSteps.length === expectedSteps.length &&
        studentSteps.every((s, idx) => s === expectedSteps[idx]);
      const display = studentSteps.map((s, idx) => `${idx + 1}. ${s}`).join(" ➔ ");
      return {
        answered,
        objective: isExactMatch,
        display: answered ? display : "",
      };
    }

    if (question.type === "value_input") {
      const text = String(answer ?? "").trim();
      const answered = text.length > 0;
      const clean = text.replace(/^\$|\$$/g, "").trim().toLowerCase();
      const expectedClean = String(question.expectedAnswer ?? "").replace(/^\$|\$$/g, "").trim().toLowerCase();
      let isMatch = clean.length > 0 && clean === expectedClean;
      const numStudent = parseFloat(clean);
      const numExpected = parseFloat(expectedClean);
      if (!isMatch && !isNaN(numStudent) && !isNaN(numExpected)) {
        const tol = typeof question.tolerance === "number" ? Math.max(0, question.tolerance) : 0.01;
        isMatch = Math.abs(numStudent - numExpected) <= tol;
      }
      return {
        answered,
        objective: isMatch ? true : null,
        display: text,
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
      } else if (question.type === "multi_select") {
        const correctSet = new Set(question.correctIndices || []);
        lines.push(
          question.options.map((option, oi) => `  ${correctSet.has(oi) ? "*" : " "} [${oi}] ${option}`).join("\n"),
          `Learner selected: ${answered ? display : "— left blank —"}`,
          `ESTABLISHED FACT: this selection is ${objective ? "CORRECT" : "INCORRECT"}.`
        );
      } else if (question.type === "step_ordering") {
        lines.push(
          `Correct step sequence:\n${(question.steps || []).map((s, idx) => `  ${idx + 1}. ${s}`).join("\n")}`,
          `Learner step sequence: ${answered ? display : "— left blank —"}`,
          `ESTABLISHED FACT: this sequence is ${objective ? "CORRECT" : "INCORRECT"}.`
        );
      } else if (question.type === "value_input") {
        lines.push(
          `Expected answer: ${question.expectedAnswer || "(none)"}${question.tolerance ? ` (tolerance: ±${question.tolerance})` : ""}`,
          `Learner calculated: ${answered ? display : "— left blank —"}`,
          objective === true ? "ESTABLISHED FACT: this calculation is mathematically verified as CORRECT." : ""
        );
      } else if (question.type === "code_input") {
        lines.push(
          `Language: ${question.language || "code"}`,
          question.starterCode ? `Starter Code:\n\`\`\`\n${question.starterCode}\n\`\`\`` : "",
          `Model solution / rubric: ${question.expectedAnswer || "(none)"}`,
          `Learner submitted code:\n\`\`\`\n${answered ? display : "# left blank"}\n\`\`\``
        );
      } else {
        lines.push(
          `Model answer: ${question.expectedAnswer || "(none)"}`,
          `Learner wrote: ${answered ? display : "— left blank —"}`
        );
      }
      return lines.filter(Boolean).join("\n");
    })
    .join("\n\n---\n\n");
}

function fallbackHeatmap(gradedAnswers) {
  const bySubtopic = new Map();

  for (const answer of gradedAnswers) {
    const bucket = bySubtopic.get(answer.subtopic) ?? { right: 0, total: 0 };
    bucket.total += 1;
    if (answer.correct) bucket.right += 1;
    bySubtopic.set(answer.subtopic, bucket);
  }

  return [...bySubtopic.entries()].map(([subtopic, { right, total }]) => {
    const ratio = right / total;
    return {
      subtopic,
      status: ratio === 1 ? "green" : ratio > 0 ? "yellow" : "red",
      feedback: `${right} of ${total} correct on this subtopic.`,
    };
  });
}

function normalizeQuizResult(raw, questions, graded) {
  const clamp = (n) => Math.max(0, Math.min(100, Math.round(Number(n) || 0)));
  const byIndex = new Map(
    (Array.isArray(raw?.gradedAnswers) ? raw.gradedAnswers : []).map((entry) => [Number(entry?.questionIndex), entry])
  );

  const gradedAnswers = questions.map((question, i) => {
    const fromModel = byIndex.get(i) ?? (Array.isArray(raw?.gradedAnswers) ? raw.gradedAnswers[i] : null);
    const { answered, objective, display } = graded[i];
    const correct =
      question.type === "multiple_choice" ||
      question.type === "multi_select" ||
      question.type === "step_ordering"
        ? objective
        : objective === true
        ? true
        : answered && Boolean(fromModel?.correct);

    return {
      questionIndex: i,
      subtopic: question.subtopic,
      type: question.type,
      prompt: question.prompt,
      options: question.options,
      correctIndex: question.correctIndex,
      correctIndices: question.correctIndices,
      steps: question.steps,
      starterCode: question.starterCode,
      language: question.language,
      tolerance: question.tolerance,
      expectedAnswer: question.expectedAnswer,
      yourAnswer: display,
      answered,
      correct,
      feedback: String(fromModel?.feedback ?? "").trim(),
    };
  });

  const heatmap = (Array.isArray(raw?.heatmap) ? raw.heatmap : [])
    .filter((entry) => entry?.subtopic)
    .map((entry) => ({
      subtopic: String(entry.subtopic).trim(),
      status: HEATMAP_STATUSES.includes(entry.status) ? entry.status : "yellow",
      feedback: String(entry.feedback ?? "").trim(),
    }));

  const correctCount = gradedAnswers.filter((a) => a.correct).length;
  return {
    score: clamp((correctCount / Math.max(1, gradedAnswers.length)) * 100),
    summary: String(raw?.summary ?? "").trim(),
    correctCount,
    totalCount: gradedAnswers.length,
    gradedAnswers,
    heatmap: heatmap.length ? heatmap : fallbackHeatmap(gradedAnswers),
  };
}

export async function quizGrade({ concept, noteContent, questions, responses, syllabus, spaceId, aiPersona, strictness, academicLevel }) {
  const graded = gradeObjectively(questions, responses);
  let spaceConfig = null;
  if (spaceId) {
    try {
      spaceConfig = await getSpaceSettings(spaceId);
    } catch (e) {}
  }

  const effectivePersona = aiPersona || spaceConfig?.aiPersona || "examiner";
  const effectiveStrictness = strictness || spaceConfig?.strictness || "standard";
  const effectiveLevel = academicLevel || spaceConfig?.academicLevel || "general";

  const personaPrompt = {
    strict: "GRADING PERSONA: Strict Examiner. Hold high standards for precise academic terms, logical necessity, and exact conceptual boundaries.",
    coach: "GRADING PERSONA: Friendly Coach. Emphasize positive reinforcement and explain missed nuances gently in constructive terms.",
    olympiad: "GRADING PERSONA: Olympiad Mentor. Scrutinize mathematical/scientific rigor, generalization, and edge case thinking.",
  }[effectivePersona] || "";

  const strictnessPrompt = {
    rigorous: "GRADING STRICTNESS: HIGH RIGOR. Do not give the benefit of the doubt on ambiguous answers; deduct whenever a crucial link in the causal chain is omitted.",
    relaxed: "GRADING STRICTNESS: RELAXED. Award credit if the learner demonstrates the core intuitive idea, even with imperfect phrasing.",
  }[effectiveStrictness] || "";

  const effectiveSyllabus = await getEffectiveSyllabus(syllabus, spaceId);
  const syllabusPrompt = effectiveSyllabus
    ? `ACADEMIC SYLLABUS & CURRICULUM BOUNDARIES (STRICT GRADING DIRECTIVE):
<syllabus_statement>
${effectiveSyllabus}
</syllabus_statement>
CRITICAL GRADING RULES:
- Grade the learner strictly according to the syllabus standard above${effectiveLevel && effectiveLevel !== "general" ? ` (Level: ${effectiveLevel.toUpperCase()})` : ""}.
- DO NOT penalize the learner or deduct marks for omitting concepts, theories, or mechanisms that belong to higher grades or out-of-syllabus curriculums (e.g. NEVER demand Grade 12 or university level concepts from a Grade 10 student).
- Give full marks when their reasoning accurately satisfies this syllabus standard.
- Keep all feedback and suggested improvements strictly appropriate and relevant to this syllabus level.`
    : null;

  const system = [
    GRADE_PERSONA,
    `Topic: ${String(concept ?? "").trim() || "this note"}`,
    personaPrompt || null,
    strictnessPrompt || null,
    syllabusPrompt,
    noteContent?.trim() ? `<learner_notes>\n${String(noteContent).trim()}\n</learner_notes>` : null,
  ]
    .filter(Boolean)
    .join("\n\n");

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
Explain the concept clearly and concisely matching the schema.
Format all mathematical expressions, formulas, fractions, and variables in LaTeX wrapped in dollar signs ($...$ or $$...$$), e.g. $\\frac{a}{b}$, $\\text{unit}$. Never leave equations in plain text.
In JSON, always double-escape backslashes for LaTeX (e.g. "\\\\frac{a}{b}", "\\\\text{...}"). Never output raw "\\ext" (use "\\text").
Use clean inline markdown (**bold**, *italic*, \`code\`) for terminology and emphasis.`;

function normalizeExplanation(raw) {
  const str = (v) => sanitizeMathText(String(v ?? "")).trim();
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
      title: str(raw.workedExample?.title || raw.workedExample?.problem),
      problem: str(raw.workedExample?.problem || raw.workedExample?.title),
      takeaway: str(raw.workedExample?.takeaway),
      steps: list(raw.workedExample?.steps)
        .map((s) => {
          if (typeof s === "string") return { step: s.trim(), explanation: "" };
          if (s && typeof s === "object") {
            return {
              step: str(s.step || s.title || s.heading),
              explanation: str(s.explanation || s.body || s.detail || s.text),
            };
          }
          return { step: "", explanation: "" };
        })
        .filter((s) => s.step || s.explanation),
    },
    checkYourself: list(raw.checkYourself).map(str).filter(Boolean),
  };
}

export async function explainConcept({ concept, noteContent, focus, syllabus, spaceId }) {
  const effectiveSyllabus = await getEffectiveSyllabus(syllabus, spaceId);
  const syllabusPrompt = effectiveSyllabus
    ? `\n\nACADEMIC SYLLABUS & CURRICULUM BOUNDARIES (STRICT CONSTRAINT):
<syllabus_statement>
${effectiveSyllabus}
</syllabus_statement>
Calibrate explanations and vocabulary strictly to this syllabus level.`
    : "";

  const system = `${EXPLAIN_PERSONA}\n\nConcept to explain: ${concept}${syllabusPrompt}\n\n<learner_notes>\n${noteContent || ""}\n</learner_notes>`;
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

// ─────────────────────────────────────────────────────────────────────
// 6. Intelligent Note Reformatting Logic
// ─────────────────────────────────────────────────────────────────────
const REFORMAT_PERSONA = `You are the Master Note Architect & Academic Structural Classifier in SocraticOS.

Your task is to take the learner's note and restructure it into clean, appropriately-typed SocraticOS blocks while preserving knowledge fidelity and repairing formatting errors.

CRITICAL DIRECTIVES:
1. CONTENT & KNOWLEDGE FIDELITY (DO NOT CHANGE MEANING):
   - Do NOT delete, summarize, truncate, or rewrite the learner's actual concepts, scientific facts, code logic, numbers, definitions, or underlying information.
   - Preserve all words, sentences, and explanations from the original note faithfully.
   - You are primarily classifying and assigning the appropriate block TYPE and structure for each section.

2. LATEX FORMULA & EQUATION ENFORCEMENT (MANDATORY):
   - Keep ALL formula-related content in LaTeX inline ($...$) or block equation ($$...$$ or 'math' block) ONLY.
   - NEVER leave mathematical expressions, formulas, functions, variables, or equations in plain unformatted text—even for simple equations like f(x) = 0, y = mx + c, a^2 + b^2 = c^2, or x \in \mathbb{R}. Always format them in LaTeX (e.g., $f(x) = 0$).
   - If an equation, reaction pathway, or formula has dangling, unbalanced, or missing math delimiters (e.g. starting with '\text{Stimulus} \rightarrow ... \rightarrow \text{Response}$$' missing opening '$$', or unclosed '$$', or raw LaTeX math lines without dollar signs), classify it as a 'math' block, repair the formula, and provide clean LaTeX in content without wrapping dollar signs.
   - Fix broken/unbalanced braces (e.g. '$I^A I^o}$' -> '$I^A I^o$'), missing backslashes ('frac{a}{b}' -> '\frac{a}{b}'), and KaTeX syntax errors.

3. MARKDOWN & INLINE FORMATTING PRESERVATION (DO NOT STRIP FORMATTING):
   - Bullets and all SocraticOS blocks natively support rich inline Markdown identification for bold, italic, strikethrough, inline code, and LaTeX.
   - DO NOT strip out leading or inner formatting symbols for bold (**bold** or __bold__), italic (*italic* or _italic_), strikethrough/crossout (~~crossout~~), inline code (\`code\`), or LaTeX ($formula$) inside 'bullet' blocks, 'text' paragraphs, or ANY other blocks.
   - In 'bullet' blocks, ONLY strip the literal list prefix (such as a leading '- ' or '* ' followed by whitespace that indicated the bullet item in raw markdown). NEVER strip formatting markers from the bullet content (e.g. '- **Important Rule**: details' becomes '**Important Rule**: details', '- *Key Note*' becomes '*Key Note*', '- \`variable\`' becomes '\`variable\`', '- $f(x) = 0$' becomes '$f(x) = 0$').
   - In normal 'text' blocks and any other blocks, strictly do NOT strip bold, italic, strikethrough, or code markers. Preserve all emphasis symbols.
   - Strip redundant markdown markers and hashes ONLY from Heading blocks ('h1'–'h4'): do NOT output 'content: "**Eye Structures:**"' or 'content: "### 14.2 ..."'; output clean heading text like 'content: "Eye Structures"'.
   - Detect standalone bold category lines strictly ending with a colon (e.g. '* **Eye Structures:**', '**Key Hormones & Sources:**') and classify them as clean 'h3' or 'h4' subheadings with outer asterisks and colons stripped. Do NOT convert bold bullet items without colons (e.g. '**Item 1**') into headings—preserve them as bullets.
   - Fix malformed table pipes ('|'), misaligned rows, broken code fences, and unescaped brackets.

4. OPTIMAL BLOCK TYPING:
   - 'h1': Note main title or top-level topic breakdown.
   - 'h2': Primary concept sections (e.g. "Chapter 15: Drugs").
   - 'h3' / 'h4': Sub-topics and analytical components (e.g. "14.2 Sense Organs: The Eye", "Eye Structures", "Pupil Reflex").
   - 'text': Standard conceptual explanations and paragraphs. Keep all inline formulas in LaTeX ($f(x) = 0$).
   - 'bullet': Key takeaways, properties, characteristics, bullet lists. For nested sub-points, examples, or secondary details under a parent bullet, specify 'level' (0 for root bullet, 1 for sub-bullet, 2 for sub-sub-bullet). Preserve all inline bold, italic, strikethrough, inline code, and inline LaTeX ($...$).
   - 'number': Sequential steps, proofs, mechanisms, chronological processes. Preserve all inline formatting and LaTeX.
   - 'callout': Core axioms, key takeaways, critical warnings, golden rules (assign appropriate calloutIcon: 💡, ⚠️, 📌, 🎯, ✨, 🧠, ⚡, 🔬). Preserve all inline formatting and LaTeX.
   - 'quote': Notable definitions, historical quotes, or philosophical axioms.
   - 'toggle': Deep-dive proofs, secondary details, or collapsible derivations (set summary in content and body in details).
   - 'math': Display LaTeX mathematical formulas or multi-step reaction/reflex pathways (e.g. \int_a^b f(x)dx = F(b) - F(a), f(x) = 0, or \text{Stimulus} \rightarrow \text{Receptor} \rightarrow \text{Effector}). Do NOT wrap in dollar signs in content.
   - 'inlinemath': Inline equations or quick variables (e.g. E = mc^2, f(x) = 0).
   - 'code': Code snippets, algorithms, pseudocode, or queries (specify programming language in language).
   - 'todo': Actionable study tasks, revision checkpoints, self-test problems.
   - 'divider': Clean section dividers between major thematic transitions.
   - 'table': Structured comparisons, matrices, benchmark charts, data tables, or tabular parameter lists. Provide headers in tableHeaders and 2D cells in tableRows, or markdown table in content (e.g. | Feature | Option A | Option B |).
5. CONCISE ACADEMIC TITLE & EMOJI: Provide a title reflecting the note and a single relevant emoji (e.g. ⚛️, 🧬, 📐, 💻, 🧠, 📚, ⚡, 🌌).
6. OUTPUT FORMAT: Strictly output valid JSON matching the schema with no external markdown fences or XML tags.`;

export function normalizeReformattedPayload(raw, fallbackTitle = "Untitled Note") {
  const str = (v) => String(v ?? "").trim();
  const list = (v) => (Array.isArray(v) ? v : []);

  const now = Date.now();
  const rawBlocks = list(raw?.blocks);

  const cleanBlocks = rawBlocks
    .filter((b) => b && (b.content !== undefined || b.type === "divider" || b.type === "table"))
    .map((b, idx) => {
      let type = REFORMAT_BLOCK_TYPES.includes(b.type) ? b.type : "text";
      const id = `blk_reformat_${now}_${idx}`;
      let content = str(b.content);

      // Auto-heal math if content starts or ends with $$ or contains LaTeX pathway commands
      if (
        type === "text" &&
        (content.endsWith("$$") || content.startsWith("$$") || (/^\\(text|frac|rightarrow|sum|int|sqrt|begin)/.test(content) && content.includes("\\")))
      ) {
        type = "math";
        content = content.replace(/^\$\$+|\$\$+$/g, "").trim();
      }

      if (type === "math" || type === "inlinemath") {
        content = content.replace(/^\$\$+|\$\$+$/g, "").replace(/^\$+|\$$/g, "").trim();
      }

      // Auto-heal headings (strip redundant asterisks / hashes)
      if (type === "h1" || type === "h2" || type === "h3" || type === "h4") {
        content = content
          .replace(/^(\*+|\#+|\s*)+/, "")
          .replace(/(\*+|\s*)+$/, "")
          .replace(/[:\s]+$/, "")
          .trim();
      }

      // Auto-heal bullets (strip redundant leading bullet markers, only convert to h3 if explicitly ending with colon)
      if (type === "bullet") {
        content = content.replace(/^[*•\-+]\s+/, "").trim();
        const boldHeadingMatch = content.match(/^\*\*([^*:]+)(?::\*\*|\*\*:)[\s]*$/);
        if (boldHeadingMatch) {
          type = "h3";
          content = boldHeadingMatch[1].trim();
        }
      }

      const block = { id, type, content };

      if (type === "bullet") {
        const rawLvl = b.level !== undefined ? parseInt(b.level, 10) : 0;
        block.level = Number.isInteger(rawLvl) && rawLvl > 0 ? Math.min(rawLvl, 4) : 0;
      }

      if (type === "callout") {
        block.calloutIcon = str(b.calloutIcon) || "💡";
      } else if (type === "toggle") {
        block.details = str(b.details);
        block.open = true;
      } else if (type === "code") {
        block.language = str(b.language) || "javascript";
        block.meta = { language: block.language };
      } else if (type === "todo") {
        block.checked = Boolean(b.checked);
      } else if (type === "site") {
        block.url = str(b.url);
      } else if (type === "table") {
        let headers = Array.isArray(b.tableHeaders) ? b.tableHeaders.map(str) : [];
        let rows = Array.isArray(b.tableRows) ? b.tableRows.map((r) => (Array.isArray(r) ? r.map(str) : [])) : [];
        if (headers.length === 0 && (content.includes("|") || (b.tableData && b.tableData.headers))) {
          const norm = getNormalizedTableData(b.tableData, content);
          headers = norm.headers;
          rows = norm.rows;
        }
        block.tableData = {
          headers: headers.length > 0 ? headers : ["Column 1", "Column 2", "Column 3"],
          rows: rows.length > 0 ? rows : [["", "", ""], ["", "", ""]],
          hasHeaderRow: true,
        };
      }

      return block;
    });

  return {
    title: str(raw?.title) || str(fallbackTitle) || "Untitled Note",
    emoji: str(raw?.emoji) || null,
    blocks: cleanBlocks.length > 0 ? cleanBlocks : [{ id: `blk_reformat_${now}_0`, type: "text", content: "" }],
  };
}

export { normalizeReformattedPayload as normalizeReformattedNote };

export function chunkNoteBlocks(blocks = [], maxWordsPerChunk = 1000) {
  if (!Array.isArray(blocks) || blocks.length === 0) return [[]];

  const chunks = [];
  let currentChunk = [];
  let currentWordCount = 0;

  for (const block of blocks) {
    const text = (block.content || "") + " " + (block.details || "") + " " + (block.title || "");
    const words = text.trim().split(/\s+/).filter(Boolean).length || 1;

    const isMajorHeading = block.type === "h1" || block.type === "h2";
    if (
      currentChunk.length > 0 &&
      (currentWordCount + words > maxWordsPerChunk || (isMajorHeading && currentWordCount > 350))
    ) {
      chunks.push(currentChunk);
      currentChunk = [block];
      currentWordCount = words;
    } else {
      currentChunk.push(block);
      currentWordCount += words;
    }
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  return chunks;
}

export function heuristicReformatBlocks(rawBlocks = [], initialTitle = "Untitled Note") {
  const md = typeof rawBlocks === "string"
    ? rawBlocks
    : Array.isArray(rawBlocks) && rawBlocks.length > 0
      ? blocksToMarkdownLossy(rawBlocks)
      : "";

  if (!md.trim()) {
    return {
      title: initialTitle || "Untitled Note",
      emoji: "📝",
      blocks: [{ id: `blk_rf_${Date.now()}_0`, type: "text", content: "" }],
    };
  }

  const parsed = tryParseMarkdownToBlocks(md);
  const now = Date.now();
  let title = initialTitle && initialTitle !== "Untitled Note" ? initialTitle : "";
  let detectedEmoji = "📝";

  const enhancedBlocks = [];

  for (let i = 0; i < parsed.length; i++) {
    const b = parsed[i];
    let content = (b.content || "").trim();
    let type = b.type || "text";
    let calloutIcon = b.calloutIcon || "💡";
    let details = b.details || "";
    let language = b.language || null;
    let checked = Boolean(b.checked);
    let tableData = b.tableData || null;

    // If already a table block
    if (type === "table" || tableData) {
      enhancedBlocks.push({
        id: `blk_rf_${now}_${i}`,
        type: "table",
        content: "",
        tableData: getNormalizedTableData(tableData, content),
      });
      continue;
    }

    // Auto-heal math block detection if text wrapped in $$ or ends with $$ or is a LaTeX formula pathway
    if (
      type === "text" &&
      (content.endsWith("$$") || content.startsWith("$$") || (/^\\(text|frac|rightarrow|sum|int|sqrt|begin)/.test(content) && content.includes("\\")))
    ) {
      type = "math";
      content = content.replace(/^\$\$+|\$\$+$/g, "").replace(/^\$+|\$$/g, "").trim();
    } else if (type === "text" && content.startsWith("$") && content.endsWith("$") && content.length > 2 && !content.slice(1, -1).includes("$")) {
      type = "inlinemath";
      content = content.slice(1, -1).trim();
    }

    // Standalone bold category subheading: "* **Eye Structures:**" or "**Key Hormones & Sources:**"
    const boldHeaderMatch = content.match(/^([*•\-+]\s*)?\*\*([^*]+)\*\*[:\s]*$/);
    if (boldHeaderMatch && (type === "bullet" || type === "text")) {
      type = "h3";
      content = boldHeaderMatch[2].trim().replace(/[:\s]+$/, "");
    }

    // Bullet marker cleanup
    if (type === "bullet") {
      content = content.replace(/^[*•\-+]\s+/, "").trim();
    }


    // Headings cleanup (strip ** and #)
    if (type === "h1" || type === "h2" || type === "h3" || type === "h4") {
      content = content
        .replace(/^(\*+|\#+|\s*)+/, "")
        .replace(/(\*+|\s*)+$/, "")
        .replace(/[:\s]+$/, "")
        .trim();
    }


    // If no title yet, check if first H1 or short title text
    if (!title && (type === "h1" || (i === 0 && type === "text" && content.length < 60 && !content.includes(".")))) {
      title = content.replace(/^#+\s*/, "");
      if (type === "h1") continue;
    }

    // Heuristic Callout detection: "Key Idea:", "Warning:", "Note:", "Definition:", "Important:", "TL;DR:"
    const calloutMatch = content.match(/^(Important|Warning|Caution|Note|Key Idea|Takeaway|Rule|Theorem|Definition|Crucial fact|TL;?DR)\s*[:—\-]\s*(.*)$/i);
    if (calloutMatch && (type === "text" || type === "bullet")) {
      type = "callout";
      const keyword = calloutMatch[1].toLowerCase();
      if (keyword.includes("warn") || keyword.includes("caution")) calloutIcon = "⚠️";
      else if (keyword.includes("key") || keyword.includes("takeaway") || keyword.includes("rule") || keyword.includes("crucial")) calloutIcon = "🎯";
      else if (keyword.includes("theorem") || keyword.includes("def")) calloutIcon = "📌";
      else calloutIcon = "💡";
      content = calloutMatch[2];
    }

    // Keyword emoji detection
    const fullTextLower = (title + " " + content).toLowerCase();
    if (fullTextLower.includes("quantum") || fullTextLower.includes("physics") || fullTextLower.includes("atom")) detectedEmoji = "⚛️";
    else if (fullTextLower.includes("calculus") || fullTextLower.includes("derivative") || fullTextLower.includes("integral") || fullTextLower.includes("algebra") || fullTextLower.includes("math")) detectedEmoji = "📐";
    else if (fullTextLower.includes("cell") || fullTextLower.includes("dna") || fullTextLower.includes("bio") || fullTextLower.includes("enzyme") || fullTextLower.includes("eye") || fullTextLower.includes("hormone") || fullTextLower.includes("neurone") || fullTextLower.includes("reproduction")) detectedEmoji = "🧬";
    else if (fullTextLower.includes("code") || fullTextLower.includes("function") || fullTextLower.includes("algorithm") || fullTextLower.includes("python") || fullTextLower.includes("sql") || fullTextLower.includes("react")) detectedEmoji = "💻";
    else if (fullTextLower.includes("chemistry") || fullTextLower.includes("reaction") || fullTextLower.includes("molecule") || fullTextLower.includes("acid") || fullTextLower.includes("drug")) detectedEmoji = "🧪";
    else if (fullTextLower.includes("brain") || fullTextLower.includes("neuro") || fullTextLower.includes("psych") || fullTextLower.includes("synapse")) detectedEmoji = "🧠";
    else if (fullTextLower.includes("history") || fullTextLower.includes("war") || fullTextLower.includes("century")) detectedEmoji = "🏛️";
    else if (fullTextLower.includes("star") || fullTextLower.includes("gravity") || fullTextLower.includes("space") || fullTextLower.includes("planet")) detectedEmoji = "🌌";

    const level = Math.max(0, Math.min(4, Number(b.level) || 0));

    enhancedBlocks.push({
      id: `blk_rf_${now}_${i}`,
      type,
      content,
      ...(type === "bullet" && level > 0 ? { level } : {}),
      ...(type === "callout" ? { calloutIcon } : {}),
      ...(type === "toggle" ? { details, open: true } : {}),
      ...(type === "code" ? { language: language || "javascript", meta: { language: language || "javascript" } } : {}),
      ...(type === "todo" ? { checked } : {}),
    });
  }


  return {
    title: title || initialTitle || "Untitled Note",
    emoji: detectedEmoji,
    blocks: enhancedBlocks.length > 0 ? enhancedBlocks : [{ id: `blk_rf_${now}_0`, type: "text", content: "" }],
  };
}

async function reformatSingleChunk({ title = "", blocks = [], noteContent = "" }) {
  const effectiveContent = noteContent || blocksToMarkdownLossy(blocks);
  if (!effectiveContent.trim()) {
    return { reformatted: { title: title || "Untitled Note", emoji: null, blocks: [] } };
  }

  const useDirect = await shouldUseClientAI();

  if (useDirect) {
    try {
      const system = `${REFORMAT_PERSONA}\n\nCurrent Title: ${title || "Untitled Note"}\n\n<original_notes>\n${effectiveContent}\n</original_notes>`;
      const payload = await generate({
        system,
        messages: [{ role: "user", content: "Please read and intelligently reformat this note section into clean, structured SocraticOS blocks." }],
        temperature: 0.3,
        schema: REFORMAT_SCHEMA,
      });

      const parsed = readJson(payload);
      return {
        reformatted: normalizeReformattedPayload(parsed, title),
        usage: readUsage(payload),
      };
    } catch (directErr) {
      console.warn("Direct AI reformatting failed on chunk, attempting fallback:", directErr);
    }
  }

  // Attempt backend API route
  try {
    const res = await fetch("/api/reformat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, noteContent: effectiveContent }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data?.reformatted) return data;
    }
  } catch (apiErr) {
    console.warn("Backend /api/reformat call failed on chunk, falling back to local heuristic:", apiErr);
  }

  // Graceful offline heuristic fallback
  return {
    reformatted: heuristicReformatBlocks(blocks.length > 0 ? blocks : tryParseMarkdownToBlocks(effectiveContent), title),
    isHeuristic: true,
  };
}

export async function reformatNoteContent({
  title = "",
  blocks = [],
  noteContent = "",
  onProgress = null,
}) {
  const effectiveContent = noteContent || blocksToMarkdownLossy(blocks);
  if (!effectiveContent.trim()) {
    throw new Error("Cannot reformat an empty note. Please add some notes first.");
  }

  const rawBlocks = blocks.length > 0 ? blocks : tryParseMarkdownToBlocks(effectiveContent);
  const chunks = chunkNoteBlocks(rawBlocks, 1000);

  if (chunks.length <= 1) {
    onProgress?.({ current: 1, total: 1, message: "Reformatting note..." });
    return await reformatSingleChunk({ title, blocks: rawBlocks, noteContent: effectiveContent });
  }

  // Multi-chunk sequential processing
  let finalTitle = title;
  let finalEmoji = null;
  const allReformattedBlocks = [];
  let isHeuristicOverall = false;
  let totalUsage = null;
  const now = Date.now();

  for (let i = 0; i < chunks.length; i++) {
    const chunkBlocks = chunks[i];
    onProgress?.({
      current: i + 1,
      total: chunks.length,
      message: `Reformatting part ${i + 1} of ${chunks.length}...`,
    });

    const res = await reformatSingleChunk({
      title: finalTitle,
      blocks: chunkBlocks,
      noteContent: blocksToMarkdownLossy(chunkBlocks),
    });

    if (res?.isHeuristic) isHeuristicOverall = true;

    if (res?.reformatted) {
      const { title: chunkTitle, emoji: chunkEmoji, blocks: chunkResBlocks } = res.reformatted;
      if (i === 0 && chunkTitle && chunkTitle !== "Untitled Note") {
        finalTitle = chunkTitle;
      }
      if (chunkEmoji && !finalEmoji) {
        finalEmoji = chunkEmoji;
      }
      if (Array.isArray(chunkResBlocks)) {
        for (const blk of chunkResBlocks) {
          allReformattedBlocks.push({
            ...blk,
            id: `blk_reformat_${now}_${allReformattedBlocks.length}`,
          });
        }
      }
    }
  }

  return {
    reformatted: {
      title: finalTitle || title || "Untitled Note",
      emoji: finalEmoji,
      blocks: allReformattedBlocks.length > 0 ? allReformattedBlocks : rawBlocks,
    },
    isHeuristic: isHeuristicOverall,
    usage: totalUsage,
  };
}

// ─────────────────────────────────────────────────────────────────────
// 8. AI Tutor Chat Function
// ─────────────────────────────────────────────────────────────────────
export async function tutorChat({
  messages,
  concept,
  noteContent,
  spaceId = null,
  spaceName = "",
  syllabus = null,
  aiPersona = null,
  strictness = null,
  academicLevel = null,
}) {
  let effectiveSyllabus = syllabus;
  let effectivePersona = aiPersona;
  let effectiveStrictness = strictness;
  let effectiveLevel = academicLevel;

  if (spaceId && typeof window !== "undefined") {
    if (!effectiveSyllabus) {
      effectiveSyllabus = await getActiveSyllabusForSpace(spaceId);
    }
    const settings = await getSpaceSettings(spaceId);
    if (settings) {
      if (!effectivePersona) effectivePersona = settings.aiPersona;
      if (!effectiveStrictness) effectiveStrictness = settings.strictness;
      if (!effectiveLevel) effectiveLevel = settings.academicLevel;
    }
  }

  const payload = {
    messages,
    concept,
    noteContent,
    spaceId,
    spaceName,
    syllabus: effectiveSyllabus || "",
    aiPersona: effectivePersona || "examiner",
    strictness: effectiveStrictness || "standard",
    academicLevel: effectiveLevel || "general",
  };

  const isClient = await shouldUseClientAI();
  if (isClient) {
    const academicLevelDirectives = {
      igcse: `ACADEMIC STANDARD: Cambridge IGCSE / O-Level (Grade 9-10). Calibrate explanation depth and vocabulary strictly to this standard.`,
      ib_hl: `ACADEMIC STANDARD: IB Diploma Higher Level (HL). Rigorous theoretical depth and precise syllabus command terms.`,
      ap: `ACADEMIC STANDARD: AP / College Board. Conceptual rigor aligned with standard AP rubrics.`,
      university: `ACADEMIC STANDARD: University / Undergraduate. High-level rigor and formal derivations.`,
      olympiad: `ACADEMIC STANDARD: Olympiad / Competitive Excellence. First-principles thinking and edge cases.`,
      general: `ACADEMIC STANDARD: General Concept Mastery.`,
    };

    const personaDirectives = {
      strict: `AI TUTOR PERSONA: Strict Examiner. Demand exact scientific terminology and correct imprecise phrasing.`,
      socratic: `AI TUTOR PERSONA: Socratic Guide. Ask guiding questions before handing out final answers.`,
      coach: `AI TUTOR PERSONA: Friendly Coach. Warm, highly intuitive phrasing and encouraging analogies.`,
      olympiad: `AI TUTOR PERSONA: Olympiad Mentor. Encourage non-routine problem solving and multiple viewpoints.`,
      examiner: `AI TUTOR PERSONA: Standard Academic Tutor. Balanced, structured, and exam-focused.`,
    };

    const strictnessDirectives = {
      rigorous: `EXPLANATION RIGOR: HIGH RIGOR. Uncompromising on precision, units, and common exam traps.`,
      relaxed: `EXPLANATION RIGOR: RELAXED. Focus on intuition and relatable steps.`,
      standard: `EXPLANATION RIGOR: BALANCED.`,
    };

    const system = [
      `You are the personal AI Tutor inside SocraticOS, an intelligent study workspace.
Your mission is to help the learner resolve doubts, understand concepts, work through step-by-step problem derivations, and master their subjects.
Format with Markdown, bold key terms, and KaTeX LaTeX math ($...$ for inline, $$...$$ for display). Answer doubts directly, warmly, and clearly without filler.`,
      spaceName ? `Active Study Space: "${spaceName}"` : null,
      concept ? `Topic: "${concept}"` : null,
      academicLevelDirectives[payload.academicLevel] || academicLevelDirectives.general,
      personaDirectives[payload.aiPersona] || personaDirectives.examiner,
      strictnessDirectives[payload.strictness] || strictnessDirectives.standard,
      payload.syllabus?.trim()
        ? `ACADEMIC SYLLABUS & CURRICULUM BOUNDARIES (STRICT CONSTRAINT):
<syllabus_statement>
${payload.syllabus.trim()}
</syllabus_statement>
Align explanations and notation strictly with this syllabus material.`
        : null,
      payload.noteContent?.trim()
        ? `The learner is studying this note:
<learner_notes>
${payload.noteContent.trim()}
</learner_notes>`
        : null,
    ]
      .filter(Boolean)
      .join("\n\n");

    const resultPayload = await generate({
      system,
      messages,
      temperature: 0.5,
    });

    return {
      reply: readText(resultPayload),
      usage: readUsage(resultPayload),
    };
  }

  const res = await fetch("/api/tutor/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Failed to get tutor response (${res.status})`);
  return data;
}



