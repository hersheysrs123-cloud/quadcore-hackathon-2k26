import { NextResponse } from "next/server";
import {
  errorPayload,
  generate,
  hasApiKey,
  readJson,
  readUsage,
} from "@/lib/gemini";
import { EXPLAIN_SCHEMA } from "@/lib/schemas";

export const dynamic = "force-dynamic";

/**
 * The Explainer is the Duck's opposite number.
 *
 * The Socratic route is under standing orders never to give an answer; this one
 * exists to give exactly that. Keeping them as separate endpoints with opposed
 * personas is what stops either from drifting into a hedged middle — a tutor
 * that half-explains and half-quizzes does neither job.
 */
const PERSONA = `You are the Explainer inside SocraticOS, a study workspace.

A learner has written notes and wants the concept explained properly. Explain it
so that they could rebuild the idea themselves, not just recognise it.

How to write:
- Explain the mechanism. "Why does this work?" is always the question you are
  answering, even when they asked "what is".
- Ground every abstraction in something concrete within a sentence or two of
  introducing it.
- Use the learner's own notes to pitch the level: build on what they clearly
  already have, and spend your effort where their notes are thin, hedged, or
  where they wrote down a result without a reason.
- If their notes say outright that something confuses them, that is the most
  important thing on the page. Address it directly.
- Plain language. Define a term the first time you need it, then use it.
- Never pad. No "it is important to note", no restating the question, no
  congratulating them on a good question.
- Do not include internal or system XML tags in your response.`;

function buildPrompt({ concept, noteContent, focus }) {
  const sections = [PERSONA, `Concept to explain: ${concept}`];

  if (focus?.trim()) {
    sections.push(
      `The learner highlighted this specific passage, so weight the explanation
toward it rather than covering the whole note evenly:

<focus>
${focus.trim()}
</focus>`,
    );
  }

  if (noteContent?.trim()) {
    sections.push(
      `The learner's own notes are below. Read them for what is missing as much
as for what is there.

<learner_notes>
${noteContent.trim()}
</learner_notes>`,
    );
  }

  return sections.join("\n\n");
}

/** Structured output guarantees the shape; this guards lengths and emptiness. */
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

/**
 * POST /api/explain
 *
 * Body: { concept, noteContent?, focus? }
 * 200 -> { explanation: {...}, usage }
 */
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }

  const { concept, noteContent, focus } = body ?? {};

  if (!concept || typeof concept !== "string" || !concept.trim()) {
    return NextResponse.json({ error: "`concept` is required." }, { status: 400 });
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

  const system = buildPrompt({ concept: concept.trim(), noteContent, focus });

  try {
    const payload = await generate({
      system,
      messages: [
        {
          role: "user",
          content: `Explain "${concept.trim()}" to me, using my notes to decide what I already have and what I am missing.`,
        },
      ],
      // An explanation should be the same one twice. Variety is the Duck's job.
      temperature: 0.4,
      schema: EXPLAIN_SCHEMA,
    });

    return NextResponse.json({
      explanation: normalizeExplanation(readJson(payload)),
      usage: readUsage(payload),
    });
  } catch (error) {
    const { status, body: payload } = errorPayload(error);
    return NextResponse.json(payload, { status });
  }
}
