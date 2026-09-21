"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  FileText,
  Upload,
  Trash2,
  CheckCircle,
  Eye,
  Settings,
  Sparkles,
  GraduationCap,
  Layers,
  Check,
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  Shield,
  Palette,
  ChevronDown,
  Pencil,
} from "lucide-react";
import { SPACE_ICON_OPTIONS } from "@/lib/constants";
import {
  getSpaceDocuments,
  addSpaceDocument,
  deleteSpaceDocument,
  toggleSpaceDocumentActive,
  getSpaceSettings,
  saveSpaceSettings,
  extractSyllabusTextFromFile,
} from "@/lib/storageService";

const ACADEMIC_LEVELS = [
  { id: "general", label: "Standard / General", blurb: "Broad balanced level, standard school or self-study" },
  { id: "igcse", label: "IGCSE / O-Level", blurb: "Cambridge / Edexcel Grade 10 curriculum boundaries" },
  { id: "ib_hl", label: "IB Diploma (HL/SL)", blurb: "International Baccalaureate Higher / Standard Level" },
  { id: "ap", label: "AP / College Board", blurb: "Advanced Placement university-preparatory depth" },
  { id: "university", label: "College / University", blurb: "Undergraduate degree depth & formal rigor" },
  { id: "olympiad", label: "Olympiad / Competition", blurb: "Advanced contest math/science non-routine problem solving" },
];

const AI_PERSONAS = [
  { id: "examiner", icon: "⚖️", label: "Standard Examiner", blurb: "Balanced, high-fidelity diagnostic assessment with objective rigor" },
  { id: "strict", icon: "🧐", label: "Strict Examiner", blurb: "Zero tolerance for imprecise terms; strictly penalizes hand-waving" },
  { id: "socratic", icon: "🦆", label: "Socratic Guide", blurb: "Probes foundational mechanisms, counterfactuals, and the core 'why'" },
  { id: "coach", icon: "💡", label: "Friendly Coach", blurb: "Encouraging, supportive tone emphasizing conceptual intuition" },
  { id: "olympiad", icon: "🏆", label: "Olympiad Mentor", blurb: "Pushes multi-step synthesis, lateral thinking, and deep derivations" },
];

const STRICTNESS_LEVELS = [
  { id: "relaxed", label: "Relaxed", blurb: "Direct question prompts, straightforward options, gentle grading" },
  { id: "standard", label: "Standard", blurb: "Realistic student misconceptions as distractors, balanced grading" },
  { id: "rigorous", label: "High Rigor", blurb: "Deceptive distractors, deep edge cases, strict marking penalty" },
];

const QUICK_PRESETS = [
  {
    name: "Cambridge IGCSE Gr.10 Syllabus",
    level: "igcse",
    persona: "strict",
    strictness: "standard",
    text: `Cambridge IGCSE Curriculum (Grades 9-10). Scope covers standard IGCSE Core and Extended concepts only. Do not include A-Level, IB HL, AP, or university-level mechanics. Maintain strict alignment with IGCSE syllabus specifications and grade boundaries.`,
  },
  {
    name: "IB Diploma HL Specification",
    level: "ib_hl",
    persona: "examiner",
    strictness: "rigorous",
    text: `IB Diploma Programme (Higher Level). Expect deep conceptual derivations, command terms (Deduce, Evaluate, Contrast), and application of principles to novel data. Maintain high academic rigor matching official mark schemes.`,
  },
  {
    name: "AP College Board Prep",
    level: "ap",
    persona: "coach",
    strictness: "standard",
    text: `Advanced Placement (AP) Curriculum. Emphasize standard College Board question structures, multi-variable analytical deduction, and conceptual synthesis across standard units.`,
  },
  {
    name: "Foundational / Concept Mastery",
    level: "general",
    persona: "socratic",
    strictness: "relaxed",
    text: `Foundational Curriculum. Emphasize intuition, everyday analogies, physical mechanisms, and first-principles understanding without excessive formal jargon.`,
  },
];

export default function SpaceHubView({
  activeSpace,
  onSelectSpace,
  spaces = [],
  onUpdateSpace,
  onRenameSpace,
  onBack,
  notesCount = 0,
  quizzesCount = 0,
}) {
  const [documents, setDocuments] = useState([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [fileUploading, setFileUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [saveToast, setSaveToast] = useState(false);
  const [previewDoc, setPreviewDoc] = useState(null);

  // Space Rename State
  const [spaceNameInput, setSpaceNameInput] = useState(activeSpace || "");
  const [renameError, setRenameError] = useState("");
  const [renaming, setRenaming] = useState(false);

  // Settings State
  const [settings, setSettings] = useState({
    academicLevel: "general",
    aiPersona: "examiner",
    strictness: "standard",
    accentColor: "amber",
    icon: "🎓",
    blurb: "",
  });

  const fileInputRef = useRef(null);

  useEffect(() => {
    setSpaceNameInput(activeSpace || "");
    setRenameError("");
  }, [activeSpace]);

  // Load documents and space settings when activeSpace changes
  const loadSpaceData = useCallback(async () => {
    if (!activeSpace) return;
    setLoadingDocs(true);
    try {
      const [docs, savedSettings] = await Promise.all([
        getSpaceDocuments(activeSpace),
        getSpaceSettings(activeSpace),
      ]);
      setDocuments(docs);
      const currentSpaceObj = spaces.find((s) => s.name === activeSpace);
      setSettings({
        academicLevel: savedSettings?.academicLevel || "general",
        aiPersona: savedSettings?.aiPersona || "examiner",
        strictness: savedSettings?.strictness || "standard",
        accentColor: savedSettings?.accentColor || "amber",
        icon: savedSettings?.icon || currentSpaceObj?.icon || "🎓",
        blurb: savedSettings?.blurb !== undefined ? savedSettings.blurb : (currentSpaceObj?.blurb || ""),
      });
    } catch (err) {
      console.error("Failed to load Space Hub data:", err);
    } finally {
      setLoadingDocs(false);
    }
  }, [activeSpace, spaces]);

  useEffect(() => {
    loadSpaceData();
  }, [loadSpaceData]);

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileUploading(true);
    setUploadError(null);

    try {
      const cleaned = await extractSyllabusTextFromFile(file);
      if (!cleaned) {
        setUploadError("The uploaded file contains no readable text content.");
        return;
      }

      const newDoc = await addSpaceDocument(activeSpace, {
        name: file.name,
        text: cleaned,
        size: file.size,
        active: true,
      });

      if (newDoc) {
        setDocuments((prev) => [newDoc, ...prev]);
        triggerToast();
      }
    } catch (err) {
      console.error("Document upload failed:", err);
      setUploadError(`Failed to parse file: ${err.message || "Unknown error"}`);
    } finally {
      setFileUploading(false);
      if (e.target) e.target.value = "";
    }
  };

  const handleToggleDoc = async (id, currentStatus) => {
    const nextStatus = !currentStatus;
    setDocuments((prev) =>
      prev.map((d) => (d.id === id ? { ...d, active: nextStatus } : d))
    );
    await toggleSpaceDocumentActive(id, nextStatus);
  };

  const handleDeleteDoc = async (id) => {
    if (!window.confirm("Are you sure you want to remove this document from this space?")) return;
    setDocuments((prev) => prev.filter((d) => d.id !== id));
    await deleteSpaceDocument(id);
    triggerToast();
  };

  const handleApplyPreset = async (preset) => {
    const newDoc = await addSpaceDocument(activeSpace, {
      name: `${preset.name}.txt`,
      text: preset.text,
      size: preset.text.length,
      active: true,
    });
    if (newDoc) {
      setDocuments((prev) => [newDoc, ...prev]);
    }
    const updatedSettings = {
      ...settings,
      academicLevel: preset.level,
      aiPersona: preset.persona,
      strictness: preset.strictness,
    };
    setSettings(updatedSettings);
    await saveSpaceSettings(activeSpace, updatedSettings);
    triggerToast();
  };

  const updateSetting = async (key, val) => {
    const updated = { ...settings, [key]: val };
    setSettings(updated);
    await saveSpaceSettings(activeSpace, updated);
    if (key === "icon" || key === "blurb") {
      onUpdateSpace?.(activeSpace, { [key]: val });
    }
    triggerToast();
  };

  const handleRename = async (e) => {
    e?.preventDefault?.();
    const trimmed = spaceNameInput.trim();
    if (!trimmed) {
      setRenameError("Space name cannot be empty");
      return;
    }
    if (
      trimmed.toLowerCase() !== activeSpace.toLowerCase() &&
      spaces.some((s) => s.name.toLowerCase() === trimmed.toLowerCase())
    ) {
      setRenameError(`A space named "${trimmed}" already exists.`);
      return;
    }
    setRenaming(true);
    try {
      await onRenameSpace?.(activeSpace, trimmed, settings.icon, settings.blurb);
      triggerToast();
    } catch (err) {
      setRenameError(err.message || "Failed to rename space");
    } finally {
      setRenaming(false);
    }
  };

  const triggerToast = () => {
    setSaveToast(true);
    setTimeout(() => setSaveToast(false), 2000);
  };

  const activeDocs = useMemo(() => documents.filter((d) => d.active), [documents]);
  const activeCharCount = useMemo(
    () => activeDocs.reduce((acc, d) => acc + (d.text ? d.text.length : 0), 0),
    [activeDocs]
  );

  const currentSpaceObj = spaces.find((s) => s.name === activeSpace) || { name: activeSpace, icon: "🎓" };

  return (
    <div className="flex-1 flex flex-col h-full bg-ink-950 text-ink-100 overflow-y-auto">
      {/* Toast Notification */}
      {saveToast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-950/90 px-4 py-2.5 text-xs font-semibold text-emerald-200 shadow-2xl backdrop-blur-md animate-fade-in">
          <CheckCircle className="h-4 w-4 text-emerald-400" />
          <span>Space settings and curriculum updated</span>
        </div>
      )}

      {/* Top Banner Header */}
      <div className="shrink-0 border-b border-ink-800 bg-ink-900/90 px-6 py-4 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="flex items-center gap-1.5 rounded-xl border border-ink-700 bg-ink-800/80 px-3 py-1.5 text-xs font-semibold text-ink-300 hover:text-ink-100 hover:border-ink-600 transition-colors"
                title="Return to Notes or previous view"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Back</span>
              </button>
            )}
            <div className="flex items-center gap-2.5">
              <span className="text-2xl leading-none p-2 rounded-xl bg-ink-850 border border-ink-700 shadow-inner">
                {settings.icon || currentSpaceObj.icon || "🎓"}
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base font-bold text-ink-100 tracking-tight">
                    {activeSpace} Hub
                  </h1>
                  <span className="rounded-md border border-duck-500/30 bg-duck-500/10 px-2 py-0.5 text-[10px] font-bold text-duck-300 uppercase tracking-wider">
                    Space Dashboard
                  </span>
                </div>
                <p className="text-xs text-ink-400 mt-0.5">
                  Curriculum documents, subject AI settings &amp; diagnostic parameters
                </p>
              </div>
            </div>
          </div>

          {/* Quick Space Switcher Dropdown */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <label className="text-[10px] font-bold uppercase tracking-wider text-ink-500 block mb-1">
                Active Space:
              </label>
              <div className="relative">
                <select
                  value={activeSpace}
                  onChange={(e) => onSelectSpace?.(e.target.value)}
                  className="rounded-xl border border-ink-700 bg-ink-850 py-1.5 pl-3 pr-8 text-xs font-semibold text-ink-100 focus:border-duck-500/50 focus:outline-none cursor-pointer appearance-none shadow-sm"
                >
                  {spaces.map((s) => (
                    <option key={s.name} value={s.name}>
                      {s.icon} {s.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-2.5 h-3.5 w-3.5 text-ink-400 pointer-events-none" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-6xl w-full mx-auto p-6 space-y-8">
        {/* Space Stats Overview Pills */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-2xl border border-ink-800 bg-ink-900/60 p-4 shadow-sm">
            <div className="flex items-center justify-between text-xs text-ink-400">
              <span className="font-medium">Curriculum Docs</span>
              <BookOpen className="h-4 w-4 text-duck-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-ink-100">{documents.length}</span>
              <span className="text-xs text-emerald-400 font-medium">
                ({activeDocs.length} active)
              </span>
            </div>
          </div>

          <div className="rounded-2xl border border-ink-800 bg-ink-900/60 p-4 shadow-sm">
            <div className="flex items-center justify-between text-xs text-ink-400">
              <span className="font-medium">AI Context Scope</span>
              <Sparkles className="h-4 w-4 text-indigo-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-ink-100">
                {(activeCharCount / 1000).toFixed(1)}k
              </span>
              <span className="text-xs text-ink-400">chars active</span>
            </div>
          </div>

          <div className="rounded-2xl border border-ink-800 bg-ink-900/60 p-4 shadow-sm">
            <div className="flex items-center justify-between text-xs text-ink-400">
              <span className="font-medium">Academic Level</span>
              <GraduationCap className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="mt-2">
              <span className="text-sm font-bold text-ink-200 capitalize">
                {ACADEMIC_LEVELS.find((l) => l.id === settings.academicLevel)?.label.split("/")[0] || "General"}
              </span>
            </div>
          </div>

          <div className="rounded-2xl border border-ink-800 bg-ink-900/60 p-4 shadow-sm">
            <div className="flex items-center justify-between text-xs text-ink-400">
              <span className="font-medium">AI Persona</span>
              <Shield className="h-4 w-4 text-amber-400" />
            </div>
            <div className="mt-2 flex items-center gap-1.5">
              <span className="text-lg leading-none">
                {AI_PERSONAS.find((p) => p.id === settings.aiPersona)?.icon || "⚖️"}
              </span>
              <span className="text-sm font-bold text-ink-200 truncate">
                {AI_PERSONAS.find((p) => p.id === settings.aiPersona)?.label || "Standard Examiner"}
              </span>
            </div>
          </div>
        </div>

        {/* SECTION 1: Syllabus Documents Hub with Active Toggles */}
        <section className="rounded-3xl border border-ink-800 bg-ink-900/80 p-6 sm:p-7 shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-ink-800">
            <div>
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-duck-400" />
                <h2 className="text-base font-bold text-ink-100 tracking-tight">
                  Curriculum &amp; Syllabus Documents
                </h2>
              </div>
              <p className="text-xs text-ink-400 mt-1 max-w-xl">
                Upload syllabus documents, exam specifications, or lecture schedules. Toggle which
                documents are actively injected into the AI context for diagnostic quizzes in this space.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.txt,.md"
                onChange={handleFileUpload}
                disabled={fileUploading}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={fileUploading}
                className="flex items-center gap-2 rounded-xl bg-duck-500 hover:bg-duck-400 text-ink-950 px-4 py-2 text-xs font-bold shadow-lg transition-all active:scale-95 disabled:opacity-50"
              >
                <Upload className="h-4 w-4" />
                <span>{fileUploading ? "Extracting Text..." : "Upload Syllabus Document"}</span>
              </button>
            </div>
          </div>

          {uploadError && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs text-rose-300 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
              <span>{uploadError}</span>
            </div>
          )}

          {/* Quick Presets Carousel/Grid */}
          <div className="space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-ink-500">
              Quick Subject Presets (1-Click Load)
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
              {QUICK_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => handleApplyPreset(preset)}
                  className="flex flex-col text-left p-3 rounded-2xl border border-ink-800 bg-ink-850/60 hover:bg-ink-800 hover:border-duck-500/40 transition-all group"
                >
                  <span className="text-xs font-bold text-ink-200 group-hover:text-duck-300 transition-colors">
                    {preset.name}
                  </span>
                  <span className="text-[10px] text-ink-500 mt-1 line-clamp-2">
                    {preset.text}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Document List */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between text-xs text-ink-400 px-1">
              <span className="font-semibold uppercase tracking-wider text-[11px]">
                Space Documents ({documents.length})
              </span>
              <span className="text-[11px] text-ink-500">
                {activeDocs.length} active for AI quiz generation
              </span>
            </div>

            {loadingDocs ? (
              <div className="rounded-2xl border border-ink-800 bg-ink-850/40 p-8 text-center text-xs text-ink-500">
                Loading space documents...
              </div>
            ) : documents.length === 0 ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="group relative flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-ink-800 hover:border-duck-500/50 hover:bg-duck-500/5 p-10 text-center cursor-pointer transition-all"
              >
                <div className="rounded-full bg-ink-850 p-4 group-hover:scale-110 transition-transform">
                  <Upload className="h-6 w-6 text-duck-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-ink-200">
                    No documents uploaded for {activeSpace} yet
                  </p>
                  <p className="text-xs text-ink-500 mt-1">
                    Drop your syllabus, formula sheet, or learning outcomes (.pdf, .docx, .txt) here
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl border transition-all ${
                      doc.active
                        ? "border-emerald-500/40 bg-emerald-950/10 shadow-sm"
                        : "border-ink-800 bg-ink-850/40 opacity-70"
                    }`}
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div
                        className={`p-2.5 rounded-xl shrink-0 ${
                          doc.active ? "bg-emerald-500/20 text-emerald-300" : "bg-ink-800 text-ink-400"
                        }`}
                      >
                        <FileText className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs sm:text-sm font-bold text-ink-100 truncate">
                            {doc.name}
                          </h4>
                          {doc.active && (
                            <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-300 shrink-0">
                              Active for AI
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-ink-400 mt-0.5">
                          {((doc.text?.length || doc.size || 0) / 1000).toFixed(1)}k chars extracted · Uploaded{" "}
                          {new Date(doc.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-center">
                      {/* Active for Quiz Generator Toggle */}
                      <label className="flex items-center gap-2 cursor-pointer bg-ink-900 border border-ink-700/80 rounded-xl px-3 py-1.5 hover:border-ink-600 transition-colors">
                        <span className="text-xs font-semibold text-ink-300">
                          {doc.active ? "Fed to AI" : "Excluded"}
                        </span>
                        <input
                          type="checkbox"
                          checked={doc.active}
                          onChange={() => handleToggleDoc(doc.id, doc.active)}
                          className="h-4 w-4 rounded border-ink-600 bg-ink-800 text-emerald-500 focus:ring-emerald-500/40 cursor-pointer"
                        />
                      </label>

                      {/* Preview Button */}
                      <button
                        type="button"
                        onClick={() => setPreviewDoc(doc)}
                        className="p-2 rounded-xl text-ink-400 hover:text-ink-100 hover:bg-ink-800 transition-colors"
                        title="Preview Document Text"
                      >
                        <Eye className="h-4 w-4" />
                      </button>

                      {/* Delete Button */}
                      <button
                        type="button"
                        onClick={() => handleDeleteDoc(doc.id)}
                        className="p-2 rounded-xl text-ink-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                        title="Remove Document"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* SECTION 2: Space AI Examiner & Pedagogy Settings */}
        <section className="rounded-3xl border border-ink-800 bg-ink-900/80 p-6 sm:p-7 shadow-xl space-y-6">
          <div className="pb-5 border-b border-ink-800">
            <div className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-indigo-400" />
              <h2 className="text-base font-bold text-ink-100 tracking-tight">
                AI Pedagogy &amp; Examiner Settings
              </h2>
            </div>
            <p className="text-xs text-ink-400 mt-1 max-w-xl">
              Configure how the Gemini AI conducts assessments, structures distractors, and sets question
              depth specifically for <strong>{activeSpace}</strong>.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Academic Level */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-ink-300 flex items-center gap-1.5">
                <GraduationCap className="h-4 w-4 text-emerald-400" />
                <span>Academic Standard / Grade Level</span>
              </label>
              <div className="space-y-1.5">
                {ACADEMIC_LEVELS.map((lvl) => {
                  const isSelected = settings.academicLevel === lvl.id;
                  return (
                    <button
                      key={lvl.id}
                      type="button"
                      onClick={() => updateSetting("academicLevel", lvl.id)}
                      className={`w-full flex items-center justify-between p-3 rounded-2xl border text-left transition-all ${
                        isSelected
                          ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-200 shadow-sm"
                          : "border-ink-800 bg-ink-850/60 text-ink-300 hover:bg-ink-800 hover:text-ink-100"
                      }`}
                    >
                      <div>
                        <div className="text-xs font-bold">{lvl.label}</div>
                        <div className="text-[11px] text-ink-400 mt-0.5">{lvl.blurb}</div>
                      </div>
                      {isSelected && <Check className="h-4 w-4 text-emerald-400 shrink-0 ml-2" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* AI Persona */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-ink-300 flex items-center gap-1.5">
                <Shield className="h-4 w-4 text-amber-400" />
                <span>Examiner Persona &amp; Tone</span>
              </label>
              <div className="space-y-1.5">
                {AI_PERSONAS.map((p) => {
                  const isSelected = settings.aiPersona === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => updateSetting("aiPersona", p.id)}
                      className={`w-full flex items-center justify-between p-3 rounded-2xl border text-left transition-all ${
                        isSelected
                          ? "border-duck-500/50 bg-duck-500/10 text-duck-200 shadow-sm"
                          : "border-ink-800 bg-ink-850/60 text-ink-300 hover:bg-ink-800 hover:text-ink-100"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-lg leading-none">{p.icon}</span>
                        <div>
                          <div className="text-xs font-bold">{p.label}</div>
                          <div className="text-[11px] text-ink-400 mt-0.5">{p.blurb}</div>
                        </div>
                      </div>
                      {isSelected && <Check className="h-4 w-4 text-duck-400 shrink-0 ml-2" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Distractor Toughness & Strictness */}
          <div className="pt-2 border-t border-ink-800 space-y-2">
            <label className="text-xs font-bold text-ink-300 flex items-center gap-1.5">
              <Layers className="h-4 w-4 text-indigo-400" />
              <span>Distractor Toughness &amp; Marking Rigor</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {STRICTNESS_LEVELS.map((s) => {
                const isSelected = settings.strictness === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => updateSetting("strictness", s.id)}
                    className={`p-3.5 rounded-2xl border text-left transition-all ${
                      isSelected
                        ? "border-indigo-500/50 bg-indigo-500/10 text-indigo-200 shadow-sm"
                        : "border-ink-800 bg-ink-850/60 text-ink-300 hover:bg-ink-800 hover:text-ink-100"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold">{s.label}</span>
                      {isSelected && <Check className="h-4 w-4 text-indigo-400" />}
                    </div>
                    <p className="text-[11px] text-ink-400 mt-1">{s.blurb}</p>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* SECTION 3: Space Identity & Customization */}
        <section className="rounded-3xl border border-ink-800 bg-ink-900/80 p-6 sm:p-7 shadow-xl space-y-6">
          <div className="pb-5 border-b border-ink-800">
            <div className="flex items-center gap-2">
              <Palette className="h-5 w-5 text-rose-400" />
              <h2 className="text-base font-bold text-ink-100 tracking-tight">
                Space Identity &amp; Accent
              </h2>
            </div>
            <p className="text-xs text-ink-400 mt-1 max-w-xl">
              Customize the name, icon emoji, and descriptive tagline for this space. All changes are saved across the app.
            </p>
          </div>

          <div className="space-y-5">
            {/* Space Name */}
            <form onSubmit={handleRename} className="space-y-1.5">
              <label className="text-xs font-semibold text-ink-300 flex items-center gap-1.5">
                <Pencil className="w-3.5 h-3.5 text-duck-400" />
                <span>Space Name</span>
              </label>
              <div className="flex items-center gap-2 max-w-md">
                <input
                  type="text"
                  maxLength={32}
                  value={spaceNameInput}
                  onChange={(e) => {
                    setSpaceNameInput(e.target.value);
                    if (renameError) setRenameError("");
                  }}
                  placeholder="Space Name"
                  className="flex-1 rounded-xl border border-ink-700 bg-ink-850 py-2 px-3.5 text-xs text-ink-100 placeholder:text-ink-600 focus:border-duck-500/50 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={renaming || !spaceNameInput.trim() || spaceNameInput.trim() === activeSpace}
                  className="rounded-xl bg-duck-400 hover:bg-duck-300 text-ink-950 px-4 py-2 text-xs font-bold transition-all disabled:opacity-30 disabled:pointer-events-none cursor-pointer shadow-sm"
                >
                  {renaming ? "Saving..." : "Rename"}
                </button>
              </div>
              {renameError && (
                <p className="text-xs font-medium text-rose-400 animate-fade-in mt-1">{renameError}</p>
              )}
            </form>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-2">
              {/* Space Icon & Presets */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-ink-300">Space Icon / Emoji</label>
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="text"
                    maxLength={4}
                    value={settings.icon}
                    onChange={(e) => updateSetting("icon", e.target.value)}
                    className="w-14 rounded-xl border border-ink-700 bg-ink-850 py-2 text-center text-xl font-bold text-ink-100 focus:border-duck-500/50 focus:outline-none"
                  />
                  <span className="text-xs text-ink-400">Type custom emoji or pick preset below</span>
                </div>
                {/* Emoji Preset Buttons */}
                <div className="flex flex-wrap gap-1.5 p-2 rounded-2xl border border-ink-800/80 bg-ink-950/50 max-h-32 overflow-y-auto">
                  {SPACE_ICON_OPTIONS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => updateSetting("icon", emoji)}
                      className={`h-8 w-8 flex items-center justify-center rounded-xl text-base transition-all cursor-pointer ${
                        settings.icon === emoji
                          ? "bg-duck-500/20 ring-2 ring-duck-400"
                          : "bg-ink-850 hover:bg-ink-800"
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              {/* Description Tagline */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-ink-300">Description Tagline</label>
                <input
                  type="text"
                  placeholder="e.g. Courses, problem sets & exam preparation"
                  value={settings.blurb}
                  onChange={(e) => updateSetting("blurb", e.target.value)}
                  className="w-full rounded-xl border border-ink-700 bg-ink-850 py-2.5 px-3.5 text-xs text-ink-100 placeholder:text-ink-600 focus:border-duck-500/50 focus:outline-none"
                />
                <p className="text-[11px] text-ink-500 mt-1">
                  Shown as the subtitle for this space across headers and dashboards.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Document Text Preview Modal */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-950/80 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-3xl max-h-[85vh] flex flex-col rounded-3xl border border-ink-700 bg-ink-900 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-ink-800 px-6 py-4">
              <div className="flex items-center gap-2.5">
                <FileText className="h-5 w-5 text-duck-400" />
                <h3 className="text-sm font-bold text-ink-100 truncate">{previewDoc.name}</h3>
              </div>
              <button
                type="button"
                onClick={() => setPreviewDoc(null)}
                className="rounded-xl p-1.5 text-ink-400 hover:bg-ink-800 hover:text-ink-200"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 font-mono text-xs text-ink-300 whitespace-pre-wrap leading-relaxed bg-ink-950/50">
              {previewDoc.text || "No text found in this document."}
            </div>
            <div className="flex items-center justify-between border-t border-ink-800 px-6 py-3.5 bg-ink-900 text-xs text-ink-400">
              <span>{previewDoc.text?.length || 0} characters</span>
              <button
                type="button"
                onClick={() => setPreviewDoc(null)}
                className="rounded-xl bg-ink-800 hover:bg-ink-700 px-4 py-1.5 font-semibold text-ink-200 transition-colors"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
