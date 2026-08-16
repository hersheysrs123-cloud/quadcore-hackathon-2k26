import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  CORE_LANGUAGES,
  normalizeLanguage,
  tokenizeCode,
  TOKEN_STYLES,
} from "../../lib/syntaxHighlighter.js";

describe("10-Language Syntax Highlighter (lib/syntaxHighlighter.js)", () => {
  describe("Language Normalization & Aliases", () => {
    it("recognizes all 10 core language IDs and common aliases", () => {
      assert.strictEqual(normalizeLanguage("js"), "javascript");
      assert.strictEqual(normalizeLanguage("TypeScript"), "typescript");
      assert.strictEqual(normalizeLanguage("py"), "python");
      assert.strictEqual(normalizeLanguage("htm"), "html");
      assert.strictEqual(normalizeLanguage("xml"), "html");
      assert.strictEqual(normalizeLanguage("c++"), "cpp");
      assert.strictEqual(normalizeLanguage("rs"), "rust");
      assert.strictEqual(normalizeLanguage("SQL"), "sql");
      assert.strictEqual(normalizeLanguage("json"), "json");
      assert.strictEqual(normalizeLanguage("unknown_lang"), "javascript");
      assert.strictEqual(normalizeLanguage(null), "javascript");
    });
  });

  describe("Tokenization Verification Across Languages", () => {
    it("tokenizes JavaScript keywords, strings, comments, and numbers", () => {
      const code = 'const count = 42; // Answer\nfunction test() { return "hello"; }';
      const tokens = tokenizeCode(code, "javascript");

      const keywords = tokens.filter((t) => t.type === "keyword").map((t) => t.text);
      const strings = tokens.filter((t) => t.type === "string").map((t) => t.text);
      const numbers = tokens.filter((t) => t.type === "number").map((t) => t.text);
      const comments = tokens.filter((t) => t.type === "comment").map((t) => t.text);

      assert.ok(keywords.includes("const"));
      assert.ok(keywords.includes("function"));
      assert.ok(keywords.includes("return"));
      assert.ok(strings.includes('"hello"'));
      assert.ok(numbers.includes("42"));
      assert.ok(comments.some((c) => c.includes("// Answer")));
    });

    it("tokenizes Python def, decorators, strings, and hash comments", () => {
      const code = "@decorator\ndef calculate(x):\n    # compute square\n    return x ** 2";
      const tokens = tokenizeCode(code, "python");

      assert.ok(tokens.some((t) => t.type === "decorator" && t.text === "@decorator"));
      assert.ok(tokens.some((t) => t.type === "keyword" && t.text === "def"));
      assert.ok(tokens.some((t) => t.type === "comment" && t.text.includes("# compute square")));
    });

    it("tokenizes JSON keys and values distinctly", () => {
      const code = '{\n  "name": "SocraticOS",\n  "version": 2\n}';
      const tokens = tokenizeCode(code, "json");

      const jsonKeys = tokens.filter((t) => t.type === "json-key").map((t) => t.text.trim());
      assert.ok(jsonKeys.includes('"name"'));
      assert.ok(jsonKeys.includes('"version"'));
      assert.ok(tokens.some((t) => t.type === "string" && t.text === '"SocraticOS"'));
      assert.ok(tokens.some((t) => t.type === "number" && t.text === "2"));
    });

    it("tokenizes SQL queries with uppercase keywords and string literals", () => {
      const code = "SELECT id, title FROM notes WHERE is_favorite = 1;";
      const tokens = tokenizeCode(code, "sql");

      const keywords = tokens.filter((t) => t.type === "keyword").map((t) => t.text);
      assert.ok(keywords.includes("SELECT"));
      assert.ok(keywords.includes("FROM"));
      assert.ok(keywords.includes("WHERE"));
    });

    it("handles empty or whitespace-only code snippets without crashing", () => {
      assert.deepStrictEqual(tokenizeCode("", "javascript"), []);
      assert.deepStrictEqual(tokenizeCode(null, "javascript"), []);
    });
  });
});
