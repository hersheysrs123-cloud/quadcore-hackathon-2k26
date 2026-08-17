"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Folder,
  FolderOpen,
  FolderPlus,
  Bookmark,
  Plus,
  Search,
  Grid,
  List,
  ExternalLink,
  Copy,
  Check,
  MoreVertical,
  Edit2,
  Trash2,
  Tag,
  Globe,
  Upload,
  Download,
  ChevronRight,
  ChevronDown,
  ArrowUpDown,
  MoveRight,
  X,
  FileText,
  Sparkles,
} from "lucide-react";
import { db } from "@/lib/db";
import {
  createFolder,
  renameFolder,
  deleteFolder,
  createBookmark,
  updateBookmark,
  moveBookmark,
  deleteBookmark,
} from "@/lib/storageService";
import { exportBookmarksToHtml, importBookmarksFromHtml } from "@/lib/exportImport";
import { extractDomain, getFaviconUrl } from "@/lib/urlUtils";
import { SPACES } from "@/lib/constants";
import AddBookmarkModal from "@/components/AddBookmarkModal";

// ─── Inline New/Edit Folder Modal ──────────────────────────────────
function FolderModal({ open, onClose, onSave, initialName = "", parentId = null, title = "New Folder" }) {
  const [name, setName] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setName(initialName);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open, initialName]);

  if (!open) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave(name.trim(), parentId);
    onClose();
  };

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 z-[250] bg-ink-950/70 backdrop-blur-xs" />
      <div className="fixed left-1/2 top-1/2 z-[260] w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-ink-800 bg-ink-900 p-5 shadow-2xl animate-fade-up">
        <h3 className="text-sm font-bold text-ink-100 flex items-center gap-2">
          <FolderPlus className="h-4 w-4 text-duck-400" />
          <span>{title}</span>
        </h3>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <input
            ref={inputRef}
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Folder name (e.g. Research Papers)..."
            className="w-full rounded-xl border border-ink-700 bg-ink-850 px-3.5 py-2.5 text-xs text-ink-100 placeholder:text-ink-600 focus:border-duck-500 focus:outline-none"
          />
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-3 py-1.5 text-xs font-medium text-ink-400 hover:text-ink-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="rounded-xl bg-duck-400 px-4 py-1.5 text-xs font-bold text-ink-950 hover:bg-duck-300 disabled:opacity-40"
            >
              Save Folder
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

// ─── Main WebSaverView Component ──────────────────────────────────
export default function WebSaverView({ activeSpace = "School", spaces = SPACES }) {
  // Live queries for reactive persistence
  const folders = useLiveQuery(
    async () => {
      if (!db.folders) return [];
      return await db.folders.toArray();
    },
    [],
    []
  );

  const bookmarks = useLiveQuery(
    async () => {
      if (!db.bookmarks) return [];
      return await db.bookmarks.toArray();
    },
    [],
    []
  );

  // State
  const [selectedFolderId, setSelectedFolderId] = useState("all"); // "all" | "unorganized" | folderId
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState(null);
  const [viewMode, setViewMode] = useState("grid"); // "grid" | "list"
  const [sortBy, setSortBy] = useState("newest"); // "newest" | "oldest" | "title" | "domain"
  const [expandedFolders, setExpandedFolders] = useState({});
  const [dragOverFolderId, setDragOverFolderId] = useState(null);

  // Modals state
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editBookmark, setEditBookmark] = useState(null);
  const [folderModalState, setFolderModalState] = useState({ open: false, mode: "create", parentId: null, folder: null });
  const [copiedId, setCopiedId] = useState(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef(null);

  // Space-filtered folders and bookmarks
  const spaceFolders = useMemo(() => {
    return folders.filter((f) => (f.spaceId || "School") === activeSpace);
  }, [folders, activeSpace]);

  const spaceBookmarks = useMemo(() => {
    return bookmarks.filter((b) => (b.spaceId || "School") === activeSpace);
  }, [bookmarks, activeSpace]);

  // Folder Tree Structure Builder
  const folderTree = useMemo(() => {
    const map = {};
    const roots = [];

    spaceFolders.forEach((f) => {
      map[f.id] = { ...f, children: [] };
    });

    spaceFolders.forEach((f) => {
      if (f.parentId && map[f.parentId]) {
        map[f.parentId].children.push(map[f.id]);
      } else {
        roots.push(map[f.id]);
      }
    });

    return roots;
  }, [spaceFolders]);

  // Count bookmarks per folder
  const bookmarkCounts = useMemo(() => {
    const counts = { all: spaceBookmarks.length, unorganized: 0 };
    spaceFolders.forEach((f) => (counts[f.id] = 0));

    spaceBookmarks.forEach((bm) => {
      if (!bm.folderId) {
        counts.unorganized += 1;
      } else if (counts[bm.folderId] !== undefined) {
        counts[bm.folderId] += 1;
      }
    });

    return counts;
  }, [spaceFolders, spaceBookmarks]);

  // Extract all unique tags in active space
  const allTags = useMemo(() => {
    const tagSet = new Set();
    spaceBookmarks.forEach((b) => {
      if (Array.isArray(b.tags)) {
        b.tags.forEach((t) => tagSet.add(t));
      }
    });
    return Array.from(tagSet).sort();
  }, [spaceBookmarks]);

  // Filtered & Sorted Bookmarks
  const displayedBookmarks = useMemo(() => {
    let list = spaceBookmarks;

    // Folder Filter
    if (selectedFolderId === "unorganized") {
      list = list.filter((b) => !b.folderId);
    } else if (selectedFolderId !== "all") {
      // Show bookmarks in this folder or any child folder
      const childFolderIds = new Set([selectedFolderId]);
      let added = true;
      while (added) {
        added = false;
        spaceFolders.forEach((f) => {
          if (f.parentId && childFolderIds.has(f.parentId) && !childFolderIds.has(f.id)) {
            childFolderIds.add(f.id);
            added = true;
          }
        });
      }
      list = list.filter((b) => b.folderId && childFolderIds.has(b.folderId));
    }

    // Tag Filter
    if (selectedTag) {
      list = list.filter((b) => Array.isArray(b.tags) && b.tags.includes(selectedTag));
    }

    // Search Query Filter
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter((b) => {
        const titleMatch = (b.title || "").toLowerCase().includes(q);
        const urlMatch = (b.url || "").toLowerCase().includes(q);
        const domainMatch = extractDomain(b.url).toLowerCase().includes(q);
        const notesMatch = (b.notes || "").toLowerCase().includes(q);
        const tagsMatch = Array.isArray(b.tags) && b.tags.some((t) => t.toLowerCase().includes(q));
        return titleMatch || urlMatch || domainMatch || notesMatch || tagsMatch;
      });
    }

    // Sorting
    return [...list].sort((a, b) => {
      if (sortBy === "newest") {
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      }
      if (sortBy === "oldest") {
        return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
      }
      if (sortBy === "title") {
        return (a.title || "").localeCompare(b.title || "");
      }
      if (sortBy === "domain") {
        return extractDomain(a.url).localeCompare(extractDomain(b.url));
      }
      return 0;
    });
  }, [spaceBookmarks, selectedFolderId, spaceFolders, selectedTag, searchQuery, sortBy]);

  // Toggle Folder Collapse
  const toggleFolderExpand = (folderId, e) => {
    e?.stopPropagation();
    setExpandedFolders((prev) => ({
      ...prev,
      [folderId]: !prev[folderId],
    }));
  };

  // Drag and Drop Bookmark to Folder
  const handleDragStart = (e, bookmarkId) => {
    e.dataTransfer.setData("text/plain", bookmarkId);
  };

  const handleDragOver = (e, targetFolderId) => {
    e.preventDefault();
    if (dragOverFolderId !== targetFolderId) {
      setDragOverFolderId(targetFolderId);
    }
  };

  const handleDragLeave = () => {
    setDragOverFolderId(null);
  };

  const handleDrop = async (e, targetFolderId) => {
    e.preventDefault();
    setDragOverFolderId(null);
    const bookmarkId = e.dataTransfer.getData("text/plain");
    if (!bookmarkId) return;

    const finalFolderId = targetFolderId === "unorganized" || targetFolderId === "all" ? null : targetFolderId;
    await moveBookmark(bookmarkId, finalFolderId);
  };

  // Quick Copy URL
  const handleCopyLink = async (bm) => {
    if (!bm.url) return;
    try {
      await navigator.clipboard.writeText(bm.url);
      setCopiedId(bm.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Fallback
    }
  };

  // HTML Export
  const handleExportHtml = async () => {
    try {
      await exportBookmarksToHtml(spaceBookmarks, spaceFolders, activeSpace);
    } catch (err) {
      alert("Failed to export HTML bookmarks: " + err.message);
    }
  };

  // HTML Import
  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const res = await importBookmarksFromHtml(file, activeSpace);
      alert(`✓ Successfully imported ${res.bookmarksCount} bookmarks and ${res.foldersCount} folders into "${activeSpace}" space!`);
    } catch (err) {
      alert("Import error: " + err.message);
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Current folder label for breadcrumbs
  const currentFolderLabel = useMemo(() => {
    if (selectedFolderId === "all") return "All Saved Links";
    if (selectedFolderId === "unorganized") return "Unorganized Links";
    const found = spaceFolders.find((f) => f.id === selectedFolderId);
    return found ? found.name : "Bookmarks";
  }, [selectedFolderId, spaceFolders]);

  return (
    <div className="flex h-full w-full overflow-hidden bg-ink-950">
      {/* ─── Left Sidebar: Folders Tree & Quick Filters ─────────────── */}
      <aside className="flex w-64 shrink-0 flex-col border-r border-ink-800 bg-ink-900">
        {/* Sidebar Header */}
        <div className="flex items-center justify-between border-b border-ink-800 px-4 py-3 bg-ink-900/60">
          <div className="flex items-center gap-2">
            <Folder className="h-4 w-4 text-duck-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-ink-200">
              Folders
            </span>
          </div>
          <button
            type="button"
            onClick={() => setFolderModalState({ open: true, mode: "create", parentId: null, folder: null })}
            title="Create New Folder"
            className="flex items-center gap-1 rounded-lg border border-duck-500/30 bg-duck-500/10 px-2 py-1 text-[11px] font-semibold text-duck-300 transition-colors hover:bg-duck-500/20"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>New</span>
          </button>
        </div>

        {/* Navigation & Folder List */}
        <div className="flex-1 overflow-y-auto px-2.5 py-3 space-y-1">
          {/* All Bookmarks */}
          <button
            type="button"
            onClick={() => {
              setSelectedFolderId("all");
              setSelectedTag(null);
            }}
            onDragOver={(e) => handleDragOver(e, "all")}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, "all")}
            className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-medium transition-colors ${
              selectedFolderId === "all"
                ? "bg-ink-800 text-duck-300 font-semibold shadow-xs"
                : "text-ink-300 hover:bg-ink-850 hover:text-ink-100"
            } ${dragOverFolderId === "all" ? "ring-2 ring-duck-400 bg-duck-500/20" : ""}`}
          >
            <div className="flex items-center gap-2.5">
              <Bookmark className="h-4 w-4 text-duck-400" />
              <span>All Bookmarks</span>
            </div>
            <span className="rounded-md bg-ink-850 px-1.5 py-0.5 text-[10px] font-mono text-ink-400">
              {bookmarkCounts.all || 0}
            </span>
          </button>

          {/* Unorganized */}
          <button
            type="button"
            onClick={() => {
              setSelectedFolderId("unorganized");
              setSelectedTag(null);
            }}
            onDragOver={(e) => handleDragOver(e, "unorganized")}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, "unorganized")}
            className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-medium transition-colors ${
              selectedFolderId === "unorganized"
                ? "bg-ink-800 text-duck-300 font-semibold shadow-xs"
                : "text-ink-400 hover:bg-ink-850 hover:text-ink-200"
            } ${dragOverFolderId === "unorganized" ? "ring-2 ring-duck-400 bg-duck-500/20" : ""}`}
          >
            <div className="flex items-center gap-2.5">
              <Globe className="h-4 w-4 text-ink-500" />
              <span>Unorganized</span>
            </div>
            <span className="rounded-md bg-ink-850 px-1.5 py-0.5 text-[10px] font-mono text-ink-400">
              {bookmarkCounts.unorganized || 0}
            </span>
          </button>

          <div className="my-2 border-t border-ink-800/80" />

          {/* Folders Tree */}
          <div className="px-1 pb-1">
            <p className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-ink-500">
              {activeSpace} · Folders
            </p>

            {spaceFolders.length === 0 ? (
              <p className="px-3 py-3 text-xs italic text-ink-600">
                No folders created yet.
              </p>
            ) : (
              <div className="space-y-0.5">
                {folderTree.map((folder) => (
                  <FolderTreeItem
                    key={folder.id}
                    folder={folder}
                    depth={0}
                    selectedFolderId={selectedFolderId}
                    expandedFolders={expandedFolders}
                    dragOverFolderId={dragOverFolderId}
                    bookmarkCounts={bookmarkCounts}
                    onSelectFolder={(id) => {
                      setSelectedFolderId(id);
                      setSelectedTag(null);
                    }}
                    onToggleExpand={toggleFolderExpand}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onAddSubfolder={(parentId) =>
                      setFolderModalState({ open: true, mode: "create", parentId, folder: null })
                    }
                    onRenameFolder={(f) =>
                      setFolderModalState({ open: true, mode: "rename", parentId: f.parentId, folder: f })
                    }
                    onDeleteFolder={async (f) => {
                      if (confirm(`Delete folder "${f.name}" and all subfolders/bookmarks inside it?`)) {
                        await deleteFolder(f.id, true);
                        if (selectedFolderId === f.id) setSelectedFolderId("all");
                      }
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* HTML Import/Export Footer in Left Sidebar */}
        <div className="border-t border-ink-800 p-2.5 space-y-1.5 bg-ink-900/90">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleExportHtml}
              title="Export standard Netscape HTML bookmarks for Chrome, Firefox, Safari"
              className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-ink-700 bg-ink-850 px-2.5 py-1.5 text-[11px] font-semibold text-ink-300 transition-colors hover:border-duck-500/40 hover:text-duck-300"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export HTML</span>
            </button>

            <label
              title="Import bookmarks from browser HTML file"
              className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-ink-700 bg-ink-850 px-2.5 py-1.5 text-[11px] font-semibold text-ink-300 transition-colors hover:border-emerald-500/40 hover:text-emerald-300 cursor-pointer"
            >
              <Upload className="h-3.5 w-3.5" />
              <span>{importing ? "Importing..." : "Import HTML"}</span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".html,.htm"
                onChange={handleImportFile}
                disabled={importing}
                className="hidden"
              />
            </label>
          </div>
        </div>
      </aside>

      {/* ─── Main Content Pane ───────────────────────────────────────── */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Control Bar: Search, Tags Filter, View Mode, Sort, Add Button */}
        <div className="flex flex-col gap-2.5 border-b border-ink-800 bg-ink-900/60 p-4 backdrop-blur-md shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Live Search Input */}
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search bookmarks by title, URL, tag, or notes..."
                className="w-full rounded-xl border border-ink-700 bg-ink-850 pl-9 pr-8 py-2 text-xs text-ink-100 placeholder:text-ink-600 focus:border-duck-500 focus:outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-500 hover:text-ink-300"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Right Controls: Sort, View Toggle, Add Bookmark Button */}
            <div className="flex items-center gap-2 shrink-0">
              {/* Sort Dropdown */}
              <div className="relative flex items-center">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="rounded-xl border border-ink-700 bg-ink-850 px-2.5 py-1.5 text-xs text-ink-300 focus:border-duck-500 focus:outline-none cursor-pointer"
                >
                  <option value="newest">Newest Added</option>
                  <option value="oldest">Oldest Added</option>
                  <option value="title">Title (A-Z)</option>
                  <option value="domain">Domain</option>
                </select>
              </div>

              {/* View Mode Toggle (Grid vs List) */}
              <div className="flex items-center rounded-xl border border-ink-700 bg-ink-850 p-0.5">
                <button
                  type="button"
                  onClick={() => setViewMode("grid")}
                  title="Grid View"
                  className={`rounded-lg p-1.5 transition-colors ${
                    viewMode === "grid"
                      ? "bg-ink-700 text-duck-300"
                      : "text-ink-500 hover:text-ink-200"
                  }`}
                >
                  <Grid className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("list")}
                  title="List View"
                  className={`rounded-lg p-1.5 transition-colors ${
                    viewMode === "list"
                      ? "bg-ink-700 text-duck-300"
                      : "text-ink-500 hover:text-ink-200"
                  }`}
                >
                  <List className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* "+ Add Bookmark" Primary Button */}
              <button
                type="button"
                onClick={() => {
                  setEditBookmark(null);
                  setAddModalOpen(true);
                }}
                className="flex items-center gap-1.5 rounded-xl bg-duck-400 px-3.5 py-2 text-xs font-bold text-ink-950 shadow-md shadow-duck-500/10 transition-all hover:bg-duck-300 active:scale-98"
              >
                <Plus className="h-4 w-4" />
                <span>Add Bookmark</span>
              </button>
            </div>
          </div>

          {/* Breadcrumb Context & Tags Bar */}
          <div className="flex items-center justify-between gap-2 pt-1 border-t border-ink-800/50 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-bold text-ink-200 truncate">{currentFolderLabel}</span>
              <span className="text-ink-500">·</span>
              <span className="text-ink-500 text-[11px] font-mono">
                {displayedBookmarks.length} link{displayedBookmarks.length === 1 ? "" : "s"}
              </span>
            </div>

            {/* Quick Tag Filter Chips */}
            {allTags.length > 0 && (
              <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 no-scrollbar">
                {selectedTag && (
                  <button
                    type="button"
                    onClick={() => setSelectedTag(null)}
                    className="inline-flex items-center gap-1 rounded-md bg-duck-500/20 border border-duck-400 px-2 py-0.5 text-[11px] font-bold text-duck-200"
                  >
                    <span>#{selectedTag}</span>
                    <X className="h-3 w-3" />
                  </button>
                )}
                {allTags
                  .filter((t) => t !== selectedTag)
                  .map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setSelectedTag(tag)}
                      className="rounded-md border border-ink-700 bg-ink-850/80 px-2 py-0.5 text-[11px] text-ink-400 hover:border-duck-500/50 hover:text-duck-300 transition-colors"
                    >
                      #{tag}
                    </button>
                  ))}
              </div>
            )}
          </div>
        </div>

        {/* Bookmarks Grid / List Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          {displayedBookmarks.length === 0 ? (
            /* Empty State */
            <div className="flex flex-col items-center justify-center py-16 text-center max-w-md mx-auto">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-duck-500/10 border border-duck-500/30 text-3xl">
                🔖
              </div>
              <h3 className="mt-4 text-base font-bold text-ink-100">
                {searchQuery || selectedTag ? "No bookmarks match your search" : "No bookmarks in this folder yet"}
              </h3>
              <p className="mt-1.5 text-xs text-ink-400 leading-relaxed">
                {searchQuery || selectedTag
                  ? "Try searching for a different keyword, URL, or removing tag filters."
                  : "Save articles, lecture notes, GitHub repos, and study tools organized locally into folders."}
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setEditBookmark(null);
                    setAddModalOpen(true);
                  }}
                  className="flex items-center gap-1.5 rounded-xl bg-duck-400 px-4 py-2 text-xs font-bold text-ink-950 shadow-md hover:bg-duck-300 transition-all"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add First Bookmark</span>
                </button>
                <label className="flex items-center gap-1.5 rounded-xl border border-ink-700 bg-ink-850 px-4 py-2 text-xs font-semibold text-ink-300 hover:border-duck-500/40 hover:text-duck-300 transition-colors cursor-pointer">
                  <Upload className="h-4 w-4" />
                  <span>Import HTML File</span>
                  <input
                    type="file"
                    accept=".html,.htm"
                    onChange={handleImportFile}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          ) : viewMode === "grid" ? (
            /* ─── Grid View ─────────────────────────────────────────── */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {displayedBookmarks.map((bm) => (
                <BookmarkGridCard
                  key={bm.id}
                  bookmark={bm}
                  copiedId={copiedId}
                  folders={spaceFolders}
                  onDragStart={handleDragStart}
                  onCopyLink={handleCopyLink}
                  onMoveFolder={async (targetFid) => await moveBookmark(bm.id, targetFid || null)}
                  onEdit={() => {
                    setEditBookmark(bm);
                    setAddModalOpen(true);
                  }}
                  onDelete={async () => {
                    if (confirm(`Delete bookmark "${bm.title}"?`)) {
                      await deleteBookmark(bm.id);
                    }
                  }}
                  onSelectTag={(t) => setSelectedTag(t)}
                />
              ))}
            </div>
          ) : (
            /* ─── List View ─────────────────────────────────────────── */
            <div className="space-y-2">
              {displayedBookmarks.map((bm) => (
                <BookmarkListItem
                  key={bm.id}
                  bookmark={bm}
                  copiedId={copiedId}
                  folders={spaceFolders}
                  onDragStart={handleDragStart}
                  onCopyLink={handleCopyLink}
                  onMoveFolder={async (targetFid) => await moveBookmark(bm.id, targetFid || null)}
                  onEdit={() => {
                    setEditBookmark(bm);
                    setAddModalOpen(true);
                  }}
                  onDelete={async () => {
                    if (confirm(`Delete bookmark "${bm.title}"?`)) {
                      await deleteBookmark(bm.id);
                    }
                  }}
                  onSelectTag={(t) => setSelectedTag(t)}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Add / Edit Bookmark Modal */}
      <AddBookmarkModal
        open={addModalOpen}
        onClose={() => {
          setAddModalOpen(false);
          setEditBookmark(null);
        }}
        onSave={async (data) => {
          if (editBookmark) {
            await updateBookmark(editBookmark.id, data);
          } else {
            await createBookmark(data);
          }
        }}
        initialBookmark={editBookmark}
        activeSpace={activeSpace}
        spaces={spaces}
        folders={spaceFolders}
        selectedFolderId={selectedFolderId === "all" || selectedFolderId === "unorganized" ? null : selectedFolderId}
      />

      {/* New / Edit Folder Modal */}
      <FolderModal
        open={folderModalState.open}
        onClose={() => setFolderModalState({ open: false, mode: "create", parentId: null, folder: null })}
        title={folderModalState.mode === "rename" ? "Rename Folder" : folderModalState.parentId ? "Create Subfolder" : "Create New Folder"}
        initialName={folderModalState.folder?.name || ""}
        parentId={folderModalState.parentId}
        onSave={async (name, parentId) => {
          if (folderModalState.mode === "rename" && folderModalState.folder) {
            await renameFolder(folderModalState.folder.id, name);
          } else {
            await createFolder({ name, spaceId: activeSpace, parentId });
          }
        }}
      />
    </div>
  );
}

// ─── Folder Tree Item Subcomponent ─────────────────────────────────
function FolderTreeItem({
  folder,
  depth = 0,
  selectedFolderId,
  expandedFolders,
  dragOverFolderId,
  bookmarkCounts,
  onSelectFolder,
  onToggleExpand,
  onDragOver,
  onDragLeave,
  onDrop,
  onAddSubfolder,
  onRenameFolder,
  onDeleteFolder,
}) {
  const isSelected = selectedFolderId === folder.id;
  const isExpanded = Boolean(expandedFolders[folder.id]);
  const isDragOver = dragOverFolderId === folder.id;
  const hasChildren = Array.isArray(folder.children) && folder.children.length > 0;
  const count = bookmarkCounts[folder.id] || 0;

  return (
    <div>
      <div
        onClick={() => onSelectFolder(folder.id)}
        onDragOver={(e) => onDragOver(e, folder.id)}
        onDragLeave={onDragLeave}
        onDrop={(e) => onDrop(e, folder.id)}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        className={`group flex items-center justify-between rounded-xl py-1.5 pr-2 text-xs font-medium transition-colors cursor-pointer ${
          isSelected
            ? "bg-ink-800 text-duck-300 font-semibold shadow-xs"
            : "text-ink-300 hover:bg-ink-850 hover:text-ink-100"
        } ${isDragOver ? "ring-2 ring-duck-400 bg-duck-500/20" : ""}`}
      >
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          {hasChildren ? (
            <button
              type="button"
              onClick={(e) => onToggleExpand(folder.id, e)}
              className="p-0.5 text-ink-500 hover:text-ink-200"
            >
              {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            </button>
          ) : (
            <span className="w-3.5" />
          )}

          {isSelected || isExpanded ? (
            <FolderOpen className="h-4 w-4 text-duck-400 shrink-0" />
          ) : (
            <Folder className="h-4 w-4 text-ink-400 shrink-0" />
          )}

          <span className="truncate flex-1">{folder.name}</span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <span className="rounded-md bg-ink-850 px-1.5 py-0.5 text-[10px] font-mono text-ink-400">
            {count}
          </span>

          {/* Context Hover Actions */}
          <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity ml-1">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onAddSubfolder(folder.id);
              }}
              title="Add Subfolder"
              className="p-1 rounded hover:bg-ink-700 text-ink-400 hover:text-ink-200"
            >
              <Plus className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRenameFolder(folder);
              }}
              title="Rename Folder"
              className="p-1 rounded hover:bg-ink-700 text-ink-400 hover:text-ink-200"
            >
              <Edit2 className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteFolder(folder);
              }}
              title="Delete Folder"
              className="p-1 rounded hover:bg-rose-500/20 text-ink-400 hover:text-rose-300"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Child Subfolders */}
      {hasChildren && isExpanded && (
        <div className="space-y-0.5">
          {folder.children.map((child) => (
            <FolderTreeItem
              key={child.id}
              folder={child}
              depth={depth + 1}
              selectedFolderId={selectedFolderId}
              expandedFolders={expandedFolders}
              dragOverFolderId={dragOverFolderId}
              bookmarkCounts={bookmarkCounts}
              onSelectFolder={onSelectFolder}
              onToggleExpand={onToggleExpand}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              onAddSubfolder={onAddSubfolder}
              onRenameFolder={onRenameFolder}
              onDeleteFolder={onDeleteFolder}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Bookmark Grid Card Subcomponent ───────────────────────────────
function BookmarkGridCard({
  bookmark,
  copiedId,
  folders = [],
  onDragStart,
  onCopyLink,
  onMoveFolder,
  onEdit,
  onDelete,
  onSelectTag,
}) {
  const [imgError, setImgError] = useState(false);
  const domain = extractDomain(bookmark.url);
  const isCopied = copiedId === bookmark.id;

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, bookmark.id)}
      className="group relative flex flex-col justify-between rounded-2xl border border-ink-800 bg-ink-900/90 p-4 transition-all hover:border-duck-500/40 hover:bg-ink-850 hover:shadow-lg shadow-xs"
    >
      <div>
        {/* Card Header: Favicon, Domain Pill & Quick Actions */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-ink-800 border border-ink-700 shrink-0 overflow-hidden shadow-xs">
              {bookmark.favicon && !imgError ? (
                <img
                  src={bookmark.favicon}
                  alt=""
                  className="h-5 w-5 object-contain"
                  onError={() => setImgError(true)}
                />
              ) : (
                <Globe className="h-4 w-4 text-duck-400" />
              )}
            </div>
            <div className="min-w-0">
              <span className="rounded-md bg-ink-800/80 px-2 py-0.5 text-[10px] font-mono font-medium text-ink-300 border border-ink-700 truncate block">
                {domain}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={() => onCopyLink(bookmark)}
              title={isCopied ? "Copied to clipboard!" : "Copy link URL"}
              className={`p-1.5 rounded-lg border transition-colors ${
                isCopied
                  ? "border-emerald-500/50 bg-emerald-500/20 text-emerald-300"
                  : "border-ink-700 bg-ink-800 text-ink-400 hover:text-ink-200"
              }`}
            >
              {isCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
            <button
              type="button"
              onClick={onEdit}
              title="Edit Bookmark"
              className="p-1.5 rounded-lg border border-ink-700 bg-ink-800 text-ink-400 hover:text-ink-200 transition-colors"
            >
              <Edit2 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={onDelete}
              title="Delete Bookmark"
              className="p-1.5 rounded-lg border border-ink-700 bg-ink-800 text-ink-400 hover:text-rose-300 hover:border-rose-500/40 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Title Link */}
        <a
          href={bookmark.url}
          target="_blank"
          rel="noopener noreferrer"
          className="group/title flex items-start gap-1.5 font-bold text-sm text-ink-100 hover:text-duck-300 transition-colors line-clamp-2 leading-snug"
        >
          <span>{bookmark.title || domain || "Saved Link"}</span>
          <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-40 group-hover/title:opacity-100 transition-opacity mt-0.5" />
        </a>

        {/* Personal Study Notes */}
        {bookmark.notes && (
          <p className="mt-2 text-xs text-ink-400 line-clamp-3 leading-relaxed bg-ink-850/50 p-2 rounded-xl border border-ink-800/60 font-sans">
            {bookmark.notes}
          </p>
        )}

        {/* Tags */}
        {Array.isArray(bookmark.tags) && bookmark.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {bookmark.tags.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => onSelectTag(t)}
                className="rounded-md bg-duck-500/10 border border-duck-500/20 px-1.5 py-0.5 text-[10px] font-medium text-duck-300 hover:bg-duck-500/20 transition-colors"
              >
                #{t}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Card Footer: Folder Move Dropdown */}
      <div className="mt-4 pt-3 border-t border-ink-800/80 flex items-center justify-between gap-2 text-[11px]">
        <span className="text-ink-500 flex items-center gap-1 font-mono text-[10px]">
          📁 Move:
        </span>
        <select
          value={bookmark.folderId || ""}
          onChange={(e) => onMoveFolder(e.target.value)}
          className="rounded-lg border border-ink-700 bg-ink-800 px-2 py-1 text-[11px] text-ink-300 focus:border-duck-500 focus:outline-none max-w-[150px] truncate"
        >
          <option value="">(Unorganized)</option>
          {folders.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

// ─── Bookmark List Item Subcomponent ───────────────────────────────
function BookmarkListItem({
  bookmark,
  copiedId,
  folders = [],
  onDragStart,
  onCopyLink,
  onMoveFolder,
  onEdit,
  onDelete,
  onSelectTag,
}) {
  const [imgError, setImgError] = useState(false);
  const domain = extractDomain(bookmark.url);
  const isCopied = copiedId === bookmark.id;

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, bookmark.id)}
      className="group flex items-center justify-between gap-4 rounded-xl border border-ink-800 bg-ink-900/90 p-3 transition-all hover:border-duck-500/40 hover:bg-ink-850 shadow-xs"
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {/* Favicon */}
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-ink-800 border border-ink-700 shrink-0 overflow-hidden">
          {bookmark.favicon && !imgError ? (
            <img
              src={bookmark.favicon}
              alt=""
              className="h-4 w-4 object-contain"
              onError={() => setImgError(true)}
            />
          ) : (
            <Globe className="h-4 w-4 text-duck-400" />
          )}
        </div>

        {/* Title, Domain & Notes Preview */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <a
              href={bookmark.url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold text-xs text-ink-100 hover:text-duck-300 transition-colors truncate flex items-center gap-1"
            >
              <span>{bookmark.title || domain || "Saved Link"}</span>
              <ExternalLink className="h-3 w-3 shrink-0 opacity-40 hover:opacity-100" />
            </a>
            <span className="rounded bg-ink-800 px-1.5 py-0.5 text-[10px] font-mono text-ink-400 shrink-0">
              {domain}
            </span>
          </div>

          {bookmark.notes && (
            <p className="text-[11px] text-ink-400 truncate mt-0.5 max-w-xl">
              {bookmark.notes}
            </p>
          )}
        </div>

        {/* Tags */}
        {Array.isArray(bookmark.tags) && bookmark.tags.length > 0 && (
          <div className="hidden md:flex items-center gap-1 shrink-0">
            {bookmark.tags.slice(0, 3).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => onSelectTag(t)}
                className="rounded-md bg-duck-500/10 border border-duck-500/20 px-1.5 py-0.5 text-[10px] font-medium text-duck-300 hover:bg-duck-500/20"
              >
                #{t}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Move Folder Dropdown */}
        <select
          value={bookmark.folderId || ""}
          onChange={(e) => onMoveFolder(e.target.value)}
          className="hidden sm:block rounded-lg border border-ink-700 bg-ink-800 px-2 py-1 text-[11px] text-ink-300 focus:border-duck-500 focus:outline-none max-w-[120px] truncate"
        >
          <option value="">(Unorganized)</option>
          {folders.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => onCopyLink(bookmark)}
          title={isCopied ? "Copied!" : "Copy link URL"}
          className={`p-1.5 rounded-lg border transition-colors ${
            isCopied
              ? "border-emerald-500/50 bg-emerald-500/20 text-emerald-300"
              : "border-ink-700 bg-ink-800 text-ink-400 hover:text-ink-200"
          }`}
        >
          {isCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
        <button
          type="button"
          onClick={onEdit}
          title="Edit"
          className="p-1.5 rounded-lg border border-ink-700 bg-ink-800 text-ink-400 hover:text-ink-200 transition-colors"
        >
          <Edit2 className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          title="Delete"
          className="p-1.5 rounded-lg border border-ink-700 bg-ink-800 text-ink-400 hover:text-rose-300 hover:border-rose-500/40 transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
