"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, Download, Upload, HardDrive, CheckCircle2, Key, Shield, Eye, EyeOff, Command, Search, PlusSquare, Check, MessageSquare, HeartHandshake, Sparkles, GripVertical, Star, Trash2, FolderInput, Copy, ListChecks, Pencil } from "lucide-react";
import { exportWorkspaceToJSON, importWorkspaceFromJSON } from "@/lib/backup.js";
import { db } from "@/lib/db.js";
import { getGraphicsSettings, saveGraphicsSettings, detectHardwareGraphics } from "@/lib/db.js";
import { seedDemoContent, getSyllabusStatement, saveSyllabusStatement, saveAllSpaces } from "@/lib/storageService.js";
import GlobalTimerHUD from "@/components/GlobalTimerHUD";
import NoteMenu from "@/components/NoteMenu";
import FeatureRequestModal from "@/components/FeatureRequestModal";
import { SPACES, SPACE_ICON_OPTIONS } from "@/lib/constants";

// ─── Sidebar ────────────────────────────────────────────────────────
// Dark-mode/Light-mode sidebar with Spaces, notes-per-space, Create Space modal,
// Settings ⚙️ button, and Factory Reset with Double Confirmation & Typed RESET.
// ─────────────────────────────────────────────────────────────────────

function formatTimeRemaining(deletedAt) {
  if (!deletedAt) return "24h 0m left";
  const expiresAt = new Date(deletedAt).getTime() + 24 * 60 * 60 * 1000;
  const remainingMs = Math.max(0, expiresAt - Date.now());
  const hours = Math.floor(remainingMs / (1000 * 60 * 60));
  const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
  if (hours === 0 && minutes === 0) return "Purging soon";
  return `${hours}h ${minutes}m left`;
}

// ─── Reset Confirmation Dialog with Typed RESET ───────────────────────
function FactoryResetConfirmModal({ open, target, onClose, onConfirm }) {
  const [step, setStep] = useState(1); // 1 = warning, 2 = typed verification
  const [userAnswer, setUserAnswer] = useState("");
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    if (open) {
      setStep(1);
      setUserAnswer("");
      setResetting(false);
    }
  }, [open]);

  if (!open || !target) return null;

  const targetLabel =
    target === "notes"
      ? "Notes & Content Blocks"
      : target === "calendar"
      ? "Calendar Events"
      : "ALL WORKSPACE DATA";

  const isConfirmed = userAnswer.trim() === "RESET";

  async function handleFinalReset() {
    if (!isConfirmed || resetting) return;
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
                <p className="font-semibold text-amber-300">⚠️ Confirmation Required</p>
                <p className="mt-1 text-ink-300">
                  To permanently wipe <strong>{targetLabel}</strong>, please type <strong className="text-amber-300 font-mono">RESET</strong> below:
                </p>
                <div className="mt-3">
                  <input
                    type="text"
                    value={userAnswer}
                    onChange={(e) => setUserAnswer(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && isConfirmed && !resetting) {
                        e.preventDefault();
                        handleFinalReset();
                      }
                    }}
                    placeholder="Type RESET"
                    className="w-full rounded-lg border border-ink-700 bg-ink-850 px-3 py-2 font-mono text-sm font-bold text-ink-100 placeholder:text-ink-600 focus:border-duck-500 focus:outline-none"
                    autoFocus
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
                  disabled={!isConfirmed || resetting}
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

function SettingsModal({
  open,
  onClose,
  theme,
  setTheme,
  onResetData,
  spaces = [],
  spaceSwitcherLayout = "dropdown",
  onSpaceSwitcherLayoutChange,
  onStartTutorial,
}) {
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

  // Editor behavior
  const [clickToAppend, setClickToAppend] = useState(true);

  // Syllabus / Curriculum Boundaries
  const [syllabusText, setSyllabusText] = useState("");
  const [syllabusEnabled, setSyllabusEnabled] = useState(true);
  const [syllabusSaved, setSyllabusSaved] = useState(false);
  const [syllabusFileLoading, setSyllabusFileLoading] = useState(false);
  const [syllabusFileName, setSyllabusFileName] = useState("");

  useEffect(() => {
    if (!open) return;
    async function loadAISettings() {
      try {
        const keyItem = await db.settings.get("gemini_api_key");
        if (keyItem?.value) setApiKey(keyItem.value);

        const clickItem = await db.settings.get("editor_click_to_append");
        if (clickItem) setClickToAppend(clickItem.value !== "false");
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
    async function loadSyllabusSettings() {
      try {
        const { statement, enabled } = await getSyllabusStatement();
        setSyllabusText(statement || "");
        setSyllabusEnabled(Boolean(enabled));
        if (statement) setSyllabusFileName("📄 Syllabus loaded from storage");
      } catch (err) {
        console.error("Failed to load syllabus settings:", err);
      }
    }
    loadAISettings();
    loadGfxSettings();
    loadSyllabusSettings();
  }, [open]);

  const handleSyllabusFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSyllabusFileLoading(true);
    try {
      let text = "";
      if (file.name.endsWith(".docx")) {
        const mammoth = (await import("mammoth")).default;
        const arrayBuffer = await file.arrayBuffer();
        const res = await mammoth.extractRawText({ arrayBuffer });
        text = res.value || "";
      } else if (file.name.endsWith(".pdf")) {
        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.mjs";
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const pageTexts = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          const pageStr = content.items
            .map((item) => ("str" in item ? item.str : ""))
            .join(" ")
            .replace(/\s+/g, " ")
            .trim();
          if (pageStr) pageTexts.push(pageStr);
        }
        text = pageTexts.join("\n\n");
      } else {
        text = await file.text();
      }
      const cleaned = text.replace(/\r\n/g, "\n").trim();
      if (!cleaned) {
        setSyllabusFileName("⚠️ No readable text found in file");
        return;
      }
      setSyllabusText(cleaned);
      setSyllabusFileName(file.name);
      // Auto-save immediately after loading
      await saveSyllabusStatement(cleaned, syllabusEnabled);
      setSyllabusSaved(true);
      setTimeout(() => setSyllabusSaved(false), 2500);
    } catch (err) {
      console.error("Failed to read syllabus file:", err);
      setSyllabusFileName("⚠️ Failed to parse — try a different file");
    } finally {
      setSyllabusFileLoading(false);
      e.target.value = "";
    }
  };

  const handleToggleClickToAppend = async (enabled) => {
    setClickToAppend(enabled);
    try {
      await db.settings.put({ key: "editor_click_to_append", value: String(enabled) });
    } catch (err) {
      console.error("Failed to save editor click setting:", err);
    }
  };

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

  const handleSeedDemoNotes = async () => {
    try {
      setStatusMsg("");
      const res = await seedDemoContent({ overwrite: false });
      setStatusMsg(`Successfully seeded ${res.notes} demo notes (your custom notes and bookmarks were preserved)! Reloading...`);
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (err) {
      alert("Error seeding demo notes: " + err.message);
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
        className="fixed left-1/2 top-1/2 z-[210] w-[94vw] max-w-4xl -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-ink-700 bg-ink-900 shadow-2xl flex flex-col overflow-hidden animate-fade-up"
      >
        <header className="flex items-center justify-between border-b border-ink-800 px-6 py-4.5 bg-ink-950/50 shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">⚙️</span>
            <div>
              <h2 className="text-base font-bold text-ink-100">Preferences &amp; Settings</h2>
              <p className="text-xs text-ink-400">Configure theme, AI keys, 3D graphics performance &amp; workspace backups</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-sm text-ink-500 transition-colors hover:bg-ink-800 hover:text-ink-200"
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

        <div className="space-y-6 px-7 py-6 h-[70vh] max-h-[560px] overflow-y-auto">
          {tab === "ai" && (
            <form onSubmit={handleSaveAI} className="space-y-5 max-w-2xl mx-auto py-2">
              <div className="flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-xs text-emerald-300">
                <Shield className="h-5 w-5 shrink-0 text-emerald-400 mt-0.5" />
                <div>
                  <span className="font-bold text-emerald-200 text-sm">100% Local Privacy:</span>
                  <p className="mt-0.5 leading-relaxed text-emerald-300/90">
                    Your Gemini API key is saved strictly inside your browser's local IndexedDB (Dexie.js). It is never sent to our backend servers.
                  </p>
                </div>
              </div>

              <div className="space-y-2 animate-fade-up">
                <label className="block text-xs font-semibold text-ink-200">
                  Google Gemini API Key
                </label>
                <div className="relative flex items-center">
                  <Key className="absolute left-3.5 h-4 w-4 text-ink-500" />
                  <input
                    type={showKey ? "text" : "password"}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="AIzaSy..."
                    className="w-full rounded-xl border border-ink-700 bg-ink-850 py-3 pl-10 pr-12 text-sm text-ink-100 placeholder:text-ink-600 focus:border-duck-500/50 focus:outline-none font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-3.5 text-ink-500 hover:text-ink-300"
                  >
                    {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-xs text-ink-400">
                  Leave empty to fall back to server env var. Get a free API key at{" "}
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

              <div className="flex justify-end pt-3">
                <button
                  type="submit"
                  className="rounded-xl bg-duck-400 px-6 py-2.5 text-xs font-bold text-ink-950 hover:bg-duck-300 transition-colors shadow-md"
                >
                  {aiSaved ? "✓ Saved to Dexie!" : "Save AI Key & Settings"}
                </button>
              </div>
            </form>
          )}

          {tab === "general" && (
            <div className="space-y-6">
              {/* Keyboard Shortcuts - 3 Column Wide Grid */}
              <div>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-400 flex items-center gap-2">
                  <Command className="w-4 h-4 text-duck-400" />
                  Keyboard Shortcuts
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="flex items-center justify-between p-3.5 rounded-xl border border-ink-800 bg-ink-850">
                    <div className="flex items-center gap-3">
                      <Search className="w-4 h-4 text-ink-400" />
                      <span className="text-xs font-medium text-ink-200">Command Palette</span>
                    </div>
                    <div className="flex gap-1">
                      <kbd className="px-2 py-1 bg-ink-950 border border-ink-700 rounded text-[10px] font-mono text-ink-300">Ctrl</kbd>
                      <kbd className="px-2 py-1 bg-ink-950 border border-ink-700 rounded text-[10px] font-mono text-ink-300">K</kbd>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between p-3.5 rounded-xl border border-ink-800 bg-ink-850">
                    <div className="flex items-center gap-3">
                      <PlusSquare className="w-4 h-4 text-ink-400" />
                      <span className="text-xs font-medium text-ink-200">Quick Note</span>
                    </div>
                    <div className="flex gap-1">
                      <kbd className="px-2 py-1 bg-ink-950 border border-ink-700 rounded text-[10px] font-mono text-ink-300">Ctrl</kbd>
                      <kbd className="px-2 py-1 bg-ink-950 border border-ink-700 rounded text-[10px] font-mono text-ink-300">I</kbd>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3.5 rounded-xl border border-ink-800 bg-ink-850">
                    <div className="flex items-center gap-3">
                      <Check className="w-4 h-4 text-ink-400" />
                      <span className="text-xs font-medium text-ink-200">Save Note</span>
                    </div>
                    <div className="flex gap-1">
                      <kbd className="px-2 py-1 bg-ink-950 border border-ink-700 rounded text-[10px] font-mono text-ink-300">Ctrl</kbd>
                      <kbd className="px-2 py-1 bg-ink-950 border border-ink-700 rounded text-[10px] font-mono text-ink-300">S</kbd>
                    </div>
                  </div>
                </div>
              </div>

              {/* Theme Selector */}
              <div>
                <label className="mb-3 block text-xs font-semibold uppercase tracking-wider text-ink-400">
                  Appearance &amp; Theme
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setTheme("dark")}
                    className={`flex items-center justify-center gap-3 rounded-xl border p-4 text-sm font-semibold transition-all ${
                      theme === "dark"
                        ? "border-duck-500/50 bg-duck-500/20 text-duck-300 shadow-md ring-1 ring-duck-400/40"
                        : "border-ink-800 bg-ink-850 text-ink-400 hover:border-ink-700 hover:text-ink-200"
                    }`}
                  >
                    <span className="text-xl">🌙</span>
                    <div className="text-left">
                      <div className="font-bold text-ink-100">Dark Mode</div>
                      <div className="text-[11px] text-ink-400 font-normal">Sleek Slate background for night study</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTheme("light")}
                    className={`flex items-center justify-center gap-3 rounded-xl border p-4 text-sm font-semibold transition-all ${
                      theme === "light"
                        ? "border-duck-500/50 bg-duck-500/20 text-duck-300 shadow-md ring-1 ring-duck-400/40"
                        : "border-ink-800 bg-ink-850 text-ink-400 hover:border-ink-700 hover:text-ink-200"
                    }`}
                  >
                    <span className="text-xl">☀️</span>
                    <div className="text-left">
                      <div className="font-bold text-ink-100">Light Mode</div>
                      <div className="text-[11px] text-ink-400 font-normal">Warm Stone paper aesthetic for daytime</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Space Switcher Display Layout */}
              <div className="border-t border-ink-800/80 pt-5">
                <label className="mb-3 block text-xs font-semibold uppercase tracking-wider text-ink-400 flex items-center gap-2">
                  <span className="text-sm">🗂️</span>
                  Space Switcher Display
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => onSpaceSwitcherLayoutChange?.("dropdown")}
                    className={`flex items-center gap-3 rounded-xl border p-4 text-sm font-semibold transition-all cursor-pointer ${
                      spaceSwitcherLayout === "dropdown"
                        ? "border-duck-500/50 bg-duck-500/20 text-duck-300 shadow-md ring-1 ring-duck-400/40"
                        : "border-ink-800 bg-ink-850 text-ink-400 hover:border-ink-700 hover:text-ink-200"
                    }`}
                  >
                    <span className="text-xl">▾</span>
                    <div className="text-left">
                      <div className="font-bold text-ink-100">Dropdown Menu</div>
                      <div className="text-[11px] text-ink-400 font-normal">Compact dropdown trigger with popup space list</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => onSpaceSwitcherLayoutChange?.("grid")}
                    className={`flex items-center gap-3 rounded-xl border p-4 text-sm font-semibold transition-all cursor-pointer ${
                      spaceSwitcherLayout === "grid"
                        ? "border-duck-500/50 bg-duck-500/20 text-duck-300 shadow-md ring-1 ring-duck-400/40"
                        : "border-ink-800 bg-ink-850 text-ink-400 hover:border-ink-700 hover:text-ink-200"
                    }`}
                  >
                    <span className="text-xl">⊞</span>
                    <div className="text-left">
                      <div className="font-bold text-ink-100">Grid View</div>
                      <div className="text-[11px] text-ink-400 font-normal">Multi-column tiles for direct 1-click space switching</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Editor Behavior */}
              <div className="border-t border-ink-800/80 pt-5 space-y-3">
                <label className="block text-xs font-semibold uppercase tracking-wider text-ink-400 flex items-center gap-2">
                  <PlusSquare className="w-4 h-4 text-duck-400" />
                  Editor Behavior
                </label>
                <div className="flex items-center justify-between p-4 rounded-xl border border-ink-800 bg-ink-850">
                  <div className="space-y-0.5 pr-4">
                    <p className="text-sm font-semibold text-ink-100">Click anywhere to create block</p>
                    <p className="text-xs text-ink-400">Clicking empty space below or between blocks automatically appends a new block</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={clickToAppend}
                      onChange={(e) => handleToggleClickToAppend(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-ink-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-duck-500"></div>
                  </label>
                </div>
              </div>


              {/* Academic Syllabus & Curriculum Boundaries */}
              <div className="border-t border-ink-800/80 pt-5 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-ink-400 flex items-center gap-2">
                    <span className="text-base">🎓</span>
                    Academic Syllabus &amp; Curriculum Boundaries
                  </label>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={syllabusEnabled}
                      onChange={(e) => {
                        setSyllabusEnabled(e.target.checked);
                        saveSyllabusStatement(syllabusText, e.target.checked).catch(console.error);
                      }}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-ink-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-duck-500"></div>
                  </label>
                </div>

                <p className="text-xs text-ink-400 leading-relaxed">
                  Upload your full syllabus document and the AI will <strong>stay strictly within your curriculum</strong> — no more being penalised for missing Grade 12 content when you&apos;re in Grade 10.
                </p>

                {/* Upload zone */}
                <label className={`group relative flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer transition-all ${syllabusEnabled ? "border-ink-700 hover:border-duck-500/70 hover:bg-duck-500/5" : "border-ink-800 opacity-40 pointer-events-none"} ${syllabusFileLoading ? "animate-pulse" : ""}`}>
                  <input
                    type="file"
                    accept=".txt,.md,.docx,.pdf"
                    onChange={handleSyllabusFile}
                    disabled={!syllabusEnabled || syllabusFileLoading}
                    className="sr-only"
                  />
                  {syllabusFileLoading ? (
                    <>
                      <span className="text-3xl animate-spin inline-block">⏳</span>
                      <p className="text-sm font-semibold text-duck-300">Extracting text from document…</p>
                      <p className="text-xs text-ink-500">Large PDFs may take a few seconds</p>
                    </>
                  ) : syllabusText ? (
                    <>
                      <span className="text-3xl">✅</span>
                      <div className="space-y-0.5">
                        <p className="text-sm font-semibold text-emerald-300">Syllabus loaded!</p>
                        <p className="text-xs text-ink-400 font-mono break-all">{syllabusFileName}</p>
                        <p className="text-xs text-ink-500">{(syllabusText.length / 1000).toFixed(1)}k chars extracted · Click to replace</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <span className="text-3xl group-hover:scale-110 transition-transform">📄</span>
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-ink-200">Drop your syllabus document here</p>
                        <p className="text-xs text-ink-500">Supports .pdf, .docx, .txt, .md — full document, any size</p>
                      </div>
                    </>
                  )}
                </label>

                {/* Quick preset chips */}
                <div className="space-y-1.5">
                  <p className="text-[10px] uppercase tracking-wider text-ink-600 font-semibold">Or pick a quick preset</p>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { label: "🎓 IGCSE Gr.10", text: "IGCSE Cambridge Grade 10 (Year 10-11). Curriculum covers Cambridge IGCSE syllabus only. Do not include A-Level, IB HL, AP, or university-level content. Grade strictly within IGCSE scope." },
                      { label: "📚 GCSE / O-Level", text: "GCSE / O-Level (UK/Singapore). Curriculum covers GCSE or O-Level syllabus only. Do not include A-Level or university content." },
                      { label: "🏛️ IB MYP 4-5", text: "IB Middle Years Programme (MYP Year 4-5). Curriculum covers MYP scope only. Do not include IB Diploma HL/SL or university-level content." },
                      { label: "🧬 AP / A-Level", text: "AP or A-Level (Grade 11-12). Curriculum is at AP or A-Level standard. Do not require university/postgraduate knowledge." },
                      { label: "🔬 Middle School", text: "Middle School (Grade 6-8). Curriculum covers middle school scope only. Do not include high school or university concepts." },
                    ].map(({ label, text }) => (
                      <button
                        key={label}
                        type="button"
                        disabled={!syllabusEnabled}
                        onClick={async () => {
                          setSyllabusText(text);
                          setSyllabusFileName(`Quick preset: ${label}`);
                          await saveSyllabusStatement(text, syllabusEnabled);
                          setSyllabusSaved(true);
                          setTimeout(() => setSyllabusSaved(false), 2000);
                        }}
                        className="flex items-center gap-1 rounded-md border border-ink-700 bg-ink-900/60 px-2.5 py-1 text-[11px] font-semibold text-ink-400 hover:text-ink-200 hover:border-duck-500/50 transition-all disabled:opacity-40 disabled:pointer-events-none"
                      >
                        {label}
                      </button>
                    ))}
                    {syllabusText && (
                      <button
                        type="button"
                        onClick={async () => {
                          setSyllabusText("");
                          setSyllabusFileName("");
                          await saveSyllabusStatement("", syllabusEnabled);
                        }}
                        className="flex items-center gap-1 rounded-md border border-red-800/60 bg-red-950/30 px-2.5 py-1 text-[11px] font-semibold text-red-400 hover:text-red-200 hover:border-red-500/50 transition-all"
                      >
                        🗑️ Clear
                      </button>
                    )}
                  </div>
                </div>

                {/* Status bar */}
                {syllabusSaved && (
                  <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
                    <Check className="w-3.5 h-3.5 shrink-0" />
                    <span>Syllabus saved to IndexedDB — AI will stay within your curriculum scope.</span>
                  </div>
                )}
                {!syllabusEnabled && (
                  <div className="flex items-center gap-2 rounded-lg border border-ink-700 bg-ink-850 px-3 py-2 text-xs text-ink-500">
                    <span>⏸️</span>
                    <span>Syllabus boundaries disabled — toggle on to activate.</span>
                  </div>
                )}
              </div>


              {/* Interactive Tutorial Replay */}
              <div className="border-t border-ink-800/80 pt-5 space-y-3">
                <label className="block text-xs font-semibold uppercase tracking-wider text-ink-400 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-duck-400" />
                  Interactive Tutorial &amp; Feature Guide
                </label>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-xl border border-duck-500/30 bg-duck-500/10">
                  <div className="space-y-0.5 pr-2">
                    <p className="text-sm font-semibold text-ink-100">Take the SocraticOS Onboarding Tour</p>
                    <p className="text-xs text-ink-300">
                      Explore all 19 editor blocks, Quizzes Studio, Space Hub syllabus, 27 3D simulations, multi-timer HUD, and power shortcuts.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      if (onStartTutorial) onStartTutorial();
                    }}
                    className="flex items-center gap-2 rounded-lg bg-duck-400 px-4 py-2 text-xs font-bold text-ink-950 transition-all hover:bg-duck-300 shadow-sm shrink-0 whitespace-nowrap cursor-pointer"
                  >
                    <span>🎓</span>
                    <span>Restart Tutorial</span>
                  </button>
                </div>
              </div>

              {/* Local-First Dexie Storage Status */}
              <div className="border-t border-ink-800/80 pt-4">
                <p className="text-xs text-ink-400 leading-relaxed">
                  💾 <strong>100% Local-First Storage</strong>: Your notes, 3D scenes, calendar events, and study sessions are stored privately in your browser&apos;s IndexedDB engine (Dexie.js).
                </p>
              </div>
            </div>
          )}

          {tab === "backup" && (
            <div className="space-y-5">
              <div className="rounded-xl border border-sky-500/20 bg-sky-500/10 p-4 text-xs leading-relaxed text-sky-200">
                <div className="font-bold flex items-center gap-2 text-sm text-sky-300">
                  <HardDrive className="h-4 w-4" />
                  <span>100% Offline Workspace Backups</span>
                </div>
                <p className="mt-1 text-xs text-sky-300/80">
                  Save a complete snapshot of your workspace (notes, whiteboard drawings, calendar events, and study sessions) directly to your hard drive, or restore an existing <code>.socratic</code> / <code>.json</code> backup.
                </p>
              </div>

              {statusMsg && (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300 flex items-center gap-2 animate-fade-in">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>{statusMsg}</span>
                </div>
              )}

              {/* Export & Import Dual Columns */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Export Section */}
                <div className="rounded-xl border border-duck-500/30 bg-duck-500/5 p-4 space-y-3 flex flex-col justify-between">
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-bold text-duck-200">Export Space Backup (.socratic)</div>
                      <span className="text-[10px] text-duck-400 font-mono">Select Space</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {[{ name: "All", icon: "🌐" }, ...spaces].map((sp) => (
                        <button
                          key={sp.name}
                          type="button"
                          onClick={() => setBackupExportSpace(sp.name)}
                          className={`flex items-center gap-1 rounded-md border px-2.5 py-1 text-[11px] font-semibold transition-all ${
                            backupExportSpace === sp.name
                              ? "border-duck-400 bg-duck-500/30 text-duck-200 shadow-sm"
                              : "border-ink-700 bg-ink-900/60 text-ink-400 hover:text-ink-200"
                          }`}
                        >
                          <span>{sp.icon}</span>
                          <span>{sp.name === "All" ? "All Spaces" : sp.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleExport}
                    disabled={isExporting}
                    className="flex w-full items-center justify-between rounded-lg border border-duck-500/40 bg-duck-500/20 p-3 text-xs font-bold text-duck-300 transition-all hover:bg-duck-500/30 disabled:opacity-50 shadow-sm mt-2"
                  >
                    <div className="flex items-center gap-2">
                      <Download className="h-4 w-4 text-duck-400" />
                      <span>Export {backupExportSpace === "All" ? "All Spaces" : `"${backupExportSpace}" Space`}</span>
                    </div>
                    <span className="rounded bg-duck-500/30 px-2 py-0.5 font-mono text-[10px] text-duck-200">
                      {isExporting ? "Exporting..." : ".socratic"}
                    </span>
                  </button>
                </div>

                {/* Import Section */}
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-3 flex flex-col justify-between">
                  <div className="space-y-2.5">
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
                            ? "border-emerald-400 bg-emerald-500/30 text-emerald-200 shadow-sm"
                            : "border-ink-700 bg-ink-900/60 text-ink-400 hover:text-ink-200"
                        }`}
                      >
                        <span>🔄</span>
                        <span>Original Spaces</span>
                      </button>
                      {spaces.map((sp) => (
                        <button
                          key={sp.name}
                          type="button"
                          onClick={() => setBackupImportSpace(sp.name)}
                          className={`flex items-center gap-1 rounded-md border px-2.5 py-1 text-[11px] font-semibold transition-all ${
                            backupImportSpace === sp.name
                              ? "border-emerald-400 bg-emerald-500/30 text-emerald-200 shadow-sm"
                              : "border-ink-700 bg-ink-900/60 text-ink-400 hover:text-ink-200"
                          }`}
                        >
                          <span>{sp.icon}</span>
                          <span>{sp.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <label className="flex w-full cursor-pointer items-center justify-between rounded-lg border border-emerald-500/40 bg-emerald-500/20 p-3 text-xs font-bold text-emerald-300 transition-all hover:bg-emerald-500/30 shadow-sm mt-2">
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

              {/* Seed Demo Content Card */}
              <div className="rounded-xl border border-duck-500/30 bg-duck-500/10 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs font-bold text-duck-200">
                    <span>🌱</span>
                    <span>Sample Study Notes (Demo Notes Only)</span>
                  </div>
                  <p className="text-[11px] text-ink-300">
                    Re-seed curated textbook-grade study notes (Calculus, Photosynthesis, Big-O, Wave Optics, Neuroscience, Quantum Mechanics) into your workspace without modifying your Web Saver bookmarks or folders.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleSeedDemoNotes}
                  className="rounded-lg border border-duck-500/40 bg-duck-400 px-4 py-2 text-xs font-bold text-ink-950 transition-all hover:bg-duck-300 whitespace-nowrap shadow-sm shrink-0"
                >
                  🌱 Restore Seed Notes
                </button>
              </div>
            </div>
          )}

          {tab === "reset" && (
            <div className="space-y-4">
              <p className="text-xs text-ink-400 leading-relaxed">
                Factory resets permanently delete data from both local cache and Supabase. Each action requires double confirmation and human verification.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                <button
                  type="button"
                  onClick={() => setResetTarget("notes")}
                  className="flex items-center justify-between rounded-xl border border-ink-800 bg-ink-850 p-4 text-xs font-medium text-ink-200 transition-all hover:border-rose-500/40 hover:bg-rose-500/5 hover:text-rose-300"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-base">📝</span>
                    <div>
                      <div className="font-bold text-ink-100">Factory Reset Notes</div>
                      <div className="text-[11px] text-ink-400 font-normal">Clear all notes and trash</div>
                    </div>
                  </div>
                  <span className="text-[10px] text-rose-400 font-bold uppercase rounded bg-rose-500/10 px-2 py-1">Clear Notes</span>
                </button>

                <button
                  type="button"
                  onClick={() => setResetTarget("calendar")}
                  className="flex items-center justify-between rounded-xl border border-ink-800 bg-ink-850 p-4 text-xs font-medium text-ink-200 transition-all hover:border-rose-500/40 hover:bg-rose-500/5 hover:text-rose-300"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-base">📅</span>
                    <div>
                      <div className="font-bold text-ink-100">Factory Reset Calendar</div>
                      <div className="text-[11px] text-ink-400 font-normal">Clear all events and alarms</div>
                    </div>
                  </div>
                  <span className="text-[10px] text-rose-400 font-bold uppercase rounded bg-rose-500/10 px-2 py-1">Clear Events</span>
                </button>
              </div>

              <div className="border-t border-ink-800 pt-3">
                <button
                  type="button"
                  onClick={() => setResetTarget("all")}
                  className="flex w-full items-center justify-between rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-xs font-bold text-rose-300 transition-all hover:bg-rose-500/20"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg">💥</span>
                    <div>
                      <div className="font-extrabold text-sm text-rose-200">Factory Reset ALL WORKSPACE DATA</div>
                      <div className="text-xs text-rose-300/80 font-normal">Purge notes, calendar events, mastery analytics, settings and local cache</div>
                    </div>
                  </div>
                  <span className="text-[11px] uppercase font-extrabold text-rose-300 bg-rose-500/20 px-3 py-1.5 rounded-lg border border-rose-500/40">Purge Everything</span>
                </button>
              </div>
            </div>
          )}

          {tab === "3d" && gfx && (
            <form onSubmit={handleSaveGfx} className="space-y-6 animate-fade-up">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-ink-300">Graphics Preset</label>
                  <select 
                    value={gfx.graphicsPreset} 
                    onChange={handlePresetChange}
                    className="w-full rounded-xl border border-ink-700 bg-ink-850 py-2.5 px-3 text-xs text-ink-100 focus:border-duck-500/50 focus:outline-none"
                  >
                    <option value="auto">Auto-detect</option>
                    <option value="high">High Quality</option>
                    <option value="medium">Balanced</option>
                    <option value="low">Performance (Battery Saver)</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
                
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-ink-300">Target FPS</label>
                  <select 
                    value={gfx.targetFps} 
                    onChange={(e) => updateGfx('targetFps', parseInt(e.target.value, 10))}
                    className="w-full rounded-xl border border-ink-700 bg-ink-850 py-2.5 px-3 text-xs text-ink-100 focus:border-duck-500/50 focus:outline-none"
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
                    className="w-full rounded-xl border border-ink-700 bg-ink-850 py-2.5 px-3 text-xs text-ink-100 focus:border-duck-500/50 focus:outline-none"
                  >
                    <option value={1.0}>1.0x (Standard)</option>
                    <option value={1.5}>1.5x (Retina)</option>
                    <option value={2.0}>2.0x (Ultra)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                <label className="flex items-center gap-3 p-3.5 rounded-xl border border-ink-800 bg-ink-850 cursor-pointer group hover:border-ink-700">
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
                    <span className="text-xs font-semibold text-ink-200">Enable Shadows</span>
                    <span className="text-[10px] text-ink-500">Improves realism</span>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3.5 rounded-xl border border-ink-800 bg-ink-850 cursor-pointer group hover:border-ink-700">
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
                    <span className="text-xs font-semibold text-ink-200">Anti-aliasing</span>
                    <span className="text-[10px] text-ink-500">Smooths jagged edges</span>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3.5 rounded-xl border border-ink-800 bg-ink-850 cursor-pointer group hover:border-ink-700">
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
                    <span className="text-xs font-semibold text-ink-200">Auto-pause Hidden</span>
                    <span className="text-[10px] text-ink-500">Stops rendering when tab hidden</span>
                  </div>
                </label>
              </div>

              <div className="flex justify-end pt-4 border-t border-ink-800">
                <button
                  type="submit"
                  className="rounded-xl bg-amber-400 px-6 py-2.5 text-xs font-bold text-ink-950 hover:bg-amber-300 transition-colors shadow-md"
                >
                  {gfxSaved ? "✓ Saved to Dexie!" : "Save 3D Settings"}
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
function CreateSpaceModal({ open, onClose, onCreate, spaces = [] }) {
  const inputRef = useRef(null);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("📂");
  const [blurb, setBlurb] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setName("");
      setIcon("📂");
      setBlurb("");
      setError("");
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
    if (spaces.some((s) => s.name.toLowerCase() === trimmed.toLowerCase())) {
      setError(`A space named "${trimmed}" already exists.`);
      return;
    }
    onCreate({ name: trimmed, icon: icon || "📂", blurb: blurb.trim() });
    onClose();
  }

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
        aria-label="Create New Space"
        className="fixed left-1/2 top-1/2 z-[210] w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl border border-ink-700 bg-ink-900 shadow-2xl"
      >
        <header className="flex items-center justify-between border-b border-ink-800 px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="text-base">{icon || "📂"}</span>
            <h2 className="text-sm font-semibold text-ink-100">Create New Space</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md px-2 py-1 text-sm text-ink-500 transition-colors hover:bg-ink-800 hover:text-ink-200"
          >
            ✕
          </button>
        </header>

        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-5">
          <div>
            <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-ink-500">
              Space Emoji
            </label>
            <div className="flex items-center gap-2 mb-2">
              <input
                type="text"
                maxLength={4}
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                placeholder="📂"
                className="w-12 h-9 rounded-lg border border-ink-700 bg-ink-850 text-center text-lg font-bold text-ink-100 focus:border-duck-500/50 focus:outline-none"
              />
              <span className="text-xs text-ink-400">Pick below or type any custom emoji</span>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-0.5">
              {SPACE_ICON_OPTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setIcon(emoji)}
                  className={`flex h-8 w-8 items-center justify-center rounded-lg text-base transition-all ${
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
              htmlFor="create-space-name"
              className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-ink-500"
            >
              Name
            </label>
            <input
              ref={inputRef}
              id="create-space-name"
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError("");
              }}
              placeholder="e.g. Research"
              maxLength={32}
              className="w-full rounded-lg border border-ink-700 bg-ink-850 px-3 py-2 text-sm text-ink-100 placeholder:text-ink-600 focus:border-duck-500/50 focus:outline-none"
            />
            {error && <p className="mt-1.5 text-xs font-medium text-rose-400 animate-fade-in">{error}</p>}
          </div>

          <div>
            <label
              htmlFor="create-space-blurb"
              className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-ink-500"
            >
              Description / Tagline (Optional)
            </label>
            <input
              id="create-space-blurb"
              type="text"
              value={blurb}
              onChange={(e) => setBlurb(e.target.value)}
              placeholder="e.g. Courses, problem sets & exam preparation"
              maxLength={80}
              className="w-full rounded-lg border border-ink-700 bg-ink-850 px-3 py-2 text-xs text-ink-100 placeholder:text-ink-600 focus:border-duck-500/50 focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-ink-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-3.5 py-1.5 text-xs text-ink-400 transition-colors hover:text-ink-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="rounded-lg bg-duck-400 px-4 py-1.5 text-xs font-semibold text-ink-950 transition-opacity disabled:opacity-30 hover:bg-duck-300 shadow-sm cursor-pointer"
            >
              Create
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

// ─── Edit Space Modal ───────────────────────────────────────────────
function EditSpaceModal({
  open,
  onClose,
  space,
  onSave,
  onDelete,
  canDelete = false,
  spaces = [],
}) {
  const inputRef = useRef(null);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("📂");
  const [blurb, setBlurb] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (open && space) {
      setName(space.name || "");
      setIcon(space.icon || "📂");
      setBlurb(space.blurb || "");
      setError("");
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [open, space]);

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
    if (
      trimmed.toLowerCase() !== (space?.name || "").toLowerCase() &&
      spaces.some((s) => s.name.toLowerCase() === trimmed.toLowerCase())
    ) {
      setError(`A space named "${trimmed}" already exists.`);
      return;
    }
    onSave?.(space.name, { name: trimmed, icon: icon || "📂", blurb: blurb.trim() });
    onClose();
  }

  if (!open || !space) return null;

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
        aria-label="Edit Space"
        className="fixed left-1/2 top-1/2 z-[210] w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl border border-ink-700 bg-ink-900 shadow-2xl"
      >
        <header className="flex items-center justify-between border-b border-ink-800 px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="text-base">{icon || "📂"}</span>
            <h2 className="text-sm font-semibold text-ink-100">Edit Space</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md px-2 py-1 text-sm text-ink-500 transition-colors hover:bg-ink-800 hover:text-ink-200"
          >
            ✕
          </button>
        </header>

        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-5">
          <div>
            <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-ink-500">
              Space Emoji
            </label>
            <div className="flex items-center gap-2 mb-2">
              <input
                type="text"
                maxLength={4}
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                placeholder="📂"
                className="w-12 h-9 rounded-lg border border-ink-700 bg-ink-850 text-center text-lg font-bold text-ink-100 focus:border-duck-500/50 focus:outline-none"
              />
              <span className="text-xs text-ink-400">Pick below or type any custom emoji</span>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-0.5">
              {SPACE_ICON_OPTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setIcon(emoji)}
                  className={`flex h-8 w-8 items-center justify-center rounded-lg text-base transition-all ${
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
              htmlFor="edit-space-name"
              className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-ink-500"
            >
              Name
            </label>
            <input
              ref={inputRef}
              id="edit-space-name"
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError("");
              }}
              placeholder="e.g. Research"
              maxLength={32}
              className="w-full rounded-lg border border-ink-700 bg-ink-850 px-3 py-2 text-sm text-ink-100 placeholder:text-ink-600 focus:border-duck-500/50 focus:outline-none"
            />
            {error && <p className="mt-1.5 text-xs font-medium text-rose-400 animate-fade-in">{error}</p>}
          </div>

          <div>
            <label
              htmlFor="edit-space-blurb"
              className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-ink-500"
            >
              Description / Tagline (Optional)
            </label>
            <input
              id="edit-space-blurb"
              type="text"
              value={blurb}
              onChange={(e) => setBlurb(e.target.value)}
              placeholder="e.g. Courses, problem sets & exam preparation"
              maxLength={80}
              className="w-full rounded-lg border border-ink-700 bg-ink-850 px-3 py-2 text-xs text-ink-100 placeholder:text-ink-600 focus:border-duck-500/50 focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-ink-800">
            {canDelete ? (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onDelete?.(space.name);
                }}
                className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-rose-400 hover:bg-rose-500/15 transition-colors"
              >
                Delete Space
              </button>
            ) : <div />}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg px-3 py-1.5 text-xs text-ink-400 transition-colors hover:text-ink-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!name.trim()}
                className="rounded-lg bg-duck-400 px-4 py-1.5 text-xs font-semibold text-ink-950 transition-opacity disabled:opacity-30 hover:bg-duck-300 shadow-sm cursor-pointer"
              >
                Save
              </button>
            </div>
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
                      <span className="text-sm shrink-0 leading-none">{note.emoji || "📝"}</span>
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

// ─── Batch Delete Confirmation Dialog ────────────────────────────────
function BatchDeleteConfirmModal({ open, count, notes = [], onClose, onConfirm }) {
  if (!open || count === 0) return null;

  return (
    <>
      <div
        onClick={onClose}
        aria-hidden="true"
        className="fixed inset-0 z-[220] bg-ink-950/70 backdrop-blur-sm transition-opacity"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Confirm Move Notes to Trash"
        className="fixed left-1/2 top-1/2 z-[230] w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-rose-500/30 bg-ink-900 shadow-2xl overflow-hidden"
      >
        <header className="flex items-center justify-between border-b border-rose-500/20 bg-rose-500/10 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">🗑️</span>
            <div>
              <h3 className="text-sm font-bold text-rose-200">
                Move {count} Note{count === 1 ? "" : "s"} to Trash?
              </h3>
              <p className="text-[11px] text-ink-400 mt-0.5">
                Deleted notes are kept in Trash for 24 hours before permanent removal.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-sm text-ink-500 hover:bg-ink-800 hover:text-ink-200 transition-colors"
          >
            ✕
          </button>
        </header>

        <div className="p-5 space-y-4">
          {/* Note List Preview */}
          <div className="rounded-lg border border-ink-800 bg-ink-950/60 p-3 max-h-48 overflow-y-auto space-y-1.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-ink-500 pb-1 border-b border-ink-800/80">
              Notes to be moved to trash:
            </div>
            {notes.slice(0, 5).map((note) => (
              <div key={note.id} className="flex items-center gap-2 text-xs text-ink-200 truncate py-0.5">
                <span className="text-sm shrink-0 leading-none">{note.emoji || "📝"}</span>
                <span className="truncate font-medium">{note.title || "Untitled Note"}</span>
              </div>
            ))}
            {count > 5 && (
              <div className="text-[11px] text-ink-500 italic pt-1">
                ...and {count - 5} more note{count - 5 === 1 ? "" : "s"}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-xs font-medium text-ink-400 hover:bg-ink-800 hover:text-ink-200 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-rose-500 transition-colors cursor-pointer"
            >
              Move {count} Note{count === 1 ? "" : "s"} to Trash
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Batch Move to Space Modal ──────────────────────────────────────
function BatchMoveModal({ open, count, currentSpace, spaces = [], onClose, onSelectTargetSpace }) {
  if (!open || count === 0) return null;

  return (
    <>
      <div
        onClick={onClose}
        aria-hidden="true"
        className="fixed inset-0 z-[220] bg-ink-950/70 backdrop-blur-sm transition-opacity"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Move Notes to Space"
        className="fixed left-1/2 top-1/2 z-[230] w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl border border-ink-700 bg-ink-900 shadow-2xl overflow-hidden"
      >
        <header className="flex items-center justify-between border-b border-ink-800 px-5 py-4">
          <div className="flex items-center gap-2">
            <FolderInput className="w-4 h-4 text-duck-400" />
            <h3 className="text-sm font-bold text-ink-100">
              Move {count} Note{count === 1 ? "" : "s"} to Space
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-sm text-ink-500 hover:bg-ink-800 hover:text-ink-200 transition-colors"
          >
            ✕
          </button>
        </header>

        <div className="p-4 space-y-3">
          <p className="text-[11px] font-medium text-ink-400 px-1">
            Choose destination space:
          </p>

          <div className="space-y-1 max-h-60 overflow-y-auto">
            {spaces.map((s) => {
              const isCurrent = s.name === currentSpace;
              return (
                <button
                  key={s.name}
                  type="button"
                  disabled={isCurrent}
                  onClick={() => onSelectTargetSpace(s.name)}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-medium transition-all cursor-pointer ${
                    isCurrent
                      ? "opacity-40 cursor-not-allowed bg-ink-950/40 text-ink-500 border border-transparent"
                      : "hover:bg-duck-500/10 hover:text-duck-300 text-ink-200 hover:border-duck-500/30 border border-ink-800/60 bg-ink-850/60"
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="text-sm leading-none shrink-0">{s.icon || "📂"}</span>
                    <span className="truncate">{s.name}</span>
                  </div>
                  {isCurrent ? (
                    <span className="text-[10px] text-ink-500 shrink-0">(Current)</span>
                  ) : (
                    <span className="text-xs text-ink-500 group-hover:text-duck-300 shrink-0">→</span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-end pt-2 border-t border-ink-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-3.5 py-1.5 text-xs text-ink-400 hover:bg-ink-800 hover:text-ink-200 transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Sidebar (main export) ──────────────────────────────────────────
export default function Sidebar({
  spaces,
  setSpaces,
  onEditSpace,
  onRenameSpace,
  handleDeleteSpace,
  activeSpace,
  onSelectSpace,
  activeNoteId,
  onSelectNote,
  notesBySpace,
  onCreateNote,
  onDeleteNote,
  onSaveNote,
  onReorderNotes,
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
  activeTab = "notes",
  onNavigateTab,
  onOpenInstantNote,
  onOpenTutor,
  onReformatNote,
  onNavigateCalendar,
  onToggleSidebar,
  onDuplicateNote,
  onMoveNote,
  onRenameNote,
  onDeleteMultipleNotes,
  onMoveMultipleNotes,
  onToggleFavoriteMultipleNotes,
  onDuplicateMultipleNotes,
  onStartTutorial,
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSpace, setEditingSpace] = useState(null);
  const [trashOpen, setTrashOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [featureRequestOpen, setFeatureRequestOpen] = useState(false);
  const [spacesDropdownOpen, setSpacesDropdownOpen] = useState(false);
  const [spaceSwitcherLayout, setSpaceSwitcherLayout] = useState("dropdown"); // "dropdown" | "grid"
  const [draggingNoteId, setDraggingNoteId] = useState(null);
  const [dragOverInfo, setDragOverInfo] = useState(null); // { id: string, position: 'top' | 'bottom' }
  const [isMultiSelecting, setIsMultiSelecting] = useState(false);
  const [selectedNoteIds, setSelectedNoteIds] = useState(new Set());
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false);
  const [batchMoveOpen, setBatchMoveOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    try {
      const cached = localStorage.getItem("socraticos_space_switcher_layout");
      if (cached === "grid" || cached === "dropdown") {
        setSpaceSwitcherLayout(cached);
      }
    } catch {
      // Ignore
    }
    db.settings.get("space_switcher_layout").then((item) => {
      if (item?.value && (item.value === "grid" || item.value === "dropdown")) {
        setSpaceSwitcherLayout(item.value);
        try {
          localStorage.setItem("socraticos_space_switcher_layout", item.value);
        } catch {
          // Ignore
        }
      }
    }).catch(console.error);
  }, []);

  const handleSpaceSwitcherLayoutChange = useCallback(async (newLayout) => {
    setSpaceSwitcherLayout(newLayout);
    try {
      localStorage.setItem("socraticos_space_switcher_layout", newLayout);
    } catch {
      // Ignore
    }
    try {
      await db.settings.put({ key: "space_switcher_layout", value: newLayout });
    } catch (err) {
      console.error("Failed to save space switcher layout setting:", err);
    }
  }, []);

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
      try {
        const delArr = JSON.parse(localStorage.getItem("socratic_deleted_spaces") || "[]");
        if (Array.isArray(delArr) && delArr.includes(newSpace.name)) {
          const nextDeleted = delArr.filter((n) => n !== newSpace.name);
          localStorage.setItem("socratic_deleted_spaces", JSON.stringify(nextDeleted));
        }
      } catch (e) {}
      setSpaces((prev) => {
        const next = [...prev, newSpace];
        saveAllSpaces(next);
        return next;
      });
      onSelectSpace(newSpace.name);
    },
    [setSpaces, onSelectSpace]
  );

  const currentNotes = (notesBySpace && notesBySpace[activeSpace]) || [];
  const currentSpaceObj = spaces.find((s) => s.name === activeSpace) || spaces[0];

  // Reset selection when switching spaces
  useEffect(() => {
    setSelectedNoteIds(new Set());
  }, [activeSpace]);

  // Exit multi-select mode if active space has no notes
  useEffect(() => {
    if (currentNotes.length === 0 && isMultiSelecting) {
      setIsMultiSelecting(false);
      setSelectedNoteIds(new Set());
    }
  }, [currentNotes.length, isMultiSelecting]);

  const handleToggleSelectNote = useCallback((noteId) => {
    setSelectedNoteIds((prev) => {
      const next = new Set(prev);
      if (next.has(noteId)) {
        next.delete(noteId);
      } else {
        next.add(noteId);
      }
      return next;
    });
  }, []);

  const handleSelectAllToggle = useCallback(() => {
    if (selectedNoteIds.size === currentNotes.length) {
      setSelectedNoteIds(new Set());
    } else {
      setSelectedNoteIds(new Set(currentNotes.map((n) => n.id)));
    }
  }, [selectedNoteIds.size, currentNotes]);

  const selectedNotesList = currentNotes.filter((n) => selectedNoteIds.has(n.id));
  const allSelectedAreStarred = selectedNotesList.length > 0 && selectedNotesList.every((n) => Boolean(n.isFavorite));

  return (
    <>
      <div className="flex w-64 shrink-0 flex-col bg-ink-900 h-full">
        {/* Brand Header with Support, Feedback & Settings */}
        <div className="flex h-13 shrink-0 items-center justify-between border-b border-ink-800/80 px-4 py-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xl leading-none shrink-0">🦆</span>
            <span className="text-sm font-bold tracking-tight text-ink-100 shrink-0">
              SocraticOS
            </span>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => {
                const donateUrl = process.env.NEXT_PUBLIC_STRIPE_DONATE_URL || '#';
                window.open(donateUrl, '_blank', 'noopener,noreferrer');
              }}
              title="Donate/Support"
              className="rounded-lg p-1.5 text-rose-400/90 transition-colors hover:bg-ink-850 hover:text-rose-300"
            >
              <HeartHandshake className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setFeatureRequestOpen(true)}
              title="Feedback/Request"
              className="rounded-lg p-1.5 text-duck-400/90 transition-colors hover:bg-ink-850 hover:text-duck-300"
            >
              <MessageSquare className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              title="Settings"
              className="rounded-lg p-1.5 text-ink-400 transition-colors hover:bg-ink-850 hover:text-ink-100 text-sm leading-none"
            >
              ⚙️
            </button>
          </div>
        </div>

        {/* Global Workspace Tools Section (Global Apps) */}
        <div className="px-3 pt-3 pb-1 space-y-1.5">
          <div className="px-1 text-[10px] font-bold uppercase tracking-wider text-ink-500">
            Global Tools
          </div>

          {/* Compact Icon Grid for Global Tools & Instant Note */}
          <div className="grid grid-cols-4 gap-1 p-1 bg-ink-950/60 rounded-xl border border-ink-800/80">
            {/* Instant Note ⚡ */}
            <button
              type="button"
              onClick={onOpenInstantNote}
              title="Instant Note (Ctrl+I)"
              className="flex flex-col items-center justify-center gap-0.5 rounded-lg py-1.5 text-amber-400 transition-all hover:bg-ink-850 hover:text-amber-300 active:scale-95 group/tool"
            >
              <span className="text-base leading-none">⚡</span>
              <span className="text-[9px] font-medium text-ink-400 group-hover/tool:text-ink-200">Note</span>
            </button>

            {/* 3D Simulations 🌌 */}
            <button
              type="button"
              onClick={() => onNavigateTab?.("3d")}
              title="3D Simulations & Visualizations"
              className={`flex flex-col items-center justify-center gap-0.5 rounded-lg py-1.5 transition-all active:scale-95 group/tool ${
                activeTab === "3d"
                  ? "bg-ink-800 text-duck-300 shadow-sm ring-1 ring-duck-400/40 font-semibold"
                  : "text-ink-400 hover:bg-ink-850 hover:text-ink-200"
              }`}
            >
              <span className="text-base leading-none">🌌</span>
              <span className="text-[9px] font-medium text-ink-400 group-hover/tool:text-ink-200">3D</span>
            </button>

            {/* Calendar 📅 */}
            <button
              type="button"
              onClick={() => onNavigateTab?.("calendar")}
              title="Calendar & Timers"
              className={`flex flex-col items-center justify-center gap-0.5 rounded-lg py-1.5 transition-all active:scale-95 group/tool ${
                activeTab === "calendar"
                  ? "bg-ink-800 text-duck-300 shadow-sm ring-1 ring-duck-400/40 font-semibold"
                  : "text-ink-400 hover:bg-ink-850 hover:text-ink-200"
              }`}
            >
              <span className="text-base leading-none">📅</span>
              <span className="text-[9px] font-medium text-ink-400 group-hover/tool:text-ink-200">Calendar</span>
            </button>

            {/* Web Saver 🔖 */}
            <button
              type="button"
              onClick={() => onNavigateTab?.("websaver")}
              title="Web Saver (Bookmarks)"
              className={`flex flex-col items-center justify-center gap-0.5 rounded-lg py-1.5 transition-all active:scale-95 group/tool ${
                activeTab === "websaver"
                  ? "bg-ink-800 text-duck-300 shadow-sm ring-1 ring-duck-400/40 font-semibold"
                  : "text-ink-400 hover:bg-ink-850 hover:text-ink-200"
              }`}
            >
              <span className="text-base leading-none">🔖</span>
              <span className="text-[9px] font-medium text-ink-400 group-hover/tool:text-ink-200">Saver</span>
            </button>
          </div>

          {/* Unified Timers HUD */}
          <div className="pt-0.5">
            <GlobalTimerHUD onNavigateCalendar={() => onNavigateTab?.("calendar")} />
          </div>
        </div>

        <div className="my-1.5 border-t border-ink-800/80 mx-3" />

        {/* Space Switcher */}
        <div className="px-3 pt-1 pb-1">
          <div className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-ink-500">
            Spaces
          </div>
          {spaceSwitcherLayout === "grid" ? (
            /* Grid View */
            <div className="grid grid-cols-2 gap-1.5 w-full">
              {spaces.map((space) => {
                const isActive = space.name === activeSpace;
                return (
                  <div
                    key={space.name}
                    className={`group/space relative flex items-center justify-between rounded-xl border px-2.5 py-2 text-xs transition-all ${
                      isActive
                        ? "border-duck-500/60 bg-duck-500/15 text-duck-300 font-semibold shadow-sm ring-1 ring-duck-500/30"
                        : "border-ink-750 bg-ink-850/80 text-ink-300 hover:border-duck-500/40 hover:bg-ink-800 hover:text-ink-100"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => onSelectSpace(space.name)}
                      className="flex-1 flex items-center gap-1.5 truncate text-left min-w-0 cursor-pointer"
                      title={`Switch to ${space.name}`}
                    >
                      <span className="text-sm leading-none shrink-0">{space.icon || "📂"}</span>
                      <span className="truncate text-xs">{space.name}</span>
                    </button>

                    <div className="flex items-center shrink-0 ml-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingSpace(space);
                        }}
                        className="opacity-0 group-hover/space:opacity-100 p-0.5 rounded hover:bg-ink-700/60 text-ink-400 hover:text-duck-300 transition-all cursor-pointer"
                        title="Edit space (name & emoji)"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      {spaces.length > 1 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteSpace(space.name);
                          }}
                          className="opacity-0 group-hover/space:opacity-100 p-0.5 rounded hover:bg-rose-500/20 text-ink-500 hover:text-rose-400 transition-all ml-0.5 cursor-pointer"
                          title="Delete space"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Create New Space Button in Grid */}
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                className="flex items-center justify-center gap-1 rounded-xl border border-dashed border-ink-700/80 bg-ink-850/40 px-2.5 py-2 text-xs text-ink-400 hover:border-duck-500/50 hover:bg-duck-500/10 hover:text-duck-300 transition-all font-medium cursor-pointer"
                title="Create New Space"
              >
                <span className="text-sm leading-none">＋</span>
                <span className="truncate">New</span>
              </button>
            </div>
          ) : (
            /* Dropdown View */
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
                        <div 
                          key={space.name} 
                          className={`group/space flex w-full items-center justify-between rounded-lg transition-colors ${
                            isActive
                              ? "bg-ink-800 text-duck-300 font-semibold"
                              : "text-ink-300 hover:bg-ink-850 hover:text-ink-100"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              onSelectSpace(space.name);
                              setSpacesDropdownOpen(false);
                            }}
                            className="flex-1 flex items-center px-2.5 py-1.5 text-xs text-left truncate cursor-pointer"
                          >
                            <div className="flex items-center gap-2 truncate">
                              <span className="text-sm leading-none">{space.icon}</span>
                              <span className="truncate">{space.name}</span>
                            </div>
                            {isActive && (
                              <span className="h-1.5 w-1.5 rounded-full bg-duck-400 shrink-0 mx-2" />
                            )}
                          </button>
                          
                          <div className="flex items-center shrink-0 pr-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSpacesDropdownOpen(false);
                                setEditingSpace(space);
                              }}
                              className="opacity-0 group-hover/space:opacity-100 p-1 rounded hover:bg-ink-700/60 text-ink-400 hover:text-duck-300 transition-all cursor-pointer"
                              title="Edit space (name & emoji)"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                            {spaces.length > 1 && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteSpace(space.name);
                                }}
                                className="opacity-0 group-hover/space:opacity-100 p-1 rounded hover:bg-rose-500/20 text-ink-500 hover:text-rose-400 transition-all ml-0.5 cursor-pointer"
                                title="Delete space"
                              >
                                ✕
                              </button>
                            )}
                          </div>
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
          )}

          {/* Space Hub Navigation Button Right Below Spaces Switcher */}
          <button
            type="button"
            onClick={() => onNavigateTab?.("spacehub")}
            className={`mt-2 flex w-full items-center justify-between rounded-xl border px-3 py-2 text-xs font-semibold transition-all group shadow-sm ${
              activeTab === "spacehub"
                ? "border-duck-500/60 bg-duck-500/15 text-duck-300 shadow-duck-500/5 ring-1 ring-duck-500/30"
                : "border-ink-750 bg-ink-850/80 text-ink-200 hover:border-duck-500/40 hover:bg-ink-800 hover:text-ink-100"
            }`}
            title={`Open ${activeSpace} Space Hub: Syllabus documents & subject settings`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm leading-none group-hover:scale-110 transition-transform">⚙️</span>
              <div className="text-left truncate">
                <div className="text-[11px] font-bold leading-tight truncate flex items-center gap-1.5">
                  <span>Space Hub</span>
                  <span className="rounded bg-duck-500/20 px-1 py-0.2 text-[9px] font-bold text-duck-300">
                    Syllabus
                  </span>
                </div>
                <div className="text-[9px] text-ink-400 font-normal leading-tight truncate mt-0.5">
                  Curriculum &amp; AI settings
                </div>
              </div>
            </div>
            <span className="text-xs text-ink-400 group-hover:text-duck-300 transition-colors shrink-0">→</span>
          </button>
        </div>

        {/* ─── Notes list ─────────────────────────────── */}
        <div className="mt-3 flex-1 overflow-y-auto px-3">
          <div className="flex items-center justify-between px-2 pb-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-400">
              {activeSpace} · Notes
            </p>
            {currentNotes.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setIsMultiSelecting((prev) => {
                    if (prev) {
                      setSelectedNoteIds(new Set());
                    }
                    return !prev;
                  });
                }}
                className={`text-[11px] px-2 py-0.5 rounded transition-all font-medium flex items-center gap-1 cursor-pointer ${
                  isMultiSelecting
                    ? "bg-duck-500/20 text-duck-300 ring-1 ring-duck-400/40 font-semibold"
                    : "text-ink-400 hover:text-ink-200 hover:bg-ink-800"
                }`}
                title={isMultiSelecting ? "Exit multi-select mode" : "Select multiple notes"}
              >
                <ListChecks className="w-3.5 h-3.5" />
                <span>{isMultiSelecting ? "Done" : "Select"}</span>
              </button>
            )}
          </div>

          {/* Multi-Select Action Bar */}
          {isMultiSelecting && (
            <div className="mb-2.5 p-2 rounded-xl bg-ink-850/90 border border-ink-750 shadow-sm space-y-2">
              <div className="flex items-center justify-between text-xs px-1 font-medium">
                <span className="text-ink-200">
                  <strong className="text-duck-300 font-bold">{selectedNoteIds.size}</strong> of {currentNotes.length} selected
                </span>
                <button
                  type="button"
                  onClick={handleSelectAllToggle}
                  className="text-[11px] text-duck-400 hover:text-duck-300 hover:underline cursor-pointer font-medium"
                >
                  {selectedNoteIds.size === currentNotes.length ? "Deselect All" : "Select All"}
                </button>
              </div>

              {/* Bulk Action Buttons Grid */}
              <div className="grid grid-cols-4 gap-1 pt-1.5 border-t border-ink-800/80">
                {/* Star / Unstar Button */}
                <button
                  type="button"
                  disabled={selectedNoteIds.size === 0}
                  onClick={async () => {
                    const ids = Array.from(selectedNoteIds);
                    if (onToggleFavoriteMultipleNotes) {
                      await onToggleFavoriteMultipleNotes(ids);
                    }
                  }}
                  className="flex flex-col items-center justify-center gap-1 py-1.5 px-1 rounded-lg text-ink-300 hover:text-amber-300 hover:bg-ink-800 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer group"
                  title={allSelectedAreStarred ? "Unstar selected notes" : "Star selected notes"}
                >
                  <Star className={`w-3.5 h-3.5 text-amber-400 ${allSelectedAreStarred ? "fill-amber-400" : ""}`} />
                  <span className="text-[10px] font-medium leading-none">
                    {allSelectedAreStarred ? "Unstar" : "Star"}
                  </span>
                </button>

                {/* Duplicate Button */}
                <button
                  type="button"
                  disabled={selectedNoteIds.size === 0}
                  onClick={async () => {
                    const ids = Array.from(selectedNoteIds);
                    setSelectedNoteIds(new Set());
                    if (onDuplicateMultipleNotes) {
                      await onDuplicateMultipleNotes(ids);
                    }
                  }}
                  className="flex flex-col items-center justify-center gap-1 py-1.5 px-1 rounded-lg text-ink-300 hover:text-sky-300 hover:bg-ink-800 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
                  title="Duplicate selected notes"
                >
                  <Copy className="w-3.5 h-3.5 text-sky-400" />
                  <span className="text-[10px] font-medium leading-none">Copy</span>
                </button>

                {/* Move Button */}
                <button
                  type="button"
                  disabled={selectedNoteIds.size === 0}
                  onClick={() => setBatchMoveOpen(true)}
                  className="flex flex-col items-center justify-center gap-1 py-1.5 px-1 rounded-lg text-ink-300 hover:text-duck-300 hover:bg-ink-800 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
                  title="Move selected notes to another space"
                >
                  <FolderInput className="w-3.5 h-3.5 text-duck-400" />
                  <span className="text-[10px] font-medium leading-none">Move</span>
                </button>

                {/* Delete to Trash Button (requires confirmation) */}
                <button
                  type="button"
                  disabled={selectedNoteIds.size === 0}
                  onClick={() => setBatchDeleteOpen(true)}
                  className="flex flex-col items-center justify-center gap-1 py-1.5 px-1 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-500/20 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
                  title="Move selected notes to trash (requires confirmation)"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-medium leading-none">Delete</span>
                </button>
              </div>
            </div>
          )}

          {currentNotes.length === 0 ? (
            <p className="px-2.5 py-2 text-sm text-ink-500 italic">No notes in this space yet.</p>
          ) : (
            <ul
              className="space-y-1"
              onDragOver={(e) => {
                if (isMultiSelecting) return;
                if (e.target === e.currentTarget) {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                }
              }}
              onDrop={(e) => {
                if (isMultiSelecting) return;
                if (e.target === e.currentTarget) {
                  e.preventDefault();
                  const sourceId = draggingNoteId || e.dataTransfer.getData("text/plain");
                  if (!sourceId) return;
                  const fromIdx = currentNotes.findIndex((item) => item.id === sourceId);
                  if (fromIdx !== -1 && fromIdx !== currentNotes.length - 1) {
                    const updated = [...currentNotes];
                    const [movedNote] = updated.splice(fromIdx, 1);
                    updated.push(movedNote);
                    setDraggingNoteId(null);
                    setDragOverInfo(null);
                    onReorderNotes?.(activeSpace, updated);
                  }
                }
              }}
            >
              {currentNotes.map((n) => {
                const isActive = activeNoteId === n.id;
                const isDragging = draggingNoteId === n.id;
                const isDragOver = dragOverInfo?.id === n.id;
                const isSelected = selectedNoteIds.has(n.id);

                return (
                  <li
                    key={n.id}
                    onDragOver={(e) => {
                      if (isMultiSelecting) return;
                      e.preventDefault();
                      e.stopPropagation();
                      const sourceId = draggingNoteId || e.dataTransfer.getData("text/plain");
                      if (!sourceId || sourceId === n.id) return;
                      e.dataTransfer.dropEffect = "move";
                      const rect = e.currentTarget.getBoundingClientRect();
                      const midY = rect.top + rect.height / 2;
                      const position = e.clientY < midY ? "top" : "bottom";
                      setDragOverInfo((prev) => {
                        if (prev?.id === n.id && prev?.position === position) return prev;
                        return { id: n.id, position };
                      });
                    }}
                    onDragLeave={(e) => {
                      if (isMultiSelecting) return;
                      e.stopPropagation();
                      if (!e.currentTarget.contains(e.relatedTarget)) {
                        if (dragOverInfo?.id === n.id) {
                          setDragOverInfo(null);
                        }
                      }
                    }}
                    onDrop={(e) => {
                      if (isMultiSelecting) return;
                      e.preventDefault();
                      e.stopPropagation();
                      const sourceId = draggingNoteId || e.dataTransfer.getData("text/plain");
                      if (!sourceId || sourceId === n.id) {
                        setDraggingNoteId(null);
                        setDragOverInfo(null);
                        return;
                      }

                      const fromIdx = currentNotes.findIndex((item) => item.id === sourceId);
                      if (fromIdx === -1) {
                        setDraggingNoteId(null);
                        setDragOverInfo(null);
                        return;
                      }

                      const rect = e.currentTarget.getBoundingClientRect();
                      const midY = rect.top + rect.height / 2;
                      const isBottom = e.clientY >= midY;

                      const updated = [...currentNotes];
                      const [movedNote] = updated.splice(fromIdx, 1);
                      let toIdx = updated.findIndex((item) => item.id === n.id);
                      if (toIdx === -1) {
                        updated.push(movedNote);
                      } else {
                        if (isBottom) {
                          toIdx += 1;
                        }
                        updated.splice(toIdx, 0, movedNote);
                      }

                      setDraggingNoteId(null);
                      setDragOverInfo(null);
                      onReorderNotes?.(activeSpace, updated);
                    }}
                    className={`group relative flex items-center justify-between gap-0.5 rounded-lg transition-all ${
                      isMultiSelecting
                        ? isSelected
                          ? "bg-duck-500/15 ring-1 ring-duck-400/40 text-duck-200 shadow-xs"
                          : "hover:bg-ink-850 text-ink-300"
                        : isDragging
                        ? "opacity-30 bg-ink-800/50"
                        : "hover:bg-ink-850"
                    }`}
                  >
                    {/* Visual Placement Indicator */}
                    {!isMultiSelecting && isDragOver && (
                      <div
                        className={`absolute left-0 right-0 h-0.5 z-20 bg-duck-400 rounded-full shadow-[0_0_8px_rgba(240,192,74,0.9)] pointer-events-none ${
                          dragOverInfo.position === "top" ? "-top-0.5" : "-bottom-0.5"
                        }`}
                      />
                    )}

                    {/* Drag Handle Grip OR Checkbox indicator in selection mode */}
                    {isMultiSelecting ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleSelectNote(n.id);
                        }}
                        className="flex items-center justify-center p-1.5 pl-2 shrink-0 cursor-pointer"
                        title={isSelected ? "Deselect note" : "Select note"}
                      >
                        <span
                          className={`flex items-center justify-center w-4 h-4 rounded transition-all ${
                            isSelected
                              ? "border border-duck-400 bg-duck-500 text-ink-950 shadow-xs"
                              : "border border-ink-600 hover:border-duck-400/70 bg-ink-850"
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                        </span>
                      </button>
                    ) : (
                      <div
                        draggable
                        onDragStart={(e) => {
                          e.stopPropagation();
                          setDraggingNoteId(n.id);
                          e.dataTransfer.effectAllowed = "move";
                          e.dataTransfer.setData("text/plain", n.id);
                        }}
                        onDragEnd={() => {
                          setDraggingNoteId(null);
                          setDragOverInfo(null);
                        }}
                        title="Drag to reorder note"
                        className="flex items-center justify-center p-1 text-ink-600 group-hover:text-ink-400 hover:!text-duck-300 cursor-grab active:cursor-grabbing shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <GripVertical className="w-3.5 h-3.5" />
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        if (isMultiSelecting) {
                          handleToggleSelectNote(n.id);
                        } else {
                          onSelectNote?.(n);
                        }
                      }}
                      className={`flex flex-1 items-center gap-2 rounded-lg px-2 py-2 text-left text-sm min-w-0 transition-colors cursor-pointer ${
                        isMultiSelecting && isSelected
                          ? "text-duck-200 font-semibold"
                          : isActive && !isMultiSelecting
                          ? "bg-ink-800 text-ink-100 font-semibold shadow-xs"
                          : "text-ink-300 hover:text-ink-100 hover:bg-ink-800/40 font-medium"
                      }`}
                    >
                      <span className="text-sm shrink-0 leading-none">{n.emoji || "📝"}</span>
                      <span className="truncate flex-1 text-sm">{n.title || "Untitled Note"}</span>
                      {n.isFavorite && (
                        <span className="text-amber-400 text-xs shrink-0" title="Starred">⭐</span>
                      )}
                    </button>

                    {!isMultiSelecting && (
                      <div className="shrink-0 pr-1 flex items-center">
                        <NoteMenu
                          mode="sidebar"
                          note={n}
                          spaces={spaces}
                          onSaveNote={onSaveNote}
                          onToggleFavorite={onToggleFavorite}
                          onDuplicateNote={onDuplicateNote}
                          onMoveNote={onMoveNote}
                          onRenameNote={onRenameNote}
                          onDeleteNote={onDeleteNote}
                          variant="icon"
                          align="right"
                          className="opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity"
                        />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          <button
            type="button"
            onClick={onCreateNote}
            className="mt-2 w-full rounded-lg border border-dashed border-ink-700/80 px-3 py-2 text-left text-sm font-medium text-ink-400 transition-colors hover:border-duck-500/50 hover:bg-ink-850/50 hover:text-duck-300"
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

      </div>

      {/* Modals */}
      <CreateSpaceModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreate={handleCreateSpace}
        spaces={spaces}
      />

      <EditSpaceModal
        open={Boolean(editingSpace)}
        space={editingSpace}
        onClose={() => setEditingSpace(null)}
        onSave={(spaceName, updates) => onEditSpace?.(spaceName, updates)}
        onDelete={(spaceName) => handleDeleteSpace(spaceName)}
        canDelete={spaces.length > 1}
        spaces={spaces}
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
        spaces={spaces}
        spaceSwitcherLayout={spaceSwitcherLayout}
        onSpaceSwitcherLayoutChange={handleSpaceSwitcherLayoutChange}
        onStartTutorial={onStartTutorial}
      />

      <FeatureRequestModal
        open={featureRequestOpen}
        onClose={() => setFeatureRequestOpen(false)}
      />

      {/* Batch Operation Modals */}
      <BatchDeleteConfirmModal
        open={batchDeleteOpen}
        count={selectedNoteIds.size}
        notes={selectedNotesList}
        onClose={() => setBatchDeleteOpen(false)}
        onConfirm={async () => {
          const ids = Array.from(selectedNoteIds);
          setBatchDeleteOpen(false);
          setSelectedNoteIds(new Set());
          if (onDeleteMultipleNotes) {
            await onDeleteMultipleNotes(ids);
          }
        }}
      />

      <BatchMoveModal
        open={batchMoveOpen}
        count={selectedNoteIds.size}
        currentSpace={activeSpace}
        spaces={spaces}
        onClose={() => setBatchMoveOpen(false)}
        onSelectTargetSpace={async (targetSpace) => {
          const ids = Array.from(selectedNoteIds);
          setBatchMoveOpen(false);
          setSelectedNoteIds(new Set());
          if (onMoveMultipleNotes) {
            await onMoveMultipleNotes(ids, targetSpace);
          }
        }}
      />
    </>
  );
}
