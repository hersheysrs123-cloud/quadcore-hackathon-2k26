"use client";

import { useEffect, useState } from "react";
import { db, getGraphicsSettings, saveGraphicsSettings, DEFAULT_GRAPHICS_SETTINGS } from "@/lib/db";
import { Eye, EyeOff, Key, Cpu, Check, Shield, Server, MonitorPlay, Settings, Command, Search, PlusSquare } from "lucide-react";

export default function SettingsModal({ open, onClose }) {
  const [activeTab, setActiveTab] = useState("general"); // "general" | "ai" | "3d"
  
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);

  
  const [gfx, setGfx] = useState(DEFAULT_GRAPHICS_SETTINGS);
  
  const [saved, setSaved] = useState(false);

  const [clickToAppend, setClickToAppend] = useState(true);

  useEffect(() => {
    if (!open) return;
    async function loadSettings() {
      try {
        const keyItem = await db.settings.get("gemini_api_key");
        if (keyItem?.value) setApiKey(keyItem.value);

        const clickItem = await db.settings.get("editor_click_to_append");
        if (clickItem) setClickToAppend(clickItem.value !== "false");
        
        const loadedGfx = await getGraphicsSettings();
        setGfx(loadedGfx);
      } catch (err) {
        console.error("Failed to load settings:", err);
      }
    }
    loadSettings();
  }, [open]);

  async function handleSave(e) {
    e.preventDefault();
    try {
      await db.settings.put({ key: "gemini_api_key", value: apiKey.trim() });
      await db.settings.put({ key: "editor_click_to_append", value: String(clickToAppend) });

      
      await saveGraphicsSettings(gfx);

      setSaved(true);
      setTimeout(() => {
        setSaved(false);
        onClose();
      }, 1000);
    } catch (err) {
      console.error("Failed to save settings:", err);
    }
  }
  
  function handlePresetChange(e) {
    const preset = e.target.value;
    if (preset === "high") {
      setGfx(prev => ({ ...prev, graphicsPreset: preset, targetFps: 60, pixelRatio: 2.0, enableShadows: true, enableAntialias: true }));
    } else if (preset === "medium") {
      setGfx(prev => ({ ...prev, graphicsPreset: preset, targetFps: 60, pixelRatio: 1.5, enableShadows: true, enableAntialias: false }));
    } else if (preset === "low") {
      setGfx(prev => ({ ...prev, graphicsPreset: preset, targetFps: 30, pixelRatio: 1.0, enableShadows: false, enableAntialias: false }));
    } else {
      setGfx(prev => ({ ...prev, graphicsPreset: preset }));
    }
  }

  function updateGfx(key, value) {
    setGfx(prev => ({ ...prev, graphicsPreset: "custom", [key]: value }));
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-ink-950/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-lg rounded-2xl border border-ink-800 bg-ink-900 shadow-2xl p-6 overflow-hidden z-10 animate-fade-up max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-ink-800 pb-4 mb-5 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-duck-500/10 text-duck-400 border border-duck-500/20">
              <Cpu className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-ink-100">Settings</h2>
              <p className="text-xs text-ink-400">Configure AI and 3D graphics</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-800 hover:text-ink-200 transition-colors"
          >
            ✕
          </button>
        </div>
        
        {/* Tabs */}
        <div className="flex gap-2 mb-5 shrink-0">
          <button 
            type="button"
            onClick={() => setActiveTab("general")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
              activeTab === "general" ? "bg-ink-800 text-ink-100" : "text-ink-400 hover:text-ink-200 hover:bg-ink-800/50"
            }`}
          >
            <Settings className="w-4 h-4" /> General
          </button>
          <button 
            type="button"
            onClick={() => setActiveTab("3d")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
              activeTab === "3d" ? "bg-ink-800 text-ink-100" : "text-ink-400 hover:text-ink-200 hover:bg-ink-800/50"
            }`}
          >
            <MonitorPlay className="w-4 h-4" /> 3D & Performance
          </button>
          <button 
            type="button"
            onClick={() => setActiveTab("ai")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
              activeTab === "ai" ? "bg-ink-800 text-ink-100" : "text-ink-400 hover:text-ink-200 hover:bg-ink-800/50"
            }`}
          >
            <Server className="w-4 h-4" /> AI & Keys
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-5 overflow-y-auto flex-1 pr-2">
          {activeTab === "general" && (
            <div className="space-y-6 animate-fade-up">
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-ink-100 flex items-center gap-2">
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
                      <kbd className="px-2 py-1 bg-ink-950 border border-ink-700 rounded text-[10px] font-mono text-ink-300">Ctrl</kbd>
                      <kbd className="px-2 py-1 bg-ink-950 border border-ink-700 rounded text-[10px] font-mono text-ink-300">K</kbd>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 rounded-xl border border-ink-800 bg-ink-850">
                    <div className="flex items-center gap-3">
                      <PlusSquare className="w-4 h-4 text-ink-400" />
                      <span className="text-xs font-medium text-ink-200">Quick Note</span>
                    </div>
                    <div className="flex gap-1">
                      <kbd className="px-2 py-1 bg-ink-950 border border-ink-700 rounded text-[10px] font-mono text-ink-300">Ctrl</kbd>
                      <kbd className="px-2 py-1 bg-ink-950 border border-ink-700 rounded text-[10px] font-mono text-ink-300">I</kbd>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-xl border border-ink-800 bg-ink-850">
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

              <div className="space-y-3 pt-3 border-t border-ink-800">
                <h3 className="text-sm font-semibold text-ink-100 flex items-center gap-2">
                  <PlusSquare className="w-4 h-4 text-duck-400" />
                  Editor Behavior
                </h3>
                <div className="flex items-center justify-between p-3.5 rounded-xl border border-ink-800 bg-ink-850">
                  <div className="space-y-0.5 pr-4">
                    <p className="text-xs font-semibold text-ink-100">Click anywhere to create block</p>
                    <p className="text-[11px] text-ink-400">Clicking empty space below or between blocks appends a new block</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={clickToAppend}
                      onChange={(e) => setClickToAppend(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-ink-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-duck-500"></div>
                  </label>
                </div>
              </div>
            </div>
          )}

          {activeTab === "ai" && (
            <div className="space-y-6 animate-fade-up">
              {/* Privacy Notice Banner */}
              <div className="flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs text-emerald-300">
                <Shield className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
                <div>
                  <span className="font-semibold text-emerald-200">100% Local Privacy:</span> Keys and settings are stored strictly inside your browser's IndexedDB (Dexie). They are never transmitted to our backend server.
                </div>
              </div>

              {/* Gemini API Key Input */}
              <div className="space-y-1.5 animate-fade-up">
                  <label className="block text-xs font-semibold text-ink-300">
                    Personal Gemini API Key
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
                    Leave blank to fall back to default server key if configured. Get your key free at{" "}
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

            </div>
          )}

          {activeTab === "3d" && (
            <div className="space-y-6 animate-fade-up">
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
              
              <div className="grid grid-cols-2 gap-4">
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

              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative">
                    <input 
                      type="checkbox" 
                      className="sr-only" 
                      checked={gfx.enableShadows} 
                      onChange={(e) => updateGfx('enableShadows', e.target.checked)} 
                    />
                    <div className={`block w-10 h-6 rounded-full transition-colors ${gfx.enableShadows ? 'bg-duck-500' : 'bg-ink-700'}`}></div>
                    <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${gfx.enableShadows ? 'translate-x-4' : ''}`}></div>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-ink-200">Enable Shadows</span>
                    <span className="text-[10px] text-ink-500">Improves realism but uses more GPU</span>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative">
                    <input 
                      type="checkbox" 
                      className="sr-only" 
                      checked={gfx.enableAntialias} 
                      onChange={(e) => updateGfx('enableAntialias', e.target.checked)} 
                    />
                    <div className={`block w-10 h-6 rounded-full transition-colors ${gfx.enableAntialias ? 'bg-duck-500' : 'bg-ink-700'}`}></div>
                    <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${gfx.enableAntialias ? 'translate-x-4' : ''}`}></div>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-ink-200">Anti-aliasing</span>
                    <span className="text-[10px] text-ink-500">Smooths jagged edges on models (requires refresh)</span>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative">
                    <input 
                      type="checkbox" 
                      className="sr-only" 
                      checked={gfx.autoPauseHidden} 
                      onChange={(e) => updateGfx('autoPauseHidden', e.target.checked)} 
                    />
                    <div className={`block w-10 h-6 rounded-full transition-colors ${gfx.autoPauseHidden ? 'bg-duck-500' : 'bg-ink-700'}`}></div>
                    <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${gfx.autoPauseHidden ? 'translate-x-4' : ''}`}></div>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-ink-200">Auto-pause when hidden</span>
                    <span className="text-[10px] text-ink-500">Stops rendering when the tab is out of view</span>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-ink-800 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-ink-700 px-4 py-2 text-xs font-medium text-ink-400 hover:text-ink-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 rounded-xl bg-duck-400 px-5 py-2 text-xs font-semibold text-ink-950 hover:bg-duck-300 transition-all shadow-md"
            >
              {saved ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  Saved!
                </>
              ) : (
                "Save Preferences"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
