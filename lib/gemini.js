/**
 * Thin client for Google AI Studio (Gemini).
 *
 * Talks to the REST API with `fetch` rather than pulling in `@google/genai`.
 * That is a deliberate trade: one fewer dependency to install and audit, no SDK
 * version drift, and the exact request shape below was validated against the
 * live endpoint before it was written. If you later want the SDK's extras
 * (streaming helpers, file uploads, function calling), `generate()` is the only
 * function that touches the network — swap its body and nothing else changes.
 */

const API_ROOT = "https://generativelanguage.googleapis.com/v1beta/models";

/**
 * Single seam for model choice. Confirmed present on this key via ListModels.
 * Newer siblings on the same account if you want to trade cost for capability:
 * gemini-3.5-flash-lite, gemini-3.5-flash, gemini-3.6-flash.
 */
export const MODEL = "gemini-3.1-flash-lite";

/** Gemini counts this as output only — thinking is not billed against it. */
export const MAX_OUTPUT_TOKENS = 4000;

export class GeminiError extends Error {
  constructor(message, status = 502, detail = null) {
    super(message);
    this.name = "GeminiError";
    this.status = status;
    this.detail = detail;
  }
}

export function hasApiKey() {
  return Boolean(process.env.GOOGLE_API_KEY);
}

/** Our transcript shape -> Gemini's. Note Gemini calls the model turn "model". */
function toContents(messages) {
  return messages.map((message) => ({
    role: message.role === "assistant" ? "model" : "user",
    parts: [{ text: message.content }],
  }));
}

/**
 * One generateContent call.
 *
 * Pass `schema` (Gemini/OpenAPI-3.0 flavour — see lib/schemas.js) to force
 * schema-valid JSON. Omit it for a conversational turn.
 */
export async function generate({
  system,
  messages,
  schema = null,
  temperature = 0.7,
}) {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new GeminiError("GOOGLE_API_KEY is not set.", 500);

  const generationConfig = {
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    temperature,
  };

  if (schema) {
    generationConfig.responseMimeType = "application/json";
    generationConfig.responseSchema = schema;
  }

  let response;
  try {
    response = await fetch(`${API_ROOT}/${MODEL}:generateContent`, {
      method: "POST",
      headers: {
        // Header, not a ?key= query param — keeps the secret out of access logs.
        "x-goog-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: toContents(messages),
        generationConfig,
      }),
    });
  } catch (error) {
    throw new GeminiError(
      "Could not reach the Gemini API.",
      502,
      String(error?.message ?? error),
    );
  }

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message = payload?.error?.message ?? `HTTP ${response.status}`;
    if (response.status === 400 && /API key/i.test(message)) {
      throw new GeminiError("GOOGLE_API_KEY is invalid.", 500, message);
    }
    if (response.status === 429) {
      throw new GeminiError("Rate limited by the Gemini API.", 429, message);
    }
    throw new GeminiError("Gemini API error.", response.status, message);
  }

  return payload;
}

/**
 * Pulls the text out of a response, converting Gemini's failure modes into
 * errors rather than letting them surface as a confusing empty string.
 */
export function readText(payload) {
  // A prompt rejected before generation has no candidates at all.
  const blockReason = payload?.promptFeedback?.blockReason;
  if (blockReason) {
    throw new GeminiError(
      "Gemini declined this request.",
      422,
      `Prompt blocked: ${blockReason}`,
    );
  }

  const candidate = payload?.candidates?.[0];
  if (!candidate) throw new GeminiError("Gemini returned no candidates.", 502);

  const finish = candidate.finishReason;
  if (finish === "MAX_TOKENS") {
    throw new GeminiError(
      `Response hit the ${MAX_OUTPUT_TOKENS}-token ceiling before finishing. Raise MAX_OUTPUT_TOKENS in lib/gemini.js.`,
      502,
    );
  }
  if (finish === "SAFETY" || finish === "PROHIBITED_CONTENT") {
    throw new GeminiError("Gemini declined this request.", 422, finish);
  }

  const text = (candidate.content?.parts ?? [])
    .map((part) => part.text ?? "")
    .join("")
    .trim();

  if (!text) throw new GeminiError("Gemini returned no text content.", 502);
  return text;
}

export function readJson(payload) {
  const text = readText(payload);
  try {
    return JSON.parse(text);
  } catch {
    throw new GeminiError("Gemini returned malformed JSON.", 502, text.slice(0, 500));
  }
}

/** Token counts, normalised to the names the routes already return. */
export function readUsage(payload) {
  const usage = payload?.usageMetadata ?? {};
  return {
    input_tokens: usage.promptTokenCount ?? 0,
    output_tokens: usage.candidatesTokenCount ?? 0,
  };
}

export function errorPayload(error) {
  const e =
    error instanceof GeminiError
      ? error
      : new GeminiError(
          "Unexpected failure calling Gemini.",
          500,
          String(error?.message ?? error),
        );
  return {
    status: e.status,
    body: { error: e.message, ...(e.detail ? { detail: e.detail } : {}) },
  };
}

/** Trims a stored transcript into something the API will accept. */
export function normalizeHistory(history) {
  const turns = (Array.isArray(history) ? history : [])
    .filter((m) => m && (m.role === "user" || m.role === "assistant"))
    .map((m) => ({ role: m.role, content: String(m.content ?? "").trim() }))
    .filter((m) => m.content.length > 0);

  // Gemini requires the conversation to open on a user turn, and a trailing
  // model turn would mean asking it to continue its own message.
  while (turns.length && turns[0].role === "assistant") turns.shift();
  while (turns.length && turns.at(-1).role === "assistant") turns.pop();

  return turns;
}
