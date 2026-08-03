"use client";

import { db } from "./db";

let webLlmEngine = null;
let currentModel = null;

/**
 * Gets or initializes the WebLLM engine singleton.
 */
export async function getWebLLMEngine(onProgress = null) {
  if (typeof window === "undefined") {
    throw new Error("WebLLM is only available in browser environments with WebGPU support.");
  }

  // Get configured model from Dexie or default
  const modelItem = await db.settings.get("webllm_model").catch(() => null);
  const selectedModel = modelItem?.value || "Llama-3.8B-Instruct-q4f16_1-MLC";

  if (webLlmEngine && currentModel === selectedModel) {
    return webLlmEngine;
  }

  const { CreateMLCEngine } = await import("@mlc-ai/web-llm");
  
  webLlmEngine = await CreateMLCEngine(selectedModel, {
    initProgressCallback: (progress) => {
      console.log(`[WebLLM Progress] ${progress.text}`);
      onProgress?.(progress);
    },
  });

  currentModel = selectedModel;
  return webLlmEngine;
}

/**
 * Generate response using WebLLM locally in browser
 */
export async function generateWebLLM({ system, messages, temperature = 0.7, schema = null }) {
  const engine = await getWebLLMEngine();

  const formattedMessages = [];
  if (system) {
    formattedMessages.push({ role: "system", content: system });
  }

  for (const m of messages) {
    formattedMessages.push({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content,
    });
  }

  // If schema is supplied, append JSON formatting instruction to system prompt
  if (schema) {
    formattedMessages[0].content += `\n\nCRITICAL: You MUST respond ONLY with valid, minified raw JSON matching this schema: ${JSON.stringify(schema)}. Do NOT include markdown codeblocks, prose, or quotes around the JSON.`;
  }

  const completion = await engine.chat.completions.create({
    messages: formattedMessages,
    temperature,
    max_tokens: 2000,
  });

  const text = completion.choices[0]?.message?.content || "";

  // Convert WebLLM result into Gemini payload format so readJson/readText/readUsage remain uniform
  return {
    candidates: [
      {
        content: {
          parts: [{ text }],
        },
        finishReason: "STOP",
      },
    ],
    usageMetadata: {
      promptTokenCount: completion.usage?.prompt_tokens || 0,
      candidatesTokenCount: completion.usage?.completion_tokens || 0,
    },
  };
}
