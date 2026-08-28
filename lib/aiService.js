"use client";

import { generate, readJson, readText, readUsage, getEffectiveApiKey } from "./gemini.js";
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
2. SYNTAX ERROR HEALING & FORMATTING REPAIR (ALLOWED EDITS):
   - LaTeX Math & Pathway Healing:
     * If an equation, reaction pathway, or formula has dangling, unbalanced, or missing math delimiters (e.g. starting with '\\text{Stimulus} \\rightarrow ... \\rightarrow \\text{Response}$$' missing opening '$$', or unclosed '$$', or raw LaTeX math lines without dollar signs), classify it as a 'math' block, repair the formula, and provide clean LaTeX in content without wrapping dollar signs.
     * Fix broken/unbalanced braces (e.g. '$I^A I^o}$' -> '$I^A I^o$'), missing backslashes ('frac{a}{b}' -> '\\frac{a}{b}'), and KaTeX syntax errors.
   - Markdown & Asterisk Symbol Healing:
     * Strip redundant markdown markers and asterisks from Heading blocks ('h1'–'h4'): do NOT output 'content: "**Eye Structures:**"' or 'content: "### 14.2 ..."'; output clean heading text like 'content: "Eye Structures"'.
     * Detect standalone bold category lines ending with a colon (e.g. '* **Eye Structures:**', '**Key Hormones & Sources:**') and classify them as clean 'h3' or 'h4' subheadings with outer asterisks stripped.
     * Strip redundant list markers ('* ', '- ') from the beginning of 'bullet' block content.
     * Fix malformed table pipes ('|'), misaligned rows, broken code fences, and unescaped brackets.

3. OPTIMAL BLOCK TYPING:
   - 'h1': Note main title or top-level topic breakdown.
   - 'h2': Primary concept sections (e.g. "Chapter 15: Drugs").
   - 'h3' / 'h4': Sub-topics and analytical components (e.g. "14.2 Sense Organs: The Eye", "Eye Structures", "Pupil Reflex").
   - 'text': Standard conceptual explanations and paragraphs.
   - 'bullet': Key takeaways, properties, characteristics, bullet lists.
   - 'number': Sequential steps, proofs, mechanisms, chronological processes.
   - 'callout': Core axioms, key takeaways, critical warnings, golden rules (assign appropriate calloutIcon: 💡, ⚠️, 📌, 🎯, ✨, 🧠, ⚡, 🔬).
   - 'quote': Notable definitions, historical quotes, or philosophical axioms.
   - 'toggle': Deep-dive proofs, secondary details, or collapsible derivations (set summary in content and body in details).
   - 'math': Display LaTeX mathematical formulas or multi-step reaction/reflex pathways (e.g. \\int_a^b f(x)dx = F(b) - F(a) or \\text{Stimulus} \\rightarrow \\text{Receptor} \\rightarrow \\text{Effector}). Do NOT wrap in dollar signs in content.
   - 'inlinemath': Inline equations or quick variables (e.g. E = mc^2).
   - 'code': Code snippets, algorithms, pseudocode, or queries (specify programming language in language).
   - 'todo': Actionable study tasks, revision checkpoints, self-test problems.
   - 'divider': Clean section dividers between major thematic transitions.
   - 'table': Structured comparisons, matrices, benchmark charts, data tables, or tabular parameter lists. Provide headers in tableHeaders and 2D cells in tableRows, or markdown table in content (e.g. | Feature | Option A | Option B |).
4. CONCISE ACADEMIC TITLE & EMOJI: Provide a title reflecting the note and a single relevant emoji (e.g. ⚛️, 🧬, 📐, 💻, 🧠, 📚, ⚡, 🌌).
5. OUTPUT FORMAT: Strictly output valid JSON matching the schema with no external markdown fences or XML tags.`;

function normalizeReformattedPayload(raw, fallbackTitle = "Untitled Note") {
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

      // Auto-heal bullets (strip redundant leading bullet markers)
      if (type === "bullet") {
        content = content.replace(/^[*•\-+]\s+/, "").trim();
        const boldHeadingMatch = content.match(/^\*\*([^*]+)\*\*[:\s]*$/);
        if (boldHeadingMatch) {
          type = "h3";
          content = boldHeadingMatch[1].trim().replace(/[:\s]+$/, "");
        }
      }

      const block = { id, type, content };


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
  const md = Array.isArray(rawBlocks) && rawBlocks.length > 0
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

    enhancedBlocks.push({
      id: `blk_rf_${now}_${i}`,
      type,
      content,
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


