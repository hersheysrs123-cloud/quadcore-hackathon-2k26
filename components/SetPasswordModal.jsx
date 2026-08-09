"use client";

import { useState } from "react";
import { Lock, X, Check, Eye, EyeOff } from "lucide-react";

export default function SetPasswordModal({ open, spaceName, onClose, onSave }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");

    if (!password) {
      setError("Password cannot be empty");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    onSave(spaceName, password);
    handleClose();
  };

  const handleClose = () => {
    setPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    setError("");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-ink-950/80 backdrop-blur-sm" onClick={handleClose} />
      
      <div className="relative w-full max-w-sm rounded-2xl border border-ink-800 bg-ink-900 shadow-2xl p-6 overflow-hidden z-10 animate-fade-up">
        <div className="flex items-center justify-between border-b border-ink-800 pb-4 mb-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-ink-100">Lock Space</h2>
              <p className="text-xs text-ink-400 truncate max-w-[200px]">{spaceName}</p>
            </div>
          </div>
          <button onClick={handleClose} className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-800 hover:text-ink-200">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-ink-300">New Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                autoFocus
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-ink-700 bg-ink-850 py-2.5 px-3 text-xs text-ink-100 focus:border-rose-500/50 focus:outline-none pr-10"
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

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-ink-300">Confirm Password</label>
            <input
              type={showPassword ? "text" : "password"}
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-xl border border-ink-700 bg-ink-850 py-2.5 px-3 text-xs text-ink-100 focus:border-rose-500/50 focus:outline-none"
            />
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
              className="flex items-center gap-1.5 rounded-xl bg-rose-500 px-5 py-2 text-xs font-semibold text-white hover:bg-rose-400 shadow-md"
            >
              <Check className="h-3.5 w-3.5" />
              Set Password
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
