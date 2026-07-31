import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getSupabaseServerClient } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

const MODEL = "claude-opus-5";

const SYSTEM_PROMPT = `You are the Socratic Duck, a diagnostic tutor inside SocraticOS.

Your job is to find the exact edge of what the student actually understands about
a concept — not to teach, summarise, or reassure.

How you behave:
- Ask exactly ONE question per turn. Never stack questions.
- Questions probe mechanism and edge cases ("what would happen if...", "why does
  that step work?"), not recall of definitions.
- When an answer is vague, ask for a concrete instance rather than pointing out
  the vagueness.
- Never state the answer, never confirm correctness explicitly, never praise. If
  the student is right, move to a harder case. If they are wrong, ask the
  question that makes the contradiction visible to them.
- Keep questions under 40 words. Plain language.
- Set status to "completed" only once you have enough evidence to score every
  sub-concept you have raised — usually 5 or more exchanges.

Alongside each question, maintain a confidence map: for every sub-concept you've
probed, a confidence from 0 (demonstrably confused) to 1 (explained the
mechanism unprompted), with a one-line quote or paraphrase as evidence. Base
confidence only on what the student has said in this conversation — never on
what a typical student would know.`;

/**
 * Structured output schema. Keep this in sync with the heatmap_json shape read
 * by the Duck pane. Note: JSON Schema numeric bounds (minimum/maximum) are not
 * supported by the structured-outputs API, so the 0..1 range for `confidence`
 * lives in the system prompt and the clamp below instead.
 */
const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    reply: {
      type: "string",
      description: "The single Socratic question to show the student.",
    },
    understanding: {
      type: "array",
      description: "One entry per sub-concept probed so far.",
      items: {
        type: "object",
        properties: {
          concept: { type: "string" },
          confidence: { type: "number" },
          evidence: {
            type: "string",
            description: "What the student said that justifies this score.",
          },
        },
        required: ["concept", "confidence", "evidence"],
        additionalProperties: false,
      },
    },
    status: { type: "string", enum: ["active", "completed"] },
  },
  required: ["reply", "understanding", "status"],
  additionalProperties: false,
};

const clamp01 = (n) => Math.min(1, Math.max(0, Number(n) || 0));

/** Keeps the UI demoable before anyone adds an API key. */
function stubResponse(conceptName) {
  return {
    reply: `Before we get into ${conceptName || "this"} — describe a situation where it would break down, and tell me what goes wrong.`,
    understanding: [],
    status: "active",
    stubbed: true,
  };
}

/**
 * POST /api/socratic/chat
 *
 * Body:
 * {
 *   "conceptName": "Eigenvectors",     // required
 *   "messages": [                      // required, may be empty to open a session
 *     { "role": "user", "content": "..." },
 *     { "role": "assistant", "content": "..." }
 *   ],
 *   "blockId": "uuid"                  // optional — persists to socratic_sessions
 * }
 *
 * 200 -> { reply, understanding: [...], status, persisted }
 */
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }

  const { conceptName, messages, blockId } = body ?? {};

  if (!conceptName || typeof conceptName !== "string") {
    return NextResponse.json(
      { error: "`conceptName` is required." },
      { status: 400 },
    );
  }

  if (messages !== undefined && !Array.isArray(messages)) {
    return NextResponse.json(
      { error: "`messages` must be an array when provided." },
      { status: 400 },
    );
  }

  const history = (messages ?? [])
    .filter((m) => m && (m.role === "user" || m.role === "assistant"))
    .map((m) => ({ role: m.role, content: String(m.content ?? "") }));

  // The Messages API must start on a user turn, and a trailing assistant turn
  // is an assistant prefill — which Opus 5 rejects outright. Trim both ends so
  // a caller replaying a stored conversation gets a clear result instead of a
  // 400 that reads like an SDK problem.
  while (history.length && history[0].role === "assistant") history.shift();
  while (history.length && history.at(-1).role === "assistant") history.pop();

  // No key configured: hand back a canned question so the pane still works.
  if (!process.env.ANTHROPIC_API_KEY) {
    const stub = stubResponse(conceptName);
    return NextResponse.json({ ...stub, persisted: false });
  }

  // The API requires a leading user turn. Opening the session counts as one.
  const apiMessages = history.length
    ? history
    : [
        {
          role: "user",
          content: `I want to be quizzed on: ${conceptName}. Start with your first question.`,
        },
      ];

  const anthropic = new Anthropic();

  let result;
  try {
    const message = await anthropic.messages.create({
      model: MODEL,
      // Thinking is on by default on Opus 5 and max_tokens caps thinking plus
      // response text together — hence the headroom for a short question.
      max_tokens: 8000,
      output_config: {
        effort: "medium",
        format: { type: "json_schema", schema: RESPONSE_SCHEMA },
      },
      system: SYSTEM_PROMPT,
      messages: apiMessages,
    });

    if (message.stop_reason === "refusal") {
      return NextResponse.json(
        {
          error: "The model declined this request.",
          detail: message.stop_details?.explanation ?? null,
        },
        { status: 422 },
      );
    }

    if (message.stop_reason === "max_tokens") {
      return NextResponse.json(
        { error: "Response hit max_tokens before completing. Raise max_tokens." },
        { status: 502 },
      );
    }

    const textBlock = message.content.find((b) => b.type === "text");
    if (!textBlock) {
      return NextResponse.json(
        { error: "Model returned no text block." },
        { status: 502 },
      );
    }

    const parsed = JSON.parse(textBlock.text);
    result = {
      reply: parsed.reply,
      understanding: (parsed.understanding ?? []).map((u) => ({
        concept: u.concept,
        confidence: clamp01(u.confidence),
        evidence: u.evidence,
      })),
      status: parsed.status === "completed" ? "completed" : "active",
      usage: {
        input_tokens: message.usage.input_tokens,
        output_tokens: message.usage.output_tokens,
      },
    };
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      return NextResponse.json(
        { error: "Rate limited by the Anthropic API. Retry shortly." },
        { status: 429 },
      );
    }
    if (error instanceof Anthropic.AuthenticationError) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY is invalid." },
        { status: 500 },
      );
    }
    if (error instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: "Anthropic API error.", detail: error.message },
        { status: error.status ?? 502 },
      );
    }
    return NextResponse.json(
      { error: "Socratic turn failed.", detail: String(error?.message ?? error) },
      { status: 500 },
    );
  }

  // Optional persistence. Reported rather than thrown so a DB hiccup doesn't
  // cost the student the turn they just paid for.
  let persisted = false;
  let persistError = null;

  if (blockId) {
    try {
      const supabase = getSupabaseServerClient();
      const conversation = [
        ...apiMessages,
        { role: "assistant", content: result.reply },
      ];
      const heatmap = {
        concepts: result.understanding,
        updated_at: new Date().toISOString(),
      };

      const { data: existing } = await supabase
        .from("socratic_sessions")
        .select("id")
        .eq("block_id", blockId)
        .eq("status", "active")
        .maybeSingle();

      const { error: writeError } = existing
        ? await supabase
            .from("socratic_sessions")
            .update({
              conversation_history: conversation,
              heatmap_json: heatmap,
              status: result.status,
            })
            .eq("id", existing.id)
        : await supabase.from("socratic_sessions").insert({
            block_id: blockId,
            concept_name: conceptName,
            conversation_history: conversation,
            heatmap_json: heatmap,
            status: result.status,
          });

      if (writeError) persistError = writeError.message;
      else persisted = true;
    } catch (error) {
      persistError = String(error?.message ?? error);
    }
  }

  return NextResponse.json({ ...result, persisted, persistError });
}
