"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/db";
import { Eye, EyeOff, Key, Cpu, Check, Shield, Server } from "lucide-react";

export default function SettingsModal({ open, onClose }) {
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [provider, setProvider] = useState("gemini"); // "gemini" | "webllm"
  const [webllmModel, setWebllmModel] = useState("Llama-3.8B-Instruct-q4f16_1-MLC");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!open) return;
    async function loadSettings() {
      try {
        const keyItem = await db.settings.get("gemini_api_key");
        const providerItem = await db.settings.get("ai_provider");
        const modelItem = await db.settings.get("webllm_model");

        if (keyItem?.value) setApiKey(keyItem.value);
        if (providerItem?.value) setProvider(providerItem.value);
        if (modelItem?.value) setWebllmModel(modelItem.value);
      } catch (err) {
        console.error("Failed to load settings:", err);
      }
    }
    loadSettings();
  }, [open]);

  async function handleSave(e) {
    e.preventDefault();
    try {
      await db.settings.put({ key: "gemini_api_key", value: apiKey.trim() });
      await db.settings.put({ key: "ai_provider", value: provider });
      await db.settings.put({ key: "webllm_model", value: webllmModel });

      setSaved(true);
      setTimeout(() => {
        setSaved(false);
        onClose();
      }, 1000);
    } catch (err) {
      console.error("Failed to save settings:", err);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-ink-950/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-lg rounded-2xl border border-ink-800 bg-ink-900 shadow-2xl p-6 overflow-hidden z-10 animate-fade-up">
        <div className="flex items-center justify-between border-b border-ink-800 pb-4 mb-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-duck-500/10 text-duck-400 border border-duck-500/20">
              <Cpu className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-ink-100">AI & Provider Settings</h2>
              <p className="text-xs text-ink-400">Configure local-first keys & offline AI fallbacks</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-800 hover:text-ink-200 transition-colors"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-5">
          {/* Privacy Notice Banner */}
          <div className="flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs text-emerald-300">
            <Shield className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
            <div>
              <span className="font-semibold text-emerald-200">100% Local Privacy:</span> Keys and settings are stored strictly inside your browser's IndexedDB (Dexie). They are never transmitted to our backend server.
            </div>
          </div>

          {/* AI Provider Selection */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-ink-400">
              Active AI Provider
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setProvider("gemini")}
                className={`flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-all ${
                  provider === "gemini"
                    ? "border-duck-500/60 bg-duck-500/10 text-ink-100 ring-1 ring-duck-500/30"
                    : "border-ink-800 bg-ink-850 text-ink-400 hover:border-ink-700 hover:text-ink-200"
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs font-semibold">
                  <Server className="h-3.5 w-3.5 text-duck-400" />
                  <span>Google Gemini API</span>
                </div>
                <p className="text-[11px] text-ink-500 leading-tight">
                  Uses your personal key directly from browser to Google AI Studio.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setProvider("webllm")}
                className={`flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-all ${
                  provider === "webllm"
                    ? "border-duck-500/60 bg-duck-500/10 text-ink-100 ring-1 ring-duck-500/30"
                    : "border-ink-800 bg-ink-850 text-ink-400 hover:border-ink-700 hover:text-ink-200"
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs font-semibold">
                  <Cpu className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Local WebLLM (Offline)</span>
                </div>
                <p className="text-[11px] text-ink-500 leading-tight">
                  Runs WebGPU in browser. Zero server compute, works 100% offline.
                </p>
              </button>
            </div>
          </div>

          {/* Gemini API Key Input (Hidden when WebLLM is selected) */}
          {provider !== "webllm" && (
            <div className="space-y-1.5 animate-fade-up">
              <label className="block text-xs font-semibold text-ink-300">
                Personal Gemini API Key
              </label>
              <div className="relative flex items-center">
                <Key className="absolute left-3 h-4 w-4 text-ink-500" />
                <input
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full rounded-xl border border-ink-700 bg-ink-850 py-2.5 pl-9 pr-10 text-xs text-ink-100 placeholder:text-ink-600 focus:border-duck-500/50 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 text-ink-500 hover:text-ink-300"
                >
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-[11px] text-ink-500">
                Leave blank to fall back to default server key if configured. Get your key free at{" "}
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noreferrer"
                  className="text-duck-400 underline hover:text-duck-300"
                >
                  Google AI Studio
                </a>.
              </p>
            </div>
          )}

          {/* WebLLM Model Selection (Shown if WebLLM selected) */}
          {provider === "webllm" && (
            <div className="space-y-1.5 animate-fade-up">
              <label className="block text-xs font-semibold text-ink-300">
                WebLLM Model Architecture
              </label>
              <select
                value={webllmModel}
                onChange={(e) => setWebllmModel(e.target.value)}
                className="w-full rounded-xl border border-ink-700 bg-ink-850 py-2.5 px-3 text-xs text-ink-100 focus:border-duck-500/50 focus:outline-none"
              >
                <option value="Llama-3.8B-Instruct-q4f16_1-MLC">Llama 3 8B Instruct (Recommended)</option>
                <option value="Phi-3.5-mini-instruct-q4f16_1-MLC">Phi-3.5 Mini Instruct (Lightweight)</option>
                <option value="Qwen2.5-Coder-7B-Instruct-q4f16_1-MLC">Qwen 2.5 Coder 7B</option>
                <option value="gemma-2-2b-it-q4f16_1-MLC">Gemma 2 2B IT</option>
              </select>
              <p className="text-[11px] text-ink-500">
                WebLLM downloads model weights into browser cache on first use (requires WebGPU).
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-ink-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-ink-700 px-4 py-2 text-xs font-medium text-ink-400 hover:text-ink-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 rounded-xl bg-duck-400 px-5 py-2 text-xs font-semibold text-ink-950 hover:bg-duck-300 transition-all shadow-md"
            >
              {saved ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  Saved!
                </>
              ) : (
                "Save Preferences"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
