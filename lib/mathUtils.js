/**
 * Regex matching LaTeX mathematical delimiters:
 * 1. $$...$$ (Display math)
 * 2. \[...\] (Display math)
 * 3. \(...\) (Inline math)
 * 4. $...$   (Inline math: requires non-empty content not starting or ending with whitespace)
 */
export const MATH_DELIMITERS_REGEX =
  /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)|\$([^\$\n]+?)\$/g;

/**
 * Regex identifying bare LaTeX expressions without delimiters
 * (e.g. \frac{a}{b}, \text{H}_2\text{O}, \Delta G = ..., x^2 + y^2 = r^2)
 */
export const BARE_LATEX_COMMANDS =
  /\\(?:frac|dfrac|cfrac|sqrt|text|ext|mathrm|mathbf|mathit|mathsf|mathtt|vec|overline|underline|Delta|nabla|sum|prod|int|iint|alpha|beta|gamma|theta|lambda|mu|pi|sigma|omega|phi|psi|tau|rho|times|cdot|pm|mp|le|ge|leq|geq|neq|approx|equiv|rightarrow|leftarrow|Rightarrow|Leftarrow|rightleftharpoons|to|infty|partial|degree|circ|sin|cos|tan|log|ln)\b|(?:\^\{[^\}]+\})|(?:_\{[^\}]+\})|(?:\^[0-9a-zA-Z])|(?:_[0-9a-zA-Z])/;

/**
 * Regex identifying discrete bare LaTeX commands and formulas embedded in prose.
 * Handles nested braces for \frac, \sqrt, \text, Greek symbols with variables, and super/subscripts.
 */
export const BARE_INLINE_LATEX_REGEX =
  /(?:[a-zA-Z]\s*=\s*)?(?:\\(?:frac|dfrac|cfrac)\s*\{[^{}]*(?:\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}[^{}]*)*\}\s*\{[^{}]*(?:\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}[^{}]*)*\}|\\(?:sqrt)(?:\[[^\]]*\])?\s*\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}|\\(?:text|ext|mathrm|mathbf|mathit|mathsf|mathtt|vec|overline|underline|hat|dot|ddot)\s*\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}|\\(?:sum|prod|int|iint|iiint|oint)(?:_[^{}\s]+|\_\{[^{}]+\})?(?:\^[^{}\s]+|\^\{[^{}]+\})?|\\(?:Delta|nabla|alpha|beta|gamma|theta|lambda|mu|pi|sigma|omega|phi|psi|tau|rho|epsilon|varepsilon|eta|zeta|xi|kappa|chi)\b(?:\s+[a-zA-Z](?![a-zA-Z]))?|\\(?:times|cdot|pm|mp|approx|equiv|neq|le|ge|leq|geq|infty|partial|degree|circ|to|rightarrow|leftarrow|Rightarrow|Leftarrow|rightleftharpoons|propto)\b)(?:(?:\^\{[^{}]+\}|_\{[^{}]+\}|\^[0-9a-zA-Z]|_[0-9a-zA-Z]))*/g;

/**
 * Sanitizes input math text by repairing JSON escape corruption (such as \f becoming form feed
 * or \t becoming tab) and normalizing \ext typos to \text.
 */
export function sanitizeMathText(text) {
  if (text == null) return "";
  let str = String(text);
  return str
    // Repair control characters resulting from single-backslash JSON escaping
    .replace(/\u000c(?=rac\b)/g, "\\f")        // \u000crac -> \frac
    .replace(/\u0009(?=ext\b)/g, "\\t")        // \u0009ext -> \text
    .replace(/\u0009(?=au\b)/g, "\\t")         // \u0009au -> \tau
    .replace(/\u0009(?=heta\b)/g, "\\t")       // \u0009heta -> \theta
    .replace(/\u0009(?=imes\b)/g, "\\t")       // \u0009imes -> \times
    .replace(/\u0009(?=o\b)/g, "\\t")          // \u0009o -> \to
    .replace(/\r(?=(?:ho|ight|ightarrow)\b)/g, "\\r") // \rho, \right, \rightarrow
    .replace(/\u0008(?=(?:eta|mathbf|egin|ar|f)\b)/g, "\\b") // \beta, \mathbf, etc.
    // Normalize \ext macro / typo to \text
    .replace(/\\ext\b/g, "\\text");
}

/**
 * Determines whether a string is purely a standalone mathematical formula
 * (e.g. in quiz options like "\frac{-b \pm \sqrt{b^2 - 4ac}}{2a}") vs a prose sentence.
 */
export function isPureMathString(str) {
  const trimmed = (str || "").trim();
  if (!trimmed) return false;
  // Strip out \text{...} or \ext{...} blocks
  const strippedText = trimmed.replace(/\\(?:text|ext|mathrm|mathbf|mathit|mathsf|mathtt)\{[^}]*\}/g, "");
  // Strip out LaTeX commands and braces
  const strippedLatex = strippedText.replace(/\\[a-zA-Z]+/g, "").replace(/[{}]/g, "");
  // Count alphabetic words with length >= 3 in remaining text
  const words = strippedLatex.match(/[a-zA-Z]{3,}/g) || [];
  return words.length < 3;
}

/**
 * Extracts bare LaTeX formulas from a prose text segment.
 */
export function extractBareMathFromText(content) {
  if (!content) return [];
  BARE_INLINE_LATEX_REGEX.lastIndex = 0;
  if (!BARE_INLINE_LATEX_REGEX.test(content)) {
    return [{ type: "text", content }];
  }
  BARE_INLINE_LATEX_REGEX.lastIndex = 0;
  const segments = [];
  let lastIndex = 0;
  let match;
  while ((match = BARE_INLINE_LATEX_REGEX.exec(content)) !== null) {
    if (match.index > lastIndex) {
      segments.push({
        type: "text",
        content: content.slice(lastIndex, match.index),
      });
    }
    const mathContent = match[0].trim();
    if (mathContent) {
      segments.push({
        type: "inline_math",
        content: mathContent,
      });
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < content.length) {
    segments.push({
      type: "text",
      content: content.slice(lastIndex),
    });
  }
  return segments;
}

export function parseMathSegments(text) {
  if (text == null) return [];
  const str = sanitizeMathText(text);
  if (!str.trim()) return [{ type: "text", content: str }];

  // 1. Check for standard math delimiters ($$, \[\], \(\), $)
  MATH_DELIMITERS_REGEX.lastIndex = 0;
  if (MATH_DELIMITERS_REGEX.test(str)) {
    MATH_DELIMITERS_REGEX.lastIndex = 0;
    const segments = [];
    let lastIndex = 0;
    let match;

    while ((match = MATH_DELIMITERS_REGEX.exec(str)) !== null) {
      if (match.index > lastIndex) {
        const textSlice = str.slice(lastIndex, match.index);
        segments.push(...extractBareMathFromText(textSlice));
      }

      // Check which group matched
      const isDisplay = Boolean(match[1] || match[2]);
      const formula = (match[1] || match[2] || match[3] || match[4] || "").trim();

      if (formula) {
        segments.push({
          type: isDisplay ? "display_math" : "inline_math",
          content: formula,
        });
      } else {
        segments.push({ type: "text", content: match[0] });
      }

      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < str.length) {
      const textSlice = str.slice(lastIndex);
      segments.push(...extractBareMathFromText(textSlice));
    }

    return segments;
  }

  // 2. Pure bare LaTeX formula (e.g. multiple choice option)
  if (isPureMathString(str) && BARE_LATEX_COMMANDS.test(str)) {
    const trimmed = str.trim();
    return [{ type: "inline_math", content: trimmed }];
  }

  // 3. Prose text containing bare LaTeX formulas
  return extractBareMathFromText(str);
}
