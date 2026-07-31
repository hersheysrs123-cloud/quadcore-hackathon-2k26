import { NextResponse } from "next/server";
import {
  errorPayload,
  generate,
  hasApiKey,
  normalizeHistory,
  readJson,
  readText,
  readUsage,
} from "@/lib/gemini";
import {
  DIAGNOSTIC_SCHEMA,
  HEATMAP_STATUSES,
  RECOMMENDED_WIDGETS,
} from "@/lib/schemas";

export const dynamic = "force-dynamic";

const PERSONA = `You are the Socratic Rubber Duck inside SocraticOS.

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

const TURN_INSTRUCTIONS = `This is a normal turn.

Ask 1-2 probing questions and nothing else. No preamble, no summary of what they
just said, no encouragement. If you ask two, the second must depend on the first
rather than opening a new thread.

Keep the whole reply under 60 words.`;

const FINAL_INSTRUCTIONS = `This is the final turn. Stop asking questions and
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

function buildSystemPrompt({ concept, noteContent, isFinalTurn }) {
  const sections = [PERSONA, `Concept under examination: ${concept}`];

  if (noteContent?.trim()) {
    sections.push(
      `The learner's own notes on this concept are below. Use them to spot what
they wrote down but cannot explain — that gap is the most valuable thing you can
find. Do not quote the notes back to them as an answer.

<learner_notes>
${noteContent.trim()}
</learner_notes>`,
    );
  }

  sections.push(isFinalTurn ? FINAL_INSTRUCTIONS : TURN_INSTRUCTIONS);
  return sections.join("\n\n");
}

const clampScore = (n) => Math.max(0, Math.min(100, Math.round(Number(n) || 0)));

/** Structured outputs guarantee the shape; this guards the value ranges. */
function normalizeDiagnostic(raw) {
  return {
    score: clampScore(raw.score),
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

/**
 * POST /api/socratic/chat
 *
 * Body: { noteContent?, concept, conversationHistory?, isFinalTurn? }
 *
 * isFinalTurn = false -> 200 { type: "question", reply, usage }
 * isFinalTurn = true  -> 200 { type: "diagnostic", diagnostic: {...}, usage }
 */
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }

  const { noteContent, concept, conversationHistory, isFinalTurn = false } =
    body ?? {};

  if (!concept || typeof concept !== "string" || !concept.trim()) {
    return NextResponse.json(
      { error: "`concept` is required." },
      { status: 400 },
    );
  }

  const history = normalizeHistory(conversationHistory);

  if (isFinalTurn && history.length === 0) {
    return NextResponse.json(
      { error: "Cannot score a session with no learner answers." },
      { status: 400 },
    );
  }

  if (!hasApiKey()) {
    return NextResponse.json(
      {
        error:
          "GOOGLE_API_KEY is not set. Add it to .env.local and restart the dev server.",
      },
      { status: 503 },
    );
  }

  // An empty history means the learner just opened the drawer — the API needs a
  // leading user turn, so opening the session becomes one.
  const messages = history.length
    ? history
    : [
        {
          role: "user",
          content: `I want to be examined on: ${concept.trim()}. Ask me your first question.`,
        },
      ];

  const system = buildSystemPrompt({
    concept: concept.trim(),
    noteContent,
    isFinalTurn,
  });

  try {
    const payload = await generate({
      system,
      messages,
      // Scoring wants repeatability; asking questions wants variety, so the
      // learner doesn't get the same probe twice across sessions.
      temperature: isFinalTurn ? 0.3 : 0.9,
      schema: isFinalTurn ? DIAGNOSTIC_SCHEMA : null,
    });

    const usage = readUsage(payload);

    if (isFinalTurn) {
      return NextResponse.json({
        type: "diagnostic",
        diagnostic: normalizeDiagnostic(readJson(payload)),
        usage,
      });
    }

    return NextResponse.json({
      type: "question",
      reply: readText(payload),
      usage,
    });
  } catch (error) {
    const { status, body: payload } = errorPayload(error);
    return NextResponse.json(payload, { status });
  }
}
