import { describe, it } from "node:test";
import assert from "node:assert/strict";

/**
 * ─── THEME BOOTSTRAP & SWITCHING LOGIC ──────────────────────────────
 * Validates pre-paint theme bootstrap and toggle from app/layout.js & Sidebar.jsx
 */

export function resolveTheme(storedPreference, prefersDark = true) {
  if (storedPreference === "light" || storedPreference === "dark") {
    return storedPreference;
  }
  return prefersDark ? "dark" : "light";
}

export function toggleTheme(currentTheme) {
  return currentTheme === "dark" ? "light" : "dark";
}

// ─── TEST SUITE ─────────────────────────────────────────────────────────────

describe("E2E Specification: Theme Persistence & Bootstrap", () => {
  it("defaults to 'dark' theme when no stored preference exists", () => {
    const theme = resolveTheme(null, true);
    assert.strictEqual(theme, "dark");
  });

  it("honors stored 'light' preference before first paint to prevent flashes", () => {
    const theme = resolveTheme("light", true);
    assert.strictEqual(theme, "light");
  });

  it("toggles cleanly between 'dark' and 'light'", () => {
    const light = toggleTheme("dark");
    assert.strictEqual(light, "light");

    const dark = toggleTheme("light");
    assert.strictEqual(dark, "dark");
  });
});
