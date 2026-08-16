import { describe, it } from "node:test";
import assert from "node:assert/strict";

/**
 * ─── UTF-8 ENCRYPTION / BASE64 HELPER UNDER TEST ────────────────────
 * Protects against DOMException when passwords contain non-Latin1 symbols.
 */

export function toBase64(input) {
  if (!input) return "";
  const bytes = new TextEncoder().encode(input);
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary);
}

export function fromBase64(encoded) {
  if (!encoded) return "";
  try {
    const binary = atob(encoded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
  } catch {
    return "";
  }
}

export function verifyPassword(enteredPassword, storedHash) {
  if (!storedHash) return true; // Unlocked
  if (!enteredPassword) return false;
  return toBase64(enteredPassword) === storedHash;
}

// ─── TEST SUITE ─────────────────────────────────────────────────────────────

describe("Space Password Security & UTF-8 Encoding", () => {
  it("encodes and decodes standard alphanumeric passwords accurately", () => {
    const pwd = "StudyPassword2026";
    const encoded = toBase64(pwd);
    assert.notStrictEqual(encoded, pwd);
    assert.strictEqual(fromBase64(encoded), pwd);
    assert.strictEqual(verifyPassword(pwd, encoded), true);
  });

  it("handles non-Latin1 characters (emojis, accents, non-Latin scripts) without throwing DOMException", () => {
    const complexPasswords = [
      "🦆Socratic#123",
      "Café_Latté_2026",
      "密码_Password_مرحبا",
      "🔬🧪Quantum⚡⚛️",
    ];

    for (const pwd of complexPasswords) {
      assert.doesNotThrow(() => {
        const hash = toBase64(pwd);
        assert.ok(hash.length > 0);
        assert.strictEqual(fromBase64(hash), pwd);
        assert.strictEqual(verifyPassword(pwd, hash), true);
        assert.strictEqual(verifyPassword("WrongPassword", hash), false);
      });
    }
  });

  it("rejects incorrect passwords cleanly", () => {
    const hash = toBase64("Secret123");
    assert.strictEqual(verifyPassword("secret123", hash), false); // Case sensitive
    assert.strictEqual(verifyPassword("", hash), false);
    assert.strictEqual(verifyPassword(null, hash), false);
  });
});
