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
  /\\(?:frac|sqrt|text|mathrm|mathbf|vec|overline|underline|Delta|nabla|sum|prod|int|iint|alpha|beta|gamma|theta|lambda|mu|pi|sigma|omega|phi|psi|times|cdot|pm|mp|le|ge|leq|geq|neq|approx|equiv|rightarrow|leftarrow|Rightarrow|Leftarrow|rightleftharpoons|to|infty|partial|degree|circ|sin|cos|tan|log|ln)\b|(?:\^\{[^\}]+\})|(?:_\{[^\}]+\})|(?:\^[0-9a-zA-Z])|(?:_[0-9a-zA-Z])/;

export function parseMathSegments(text) {
  if (text == null) return [];
  const str = String(text);
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
        segments.push({
          type: "text",
          content: str.slice(lastIndex, match.index),
        });
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
      segments.push({
        type: "text",
        content: str.slice(lastIndex),
      });
    }

    return segments;
  }

  // 2. Check if the entire string looks like a bare LaTeX formula
  if (BARE_LATEX_COMMANDS.test(str)) {
    const trimmed = str.trim();
    return [{ type: "inline_math", content: trimmed }];
  }

  return [{ type: "text", content: str }];
}
