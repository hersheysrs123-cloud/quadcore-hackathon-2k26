import Prism from "prismjs";
import "prismjs/components/prism-typescript.js";
import "prismjs/components/prism-python.js";
import "prismjs/components/prism-css.js";
import "prismjs/components/prism-c.js";
import "prismjs/components/prism-cpp.js";
import "prismjs/components/prism-java.js";
import "prismjs/components/prism-rust.js";
import "prismjs/components/prism-sql.js";
import "prismjs/components/prism-json.js";

/**
 * Syntax Highlighting definitions & tokenizers for 10 core languages via PrismJS:
 * JavaScript, TypeScript, Python, HTML, CSS, C++, Java, Rust, SQL, and JSON.
 */

export const CORE_LANGUAGES = [
  { id: "javascript", label: "JavaScript", aliases: ["js"] },
  { id: "typescript", label: "TypeScript", aliases: ["ts"] },
  { id: "python", label: "Python", aliases: ["py"] },
  { id: "html", label: "HTML", aliases: ["htm", "xml"] },
  { id: "css", label: "CSS", aliases: [] },
  { id: "cpp", label: "C++", aliases: ["c++", "cxx", "c", "c_cpp"] },
  { id: "java", label: "Java", aliases: [] },
  { id: "rust", label: "Rust", aliases: ["rs"] },
  { id: "sql", label: "SQL", aliases: [] },
  { id: "json", label: "JSON", aliases: [] },
];

const LANGUAGE_MAP = new Map(
  CORE_LANGUAGES.flatMap((item) => [[item.id, item.id], ...item.aliases.map((alias) => [alias, item.id])])
);

export const normalizeLanguage = (lang) => LANGUAGE_MAP.get(String(lang || "").toLowerCase().trim()) || "javascript";

export const TOKEN_STYLES = {
  keyword: "text-pink-400 font-semibold",
  type: "text-cyan-300 font-medium",
  builtin: "text-blue-400 font-medium",
  string: "text-emerald-300",
  comment: "text-ink-500 italic",
  number: "text-amber-400 font-mono",
  operator: "text-duck-300",
  tag: "text-rose-400 font-semibold",
  attribute: "text-purple-300",
  decorator: "text-yellow-400 italic",
  function: "text-sky-300 font-medium",
  punctuation: "text-ink-400",
  "json-key": "text-sky-300 font-semibold",
};

const PRISM_LANG_MAP = {
  javascript: Prism.languages.javascript,
  typescript: Prism.languages.typescript,
  python: Prism.languages.python,
  html: Prism.languages.markup,
  css: Prism.languages.css,
  cpp: Prism.languages.cpp,
  java: Prism.languages.java,
  rust: Prism.languages.rust,
  sql: Prism.languages.sql,
  json: Prism.languages.json,
};

const TOKEN_TYPE_MAP = {
  directive: "keyword", "directive-hash": "keyword", keyword: "keyword", boolean: "keyword", selector: "keyword", macro: "keyword",
  string: "string", char: "string", regex: "string", "attr-value": "string",
  comment: "comment", prolog: "comment", doctype: "comment", cdata: "comment",
  number: "number", operator: "operator", entity: "operator", url: "operator",
  punctuation: "punctuation", "double-colon": "punctuation", "template-punctuation": "punctuation", "interpolation-punctuation": "punctuation",
  function: "function", "function-definition": "function",
  "class-name": "type", type: "type", parameter: "type",
  builtin: "builtin", constant: "builtin",
  tag: "tag", "attr-name": "attribute", decorator: "decorator",
};

const mapTokenType = (type, lang) => (type === "property" ? (lang === "json" ? "json-key" : "attribute") : TOKEN_TYPE_MAP[type] || type || "plain");

function flattenTokens(tokens, lang, parentType = "plain") {
  const result = [];
  for (const token of tokens) {
    if (typeof token === "string") {
      result.push({ text: token, type: parentType });
    } else if (token && typeof token === "object") {
      const type = mapTokenType(token.type, lang);
      if (Array.isArray(token.content)) result.push(...flattenTokens(token.content, lang, type));
      else if (token.content && typeof token.content === "object") result.push(...flattenTokens([token.content], lang, type));
      else result.push({ text: String(token.content ?? ""), type });
    }
  }
  return result.reduce((acc, cur) => {
    if (acc.length > 0 && acc[acc.length - 1].type === cur.type) {
      acc[acc.length - 1].text += cur.text;
    } else {
      acc.push(cur);
    }
    return acc;
  }, []);
}

export function tokenizeCode(code, language) {
  if (!code) return [];
  const normLang = normalizeLanguage(language);
  const grammar = PRISM_LANG_MAP[normLang] || Prism.languages.javascript;
  return grammar ? flattenTokens(Prism.tokenize(code, grammar), normLang) : [{ text: code, type: "plain" }];
}
