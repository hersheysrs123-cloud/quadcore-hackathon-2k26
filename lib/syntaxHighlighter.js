/**
 * Syntax Highlighting definitions & tokenizers for 10 core languages:
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

export function normalizeLanguage(lang) {
  if (!lang) return "javascript";
  const lower = String(lang).toLowerCase().trim();
  for (const item of CORE_LANGUAGES) {
    if (item.id === lower || item.aliases.includes(lower)) {
      return item.id;
    }
  }
  return "javascript";
}

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

const RULES = {
  json: [
    { type: "comment", regex: /^(?:\/\/.*|\/\*[\s\S]*?\*\/)/ },
    { type: "json-key", regex: /^"([^"\\]|\\.)*"\s*(?=:)/ },
    { type: "string", regex: /^"([^"\\]|\\.)*"/ },
    { type: "number", regex: /^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/ },
    { type: "keyword", regex: /^(?:true|false|null)\b/ },
    { type: "punctuation", regex: /^[{}[\]:,]/ },
  ],
  html: [
    { type: "comment", regex: /^<!--[\s\S]*?-->/ },
    { type: "tag", regex: /^<\/?([a-zA-Z0-9-]+)/ },
    { type: "string", regex: /^("([^"\\]|\\.)*"|'([^'\\]|\\.)*')/ },
    { type: "attribute", regex: /^\s+([a-zA-Z0-9_-]+)(?=\s*=)/ },
    { type: "punctuation", regex: /^[</>=]/ },
  ],
  css: [
    { type: "comment", regex: /^\/\*[\s\S]*?\*\// },
    { type: "string", regex: /^("([^"\\]|\\.)*"|'([^'\\]|\\.)*')/ },
    { type: "keyword", regex: /^@(media|keyframes|import|font-face|charset|supports)\b/ },
    { type: "keyword", regex: /^[a-zA-Z0-9_-]+(?=\s*:)/ },
    { type: "number", regex: /^(?:#[0-9a-fA-F]{3,8}|\d+(\.\d+)?(?:px|rem|em|%|vh|vw|deg|s|ms)?)\b/ },
    { type: "type", regex: /^(?:[.#][a-zA-Z0-9_-]+|:(?:hover|focus|active|visited|before|after|nth-child\([^)]*\)))/ },
    { type: "punctuation", regex: /^[{}:;,]/ },
  ],
  sql: [
    { type: "comment", regex: /^(?:--.*|\/\*[\s\S]*?\*\/)/ },
    { type: "string", regex: /^(?:'([^'\\]|\\.)*'|"([^"\\]|\\.)*")/ },
    { type: "keyword", regex: /^(?:SELECT|FROM|WHERE|INSERT|INTO|UPDATE|SET|DELETE|JOIN|LEFT|RIGHT|INNER|OUTER|ON|GROUP|BY|HAVING|ORDER|ASC|DESC|LIMIT|OFFSET|CREATE|TABLE|ALTER|DROP|INDEX|PRIMARY|KEY|FOREIGN|REFERENCES|NULL|NOT|AND|OR|IN|LIKE|BETWEEN|AS|COUNT|SUM|AVG|MIN|MAX|CASE|WHEN|THEN|ELSE|END|UNION|ALL|EXISTS|DISTINCT|VALUES)\b/i },
    { type: "number", regex: /^\d+(\.\d+)?\b/ },
    { type: "operator", regex: /^[=><!+*/-]+/ },
    { type: "punctuation", regex: /^[(),;]/ },
  ],
  python: [
    { type: "comment", regex: /^#.*/ },
    { type: "string", regex: /^(?:"""[\s\S]*?"""|'''[\s\S]*?'''|[frb]?("([^"\\]|\\.)*"|'([^'\\]|\\.)*'))/ },
    { type: "decorator", regex: /^@[a-zA-Z0-9_.]+\b/ },
    { type: "keyword", regex: /^(?:def|class|return|if|elif|else|for|while|break|continue|pass|import|from|as|try|except|finally|raise|with|yield|lambda|assert|global|nonlocal|del|async|await|and|or|not|is|in|True|False|None)\b/ },
    { type: "builtin", regex: /^(?:print|len|range|str|int|float|list|dict|set|tuple|open|type|input|sum|max|min|abs|enumerate|zip|map|filter|super|isinstance|hasattr|getattr|setattr|self)\b/ },
    { type: "function", regex: /^[a-zA-Z_][a-zA-Z0-9_]*(?=\s*\()/ },
    { type: "number", regex: /^(?:0x[0-9a-fA-F]+|\d+(\.\d+)?)\b/ },
    { type: "operator", regex: /^[=><!+*/%&|^~-]+/ },
  ],
  javascript: [
    { type: "comment", regex: /^(?:\/\/.*|\/\*[\s\S]*?\*\/)/ },
    { type: "string", regex: /^(?:`[\s\S]*?`|"([^"\\]|\\.)*"|'([^'\\]|\\.)*')/ },
    { type: "keyword", regex: /^(?:const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|default|import|export|from|as|class|extends|super|this|new|try|catch|finally|throw|async|await|yield|typeof|instanceof|void|delete|in|of|null|undefined|true|false|NaN|Infinity)\b/ },
    { type: "builtin", regex: /^(?:console|Math|JSON|Object|Array|String|Number|Boolean|Set|Map|Date|RegExp|Error|window|document|fetch|setTimeout|setInterval|Promise)\b/ },
    { type: "function", regex: /^[a-zA-Z_$][a-zA-Z0-9_$]*(?=\s*\()/ },
    { type: "number", regex: /^(?:0x[0-9a-fA-F]+|0b[01]+|\d+(\.\d+)?)\b/ },
    { type: "operator", regex: /^(?:=>|\+\+|--|===|!==|==|!=|&&|\|\||\?\?|\?|:|[=><!+*/%&|^~-]+)/ },
  ],
  typescript: [
    { type: "comment", regex: /^(?:\/\/.*|\/\*[\s\S]*?\*\/)/ },
    { type: "string", regex: /^(?:`[\s\S]*?`|"([^"\\]|\\.)*"|'([^'\\]|\\.)*')/ },
    { type: "keyword", regex: /^(?:const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|default|import|export|from|as|class|extends|super|this|new|try|catch|finally|throw|async|await|yield|typeof|instanceof|void|delete|in|of|null|undefined|true|false|interface|type|enum|namespace|declare|abstract|implements|private|protected|public|readonly|override|keyof|never|unknown|any|satisfies|is|asserts)\b/ },
    { type: "type", regex: /^(?:string|number|boolean|symbol|bigint|object|any|unknown|never|void|Array|Record|Partial|Required|Readonly|Pick|Omit|Exclude|Extract|Promise)\b/ },
    { type: "builtin", regex: /^(?:console|Math|JSON|Object|Array|String|Number|Boolean|Set|Map|Date|RegExp|Error|window|document|fetch|setTimeout|setInterval)\b/ },
    { type: "function", regex: /^[a-zA-Z_$][a-zA-Z0-9_$]*(?=\s*\()/ },
    { type: "number", regex: /^(?:0x[0-9a-fA-F]+|0b[01]+|\d+(\.\d+)?)\b/ },
    { type: "operator", regex: /^(?:=>|\+\+|--|===|!==|==|!=|&&|\|\||\?\?|\?|:|[=><!+*/%&|^~-]+)/ },
  ],
  cpp: [
    { type: "comment", regex: /^(?:\/\/.*|\/\*[\s\S]*?\*\/)/ },
    { type: "keyword", regex: /^#\s*(?:include|define|ifndef|ifdef|endif|pragma|elif)\b.*/ },
    { type: "string", regex: /^(?:"([^"\\]|\\.)*"|'([^'\\]|\\.)*')/ },
    { type: "keyword", regex: /^(?:int|float|double|char|bool|void|auto|const|constexpr|struct|class|public|private|protected|template|typename|namespace|using|std|if|else|for|while|do|switch|case|break|continue|return|new|delete|try|catch|throw|nullptr|true|false|virtual|override|static|inline|friend|operator|sizeof)\b/ },
    { type: "builtin", regex: /^(?:cout|cin|endl|vector|string|map|set|pair|shared_ptr|unique_ptr|make_shared|make_unique)\b/ },
    { type: "function", regex: /^[a-zA-Z_][a-zA-Z0-9_]*(?=\s*\()/ },
    { type: "number", regex: /^(?:0x[0-9a-fA-F]+|\d+(\.\d+)?f?)\b/ },
  ],
  java: [
    { type: "comment", regex: /^(?:\/\/.*|\/\*[\s\S]*?\*\/)/ },
    { type: "decorator", regex: /^@[a-zA-Z0-9_]+\b/ },
    { type: "string", regex: /^(?:"([^"\\]|\\.)*"|'([^'\\]|\\.)*')/ },
    { type: "keyword", regex: /^(?:public|private|protected|class|interface|extends|implements|static|final|abstract|void|int|double|float|boolean|char|long|short|byte|return|if|else|for|while|do|switch|case|break|continue|try|catch|finally|throw|throws|new|this|super|instanceof|package|import|null|true|false|volatile|synchronized|transient|enum)\b/ },
    { type: "type", regex: /^(?:String|System|Math|Object|Integer|Double|Boolean|List|ArrayList|Map|HashMap|Set|HashSet|Exception|Thread|Override)\b/ },
    { type: "function", regex: /^[a-zA-Z_][a-zA-Z0-9_]*(?=\s*\()/ },
    { type: "number", regex: /^(?:0x[0-9a-fA-F]+|\d+(\.\d+)?[fL]?)\b/ },
  ],
  rust: [
    { type: "comment", regex: /^(?:\/\/.*|\/\*[\s\S]*?\*\/)/ },
    { type: "string", regex: /^(?:"([^"\\]|\\.)*"|'([^'\\]|\\.)*'|r#"[\s\S]*?"#)/ },
    { type: "builtin", regex: /^[a-zA-Z_][a-zA-Z0-9_]*!/ },
    { type: "keyword", regex: /^(?:fn|let|mut|const|static|struct|enum|trait|impl|pub|use|mod|crate|super|self|Self|type|where|if|else|match|loop|while|for|in|break|continue|return|unsafe|async|await|move|ref|dyn|true|false|Some|None|Ok|Err)\b/ },
    { type: "type", regex: /^(?:i32|i64|u32|u64|usize|isize|f32|f64|bool|char|str|String|Vec|Option|Result|Box)\b/ },
    { type: "function", regex: /^[a-zA-Z_][a-zA-Z0-9_]*(?=\s*\()/ },
    { type: "number", regex: /^(?:0x[0-9a-fA-F]+|\d+(\.\d+)?)\b/ },
  ],
};

export function tokenizeCode(code, language) {
  if (!code) return [];
  const normLang = normalizeLanguage(language);
  const rules = RULES[normLang] || RULES.javascript;

  let pos = 0;
  const tokens = [];

  while (pos < code.length) {
    const rest = code.slice(pos);
    let matched = false;

    for (const rule of rules) {
      const match = rule.regex.exec(rest);
      if (match && match.index === 0) {
        tokens.push({ text: match[0], type: rule.type });
        pos += match[0].length;
        matched = true;
        break;
      }
    }

    if (!matched) {
      const char = code[pos];
      if (
        tokens.length > 0 &&
        (!tokens[tokens.length - 1].type || tokens[tokens.length - 1].type === "plain")
      ) {
        tokens[tokens.length - 1].text += char;
      } else {
        tokens.push({ text: char, type: "plain" });
      }
      pos++;
    }
  }

  return tokens;
}
