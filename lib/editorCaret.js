import katex from "katex";

// ─── KaTeX LRU Memoization Cache ─────────────────────────────────────
const KATEX_STRING_CACHE = new Map();

export const KATEX_GLOBAL_MACROS = {
  "\\reflectbox": "\\htmlClass{reflect-flip}{#1}",
  "\\ext": "\\text{#1}",
};

export function renderKatexToStringMemoized(formula, options = {}) {
  const key = `${formula}::${Boolean(options.displayMode)}`;
  if (KATEX_STRING_CACHE.has(key)) return KATEX_STRING_CACHE.get(key);
  try {
    const html = katex.renderToString(formula || "", {
      displayMode: Boolean(options.displayMode),
      throwOnError: false,
      trust: true,
      strict: false,
      macros: {
        ...KATEX_GLOBAL_MACROS,
        ...(options.macros || {}),
      },
      ...options,
    });
    if (KATEX_STRING_CACHE.size > 500) {
      KATEX_STRING_CACHE.delete(KATEX_STRING_CACHE.keys().next().value);
    }
    KATEX_STRING_CACHE.set(key, html);
    return html;
  } catch {
    return escapeHtml(formula || "");
  }
}

export function escapeHtml(str) {
  return (str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function cleanZeroWidth(str) {
  if (!str) return "";
  return String(str).replace(/[\u200B\u200C\u200D\u2060\uFEFF\u0000]/g, "");
}

export function formatMarkdownInline(text) {
  if (!text) return "";

  // 1. Math tokens ($formula$ or $$formula$$)
  const mathTokens = [];
  let processed = String(text).replace(/\$\$([^$]+)\$\$|\$([^\s$](?:[^$\n]*[^\s$])?)\$/g, (match, dFormula, sFormula) => {
    const formula = (dFormula || sFormula || "").trim();
    if (!formula) return match;
    const token = `\u0000MATH_${mathTokens.length}\u0000`;
    let katexHtml = "";
    try {
      katexHtml = renderKatexToStringMemoized(formula, {
        displayMode: false,
        throwOnError: false,
      });
    } catch (e) {
      katexHtml = escapeHtml(match);
    }
    const escapedFormula = formula.replace(/"/g, "&quot;");
    mathTokens.push(
      `<span class="katex-inline-node inline-flex items-center mx-0.5 px-1 py-0.5 rounded cursor-pointer transition-colors select-none text-ink-100 hover:bg-ink-800/60" data-formula="${escapedFormula}" contenteditable="false">${katexHtml}</span>`
    );
    return token;
  });

  // 2. Code tokens (`code`)
  const codeTokens = [];
  processed = processed.replace(/`([^`\n]+)`/g, (match, code) => {
    const token = `\u0000CODE_${codeTokens.length}\u0000`;
    codeTokens.push(
      `<code class="rounded px-1.5 py-0.5 font-mono text-[13px] bg-ink-800 text-duck-300 border border-ink-700 font-normal">${escapeHtml(code)}</code>`
    );
    return token;
  });

  // 3. Links ([text](url))
  const linkTokens = [];
  processed = processed.replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+|mailto:[^\s)]+|#[^\s)]+)\)/g, (match, linkText, url) => {
    const token = `\u0000LINK_${linkTokens.length}\u0000`;
    linkTokens.push(
      `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" class="text-duck-400 underline decoration-duck-500/50 hover:text-duck-300 cursor-pointer" contenteditable="false">${escapeHtml(linkText)}</a>`
    );
    return token;
  });

  // 3b. Underline (<u>text</u> or <ins>text</ins>)
  const underlineTokens = [];
  processed = processed.replace(/<u>([^<\n]+)<\/u>|<ins>([^<\n]+)<\/ins>/gi, (match, u1, u2) => {
    const uText = u1 || u2 || "";
    const token = `\u0000U_${underlineTokens.length}\u0000`;
    underlineTokens.push(
      `<u class="underline decoration-ink-400 decoration-1 underline-offset-2">${escapeHtml(uText)}</u>`
    );
    return token;
  });

  // 4. Escape HTML for the remaining content
  processed = escapeHtml(processed);

  // 5. Bold & Italic (***text***, ___text___, **_text_**, _**text**_)
  processed = processed.replace(/\*\*\*([^\n]+?)\*\*\*/g, '<strong class="font-bold text-ink-100"><em class="italic text-ink-200">$1</em></strong>');
  processed = processed.replace(/___([^\n]+?)___/g, '<strong class="font-bold text-ink-100"><em class="italic text-ink-200">$1</em></strong>');
  processed = processed.replace(/\*\*_\s*([^\n]+?)\s*_\*\*/g, '<strong class="font-bold text-ink-100"><em class="italic text-ink-200">$1</em></strong>');
  processed = processed.replace(/_\*\*\s*([^\n]+?)\s*\*\*_(?=\s|$|[.,;:!?<)\]])/g, '<strong class="font-bold text-ink-100"><em class="italic text-ink-200">$1</em></strong>');

  // 6. Bold (**text** or __text__, allowing single * inside)
  processed = processed.replace(/\*\*(?!\s)((?:[^*\n]|\*(?!\*))+?)(?<!\s)\*\*/g, '<strong class="font-bold text-ink-100">$1</strong>');
  processed = processed.replace(/__(?!\s)((?:[^_\n]|_(?!_))+?)(?<!\s)__/g, '<strong class="font-bold text-ink-100">$1</strong>');

  // 7. Italic (*text* or _text_)
  processed = processed.replace(/(?<!\*)\*(?!\s)([^*\n]+?)(?<!\s)\*(?!\*)/g, '<em class="italic text-ink-200">$1</em>');
  processed = processed.replace(/(^|\s|>|[(])_(?!\s)([^_\n]+?)(?<!\s)_(?=\s|$|[.,;:!?<)\]])/g, '$1<em class="italic text-ink-200">$2</em>');

  // 8. Strikethrough (~~text~~)
  processed = processed.replace(/~~([^~\n]+)~~/g, '<del class="line-through text-ink-500">$1</del>');

  // 9. Highlight (==text==)
  processed = processed.replace(/==([^=\n]+)==/g, '<mark class="bg-duck-500/25 text-duck-200 px-1 py-0.5 rounded font-medium">$1</mark>');

  // 10. Restore tokens
  underlineTokens.forEach((uHtml, idx) => {
    processed = processed.replace(`\u0000U_${idx}\u0000`, uHtml);
  });
  linkTokens.forEach((linkHtml, idx) => {
    processed = processed.replace(`\u0000LINK_${idx}\u0000`, linkHtml);
  });
  codeTokens.forEach((codeHtml, idx) => {
    processed = processed.replace(`\u0000CODE_${idx}\u0000`, codeHtml);
  });
  mathTokens.forEach((mathHtml, idx) => {
    processed = processed.replace(`\u0000MATH_${idx}\u0000`, mathHtml);
  });

  return processed;
}

export function setBlockDOMFromText(domNode, text, blockType = "text") {
  if (!domNode) return;
  let textToFormat = text || "";
  if (blockType === "inlinemath" && textToFormat && !textToFormat.includes("$")) {
    textToFormat = `$${textToFormat}$`;
  }
  domNode.innerHTML = formatMarkdownInline(textToFormat);
  // Ensure boundary text nodes exist around inline code / math elements for smooth caret placement
  if (domNode.firstChild && domNode.firstChild.nodeType === 1 /* Element */) {
    domNode.insertBefore(document.createTextNode(""), domNode.firstChild);
  }
  if (domNode.lastChild && domNode.lastChild.nodeType === 1 /* Element */) {
    domNode.appendChild(document.createTextNode(""));
  }
}

export function tryAutoFormatInlineCode(el) {
  if (!el || typeof window === "undefined") return false;
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount || !sel.isCollapsed) return false;
  const range = sel.getRangeAt(0);
  const container = range.startContainer;
  const offset = range.startOffset;

  if (container.nodeType !== 3) return false;
  if (container.parentElement && container.parentElement.closest("code:not(.code-block)")) {
    return false;
  }

  const textBefore = container.nodeValue.substring(0, offset);
  const match = textBefore.match(/`([^`\n]+)`$/);
  if (match) {
    const codeContent = match[1];
    const matchStart = offset - match[0].length;

    const beforeText = textBefore.substring(0, matchStart);
    const afterText = container.nodeValue.substring(offset);

    const codeEl = document.createElement("code");
    codeEl.className =
      "rounded px-1.5 py-0.5 font-mono text-[13px] bg-ink-800 text-duck-300 border border-ink-700 font-normal selection:bg-duck-500/30 selection:text-duck-200";
    codeEl.textContent = codeContent;

    const needsSpace = afterText.length === 0 || (!/^[,\.!?;:\)\]\}\s]/.test(afterText) && !afterText.startsWith(" "));
    const insertPrefix = needsSpace ? " " : "";
    const trailingText = document.createTextNode(insertPrefix + afterText);
    container.nodeValue = beforeText;

    const parent = container.parentNode;
    parent.insertBefore(trailingText, container.nextSibling);
    parent.insertBefore(codeEl, trailingText);

    const newRange = document.createRange();
    const caretPos = insertPrefix.length;
    newRange.setStart(trailingText, caretPos);
    newRange.setEnd(trailingText, caretPos);
    sel.removeAllRanges();
    sel.addRange(newRange);

    return true;
  }
  return false;
}

export function tryAutoFormatInlineMath(el) {
  if (!el || typeof window === "undefined") return false;
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount || !sel.isCollapsed) return false;
  const range = sel.getRangeAt(0);
  const container = range.startContainer;
  const offset = range.startOffset;

  if (container.nodeType !== 3) return false;
  if (container.parentElement && container.parentElement.closest(".katex-inline-node, code:not(.code-block)")) {
    return false;
  }

  const textBefore = container.nodeValue.substring(0, offset);
  const match = textBefore.match(/\$([^\s$](?:[^$\n]*[^\s$])?)\$$/);
  if (match) {
    const formula = match[1];
    const matchStart = offset - match[0].length;

    const beforeText = textBefore.substring(0, matchStart);
    const afterText = container.nodeValue.substring(offset);

    let katexHtml = "";
    try {
      katexHtml = renderKatexToStringMemoized(formula, { displayMode: false, throwOnError: false });
    } catch (_) {
      katexHtml = escapeHtml(match[0]);
    }

    const escapedFormula = formula.replace(/"/g, "&quot;");
    const mathSpan = document.createElement("span");
    mathSpan.className =
      "katex-inline-node inline-flex items-center mx-0.5 px-1 py-0.5 rounded cursor-pointer transition-colors select-none text-ink-100 hover:bg-ink-800/60";
    mathSpan.setAttribute("data-formula", formula);
    mathSpan.setAttribute("contenteditable", "false");
    mathSpan.innerHTML = katexHtml;

    const needsSpace = afterText.length === 0 || (!/^[,\.!?;:\)\]\}\s]/.test(afterText) && !afterText.startsWith(" "));
    const insertPrefix = needsSpace ? " " : "";
    const trailingText = document.createTextNode(insertPrefix + afterText);
    container.nodeValue = beforeText;

    const parent = container.parentNode;
    parent.insertBefore(trailingText, container.nextSibling);
    parent.insertBefore(mathSpan, trailingText);

    const newRange = document.createRange();
    const caretPos = insertPrefix.length;
    newRange.setStart(trailingText, caretPos);
    newRange.setEnd(trailingText, caretPos);
    sel.removeAllRanges();
    sel.addRange(newRange);

    return true;
  }
  return false;
}

export function handleInlineBoundaryKeyDown(e) {
  if (typeof window === "undefined") return false;
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount || !sel.isCollapsed) return false;
  const range = sel.getRangeAt(0);
  const container = range.startContainer;
  const offset = range.startOffset;

  // ─── A. Handle .katex-inline-node (Inline Math Pills) ───
  // 1. Text node immediately following a KaTeX pill
  if (container.nodeType === 3 && offset === 0) {
    const prevSibling = container.previousSibling;
    if (prevSibling && prevSibling.classList?.contains("katex-inline-node")) {
      // ArrowLeft: step over KaTeX pill to the left
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        let targetText = prevSibling.previousSibling;
        if (!targetText || targetText.nodeType !== 3) {
          targetText = document.createTextNode("");
          prevSibling.parentNode.insertBefore(targetText, prevSibling);
        }
        const newRange = document.createRange();
        newRange.setStart(targetText, targetText.length);
        newRange.setEnd(targetText, targetText.length);
        sel.removeAllRanges();
        sel.addRange(newRange);
        return true;
      }
      // Backspace: delete KaTeX pill atomically
      if (e.key === "Backspace") {
        e.preventDefault();
        const parent = prevSibling.parentNode;
        let targetText = prevSibling.previousSibling;
        if (!targetText || targetText.nodeType !== 3) {
          targetText = document.createTextNode("");
          parent.insertBefore(targetText, prevSibling);
        }
        const endPos = targetText.length;
        prevSibling.remove();
        const newRange = document.createRange();
        newRange.setStart(targetText, endPos);
        newRange.setEnd(targetText, endPos);
        sel.removeAllRanges();
        sel.addRange(newRange);
        const editableParent = parent.closest?.("[contenteditable='true']") || parent;
        editableParent?.dispatchEvent?.(new Event("input", { bubbles: true }));
        return true;
      }
    }
  }

  // 2. Text node immediately preceding a KaTeX pill
  if (container.nodeType === 3 && offset === container.length) {
    const nextSibling = container.nextSibling;
    if (nextSibling && nextSibling.classList?.contains("katex-inline-node")) {
      // ArrowRight: step over KaTeX pill to the right
      if (e.key === "ArrowRight") {
        e.preventDefault();
        let targetText = nextSibling.nextSibling;
        if (!targetText || targetText.nodeType !== 3) {
          targetText = document.createTextNode("");
          nextSibling.parentNode.insertBefore(targetText, nextSibling.nextSibling);
        }
        const newRange = document.createRange();
        newRange.setStart(targetText, 0);
        newRange.setEnd(targetText, 0);
        sel.removeAllRanges();
        sel.addRange(newRange);
        return true;
      }
      // Delete: delete KaTeX pill atomically
      if (e.key === "Delete") {
        e.preventDefault();
        const parent = nextSibling.parentNode;
        nextSibling.remove();
        const newRange = document.createRange();
        newRange.setStart(container, offset);
        newRange.setEnd(container, offset);
        sel.removeAllRanges();
        sel.addRange(newRange);
        const editableParent = parent.closest?.("[contenteditable='true']") || parent;
        editableParent?.dispatchEvent?.(new Event("input", { bubbles: true }));
        return true;
      }
    }
  }

  // 3. Container element with child indexing targeting KaTeX pill
  if (container.nodeType === 1) {
    if (offset < container.childNodes.length) {
      const targetChild = container.childNodes[offset];
      if (targetChild && targetChild.classList?.contains("katex-inline-node")) {
        if (e.key === "ArrowRight") {
          e.preventDefault();
          let nextText = targetChild.nextSibling;
          if (!nextText || nextText.nodeType !== 3) {
            nextText = document.createTextNode("");
            targetChild.parentNode.insertBefore(nextText, targetChild.nextSibling);
          }
          const newRange = document.createRange();
          newRange.setStart(nextText, 0);
          newRange.setEnd(nextText, 0);
          sel.removeAllRanges();
          sel.addRange(newRange);
          return true;
        }
        if (e.key === "Delete") {
          e.preventDefault();
          let prevText = targetChild.previousSibling;
          if (!prevText || prevText.nodeType !== 3) {
            prevText = document.createTextNode("");
            targetChild.parentNode.insertBefore(prevText, targetChild);
          }
          const endPos = prevText.length;
          targetChild.remove();
          const newRange = document.createRange();
          newRange.setStart(prevText, endPos);
          newRange.setEnd(prevText, endPos);
          sel.removeAllRanges();
          sel.addRange(newRange);
          const editableParent = container.closest?.("[contenteditable='true']") || container;
          editableParent?.dispatchEvent?.(new Event("input", { bubbles: true }));
          return true;
        }
      }
    }

    if (offset > 0) {
      const targetChild = container.childNodes[offset - 1];
      if (targetChild && targetChild.classList?.contains("katex-inline-node")) {
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          let prevText = targetChild.previousSibling;
          if (!prevText || prevText.nodeType !== 3) {
            prevText = document.createTextNode("");
            targetChild.parentNode.insertBefore(prevText, targetChild);
          }
          const newRange = document.createRange();
          newRange.setStart(prevText, prevText.length);
          newRange.setEnd(prevText, prevText.length);
          sel.removeAllRanges();
          sel.addRange(newRange);
          return true;
        }
        if (e.key === "Backspace") {
          e.preventDefault();
          let prevText = targetChild.previousSibling;
          if (!prevText || prevText.nodeType !== 3) {
            prevText = document.createTextNode("");
            targetChild.parentNode.insertBefore(prevText, targetChild);
          }
          const endPos = prevText.length;
          targetChild.remove();
          const newRange = document.createRange();
          newRange.setStart(prevText, endPos);
          newRange.setEnd(prevText, endPos);
          sel.removeAllRanges();
          sel.addRange(newRange);
          const editableParent = container.closest?.("[contenteditable='true']") || container;
          editableParent?.dispatchEvent?.(new Event("input", { bubbles: true }));
          return true;
        }
      }
    }
  }

  // ─── B. Handle inline <code> elements ───
  const codeEl =
    container.nodeType === 1
      ? container.closest("code:not(.code-block)")
      : container.parentElement?.closest("code:not(.code-block)");

  if (codeEl) {
    const textLen = codeEl.textContent.length;

    // 1. Space at the end of inline code -> Exit code pill and insert space in normal text
    if (offset >= textLen && e.key === " ") {
      e.preventDefault();
      let nextNode = codeEl.nextSibling;
      if (!nextNode || nextNode.nodeType !== 3) {
        nextNode = document.createTextNode(" ");
        codeEl.parentNode.insertBefore(nextNode, codeEl.nextSibling);
      } else {
        nextNode.nodeValue = " " + (nextNode.nodeValue || "");
      }
      const newRange = document.createRange();
      newRange.setStart(nextNode, 1);
      newRange.setEnd(nextNode, 1);
      sel.removeAllRanges();
      sel.addRange(newRange);
      const editableParent = codeEl.closest("[contenteditable='true']");
      editableParent?.dispatchEvent(new Event("input", { bubbles: true }));
      return true;
    }

    // 2. ArrowRight at the end of inline code -> Step outside to the right into normal text
    if (offset >= textLen && e.key === "ArrowRight") {
      e.preventDefault();
      let nextNode = codeEl.nextSibling;
      if (!nextNode || nextNode.nodeType !== 3) {
        nextNode = document.createTextNode("");
        codeEl.parentNode.insertBefore(nextNode, codeEl.nextSibling);
      }
      const newRange = document.createRange();
      newRange.setStart(nextNode, 0);
      newRange.setEnd(nextNode, 0);
      sel.removeAllRanges();
      sel.addRange(newRange);
      return true;
    }

    // 3. ArrowLeft at the start of inline code -> Step outside to the left into normal text
    if (offset === 0 && e.key === "ArrowLeft") {
      e.preventDefault();
      let prevNode = codeEl.previousSibling;
      if (!prevNode || prevNode.nodeType !== 3) {
        prevNode = document.createTextNode("");
        codeEl.parentNode.insertBefore(prevNode, codeEl);
      }
      const newRange = document.createRange();
      const endPos = prevNode.length || 0;
      newRange.setStart(prevNode, endPos);
      newRange.setEnd(prevNode, endPos);
      sel.removeAllRanges();
      sel.addRange(newRange);
      return true;
    }

    // 4. Backspace inside empty code element -> delete code tag cleanly
    if (textLen === 0 && (e.key === "Backspace" || e.key === "Delete")) {
      e.preventDefault();
      const parent = codeEl.parentNode;
      let prevNode = codeEl.previousSibling;
      if (!prevNode || prevNode.nodeType !== 3) {
        prevNode = document.createTextNode("");
        parent.insertBefore(prevNode, codeEl);
      }
      codeEl.remove();
      const newRange = document.createRange();
      const endPos = prevNode.length || 0;
      newRange.setStart(prevNode, endPos);
      newRange.setEnd(prevNode, endPos);
      sel.removeAllRanges();
      sel.addRange(newRange);
      const editableParent = parent.closest?.("[contenteditable='true']") || parent;
      editableParent?.dispatchEvent?.(new Event("input", { bubbles: true }));
      return true;
    }
  }
  return false;
}

export function setCaretToEnd(el) {
  if (!el) return;
  if (typeof el.focus === "function") el.focus();
  if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
    const len = el.value ? el.value.length : 0;
    el.setSelectionRange?.(len, len);
    return;
  }
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const sel = window.getSelection();
  if (!sel) return;

  // Ensure last child has an editable text node if ending with uneditable element
  if (
    el.lastChild &&
    el.lastChild.nodeType === 1 &&
    (el.lastChild.classList?.contains("katex-inline-node") || el.lastChild.getAttribute?.("contenteditable") === "false")
  ) {
    el.appendChild(document.createTextNode(""));
  }

  const range = document.createRange();
  let lastNode = null;
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (node.parentElement && node.parentElement.closest(".katex-inline-node")) {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  let node;
  while ((node = walker.nextNode())) {
    lastNode = node;
  }

  if (lastNode && lastNode.nodeType === 3 /* Node.TEXT_NODE */) {
    range.setStart(lastNode, lastNode.length);
    range.setEnd(lastNode, lastNode.length);
  } else {
    if (!el.lastChild || el.lastChild.nodeType !== 3) {
      el.appendChild(document.createTextNode(""));
    }
    if (el.lastChild && el.lastChild.nodeType === 3) {
      range.setStart(el.lastChild, el.lastChild.length);
      range.setEnd(el.lastChild, el.lastChild.length);
    } else {
      range.selectNodeContents(el);
      range.collapse(false);
    }
  }
  sel.removeAllRanges();
  sel.addRange(range);
}

export function setCaretToStart(el) {
  if (!el) return;
  if (typeof el.focus === "function") el.focus();
  if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
    el.setSelectionRange?.(0, 0);
    return;
  }
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const sel = window.getSelection();
  if (!sel) return;

  // Ensure first child has an editable text node if starting with uneditable element
  if (
    el.firstChild &&
    el.firstChild.nodeType === 1 &&
    (el.firstChild.classList?.contains("katex-inline-node") || el.firstChild.getAttribute?.("contenteditable") === "false")
  ) {
    el.insertBefore(document.createTextNode(""), el.firstChild);
  }

  const range = document.createRange();
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (node.parentElement && node.parentElement.closest(".katex-inline-node")) {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  const firstNode = walker.nextNode();

  if (firstNode && firstNode.nodeType === 3 /* Node.TEXT_NODE */) {
    range.setStart(firstNode, 0);
    range.setEnd(firstNode, 0);
  } else {
    if (!el.firstChild || el.firstChild.nodeType !== 3) {
      el.insertBefore(document.createTextNode(""), el.firstChild);
    }
    if (el.firstChild && el.firstChild.nodeType === 3) {
      range.setStart(el.firstChild, 0);
      range.setEnd(el.firstChild, 0);
    } else {
      range.selectNodeContents(el);
      range.collapse(true);
    }
  }
  sel.removeAllRanges();
  sel.addRange(range);
}

export function getDOMCaretLength(el) {
  if (!el) return 0;
  if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
    return el.value ? el.value.length : 0;
  }
  if (typeof document === "undefined") {
    return (el.textContent || el.innerText || "").length;
  }
  let length = 0;
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
    acceptNode(node) {
      if (node.nodeType === 1) {
        if (node.classList && node.classList.contains("katex-inline-node")) {
          return NodeFilter.FILTER_ACCEPT;
        }
        return NodeFilter.FILTER_SKIP;
      }
      if (node.parentElement && node.parentElement.closest(".katex-inline-node")) {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  let node;
  while ((node = walker.nextNode())) {
    if (node.nodeType === 1) {
      const formula = node.getAttribute("data-formula") || "";
      length += formula.length + 2;
    } else {
      length += node.length || 0;
    }
  }
  return length;
}

export function setCaretAtOffset(el, targetOffset) {
  if (!el) return;
  if (typeof el.focus === "function") el.focus();
  if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
    el.setSelectionRange?.(targetOffset, targetOffset);
    return;
  }
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const sel = window.getSelection();
  if (!sel) return;

  try {
    let charCount = 0;
    let found = false;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
      acceptNode(node) {
        if (node.nodeType === 1 /* Node.ELEMENT_NODE */) {
          if (node.classList && node.classList.contains("katex-inline-node")) {
            return NodeFilter.FILTER_ACCEPT;
          }
          return NodeFilter.FILTER_SKIP;
        }
        if (node.parentElement && node.parentElement.closest(".katex-inline-node")) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    });

    let node;
    while ((node = walker.nextNode())) {
      let nodeLen = 0;
      if (node.nodeType === 1 /* Math Pill Element */) {
        const formula = node.getAttribute("data-formula") || "";
        nodeLen = formula.length + 2;
      } else {
        nodeLen = node.length;
      }

      const nextCount = charCount + nodeLen;
      if (targetOffset <= nextCount) {
        const r = document.createRange();
        if (node.nodeType === 1 /* Math Pill */) {
          if (targetOffset <= charCount + nodeLen / 2) {
            let prev = node.previousSibling;
            if (!prev || prev.nodeType !== 3) {
              prev = document.createTextNode("");
              node.parentNode.insertBefore(prev, node);
            }
            r.setStart(prev, prev.length);
            r.setEnd(prev, prev.length);
          } else {
            let next = node.nextSibling;
            if (!next || next.nodeType !== 3) {
              next = document.createTextNode("");
              node.parentNode.insertBefore(next, node.nextSibling);
            }
            r.setStart(next, 0);
            r.setEnd(next, 0);
          }
        } else {
          const offsetInNode = Math.min(node.length, Math.max(0, targetOffset - charCount));
          const parentEl = node.parentElement;
          const isFormattingTag = parentEl && parentEl !== el && /^(strong|b|em|i|u|ins|del|s|code|mark)$/i.test(parentEl.tagName);

          if (offsetInNode === node.length && isFormattingTag && !node.nextSibling) {
            // Caret is at the boundary end of a formatted inline element (e.g. **bold**).
            // Place caret in a trailing text node outside the formatting tag so new characters are unstyled!
            let outsideNode = parentEl.nextSibling;
            if (!outsideNode || outsideNode.nodeType !== 3) {
              outsideNode = document.createTextNode("");
              parentEl.parentNode?.insertBefore(outsideNode, parentEl.nextSibling);
            }
            r.setStart(outsideNode, 0);
            r.setEnd(outsideNode, 0);
          } else {
            r.setStart(node, offsetInNode);
            r.setEnd(node, offsetInNode);
          }
        }
        sel.removeAllRanges();
        sel.addRange(r);
        found = true;
        break;
      }
      charCount = nextCount;
    }
    if (!found) {
      setCaretToEnd(el);
    }
  } catch (_) {
    setCaretToEnd(el);
  }
}

export function isCaretAtLogicalStart(el, customRange = null) {
  if (!el) return false;
  if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
    return el.selectionStart === 0 && el.selectionEnd === 0;
  }
  if (typeof window === "undefined" || typeof document === "undefined") return false;
  const sel = window.getSelection();
  if (!sel || (!customRange && (!sel.rangeCount || !sel.isCollapsed))) return false;
  const range = customRange || sel.getRangeAt(0);
  if (!el.contains(range.startContainer) && el !== range.startContainer) return false;

  const textBefore = getSerializedTextFromRange(el, range.startContainer, range.startOffset);
  return cleanZeroWidth(textBefore).length === 0;
}

export function isCaretAtBlockStart(container, range) {
  return isCaretAtLogicalStart(container, range);
}

export function isCaretAtLogicalEnd(el, customRange = null) {
  if (!el) return false;
  if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
    const len = el.value ? el.value.length : 0;
    return el.selectionStart === len && el.selectionEnd === len;
  }
  if (typeof window === "undefined" || typeof document === "undefined") return false;
  const sel = window.getSelection();
  if (!sel || (!customRange && (!sel.rangeCount || !sel.isCollapsed))) return false;
  const range = customRange || sel.getRangeAt(0);
  if (!el.contains(range.endContainer) && el !== range.endContainer) return false;

  const textBefore = getSerializedTextFromRange(el, range.endContainer, range.endOffset);
  const fullText = getBlockTextFromDOM(el);
  const cleanBefore = cleanZeroWidth(textBefore);
  const cleanFull = cleanZeroWidth(fullText).replace(/\n$/, "");
  return cleanBefore.length >= cleanFull.length;
}

export function isCaretAtBlockEnd(container, range) {
  return isCaretAtLogicalEnd(container, range);
}

export function isCaretOnFirstVisualLine(container, range) {
  if (!container || !range) return false;
  if (isCaretAtBlockStart(container, range)) return true;
  try {
    const rangeRect = range.getBoundingClientRect?.();
    const containerRect = container.getBoundingClientRect?.();
    if (!rangeRect || !containerRect || rangeRect.height === 0 || containerRect.height === 0) {
      return isCaretAtBlockStart(container, range);
    }

    // Precise DOM line comparison: compare caret top with first character top in container
    if (typeof document !== "undefined" && document.createRange) {
      const startRange = document.createRange();
      startRange.selectNodeContents(container);
      startRange.collapse(true);
      const startRect = startRange.getBoundingClientRect?.();
      if (startRect && startRect.height > 0) {
        const lineH = Math.max(16, rangeRect.height, startRect.height);
        if (Math.abs(rangeRect.top - startRect.top) <= lineH * 0.75) {
          return true;
        }
      }
    }

    // Fallback based on computed padding/line-height or 28px default
    let threshold = 28;
    if (typeof window !== "undefined" && window.getComputedStyle) {
      const style = window.getComputedStyle(container);
      const paddingTop = parseFloat(style.paddingTop) || 0;
      const fontSize = parseFloat(style.fontSize) || 16;
      const lineHeight = parseFloat(style.lineHeight) || (fontSize * 1.35);
      threshold = Math.max(28, paddingTop + lineHeight * 0.6);
    }
    return rangeRect.top - containerRect.top <= threshold;
  } catch (_) {
    return isCaretAtBlockStart(container, range);
  }
}

export function isCaretOnLastVisualLine(container, range) {
  if (!container || !range) return false;
  if (isCaretAtBlockEnd(container, range)) return true;
  try {
    const rangeRect = range.getBoundingClientRect?.();
    const containerRect = container.getBoundingClientRect?.();
    if (!rangeRect || !containerRect || rangeRect.height === 0 || containerRect.height === 0) {
      return isCaretAtBlockEnd(container, range);
    }

    // Precise DOM line comparison: compare caret bottom with last character bottom in container
    if (typeof document !== "undefined" && document.createRange) {
      const endRange = document.createRange();
      endRange.selectNodeContents(container);
      endRange.collapse(false);
      const endRect = endRange.getBoundingClientRect?.();
      if (endRect && endRect.height > 0) {
        const lineH = Math.max(16, rangeRect.height, endRect.height);
        if (Math.abs(endRect.bottom - rangeRect.bottom) <= lineH * 0.75) {
          return true;
        }
      }
    }

    // Fallback based on computed padding/line-height or 28px default
    let threshold = 28;
    if (typeof window !== "undefined" && window.getComputedStyle) {
      const style = window.getComputedStyle(container);
      const paddingBottom = parseFloat(style.paddingBottom) || 0;
      const fontSize = parseFloat(style.fontSize) || 16;
      const lineHeight = parseFloat(style.lineHeight) || (fontSize * 1.35);
      threshold = Math.max(28, paddingBottom + lineHeight * 0.6);
    }
    return containerRect.bottom - rangeRect.bottom <= threshold;
  } catch (_) {
    return isCaretAtBlockEnd(container, range);
  }
}

export function getBlockTextFromDOM(domNode) {
  if (!domNode) return "";

  function walk(node) {
    if (node.nodeType === 3 /* Node.TEXT_NODE */) {
      return cleanZeroWidth(node.nodeValue || "");
    }
    if (node.nodeType !== 1 /* Node.ELEMENT_NODE */) {
      return "";
    }

    // 1. Math Pill - return formula ONLY, do not traverse KaTeX children
    if (node.classList && node.classList.contains("katex-inline-node")) {
      const formula = node.getAttribute("data-formula") || "";
      return `$${cleanZeroWidth(formula)}$`;
    }

    // Guard: If inside a KaTeX internal element, skip
    if (node.classList && (node.classList.contains("katex") || node.classList.contains("katex-html"))) {
      const pill = node.closest(".katex-inline-node");
      if (pill) return "";
      const formula = node.getAttribute("data-formula") || "";
      return formula ? `$${cleanZeroWidth(formula)}$` : "";
    }

    const tag = node.tagName.toLowerCase();

    // Line break (guard against solitary browser placeholder <br> in empty block)
    if (tag === "br") {
      if (node.parentNode === domNode && domNode.childNodes.length === 1) {
        return "";
      }
      return "\n";
    }

    let inner = "";
    for (const child of node.childNodes) {
      inner += walk(child);
    }

    // Bold
    if (tag === "strong" || tag === "b") {
      return inner ? `**${inner}**` : "";
    }

    // Italic
    if (tag === "em" || tag === "i") {
      return inner ? `*${inner}*` : "";
    }

    // Code
    if (tag === "code" && !node.classList.contains("code-block")) {
      return inner ? `\`${inner}\`` : "";
    }

    // Strikethrough
    if (tag === "del" || tag === "s" || tag === "strike") {
      return inner ? `~~${inner}~~` : "";
    }

    // Underline
    if (tag === "u" || tag === "ins") {
      return inner ? `<u>${inner}</u>` : "";
    }

    // Highlight
    if (tag === "mark") {
      return inner ? `==${inner}==` : "";
    }

    // Links
    if (tag === "a") {
      const href = node.getAttribute("href");
      return href ? `[${inner}](${href})` : inner;
    }

    return inner;
  }

  return cleanZeroWidth(walk(domNode));
}

export function splitBlockDOMAtRange(container, range) {
  if (!container || !range) {
    const fullText = getBlockTextFromDOM(container);
    return { textBefore: fullText, textAfter: "" };
  }

  try {
    const beforeRange = document.createRange();
    beforeRange.setStart(container, 0);
    beforeRange.setEnd(range.startContainer, range.startOffset);
    const beforeFrag = beforeRange.cloneContents();
    const tempBefore = document.createElement("div");
    tempBefore.appendChild(beforeFrag);
    const textBefore = getBlockTextFromDOM(tempBefore);

    const afterRange = document.createRange();
    afterRange.setStart(range.endContainer, range.endOffset);
    afterRange.setEnd(container, container.childNodes.length);
    const afterFrag = afterRange.cloneContents();
    const tempAfter = document.createElement("div");
    tempAfter.appendChild(afterFrag);
    const textAfter = getBlockTextFromDOM(tempAfter);

    return { textBefore, textAfter };
  } catch (e) {
    const fullText = getBlockTextFromDOM(container);
    return { textBefore: fullText, textAfter: "" };
  }
}

export function getSerializedTextFromRange(container, endContainer, endOffset) {
  if (!container || !endContainer) return "";
  try {
    const range = document.createRange();
    range.setStart(container, 0);
    range.setEnd(endContainer, endOffset);
    const fragment = range.cloneContents();
    const tempDiv = document.createElement("div");
    tempDiv.appendChild(fragment);
    return getBlockTextFromDOM(tempDiv);
  } catch (e) {
    return "";
  }
}
