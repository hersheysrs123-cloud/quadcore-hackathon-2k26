"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PanelLeftClose, ChevronDown, Download, Upload, HardDrive, CheckCircle2, Key, Cpu, Shield, Server, Eye, EyeOff, Command, Search, PlusSquare, Check } from "lucide-react";
import { exportWorkspaceToJSON, importWorkspaceFromJSON } from "@/lib/backup.js";
import { db } from "@/lib/db.js";
import { getGraphicsSettings, saveGraphicsSettings, DEFAULT_GRAPHICS_SETTINGS, detectHardwareGraphics } from "@/lib/db.js";
import GlobalTimerHUD from "@/components/GlobalTimerHUD";
import NoteMenu from "@/components/NoteMenu";
import { SPACES } from "@/lib/constants";

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
        className="fixed inset-0 z-[300] bg-ink-950/80 backdrop-blur-md transition-opacity"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Confirm Factory Reset"
        className="fixed left-1/2 top-1/2 z-[310] w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-rose-500/40 bg-ink-900 shadow-2xl"
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
  const [tab, setTab] = useState("general"); // "general" | "ai" | "backup" | "reset"
  const [resetTarget, setResetTarget] = useState(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [backupExportSpace, setBackupExportSpace] = useState("All");
  const [backupImportSpace, setBackupImportSpace] = useState("Original");
  const [statusMsg, setStatusMsg] = useState("");

  // AI settings
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);

  const [aiSaved, setAiSaved] = useState(false);

  // 3D Graphics Settings
  const [gfx, setGfx] = useState(null);
  const [gfxSaved, setGfxSaved] = useState(false);

  useEffect(() => {
    if (!open) return;
    async function loadAISettings() {
      try {
        const keyItem = await db.settings.get("gemini_api_key");
        if (keyItem?.value) setApiKey(keyItem.value);
      } catch (err) {
        console.error("Failed to load AI settings:", err);
      }
    }
    async function loadGfxSettings() {
      try {
        const loadedGfx = await getGraphicsSettings();
        setGfx(loadedGfx);
      } catch (err) {
        console.error("Failed to load graphics settings:", err);
      }
    }
    loadAISettings();
    loadGfxSettings();
  }, [open]);

  const handleSaveAI = async (e) => {
    e.preventDefault();
    try {
      await db.settings.put({ key: "gemini_api_key", value: apiKey.trim() });


      setAiSaved(true);
      setTimeout(() => setAiSaved(false), 2000);
    } catch (err) {
      console.error("Failed to save AI settings:", err);
    }
  };

  const handleSaveGfx = async (e) => {
    e.preventDefault();
    try {
      if (gfx) await saveGraphicsSettings(gfx);
      setGfxSaved(true);
      setTimeout(() => setGfxSaved(false), 2000);
    } catch (err) {
      console.error("Failed to save graphics settings:", err);
    }
  };

  const handlePresetChange = (e) => {
    const preset = e.target.value;
    if (preset === "high") {
      setGfx(prev => ({ ...prev, graphicsPreset: preset, targetFps: 60, pixelRatio: 2.0, enableShadows: true, enableAntialias: true }));
    } else if (preset === "medium") {
      setGfx(prev => ({ ...prev, graphicsPreset: preset, targetFps: 60, pixelRatio: 1.5, enableShadows: true, enableAntialias: false }));
    } else if (preset === "low") {
      setGfx(prev => ({ ...prev, graphicsPreset: preset, targetFps: 30, pixelRatio: 1.0, enableShadows: false, enableAntialias: false }));
    } else if (preset === "auto") {
      const autoSettings = detectHardwareGraphics();
      setGfx(prev => ({ ...prev, graphicsPreset: "auto", ...autoSettings }));
    } else {
      setGfx(prev => ({ ...prev, graphicsPreset: preset }));
    }
  };

  const updateGfx = (key, value) => {
    setGfx(prev => ({ ...prev, graphicsPreset: "custom", [key]: value }));
  };

  if (!open) return null;

  const handleExport = async () => {
    try {
      setIsExporting(true);
      setStatusMsg("");
      const res = await exportWorkspaceToJSON(backupExportSpace);
      setStatusMsg(`Successfully exported ${res.count} notes from "${backupExportSpace}" space to ${res.filename}`);
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
      const res = await importWorkspaceFromJSON(file, { targetSpace: backupImportSpace, overwrite: false });
      setStatusMsg(`Successfully restored ${res.imported.notes} notes into "${backupImportSpace}" space! Reloading...`);
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
            onClick={() => setTab("3d")}
            className={`border-b-2 px-3 py-2 text-xs font-semibold transition-all whitespace-nowrap ${
              tab === "3d"
                ? "border-amber-400 text-amber-300"
                : "border-transparent text-ink-400 hover:text-ink-200"
            }`}
          >
            3D &amp; Performance 🎮
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

        <div className="space-y-6 px-6 py-5 h-[65vh] max-h-[500px] overflow-y-auto">
          {tab === "ai" && (
            <form onSubmit={handleSaveAI} className="space-y-4">
              <div className="flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs text-emerald-300">
                <Shield className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
                <div>
                  <span className="font-semibold text-emerald-200">100% Local Privacy:</span> API keys are saved strictly inside IndexedDB (Dexie). They never touch our servers.
                </div>
              </div>

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
            <div className="space-y-6">
              {/* Keyboard Shortcuts */}
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-400 flex items-center gap-2">
                  <Command className="w-4 h-4 text-duck-400" />
                  Keyboard Shortcuts
                </h3>
                <div className="grid grid-cols-1 gap-2">
                  <div className="flex items-center justify-between p-3 rounded-xl border border-ink-800 bg-ink-850">
                    <div className="flex items-center gap-3">
                      <Search className="w-4 h-4 text-ink-400" />
                      <span className="text-xs font-medium text-ink-200">Command Palette</span>
                    </div>
                    <div className="flex gap-1">
                      <kbd className="px-2 py-1 bg-ink-950 border border-ink-700 rounded text-[10px] font-mono text-ink-300">Ctrl/Cmd</kbd>
                      <kbd className="px-2 py-1 bg-ink-950 border border-ink-700 rounded text-[10px] font-mono text-ink-300">K</kbd>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 rounded-xl border border-ink-800 bg-ink-850">
                    <div className="flex items-center gap-3">
                      <PlusSquare className="w-4 h-4 text-ink-400" />
                      <span className="text-xs font-medium text-ink-200">Quick Note</span>
                    </div>
                    <div className="flex gap-1">
                      <kbd className="px-2 py-1 bg-ink-950 border border-ink-700 rounded text-[10px] font-mono text-ink-300">Ctrl/Cmd</kbd>
                      <kbd className="px-2 py-1 bg-ink-950 border border-ink-700 rounded text-[10px] font-mono text-ink-300">I</kbd>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-xl border border-ink-800 bg-ink-850">
                    <div className="flex items-center gap-3">
                      <Check className="w-4 h-4 text-ink-400" />
                      <span className="text-xs font-medium text-ink-200">Save Note</span>
                    </div>
                    <div className="flex gap-1">
                      <kbd className="px-2 py-1 bg-ink-950 border border-ink-700 rounded text-[10px] font-mono text-ink-300">Ctrl/Cmd</kbd>
                      <kbd className="px-2 py-1 bg-ink-950 border border-ink-700 rounded text-[10px] font-mono text-ink-300">S</kbd>
                    </div>
                  </div>
                </div>
              </div>

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
            </div>
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

              {/* Export Section with Space Selector */}
              <div className="rounded-xl border border-duck-500/30 bg-duck-500/5 p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-duck-200">Export Space Backup (.socratic)</div>
                  <span className="text-[10px] text-duck-400 font-mono">Select Space</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {[{ name: "All", icon: "🌐" }, ...SPACES].map((sp) => (
                    <button
                      key={sp.name}
                      type="button"
                      onClick={() => setBackupExportSpace(sp.name)}
                      className={`flex items-center gap-1 rounded-md border px-2.5 py-1 text-[11px] font-semibold transition-all ${
                        backupExportSpace === sp.name
                          ? "border-duck-400 bg-duck-500/30 text-duck-200"
                          : "border-ink-700 bg-ink-900/60 text-ink-400 hover:text-ink-200"
                      }`}
                    >
                      <span>{sp.icon}</span>
                      <span>{sp.name === "All" ? "All Spaces" : sp.name}</span>
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={handleExport}
                  disabled={isExporting}
                  className="flex w-full items-center justify-between rounded-lg border border-duck-500/40 bg-duck-500/20 p-2.5 text-xs font-bold text-duck-300 transition-all hover:bg-duck-500/30 disabled:opacity-50 shadow-sm mt-1"
                >
                  <div className="flex items-center gap-2">
                    <Download className="h-4 w-4 text-duck-400" />
                    <span>Export {backupExportSpace === "All" ? "All Spaces" : `"${backupExportSpace}" Space`} Backup</span>
                  </div>
                  <span className="rounded bg-duck-500/30 px-2 py-0.5 font-mono text-[10px] text-duck-200">
                    {isExporting ? "Exporting..." : ".socratic"}
                  </span>
                </button>
              </div>

              {/* Import Section with Target Space Selector */}
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-emerald-200">Import Workspace File (.socratic)</div>
                  <span className="text-[10px] text-emerald-400 font-mono">Target Space</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setBackupImportSpace("Original")}
                    className={`flex items-center gap-1 rounded-md border px-2.5 py-1 text-[11px] font-semibold transition-all ${
                      backupImportSpace === "Original"
                        ? "border-emerald-400 bg-emerald-500/30 text-emerald-200"
                        : "border-ink-700 bg-ink-900/60 text-ink-400 hover:text-ink-200"
                    }`}
                  >
                    <span>🔄</span>
                    <span>Original Spaces</span>
                  </button>
                  {SPACES.map((sp) => (
                    <button
                      key={sp.name}
                      type="button"
                      onClick={() => setBackupImportSpace(sp.name)}
                      className={`flex items-center gap-1 rounded-md border px-2.5 py-1 text-[11px] font-semibold transition-all ${
                        backupImportSpace === sp.name
                          ? "border-emerald-400 bg-emerald-500/30 text-emerald-200"
                          : "border-ink-700 bg-ink-900/60 text-ink-400 hover:text-ink-200"
                      }`}
                    >
                      <span>{sp.icon}</span>
                      <span>{sp.name}</span>
                    </button>
                  ))}
                </div>
                <label className="flex w-full cursor-pointer items-center justify-between rounded-lg border border-emerald-500/40 bg-emerald-500/20 p-2.5 text-xs font-bold text-emerald-300 transition-all hover:bg-emerald-500/30 shadow-sm mt-1">
                  <div className="flex items-center gap-2">
                    <Upload className="h-4 w-4 text-emerald-400" />
                    <span>Import to {backupImportSpace === "Original" ? "Original Spaces" : `"${backupImportSpace}" Space`}</span>
                  </div>
                  <input
                    type="file"
                    accept=".socratic,.json"
                    className="hidden"
                    onChange={handleImportFile}
                    disabled={isImporting}
                  />
                  <span className="rounded bg-emerald-500/30 px-2 py-0.5 font-mono text-[10px] text-emerald-200">
                    {isImporting ? "Restoring..." : "Select File"}
                  </span>
                </label>
              </div>
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

          {tab === "3d" && gfx && (
            <form onSubmit={handleSaveGfx} className="space-y-6 animate-fade-up">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-ink-300">Graphics Preset</label>
                <select 
                  value={gfx.graphicsPreset} 
                  onChange={handlePresetChange}
                  className="w-full rounded-xl border border-ink-700 bg-ink-850 py-2 px-3 text-xs text-ink-100 focus:border-duck-500/50 focus:outline-none"
                >
                  <option value="auto">Auto-detect</option>
                  <option value="high">High Quality</option>
                  <option value="medium">Balanced</option>
                  <option value="low">Performance (Battery Saver)</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-ink-300">Target FPS</label>
                  <select 
                    value={gfx.targetFps} 
                    onChange={(e) => updateGfx('targetFps', parseInt(e.target.value, 10))}
                    className="w-full rounded-xl border border-ink-700 bg-ink-850 py-2 px-3 text-xs text-ink-100 focus:border-duck-500/50 focus:outline-none"
                  >
                    <option value={30}>30 FPS</option>
                    <option value={60}>60 FPS</option>
                    <option value={120}>120 FPS</option>
                  </select>
                </div>
                
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-ink-300">Pixel Ratio (DPR)</label>
                  <select 
                    value={gfx.pixelRatio} 
                    onChange={(e) => updateGfx('pixelRatio', parseFloat(e.target.value))}
                    className="w-full rounded-xl border border-ink-700 bg-ink-850 py-2 px-3 text-xs text-ink-100 focus:border-duck-500/50 focus:outline-none"
                  >
                    <option value={1.0}>1.0x (Standard)</option>
                    <option value={1.5}>1.5x (Retina)</option>
                    <option value={2.0}>2.0x (Ultra)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-4 pt-2">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative flex-shrink-0">
                    <input 
                      type="checkbox" 
                      className="sr-only" 
                      checked={gfx.enableShadows} 
                      onChange={(e) => updateGfx('enableShadows', e.target.checked)} 
                    />
                    <div className={`block w-10 h-6 rounded-full transition-colors ${gfx.enableShadows ? 'bg-amber-500' : 'bg-ink-700'}`}></div>
                    <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${gfx.enableShadows ? 'translate-x-4' : ''}`}></div>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-medium text-ink-200">Enable Shadows</span>
                    <span className="text-[10px] text-ink-500">Improves realism but uses more GPU</span>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative flex-shrink-0">
                    <input 
                      type="checkbox" 
                      className="sr-only" 
                      checked={gfx.enableAntialias} 
                      onChange={(e) => updateGfx('enableAntialias', e.target.checked)} 
                    />
                    <div className={`block w-10 h-6 rounded-full transition-colors ${gfx.enableAntialias ? 'bg-amber-500' : 'bg-ink-700'}`}></div>
                    <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${gfx.enableAntialias ? 'translate-x-4' : ''}`}></div>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-medium text-ink-200">Anti-aliasing</span>
                    <span className="text-[10px] text-ink-500">Smooths jagged edges on models (requires refresh)</span>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative flex-shrink-0">
                    <input 
                      type="checkbox" 
                      className="sr-only" 
                      checked={gfx.autoPauseHidden} 
                      onChange={(e) => updateGfx('autoPauseHidden', e.target.checked)} 
                    />
                    <div className={`block w-10 h-6 rounded-full transition-colors ${gfx.autoPauseHidden ? 'bg-amber-500' : 'bg-ink-700'}`}></div>
                    <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${gfx.autoPauseHidden ? 'translate-x-4' : ''}`}></div>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-medium text-ink-200">Auto-pause when hidden</span>
                    <span className="text-[10px] text-ink-500">Stops rendering when the tab is out of view</span>
                  </div>
                </label>
              </div>

              <div className="flex justify-end pt-4 border-t border-ink-800">
                <button
                  type="submit"
                  className="rounded-xl bg-amber-400 px-4 py-2 text-xs font-bold text-ink-950 hover:bg-amber-300 transition-colors"
                >
                  {gfxSaved ? "Saved to Dexie!" : "Save 3D Settings"}
                </button>
              </div>
            </form>
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
  spaces,
  setSpaces,
  handleDeleteSpace,
  activeSpace,
  onSelectSpace,
  activeNoteId,
  onSelectNote,
  notesBySpace,
  onCreateNote,
  onDeleteNote,
  onSaveNote,
  onToggleFavorite,
  onOpenExportImport,
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
  onNavigateCalendar,
  onToggleSidebar,
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [trashOpen, setTrashOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [spacesDropdownOpen, setSpacesDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setSpacesDropdownOpen(false);
      }
    }
    if (spacesDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [spacesDropdownOpen]);

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
  const currentSpaceObj = spaces.find((s) => s.name === activeSpace) || spaces[0];

  return (
    <>
      <aside className="flex w-64 shrink-0 flex-col border-r border-ink-800 bg-ink-900 h-full">
        {/* Brand Header with Settings ⚙️ button */}
        <div className="flex items-center justify-between border-b border-ink-800/60 px-3.5 py-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xl leading-none shrink-0">🦆</span>
            <span className="text-sm font-bold tracking-tight text-ink-100 shrink-0">
              SocraticOS
            </span>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              title="Settings"
              className="rounded-lg p-1.5 text-lg text-ink-400 transition-colors hover:bg-ink-850 hover:text-ink-100"
            >
              ⚙️
            </button>
          </div>
        </div>

        {/* Spaces Switcher below SocraticOS logo */}
        <div className="px-3 pt-3 pb-1">
          <div className="relative w-full" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setSpacesDropdownOpen((prev) => !prev)}
              title="Switch Space"
              className="flex w-full items-center justify-between rounded-xl border border-ink-700/80 bg-ink-850/90 px-3 py-2 text-xs font-medium text-ink-200 transition-colors hover:border-duck-500/50 hover:bg-ink-800 hover:text-ink-100 active:scale-98 shadow-sm"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm leading-none shrink-0">{currentSpaceObj?.icon || "📂"}</span>
                <span className="truncate font-semibold text-ink-100 text-xs">{activeSpace}</span>
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-ink-400 shrink-0 ml-1" />
            </button>

            {/* Dropdown Menu */}
            {spacesDropdownOpen && (
              <div className="absolute left-0 top-full mt-1.5 z-[100] w-full rounded-xl border border-ink-700 bg-ink-900 shadow-2xl p-1.5 backdrop-blur-md">
                <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-ink-500">
                  Spaces
                </div>
                <div className="space-y-0.5 max-h-48 overflow-y-auto">
                  {spaces.map((space) => {
                    const isActive = space.name === activeSpace;
                    return (
                      <div key={space.name} className="group/space flex w-full items-center justify-between rounded-lg transition-colors">
                        <button
                          type="button"
                          onClick={() => {
                            onSelectSpace(space.name);
                            setSpacesDropdownOpen(false);
                          }}
                          className={`flex-1 flex items-center justify-between px-2.5 py-1.5 text-xs text-left transition-colors ${
                            isActive
                              ? "bg-ink-800 text-duck-300 font-semibold"
                              : "text-ink-300 hover:bg-ink-850 hover:text-ink-100"
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span className="text-sm leading-none">{space.icon}</span>
                            <span className="truncate">{space.name}</span>
                          </div>
                          {isActive && (
                            <span className="h-1.5 w-1.5 rounded-full bg-duck-400 shrink-0" />
                          )}
                        </button>
                        {spaces.length > 1 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteSpace(space.name);
                            }}
                            className="opacity-0 group-hover/space:opacity-100 p-1 mr-1 rounded hover:bg-rose-500/20 text-ink-500 hover:text-rose-400 transition-all shrink-0"
                            title="Delete space"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="my-1 border-t border-ink-800" />
                <button
                  type="button"
                  onClick={() => {
                    setSpacesDropdownOpen(false);
                    setModalOpen(true);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-duck-400 transition-colors hover:bg-ink-850 hover:text-duck-300 font-medium"
                >
                  <span className="text-sm leading-none">＋</span>
                  <span>Create New Space</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Instant Note Big Button */}
        <div className="px-3 pt-1.5 pb-1">
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

        {/* Unified Timers Button under Instant Note */}
        <div className="px-3 pt-1 pb-1">
          <GlobalTimerHUD onNavigateCalendar={onNavigateCalendar} />
        </div>

        {/* ─── Notes list ─────────────────────────────── */}
        <div className="mt-3 flex-1 overflow-y-auto px-3">
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
                  <li
                    key={n.id}
                    className="group relative flex items-center justify-between gap-1 rounded-md transition-colors hover:bg-ink-850"
                  >
                    <button
                      type="button"
                      onClick={() => onSelectNote?.(n)}
                      className={`flex flex-1 items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm min-w-0 transition-colors ${
                        isActive
                          ? "bg-ink-800 text-ink-100 font-medium"
                          : "text-ink-400 hover:text-ink-200"
                      }`}
                    >
                      {n.isFavorite ? (
                        <span className="text-amber-400 text-xs shrink-0">⭐</span>
                      ) : (
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-duck-400 opacity-60" />
                      )}
                      <span className="truncate flex-1">{n.title || "Untitled Note"}</span>
                    </button>

                    <div className="shrink-0 pr-1 flex items-center">
                      <NoteMenu
                        note={n}
                        onSaveNote={onSaveNote}
                        onToggleFavorite={onToggleFavorite}
                        onExportImport={(noteToExport) => {
                          onSelectNote?.(noteToExport);
                          onOpenExportImport?.(noteToExport);
                        }}
                        onDeleteNote={onDeleteNote}
                        variant="icon"
                        align="left"
                        className="opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity"
                      />
                    </div>
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
