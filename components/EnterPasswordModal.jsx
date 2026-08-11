"use client";

import { useState } from "react";
import { Unlock, X, Eye, EyeOff, KeyRound } from "lucide-react";

/**
 * Matches Workspace.jsx's `toBase64` — plain `btoa` throws on any character
 * outside Latin1 (accents, emoji, non-Latin scripts). Without this, entering
 * such a password here would throw inside this async handler, silently
 * rejecting the promise and leaving the user stuck with no error message and
 * no way to unlock or remove the password.
 */
function toBase64(input) {
  const bytes = new TextEncoder().encode(input);
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary);
}

export default function EnterPasswordModal({ open, spaceName, expectedHash, onClose, onSuccess, mode = "enter" }) {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // For hackathon simplicity, we are just comparing plaintext or basic base64 as hash here,
    // or we assume expectedHash is the plaintext password itself based on how it's stored.
    // In a real app we would use crypto.subtle.digest.
    let encoded = null;
    try {
      encoded = toBase64(password);
    } catch {
      // fall through — plaintext comparison below still gets a chance
    }
    if (password === expectedHash || encoded === expectedHash) {
      onSuccess(spaceName);
      handleClose();
    } else {
      setError("Incorrect password");
    }
  };

  const handleClose = () => {
    setPassword("");
    setShowPassword(false);
    setError("");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-ink-950/90 backdrop-blur-md" onClick={handleClose} />
      
      <div className="relative w-full max-w-sm rounded-2xl border border-ink-800 bg-ink-900 shadow-2xl p-6 overflow-hidden z-10 animate-fade-up">
        <div className="flex items-center justify-between border-b border-ink-800 pb-4 mb-5">
          <div className="flex items-center gap-2.5">
            <div className={`flex h-9 w-9 items-center justify-center rounded-xl border ${mode === "remove" ? "bg-amber-500/10 text-amber-400 border-amber-500/20" : "bg-duck-500/10 text-duck-400 border-duck-500/20"}`}>
              {mode === "remove" ? <Unlock className="h-5 w-5" /> : <KeyRound className="h-5 w-5" />}
            </div>
            <div>
              <h2 className="text-base font-semibold text-ink-100">
                {mode === "remove" ? "Remove Password" : "Unlock Space"}
              </h2>
              <p className="text-xs text-ink-400 truncate max-w-[200px]">{spaceName}</p>
            </div>
          </div>
          <button onClick={handleClose} className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-800 hover:text-ink-200">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-ink-300">Enter Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                autoFocus
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-ink-700 bg-ink-850 py-2.5 px-3 text-xs text-ink-100 focus:border-duck-500/50 focus:outline-none pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-ink-500 hover:text-ink-300"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {error && <p className="text-xs font-medium text-rose-400 animate-fade-in">{error}</p>}

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-ink-800">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-xl border border-ink-700 px-4 py-2 text-xs font-medium text-ink-400 hover:text-ink-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`flex items-center gap-1.5 rounded-xl px-5 py-2 text-xs font-semibold shadow-md ${
                mode === "remove" 
                  ? "bg-amber-500 text-ink-950 hover:bg-amber-400" 
                  : "bg-duck-400 text-ink-950 hover:bg-duck-300"
              }`}
            >
              {mode === "remove" ? (
                <>
                  <Unlock className="h-3.5 w-3.5" />
                  Remove
                </>
              ) : (
                <>
                  <KeyRound className="h-3.5 w-3.5" />
                  Unlock
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
