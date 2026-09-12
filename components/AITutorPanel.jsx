"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import Drawer, { DrawerError } from "@/components/Drawer";
import MarkdownRenderer from "@/components/MarkdownRenderer";
import { tutorChat } from "@/lib/aiService";
import { getActiveSyllabusForSpace, getSpaceSettings } from "@/lib/storageService";
import { Send, Trash2, Copy, Check, GraduationCap } from "lucide-react";

export default function AITutorPanel({
  open,
  concept,
  noteContent,
  spaceId = null,
  spaceName = "",
  onClose,
}) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [spaceInfo, setSpaceInfo] = useState(null);
  const [syllabusActive, setSyllabusActive] = useState(false);

  const scrollRef = useRef(null);
  const textareaRef = useRef(null);
  const lastConceptRef = useRef(null);

  // Load space settings and curriculum state whenever space changes
  useEffect(() => {
    if (!spaceId) return;
    let isMounted = true;
    Promise.all([getSpaceSettings(spaceId), getActiveSyllabusForSpace(spaceId)])
      .then(([settings, syllabus]) => {
        if (isMounted) {
          setSpaceInfo(settings || null);
          setSyllabusActive(Boolean(syllabus && syllabus.trim()));
        }
      })
      .catch((err) => console.warn("Failed to load space tutor info:", err));
    return () => {
      isMounted = false;
    };
  }, [spaceId]);

  // When opened with a fresh concept/note, greet the learner if no history exists
  useEffect(() => {
    if (!open) return;
    if (messages.length === 0 || lastConceptRef.current !== concept) {
      lastConceptRef.current = concept;
      const topicName = concept || "your current notes";
      setMessages([
        {
          role: "assistant",
          content: `Hello! I'm your **AI Tutor** for **${spaceName || "this space"}**.\n\nI have loaded your verified curriculum boundaries and your active notes on **"${topicName}"**.\n\nWhat doubt or problem can I help you break down today?`,
        },
      ]);
    }
  }, [open, concept, spaceName, messages.length]);

  // Scroll to bottom on new message
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages, loading]);

  // Adjust textarea height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 140)}px`;
    }
  }, [input]);

  const handleSend = useCallback(
    async (textToSend) => {
      const query = (textToSend !== undefined ? textToSend : input).trim();
      if (!query || loading) return;

      const userMsg = { role: "user", content: query };
      const updatedMessages = [...messages, userMsg];
      setMessages(updatedMessages);
      setInput("");
      setLoading(true);
      setError(null);

      try {
        // Wire format: convert roles for Gemini
        const historyPayload = updatedMessages.map((m) => ({
          role: m.role === "assistant" ? "assistant" : "user",
          content: m.content,
        }));

        const data = await tutorChat({
          messages: historyPayload,
          concept,
          noteContent,
          spaceId,
          spaceName: spaceName || spaceId,
          aiPersona: spaceInfo?.aiPersona,
          strictness: spaceInfo?.strictness,
          academicLevel: spaceInfo?.academicLevel,
        });

        setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
      } catch (err) {
        setError(err.message || "Could not reach AI Tutor. Check your connection or API key.");
      } finally {
        setLoading(false);
      }
    },
    [input, loading, messages, concept, noteContent, spaceId, spaceName, spaceInfo],
  );

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCopy = (text, idx) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleClearHistory = () => {
    if (confirm("Clear tutor chat history for this session?")) {
      setMessages([
        {
          role: "assistant",
          content: `Chat history cleared. I'm ready to answer any questions or doubts about **"${concept || "your notes"}"**!`,
        },
      ]);
    }
  };

  const promptStarters = useMemo(() => [
    "Explain this step-by-step with intuition",
    "What are common exam traps or mistakes here?",
    "Give me a clear, concrete real-world example",
    "Derive the formula and explain each variable",
  ], []);

  const academicLevelLabel = useMemo(() => {
    const map = {
      igcse: "IGCSE / O-Level",
      ib_hl: "IB Diploma HL",
      ap: "AP College Board",
      university: "University",
      olympiad: "Olympiad",
      general: "General Mastery",
    };
    return map[spaceInfo?.academicLevel] || "General Standard";
  }, [spaceInfo?.academicLevel]);

  const personaLabel = useMemo(() => {
    const map = {
      strict: "Strict Examiner",
      socratic: "Socratic Guide",
      coach: "Friendly Coach",
      olympiad: "Olympiad Mentor",
      examiner: "Standard Tutor",
    };
    return map[spaceInfo?.aiPersona] || "Standard Tutor";
  }, [spaceInfo?.aiPersona]);

  return (
    <Drawer
      open={open}
      onClose={onClose}
      icon="🧑‍🏫"
      title="AI Tutor"
      subtitle={concept ? `Doubts & Explanations · ${concept}` : `Doubts & Explanations · ${spaceName}`}
      scrollRef={scrollRef}
      actions={
        <button
          type="button"
          onClick={handleClearHistory}
          title="Clear Chat"
          className="rounded-lg p-1.5 text-ink-400 transition-colors hover:bg-ink-800 hover:text-rose-400"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      }
      footer={
        <div className="bg-ink-900 px-4 py-3 border-t border-ink-800 space-y-2">
          {/* Quick Prompts */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {promptStarters.map((starter, i) => (
              <button
                key={i}
                type="button"
                disabled={loading}
                onClick={() => handleSend(starter)}
                className="shrink-0 text-left rounded-full border border-ink-750 bg-ink-850 px-2.5 py-1 text-[11px] font-medium text-ink-300 transition-all hover:border-duck-500/50 hover:bg-ink-800 hover:text-ink-100 disabled:opacity-40"
              >
                ✨ {starter}
              </button>
            ))}
          </div>

          {/* Input Box */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-end gap-2"
          >
            <div className="relative flex-1 rounded-xl border border-ink-700 bg-ink-850/80 focus-within:border-duck-500/70 focus-within:ring-1 focus-within:ring-duck-500/30 transition-all">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask any doubt, derivation, or question..."
                rows={1}
                className="w-full resize-none bg-transparent px-3.5 py-2.5 text-xs text-ink-100 placeholder-ink-500 focus:outline-none max-h-36 leading-relaxed"
              />
            </div>

            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-duck-400 text-ink-950 font-bold transition-all hover:bg-duck-300 active:scale-95 disabled:opacity-40 disabled:pointer-events-none shadow-sm"
              title="Send (Enter)"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
          <div className="flex items-center justify-between text-[10px] text-ink-500 px-1">
            <span>Press Enter to send, Shift+Enter for new line</span>
            <span>Supports LaTeX: <code className="text-duck-400 font-mono">$formula$</code></span>
          </div>
        </div>
      }
    >
      <div className="p-4 space-y-4">
        {/* Space Context Strip Badge */}
        <div className="rounded-xl border border-ink-800 bg-ink-850/60 p-3 flex flex-wrap items-center justify-between gap-2 text-xs shadow-xs">
          <div className="flex items-center gap-2 min-w-0">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-duck-500/10 text-duck-300 font-bold text-xs border border-duck-500/30">
              {spaceName?.[0]?.toUpperCase() || "S"}
            </span>
            <div className="min-w-0">
              <p className="font-semibold text-ink-100 truncate text-xs">{spaceName || "Active Space"}</p>
              <div className="flex items-center gap-2 text-[10px] text-ink-400">
                <span className="flex items-center gap-1">
                  <GraduationCap className="h-3 w-3 text-emerald-400" />
                  <span>{academicLevelLabel}</span>
                </span>
                <span>•</span>
                <span>{personaLabel}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {syllabusActive ? (
              <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Syllabus Active</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-md border border-ink-700 bg-ink-800/80 px-2 py-0.5 text-[10px] font-medium text-ink-400">
                <span>General Curric.</span>
              </span>
            )}
          </div>
        </div>

        {/* Message Stream */}
        <div className="space-y-3.5">
          {messages.map((msg, idx) => {
            const isUser = msg.role === "user";
            return (
              <div
                key={idx}
                className={`flex flex-col ${isUser ? "items-end" : "items-start"} group animate-fade-in`}
              >
                <div className="flex items-center gap-1.5 mb-1 px-1">
                  <span className="text-[10px] font-semibold text-ink-500 uppercase tracking-wider">
                    {isUser ? "You" : "AI Tutor"}
                  </span>
                  {!isUser && (
                    <button
                      type="button"
                      onClick={() => handleCopy(msg.content, idx)}
                      title="Copy message"
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 text-ink-400 hover:text-ink-200"
                    >
                      {copiedIndex === idx ? (
                        <Check className="h-3 w-3 text-emerald-400" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </button>
                  )}
                </div>

                <div
                  className={`relative rounded-2xl px-4 py-3 text-xs leading-relaxed max-w-[92%] shadow-sm ${
                    isUser
                      ? "rounded-br-xs bg-ink-800 border border-ink-700 text-ink-100 select-text"
                      : "rounded-bl-xs bg-ink-900 border border-ink-800 text-ink-200 select-text"
                  }`}
                >
                  <MarkdownRenderer content={msg.content} />
                </div>
              </div>
            );
          })}

          {loading && (
            <div className="flex items-start gap-2.5 animate-fade-in">
              <div className="rounded-2xl rounded-bl-xs bg-ink-900 border border-ink-800 px-4 py-3 text-xs text-ink-400 flex items-center gap-2 shadow-sm">
                <span className="inline-flex gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-duck-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="h-1.5 w-1.5 rounded-full bg-duck-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="h-1.5 w-1.5 rounded-full bg-duck-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                </span>
                <span className="text-[11px] text-ink-400">Consulting syllabus &amp; formulating explanation…</span>
              </div>
            </div>
          )}

          {error && (
            <DrawerError message={error} onRetry={() => handleSend()} />
          )}
        </div>
      </div>
    </Drawer>
  );
}
