"use client";

import { useState, useEffect, useRef } from "react";
import { X, Globe, Plus, Tag, Folder, Sparkles, ExternalLink, Bookmark } from "lucide-react";
import { normalizeUrl, extractDomain, getFaviconUrl, generateFallbackTitle } from "@/lib/urlUtils";
import { SPACES } from "@/lib/constants";

export default function AddBookmarkModal({
  open,
  onClose,
  onSave,
  initialBookmark = null,
  activeSpace = "School",
  spaces = SPACES,
  folders = [],
  selectedFolderId = null,
}) {
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [spaceId, setSpaceId] = useState(activeSpace || "School");
  const [folderId, setFolderId] = useState(selectedFolderId || "");
  const [notes, setNotes] = useState("");
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState("");
  const [faviconPreview, setFaviconPreview] = useState("");
  const [faviconError, setFaviconError] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const urlInputRef = useRef(null);

  // Initialize or reset form state on open / initialBookmark change
  useEffect(() => {
    if (open) {
      if (initialBookmark) {
        setUrl(initialBookmark.url || "");
        setTitle(initialBookmark.title || "");
        setSpaceId(initialBookmark.spaceId || activeSpace || "School");
        setFolderId(initialBookmark.folderId || "");
        setNotes(initialBookmark.notes || "");
        setTags(Array.isArray(initialBookmark.tags) ? initialBookmark.tags : []);
        setFaviconPreview(initialBookmark.favicon || getFaviconUrl(initialBookmark.url || ""));
      } else {
        setUrl("");
        setTitle("");
        setSpaceId(activeSpace || "School");
        setFolderId(selectedFolderId || "");
        setNotes("");
        setTags([]);
        setFaviconPreview("");
      }
      setTagInput("");
      setFaviconError(false);
      setIsSaving(false);
      setTimeout(() => urlInputRef.current?.focus(), 50);
    }
  }, [open, initialBookmark, activeSpace, selectedFolderId]);

  // Update favicon and auto-generate title when URL changes (if title is empty or user is adding new)
  const handleUrlBlur = () => {
    if (!url.trim()) return;
    const normalized = normalizeUrl(url);
    if (normalized) {
      setUrl(normalized);
      const fav = getFaviconUrl(normalized);
      setFaviconPreview(fav);
      setFaviconError(false);

      if (!title.trim() && !initialBookmark) {
        const derived = generateFallbackTitle(normalized);
        setTitle(derived);
      }
    }
  };

  const handleUrlChange = (e) => {
    const val = e.target.value;
    setUrl(val);
    const domain = extractDomain(val);
    if (domain) {
      setFaviconPreview(getFaviconUrl(val));
      setFaviconError(false);
    } else {
      setFaviconPreview("");
    }
  };

  // Keyboard navigation: Escape closes modal
  useEffect(() => {
    function handleKeyDown(e) {
      if (!open) return;
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleSubmit(e);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, url, title, spaceId, folderId, notes, tags]);

  const handleAddTag = () => {
    const trimmed = tagInput.trim().toLowerCase().replace(/^[#,]+/, "");
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
      setTagInput("");
    }
  };

  const handleTagKeyDown = (e) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      handleAddTag();
    } else if (e.key === "Backspace" && !tagInput && tags.length > 0) {
      setTags(tags.slice(0, -1));
    }
  };

  const handleRemoveTag = (tagToRemove) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    const normalized = normalizeUrl(url);
    if (!normalized) {
      alert("Please provide a valid website URL (e.g. https://example.com).");
      urlInputRef.current?.focus();
      return;
    }

    const domain = extractDomain(normalized);
    const finalTitle = title.trim() || generateFallbackTitle(normalized);
    const finalFavicon = faviconPreview || getFaviconUrl(normalized);

    setIsSaving(true);
    try {
      await onSave({
        ...(initialBookmark ? { id: initialBookmark.id } : {}),
        url: normalized,
        title: finalTitle,
        folderId: folderId || null,
        spaceId: spaceId || "School",
        favicon: finalFavicon,
        notes: notes.trim(),
        tags,
      });
      onClose();
    } catch (err) {
      console.error("Save bookmark error:", err);
      alert("Failed to save bookmark: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (!open) return null;

  // Filter folders by selected space
  const currentSpaceFolders = folders.filter((f) => (f.spaceId || "School") === spaceId);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        aria-hidden="true"
        className="fixed inset-0 z-[200] bg-ink-950/80 backdrop-blur-sm transition-opacity animate-fade-in"
      />

      {/* Modal Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={initialBookmark ? "Edit Saved Bookmark" : "Add Website Bookmark"}
        className="fixed left-1/2 top-1/2 z-[210] w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-ink-800 bg-ink-900 shadow-2xl overflow-hidden animate-fade-up"
      >
        {/* Header */}
        <header className="flex items-center justify-between border-b border-ink-800 px-6 py-4 bg-ink-900/90">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-duck-500/10 border border-duck-500/30 text-duck-400">
              <Bookmark className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-ink-100">
                {initialBookmark ? "Edit Saved Bookmark" : "Save Website Bookmark"}
              </h2>
              <p className="text-[11px] text-ink-500">
                Organized locally in SocraticOS spaces &amp; folders
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-ink-500 transition-colors hover:bg-ink-850 hover:text-ink-200 focus:outline-none"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5 max-h-[75vh] overflow-y-auto">
          {/* URL Input with Favicon Badge */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-ink-300 flex items-center justify-between">
              <span>Website URL *</span>
              {extractDomain(url) && (
                <span className="text-[10px] text-duck-300 font-mono flex items-center gap-1">
                  <Globe className="h-3 w-3" /> {extractDomain(url)}
                </span>
              )}
            </label>
            <div className="relative flex items-center">
              <div className="absolute left-3 flex h-5 w-5 items-center justify-center shrink-0">
                {faviconPreview && !faviconError ? (
                  <img
                    src={faviconPreview}
                    alt=""
                    className="h-4 w-4 rounded-sm object-contain"
                    onError={() => setFaviconError(true)}
                  />
                ) : (
                  <Globe className="h-4 w-4 text-ink-500" />
                )}
              </div>
              <input
                ref={urlInputRef}
                type="text"
                required
                value={url}
                onChange={handleUrlChange}
                onBlur={handleUrlBlur}
                placeholder="https://example.com/article"
                className="w-full rounded-xl border border-ink-700 bg-ink-850 pl-10 pr-3.5 py-2.5 text-xs text-ink-100 placeholder:text-ink-600 focus:border-duck-500 focus:outline-none font-mono"
              />
            </div>
          </div>

          {/* Title Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-ink-300">
              Bookmark Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. 3Blue1Brown — Calculus Essence"
              className="w-full rounded-xl border border-ink-700 bg-ink-850 px-3.5 py-2.5 text-xs text-ink-100 placeholder:text-ink-600 focus:border-duck-500 focus:outline-none"
            />
          </div>

          {/* Space & Folder Selector Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Space Targeting */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-ink-300">
                Target Space
              </label>
              <select
                value={spaceId}
                onChange={(e) => {
                  setSpaceId(e.target.value);
                  setFolderId(""); // reset folder selection when space switches
                }}
                className="w-full rounded-xl border border-ink-700 bg-ink-850 px-3 py-2 text-xs text-ink-200 focus:border-duck-500 focus:outline-none"
              >
                {(spaces.length > 0 ? spaces : SPACES).map((sp) => (
                  <option key={sp.name} value={sp.name}>
                    {sp.icon || "📂"} {sp.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Folder Assignment */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-ink-300">
                Folder
              </label>
              <select
                value={folderId}
                onChange={(e) => setFolderId(e.target.value)}
                className="w-full rounded-xl border border-ink-700 bg-ink-850 px-3 py-2 text-xs text-ink-200 focus:border-duck-500 focus:outline-none"
              >
                <option value="">📁 (Unorganized / Root)</option>
                {currentSpaceFolders.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.parentId ? "  └ 📁 " : "📁 "}
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Tags Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-ink-300 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5 text-duck-400" />
                <span>Tags</span>
              </span>
              <span className="text-[10px] text-ink-500">Press Enter or comma</span>
            </label>

            {/* Tag Chips */}
            <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-ink-700 bg-ink-850 p-2 min-h-[42px] focus-within:border-duck-500">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 rounded-md bg-duck-500/15 border border-duck-500/30 px-2 py-0.5 text-[11px] font-medium text-duck-300"
                >
                  #{tag}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    className="rounded hover:text-rose-300"
                  >
                    ×
                  </button>
                </span>
              ))}
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                onBlur={handleAddTag}
                placeholder={tags.length === 0 ? "Add tags (e.g. math, reference)..." : ""}
                className="flex-1 min-w-[120px] bg-transparent border-none outline-none text-xs text-ink-100 placeholder:text-ink-600 px-1 py-0.5"
              />
            </div>
          </div>

          {/* Personal Notes / Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-ink-300">
              Personal Study Notes &amp; Highlights
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Why is this resource useful? Key ideas or context for exams..."
              className="w-full rounded-xl border border-ink-700 bg-ink-850 px-3.5 py-2.5 text-xs text-ink-100 placeholder:text-ink-600 focus:border-duck-500 focus:outline-none resize-none leading-relaxed"
            />
          </div>

          {/* Action Footer */}
          <div className="flex items-center justify-between pt-3 border-t border-ink-800">
            <div className="text-[10px] text-ink-500 font-mono hidden sm:block">
              <kbd className="px-1.5 py-0.5 bg-ink-800 rounded border border-ink-700">Ctrl+Enter</kbd> to save
            </div>
            <div className="flex items-center gap-2.5 ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl px-4 py-2 text-xs font-medium text-ink-400 hover:text-ink-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!url.trim() || isSaving}
                className="inline-flex items-center gap-1.5 rounded-xl bg-duck-400 px-5 py-2 text-xs font-bold text-ink-950 shadow-md shadow-duck-500/20 transition-all hover:bg-duck-300 disabled:opacity-40"
              >
                {isSaving ? (
                  <span>Saving...</span>
                ) : (
                  <>
                    <Bookmark className="h-3.5 w-3.5" />
                    <span>{initialBookmark ? "Save Changes" : "Save Bookmark"}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </>
  );
}
