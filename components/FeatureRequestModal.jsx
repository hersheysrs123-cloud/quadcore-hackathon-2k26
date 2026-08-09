"use client";

import { useState } from "react";
import { MessageSquare, X, Send, HeartHandshake, CheckCircle2 } from "lucide-react";

export default function FeatureRequestModal({ open, onClose }) {
  const [email, setEmail] = useState("");
  const [category, setCategory] = useState("Feature Request");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setToastMessage("");

    const endpoint = process.env.NEXT_PUBLIC_FORMSPREE_ENDPOINT;
    
    // Fallback to mailto if no Formspree endpoint is configured
    if (!endpoint) {
      const mailtoLink = `mailto:support@socraticos.com?subject=[${category}] ${encodeURIComponent(subject)}&body=${encodeURIComponent(message + "\n\nFrom: " + email)}`;
      window.location.href = mailtoLink;
      setIsSubmitting(false);
      setToastMessage("✓ Opened in default email client");
      setTimeout(() => {
        handleClose();
      }, 2000);
      return;
    }

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          category,
          subject,
          message,
        }),
      });

      if (response.ok) {
        setToastMessage("✓ Feedback submitted successfully!");
        setTimeout(() => {
          handleClose();
        }, 2000);
      } else {
        setToastMessage("❌ Failed to submit feedback. Please try again.");
      }
    } catch (err) {
      setToastMessage("❌ Error submitting feedback: " + err.message);
    } finally {
      setIsSubmitting(false);
      if (!toastMessage.includes("✓")) {
        setTimeout(() => setToastMessage(""), 4000);
      }
    }
  };

  const handleClose = () => {
    setEmail("");
    setCategory("Feature Request");
    setSubject("");
    setMessage("");
    setToastMessage("");
    setIsSubmitting(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-ink-950/80 backdrop-blur-sm transition-opacity"
        onClick={handleClose}
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-md rounded-2xl border border-ink-800 bg-ink-900 shadow-2xl p-6 overflow-hidden z-10 animate-fade-up flex flex-col">
        <div className="flex items-center justify-between border-b border-ink-800 pb-4 mb-5 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-duck-500/10 text-duck-400 border border-duck-500/20">
              <MessageSquare className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-ink-100">Send Feedback</h2>
              <p className="text-xs text-ink-400">Feature requests, bugs, or ideas</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-800 hover:text-ink-200 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 flex-1">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-ink-300">Your Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-xl border border-ink-700 bg-ink-850 py-2.5 px-3 text-xs text-ink-100 placeholder:text-ink-600 focus:border-duck-500/50 focus:outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-ink-300">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-xl border border-ink-700 bg-ink-850 py-2.5 px-3 text-xs text-ink-100 focus:border-duck-500/50 focus:outline-none"
            >
              <option value="Feature Request">Feature Request</option>
              <option value="Bug Report">Bug Report</option>
              <option value="UI Improvement">UI Improvement</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-ink-300">Subject</label>
            <input
              type="text"
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Brief summary..."
              className="w-full rounded-xl border border-ink-700 bg-ink-850 py-2.5 px-3 text-xs text-ink-100 placeholder:text-ink-600 focus:border-duck-500/50 focus:outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-ink-300">Message</label>
            <textarea
              required
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Describe your request or issue in detail..."
              className="w-full rounded-xl border border-ink-700 bg-ink-850 py-2.5 px-3 text-xs text-ink-100 placeholder:text-ink-600 focus:border-duck-500/50 focus:outline-none resize-none"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-3 border-t border-ink-800 shrink-0">
            <div className="text-xs font-medium text-ink-400">
              {toastMessage && (
                <span className={`animate-fade-in ${toastMessage.includes("✓") ? "text-emerald-400" : "text-rose-400"}`}>
                  {toastMessage}
                </span>
              )}
            </div>
            
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleClose}
                disabled={isSubmitting}
                className="rounded-xl border border-ink-700 px-4 py-2 text-xs font-medium text-ink-400 hover:text-ink-200 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-1.5 rounded-xl bg-duck-400 px-5 py-2 text-xs font-semibold text-ink-950 hover:bg-duck-300 transition-all shadow-md disabled:opacity-50"
              >
                {isSubmitting ? (
                  "Sending..."
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5" />
                    Submit
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
