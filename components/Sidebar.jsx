"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PanelLeftClose, Download, Upload, HardDrive, CheckCircle2, Key, Cpu, Shield, Server, Eye, EyeOff } from "lucide-react";
import { exportWorkspaceToJSON, importWorkspaceFromJSON } from "@/lib/backup.js";
import { db } from "@/lib/db.js";

// ─── Sidebar ────────────────────────────────────────────────────────
// Dark-mode/Light-mode sidebar with Spaces, notes-per-space, Create Space modal,
// Settings ⚙️ button, and Factory Reset with Double Confirmation & Human Verification.
// ─────────────────────────────────────────────────────────────────────

function formatTimeRemaining(deletedAt) {
  if (!deletedAt) return "24h 0m left";

  const timestamp = typeof deletedAt === "number" ? deletedAt : new Date(deletedAt).getTime();
  if (isNaN(timestamp) || timestamp <= 0) return "24h 0m left";

  const elapsed = Date.now() - timestamp;
  const total24h = 24 * 60 * 60 * 1000;
  const remaining = total24h - elapsed;

  if (remaining <= 0) return "Expiring soon";

  const hours = Math.floor(remaining / (1000 * 60 * 60));
  const mins = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));

  if (isNaN(hours) || isNaN(mins)) return "24h 0m left";

  return `${hours}h ${mins}m left`;
}

// ─── Reset Confirmation & Human Check Dialog ────────────────────────
function FactoryResetConfirmModal({ open, target, onClose, onConfirm }) {
  const [step, setStep] = useState(1); // 1 = warning, 2 = human verification
  const [numA, setNumA] = useState(7);
  const [numB, setNumB] = useState(5);
  const [userAnswer, setUserAnswer] = useState("");
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    if (open) {
      setStep(1);
      setNumA(Math.floor(Math.random() * 12) + 5);
      setNumB(Math.floor(Math.random() * 12) + 3);
      setUserAnswer("");
      setResetting(false);
    }
  }, [open]);

  if (!open || !target) return null;

  const expectedAnswer = String(numA + numB);
  const targetLabel =
    target === "notes"
      ? "Notes & Content Blocks"
      : target === "calendar"
      ? "Calendar Events"
      : target === "3d"
      ? "3D Visualizations"
      : "ALL WORKSPACE DATA";

  async function handleFinalReset() {
    if (userAnswer.trim() !== expectedAnswer) return;
    setResetting(true);
    try {
      await onConfirm(target);
      onClose();
    } finally {
      setResetting(false);
    }
  }

  return (
    <>
      <div
        onClick={onClose}
        aria-hidden="true"
        className="fixed inset-0 z-[80] bg-ink-950/80 backdrop-blur-md transition-opacity"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Confirm Factory Reset"
        className="fixed left-1/2 top-1/2 z-[90] w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-rose-500/40 bg-ink-900 shadow-2xl"
      >
        <header className="flex items-center justify-between border-b border-rose-500/20 bg-rose-500/10 px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="text-lg">🚨</span>
            <h3 className="text-sm font-bold text-rose-300">
              Double Confirmation: Factory Reset {targetLabel}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-sm text-ink-500 hover:bg-ink-800 hover:text-ink-200"
          >
            ✕
          </button>
        </header>

        <div className="space-y-5 px-6 py-5">
          {step === 1 ? (
            <>
              <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-4">
                <p className="text-xs font-semibold text-rose-300">⚠️ PERMANENT DELETION WARNING</p>
                <p className="mt-1 text-xs text-ink-300 leading-relaxed">
                  You are about to permanently erase <strong>{targetLabel}</strong> from both your local browser storage and Supabase database.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg px-4 py-2 text-xs font-medium text-ink-400 hover:text-ink-200"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-rose-500"
                >
                  Proceed to Verification →
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-xs">
                <p className="font-semibold text-amber-300">🤖 Are You Human Verification</p>
                <p className="mt-1 text-ink-300">
                  Solve this quick math puzzle to confirm you want to wipe <strong>{targetLabel}</strong>:
                </p>
                <div className="mt-3 flex items-center gap-3">
                  <span className="rounded-lg border border-ink-700 bg-ink-850 px-3 py-1.5 font-mono text-sm font-bold text-duck-300">
                    {numA} + {numB} = ?
                  </span>
                  <input
                    type="number"
                    value={userAnswer}
                    onChange={(e) => setUserAnswer(e.target.value)}
                    placeholder="Result"
                    className="w-24 rounded-lg border border-ink-700 bg-ink-850 px-3 py-1.5 text-center font-mono text-sm font-bold text-ink-100 placeholder:text-ink-600 focus:border-duck-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="rounded-lg px-3.5 py-2 text-xs text-ink-400 hover:text-ink-200"
                >
                  ← Back
                </button>
                <button
                  type="button"
                  disabled={userAnswer.trim() !== expectedAnswer || resetting}
                  onClick={handleFinalReset}
                  className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow transition-all disabled:opacity-30 hover:bg-rose-500"
                >
                  {resetting ? "Erasing Data..." : "CONFIRM FACTORY RESET"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Settings Modal ──────────────────────────────────────────────────
function SettingsModal({ open, onClose, theme, setTheme, onResetData }) {
  const [tab, setTab] = useState("ai"); // "ai" | "general" | "backup" | "reset"
  const [resetTarget, setResetTarget] = useState(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");

  // AI settings
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [provider, setProvider] = useState("gemini"); // "gemini" | "webllm"
  const [webllmModel, setWebllmModel] = useState("Llama-3.8B-Instruct-q4f16_1-MLC");
  const [aiSaved, setAiSaved] = useState(false);

  useEffect(() => {
    if (!open) return;
    async function loadAISettings() {
      try {
        const keyItem = await db.settings.get("gemini_api_key");
        const providerItem = await db.settings.get("ai_provider");
        const modelItem = await db.settings.get("webllm_model");

        if (keyItem?.value) setApiKey(keyItem.value);
        if (providerItem?.value) setProvider(providerItem.value);
        if (modelItem?.value) setWebllmModel(modelItem.value);
      } catch (err) {
        console.error("Failed to load AI settings:", err);
      }
    }
    loadAISettings();
  }, [open]);

  const handleSaveAI = async (e) => {
    e.preventDefault();
    try {
      await db.settings.put({ key: "gemini_api_key", value: apiKey.trim() });
      await db.settings.put({ key: "ai_provider", value: provider });
      await db.settings.put({ key: "webllm_model", value: webllmModel });

      setAiSaved(true);
      setTimeout(() => setAiSaved(false), 2000);
    } catch (err) {
      console.error("Failed to save AI settings:", err);
    }
  };

  if (!open) return null;

  const handleExport = async () => {
    try {
      setIsExporting(true);
      setStatusMsg("");
      const res = await exportWorkspaceToJSON();
      setStatusMsg(`Successfully exported ${res.count} notes to ${res.filename}`);
    } catch (err) {
      alert("Backup export error: " + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsImporting(true);
      setStatusMsg("");
      const res = await importWorkspaceFromJSON(file, { overwrite: true });
      setStatusMsg(`Successfully restored ${res.imported.notes} notes & workspace data! Reloading...`);
      setTimeout(() => {
        window.location.reload();
      }, 1200);
    } catch (err) {
      alert("Backup import error: " + err.message);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <>
      <div
        onClick={onClose}
        aria-hidden="true"
        className="fixed inset-0 z-[200] bg-ink-950/70 backdrop-blur-sm transition-opacity"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        className="fixed left-1/2 top-1/2 z-[210] w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl border border-ink-700 bg-ink-900 shadow-2xl"
      >
        <header className="flex items-center justify-between border-b border-ink-800 px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="text-lg">⚙️</span>
            <h2 className="text-sm font-semibold text-ink-100">Preferences &amp; Settings</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-sm text-ink-500 transition-colors hover:bg-ink-800 hover:text-ink-200"
          >
            ✕
          </button>
        </header>

        {/* Subtabs */}
        <div className="flex border-b border-ink-800 bg-ink-950/40 px-5 pt-2 gap-1 overflow-x-auto">
          <button
            type="button"
            onClick={() => setTab("ai")}
            className={`border-b-2 px-3 py-2 text-xs font-semibold transition-all whitespace-nowrap ${
              tab === "ai"
                ? "border-duck-400 text-duck-300"
                : "border-transparent text-ink-400 hover:text-ink-200"
            }`}
          >
            AI &amp; Keys 🤖
          </button>

          <button
            type="button"
            onClick={() => setTab("general")}
            className={`border-b-2 px-3 py-2 text-xs font-semibold transition-all whitespace-nowrap ${
              tab === "general"
                ? "border-duck-400 text-duck-300"
                : "border-transparent text-ink-400 hover:text-ink-200"
            }`}
          >
            General &amp; Theme
          </button>

          <button
            type="button"
            onClick={() => setTab("backup")}
            className={`border-b-2 px-3 py-2 text-xs font-semibold transition-all whitespace-nowrap ${
              tab === "backup"
                ? "border-sky-400 text-sky-300"
                : "border-transparent text-ink-400 hover:text-ink-200"
            }`}
          >
            Backup &amp; Restore 💾
          </button>

          <button
            type="button"
            onClick={() => setTab("reset")}
            className={`border-b-2 px-3 py-2 text-xs font-semibold transition-all whitespace-nowrap ${
              tab === "reset"
                ? "border-rose-500 text-rose-400"
                : "border-transparent text-ink-400 hover:text-ink-200"
            }`}
          >
            Factory Reset 🚨
          </button>
        </div>

        <div className="space-y-6 px-6 py-5">
          {tab === "ai" && (
            <form onSubmit={handleSaveAI} className="space-y-4">
              <div className="flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs text-emerald-300">
                <Shield className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
                <div>
                  <span className="font-semibold text-emerald-200">100% Local Privacy:</span> API keys are saved strictly inside IndexedDB (Dexie). They never touch our servers.
                </div>
              </div>

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
                      Direct from browser to Google AI Studio.
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
                      In-browser WebGPU LLM. 100% offline.
                    </p>
                  </button>
                </div>
              </div>

              {provider !== "webllm" && (
                <div className="space-y-1.5 animate-fade-up">
                  <label className="block text-xs font-semibold text-ink-300">
                    Google Gemini API Key
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
                    Leave empty to fall back to server env var.
                  </p>
                </div>
              )}

              {provider === "webllm" && (
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-ink-300">
                    WebLLM Model Architecture
                  </label>
                  <select
                    value={webllmModel}
                    onChange={(e) => setWebllmModel(e.target.value)}
                    className="w-full rounded-xl border border-ink-700 bg-ink-850 py-2 px-3 text-xs text-ink-100 focus:border-duck-500/50 focus:outline-none"
                  >
                    <option value="Llama-3.8B-Instruct-q4f16_1-MLC">Llama 3 8B Instruct</option>
                    <option value="Phi-3.5-mini-instruct-q4f16_1-MLC">Phi-3.5 Mini Instruct</option>
                    <option value="Qwen2.5-Coder-7B-Instruct-q4f16_1-MLC">Qwen 2.5 Coder 7B</option>
                    <option value="gemma-2-2b-it-q4f16_1-MLC">Gemma 2 2B IT</option>
                  </select>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className="rounded-xl bg-duck-400 px-4 py-2 text-xs font-bold text-ink-950 hover:bg-duck-300 transition-colors"
                >
                  {aiSaved ? "Saved to Dexie!" : "Save AI Key & Settings"}
                </button>
              </div>
            </form>
          )}

          {tab === "general" && (
            <>
              {/* Theme Selector */}
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-ink-400">
                  Appearance &amp; Theme
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setTheme("dark")}
                    className={`flex items-center justify-center gap-2 rounded-xl border p-3.5 text-xs font-semibold transition-all ${
                      theme === "dark"
                        ? "border-duck-500/50 bg-duck-500/20 text-duck-300 shadow-md"
                        : "border-ink-800 bg-ink-850 text-ink-400 hover:border-ink-700 hover:text-ink-200"
                    }`}
                  >
                    <span>🌙</span>
                    <span>Dark Mode</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTheme("light")}
                    className={`flex items-center justify-center gap-2 rounded-xl border p-3.5 text-xs font-semibold transition-all ${
                      theme === "light"
                        ? "border-duck-500/50 bg-duck-500/20 text-duck-300 shadow-md"
                        : "border-ink-800 bg-ink-850 text-ink-400 hover:border-ink-700 hover:text-ink-200"
                    }`}
                  >
                    <span>☀️</span>
                    <span>Light Mode</span>
                  </button>
                </div>
              </div>

              {/* Local-First Dexie Storage Status */}
              <div className="border-t border-ink-800/80 pt-4 space-y-2">
                <p className="text-[11px] text-ink-400 leading-relaxed">
                  💾 <strong>100% Local-First Storage</strong>: Your notes, whiteboards, calendar events, and study sessions are stored privately in your browser's IndexedDB engine (Dexie.js).
                </p>
              </div>
            </>
          )}

          {tab === "backup" && (
            <div className="space-y-4">
              <div className="rounded-xl border border-sky-500/20 bg-sky-500/10 p-3.5 text-xs leading-relaxed text-sky-200">
                <div className="font-bold flex items-center gap-1.5 text-sky-300">
                  <HardDrive className="h-4 w-4" />
                  <span>100% Offline Workspace Backups</span>
                </div>
                <p className="mt-1 text-[11px] text-sky-300/80">
                  Save a complete snapshot of your workspace (notes, whiteboard drawings, calendar events, and study sessions) directly to your hard drive, or restore an existing <code>.socratic</code> / <code>.json</code> backup.
                </p>
              </div>

              {statusMsg && (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-xs text-emerald-300 flex items-center gap-2 animate-fade-in">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>{statusMsg}</span>
                </div>
              )}

              {/* Export Button */}
              <button
                type="button"
                onClick={handleExport}
                disabled={isExporting}
                className="flex w-full items-center justify-between rounded-xl border border-duck-500/40 bg-duck-500/10 p-3.5 text-xs font-bold text-duck-300 transition-all hover:bg-duck-500/20 disabled:opacity-50 shadow-sm"
              >
                <div className="flex items-center gap-2.5">
                  <Download className="h-4.5 w-4.5 text-duck-400" />
                  <div className="text-left">
                    <div className="font-bold text-duck-200">Export Workspace Backup</div>
                    <div className="text-[10px] text-duck-400 font-normal">Save .socratic backup file to computer</div>
                  </div>
                </div>
                <span className="rounded bg-duck-500/20 px-2 py-1 font-mono text-[10px] text-duck-300">
                  {isExporting ? "Exporting..." : ".socratic"}
                </span>
              </button>

              {/* Import File Input Button */}
              <label className="flex w-full cursor-pointer items-center justify-between rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3.5 text-xs font-bold text-emerald-300 transition-all hover:bg-emerald-500/20 shadow-sm">
                <div className="flex items-center gap-2.5">
                  <Upload className="h-4.5 w-4.5 text-emerald-400" />
                  <div className="text-left">
                    <div className="font-bold text-emerald-200">Import &amp; Restore Workspace</div>
                    <div className="text-[10px] text-emerald-400 font-normal">Select .socratic or .json file to restore</div>
                  </div>
                </div>
                <input
                  type="file"
                  accept=".socratic,.json"
                  className="hidden"
                  onChange={handleImportFile}
                  disabled={isImporting}
                />
                <span className="rounded bg-emerald-500/20 px-2 py-1 font-mono text-[10px] text-emerald-300">
                  {isImporting ? "Restoring..." : "Restore File"}
                </span>
              </label>
            </div>
          )}

          {tab === "reset" && (
            <div className="space-y-4">
              <p className="text-[11px] text-ink-400 leading-relaxed">
                Factory resets permanently delete data from both local cache and Supabase. Each action requires double confirmation and human verification.
              </p>

              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  onClick={() => setResetTarget("notes")}
                  className="flex w-full items-center justify-between rounded-lg border border-ink-800 bg-ink-850 p-3 text-xs font-medium text-ink-200 transition-all hover:border-rose-500/40 hover:bg-rose-500/5 hover:text-rose-300"
                >
                  <div className="flex items-center gap-2">
                    <span>📝</span>
                    <span>Factory Reset Notes</span>
                  </div>
                  <span className="text-[10px] text-rose-400 font-semibold">Clear Notes</span>
                </button>

                <button
                  type="button"
                  onClick={() => setResetTarget("calendar")}
                  className="flex w-full items-center justify-between rounded-lg border border-ink-800 bg-ink-850 p-3 text-xs font-medium text-ink-200 transition-all hover:border-rose-500/40 hover:bg-rose-500/5 hover:text-rose-300"
                >
                  <div className="flex items-center gap-2">
                    <span>📅</span>
                    <span>Factory Reset Calendar</span>
                  </div>
                  <span className="text-[10px] text-rose-400 font-semibold">Clear Events</span>
                </button>

                <button
                  type="button"
                  onClick={() => setResetTarget("3d")}
                  className="flex w-full items-center justify-between rounded-lg border border-ink-800 bg-ink-850 p-3 text-xs font-medium text-ink-200 transition-all hover:border-rose-500/40 hover:bg-rose-500/5 hover:text-rose-300"
                >
                  <div className="flex items-center gap-2">
                    <span>🧊</span>
                    <span>Factory Reset 3D Visualizations</span>
                  </div>
                  <span className="text-[10px] text-rose-400 font-semibold">Clear Models</span>
                </button>

                <div className="border-t border-ink-800 pt-2">
                  <button
                    type="button"
                    onClick={() => setResetTarget("all")}
                    className="flex w-full items-center justify-between rounded-lg border border-rose-500/40 bg-rose-500/10 p-3.5 text-xs font-bold text-rose-300 transition-all hover:bg-rose-500/20"
                  >
                    <div className="flex items-center gap-2">
                      <span>💥</span>
                      <span>Factory Reset ALL DATA</span>
                    </div>
                    <span className="text-[10px] uppercase font-bold text-rose-400">Purge Everything</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <FactoryResetConfirmModal
        open={Boolean(resetTarget)}
        target={resetTarget}
        onClose={() => setResetTarget(null)}
        onConfirm={async (target) => {
          await onResetData?.(target);
          setResetTarget(null);
          onClose();
        }}
      />
    </>
  );
}

// ─── Create New Space Modal ─────────────────────────────────────────
function CreateSpaceModal({ open, onClose, onCreate }) {
  const inputRef = useRef(null);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("📂");

  useEffect(() => {
    if (open) {
      setName("");
      setIcon("📂");
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  function handleSubmit(e) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onCreate({ name: trimmed, icon, blurb: "" });
    onClose();
  }

  if (!open) return null;

  const ICON_OPTIONS = ["📂", "🎓", "🌱", "📦", "🧪", "🎨", "🏋️", "💼", "🎯", "🔬"];

  return (
    <>
      <div
        onClick={onClose}
        aria-hidden="true"
        className="fixed inset-0 z-[200] bg-ink-950/70 backdrop-blur-sm transition-opacity"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Create New Space"
        className="fixed left-1/2 top-1/2 z-[210] w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl border border-ink-700 bg-ink-900 shadow-2xl"
      >
        <header className="flex items-center justify-between border-b border-ink-800 px-5 py-4">
          <h2 className="text-sm font-semibold text-ink-100">Create New Space</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md px-2 py-1 text-sm text-ink-500 transition-colors hover:bg-ink-800 hover:text-ink-200"
          >
            ✕
          </button>
        </header>

        <form onSubmit={handleSubmit} className="space-y-5 px-5 py-5">
          <div>
            <label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-ink-500">
              Icon
            </label>
            <div className="flex flex-wrap gap-1.5">
              {ICON_OPTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setIcon(emoji)}
                  className={`flex h-9 w-9 items-center justify-center rounded-lg text-lg transition-all ${
                    icon === emoji
                      ? "bg-duck-500/20 ring-2 ring-duck-400"
                      : "bg-ink-850 hover:bg-ink-800"
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label
              htmlFor="space-name"
              className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-ink-500"
            >
              Name
            </label>
            <input
              ref={inputRef}
              id="space-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Research"
              maxLength={32}
              className="w-full rounded-lg border border-ink-700 bg-ink-850 px-3 py-2 text-sm text-ink-100 placeholder:text-ink-600 focus:border-duck-500/50 focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-3.5 py-2 text-sm text-ink-400 transition-colors hover:text-ink-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="rounded-lg bg-duck-400 px-4 py-2 text-sm font-medium text-ink-950 transition-opacity disabled:opacity-30"
            >
              Create
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

// ─── Trash / Temporarily Deleted Notes Modal ────────────────────────
function TrashModal({
  open,
  onClose,
  trashNotes = [],
  onRecoverNote,
  onPermanentlyDeleteNote,
  onRecoverAll,
  onPermanentlyDeleteAll,
}) {
  if (!open) return null;

  return (
    <>
      <div
        onClick={onClose}
        aria-hidden="true"
        className="fixed inset-0 z-[200] bg-ink-950/70 backdrop-blur-sm transition-opacity"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Temporarily Deleted Notes"
        className="fixed left-1/2 top-1/2 z-[210] w-full max-w-xl -translate-x-1/2 -translate-y-1/2 rounded-xl border border-ink-700 bg-ink-900 shadow-2xl"
      >
        <header className="flex items-center justify-between border-b border-ink-800 px-6 py-4">
          <div className="flex items-center gap-2">
            <span className="text-lg">🗑️</span>
            <div>
              <h2 className="text-sm font-semibold text-ink-100">Temporarily Deleted Notes</h2>
              <p className="text-[11px] text-ink-500">
                Notes are permanently deleted 24 hours after deletion.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-sm text-ink-500 transition-colors hover:bg-ink-800 hover:text-ink-200"
          >
            ✕
          </button>
        </header>

        {trashNotes.length > 0 && (
          <div className="flex items-center justify-between border-b border-ink-800/60 bg-ink-950/50 px-6 py-2.5">
            <span className="text-xs text-ink-400 font-medium">
              {trashNotes.length} Note{trashNotes.length === 1 ? "" : "s"} in Trash
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onRecoverAll}
                className="rounded-lg border border-duck-500/30 bg-duck-500/10 px-3 py-1 text-xs font-semibold text-duck-300 transition-colors hover:bg-duck-500/20"
              >
                🔄 Recover All
              </button>
              <button
                type="button"
                onClick={onPermanentlyDeleteAll}
                className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1 text-xs font-semibold text-rose-300 transition-colors hover:bg-rose-500/20"
              >
                💥 Permanently Delete All
              </button>
            </div>
          </div>
        )}

        <div className="max-h-80 overflow-y-auto px-6 py-4">
          {trashNotes.length === 0 ? (
            <div className="py-10 text-center">
              <span className="text-3xl">✨</span>
              <p className="mt-2 text-xs text-ink-500">Trash is empty.</p>
            </div>
          ) : (
            <ul className="space-y-2.5">
              {trashNotes.map((note) => (
                <li
                  key={note.id}
                  className="flex items-center justify-between rounded-lg border border-ink-800 bg-ink-850 p-3.5 transition-colors hover:border-ink-700"
                >
                  <div className="min-w-0 flex-1 pr-4">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-xs font-semibold text-ink-100">
                        {note.title || "Untitled Note"}
                      </span>
                      <span className="rounded bg-ink-800 px-1.5 py-0.5 text-[10px] text-ink-400 font-medium">
                        {note.space || "School"}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-amber-400 font-mono">
                      ⏳ {formatTimeRemaining(note.deletedAt)}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => onRecoverNote(note.id)}
                      className="rounded-md border border-duck-500/30 bg-duck-500/10 px-2.5 py-1 text-xs font-medium text-duck-300 transition-colors hover:bg-duck-500/20"
                      title="Recover Note"
                    >
                      🔄 Recover
                    </button>
                    <button
                      type="button"
                      onClick={() => onPermanentlyDeleteNote(note.id)}
                      className="rounded-md border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-xs font-medium text-rose-300 transition-colors hover:bg-rose-500/20"
                      title="Delete Permanently"
                    >
                      ❌ Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Sidebar (main export) ──────────────────────────────────────────
export default function Sidebar({
  spaces: initialSpaces,
  activeSpace,
  onSelectSpace,
  activeNoteId,
  onSelectNote,
  notesBySpace,
  onCreateNote,
  onDeleteNote,
  trashNotes = [],
  onRecoverNote,
  onPermanentlyDeleteNote,
  onRecoverAllNotes,
  onPermanentlyDeleteAllNotes,
  theme,
  setTheme,
  onSyncSupabase,
  onResetData,
  onOpenInstantNote,
  onToggleSidebar,
}) {
  const [spaces, setSpaces] = useState(initialSpaces);
  const [modalOpen, setModalOpen] = useState(false);
  const [trashOpen, setTrashOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    if (!spaces.find((s) => s.name === activeSpace) && spaces.length > 0) {
      onSelectSpace(spaces[0].name);
    }
  }, [spaces, activeSpace, onSelectSpace]);

  const handleCreateSpace = useCallback(
    (newSpace) => {
      setSpaces((prev) => [...prev, newSpace]);
      onSelectSpace(newSpace.name);
    },
    [onSelectSpace]
  );

  const currentNotes = (notesBySpace && notesBySpace[activeSpace]) || [];

  return (
    <>
      <aside className="flex w-64 shrink-0 flex-col border-r border-ink-800 bg-ink-900 h-full">
        {/* Brand Header with Settings ⚙️ button beside SocraticOS */}
        <div className="flex items-center justify-between border-b border-ink-800/60 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl leading-none">🦆</span>
            <span className="text-lg font-bold tracking-tight text-ink-100">
              SocraticOS
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              title="Settings"
              className="rounded-lg p-1.5 text-lg text-ink-400 transition-colors hover:bg-ink-850 hover:text-ink-100"
            >
              ⚙️
            </button>
            {onToggleSidebar && (
              <button
                type="button"
                onClick={onToggleSidebar}
                title="Collapse Sidebar"
                className="rounded-lg p-1.5 text-ink-400 transition-colors hover:bg-ink-850 hover:text-ink-100"
              >
                <PanelLeftClose className="h-4 w-4" strokeWidth={2} />
              </button>
            )}
          </div>
        </div>

        {/* Instant Note Big Button */}
        <div className="px-3 pt-3 pb-1">
          <button
            type="button"
            onClick={onOpenInstantNote}
            className="flex w-full items-center justify-between rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-duck-400 px-3.5 py-2.5 text-xs font-bold text-ink-950 shadow-md shadow-amber-500/10 transition-all hover:scale-[1.01] hover:brightness-105 active:scale-[0.98]"
          >
            <div className="flex items-center gap-2">
              <span className="text-base leading-none">⚡</span>
              <span>Instant Note</span>
            </div>
            <kbd className="rounded bg-ink-950/20 px-1.5 py-0.5 text-[10px] font-mono text-ink-950">
              Ctrl+I
            </kbd>
          </button>
        </div>

        {/* ─── Spaces ─────────────────────────────────── */}
        <nav className="px-3 pt-2">
          <p className="px-2 pb-2 text-[11px] font-medium uppercase tracking-wider text-ink-500">
            Spaces
          </p>
          <ul className="space-y-0.5">
            {spaces.map((space) => {
              const isActive = space.name === activeSpace;
              return (
                <li key={space.name}>
                  <button
                    type="button"
                    onClick={() => onSelectSpace(space.name)}
                    aria-current={isActive ? "true" : undefined}
                    className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm transition-colors ${
                      isActive
                        ? "bg-ink-800 text-ink-100"
                        : "text-ink-400 hover:bg-ink-850 hover:text-ink-200"
                    }`}
                  >
                    <span className="text-base leading-none">{space.icon}</span>
                    <span className="flex-1 truncate">{space.name}</span>
                    {isActive && (
                      <span className="h-1.5 w-1.5 rounded-full bg-duck-400" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>

          {/* Create New Space */}
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="mt-2 flex w-full items-center gap-2 rounded-md border border-dashed border-ink-700 px-2.5 py-2 text-left text-sm text-ink-500 transition-colors hover:border-duck-500/40 hover:text-duck-400"
          >
            <span className="text-base leading-none">＋</span>
            <span>Create New Space</span>
          </button>
        </nav>

        {/* ─── Notes list ─────────────────────────────── */}
        <div className="mt-6 flex-1 overflow-y-auto px-3">
          <p className="px-2 pb-2 text-[11px] font-medium uppercase tracking-wider text-ink-500">
            {activeSpace} · Notes
          </p>

          {currentNotes.length === 0 ? (
            <p className="px-2.5 py-2 text-xs text-ink-600 italic">No notes in this space yet.</p>
          ) : (
            <ul className="space-y-0.5">
              {currentNotes.map((n) => {
                const isActive = activeNoteId === n.id;
                return (
                  <li key={n.id} className="group relative">
                    <button
                      type="button"
                      onClick={() => onSelectNote?.(n)}
                      className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors ${
                        isActive
                          ? "bg-ink-800 text-ink-100 font-medium"
                          : "text-ink-400 hover:bg-ink-850 hover:text-ink-200"
                      }`}
                    >
                      {n.isFavorite ? (
                        <span className="text-amber-400 text-xs">⭐</span>
                      ) : (
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-duck-400 opacity-60" />
                      )}
                      <span className="truncate flex-1">{n.title || "Untitled Note"}</span>
                    </button>
                    {onDeleteNote && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteNote(n.id);
                        }}
                        title="Delete note"
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-xs text-rose-400/90 opacity-0 transition-all hover:bg-rose-500/20 hover:text-rose-300 group-hover:opacity-100"
                      >
                        🗑️
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          <button
            type="button"
            onClick={onCreateNote}
            className="mt-2 w-full rounded-md border border-dashed border-ink-700 px-2.5 py-2 text-left text-sm text-ink-500 transition-colors hover:border-ink-600 hover:text-ink-400"
          >
            + New note
          </button>
        </div>

        {/* ─── Temporarily Deleted Tab at Bottom ──────── */}
        <div className="border-t border-ink-800 px-3 py-2">
          <button
            type="button"
            onClick={() => setTrashOpen(true)}
            className="flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-xs font-medium text-ink-400 transition-colors hover:bg-ink-850 hover:text-ink-200"
          >
            <div className="flex items-center gap-2">
              <span>🗑️</span>
              <span>Trash (24h)</span>
            </div>
            {trashNotes.length > 0 && (
              <span className="rounded-full border border-rose-500/30 bg-rose-500/20 px-2 py-0.5 text-[10px] font-bold text-rose-300">
                {trashNotes.length}
              </span>
            )}
          </button>
        </div>

      </aside>

      {/* Modals */}
      <CreateSpaceModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreate={handleCreateSpace}
      />

      <TrashModal
        open={trashOpen}
        onClose={() => setTrashOpen(false)}
        trashNotes={trashNotes}
        onRecoverNote={onRecoverNote}
        onPermanentlyDeleteNote={onPermanentlyDeleteNote}
        onRecoverAll={onRecoverAllNotes}
        onPermanentlyDeleteAll={onPermanentlyDeleteAllNotes}
      />

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        theme={theme}
        setTheme={setTheme}
        onSyncSupabase={onSyncSupabase}
        onResetData={onResetData}
      />
    </>
  );
}
