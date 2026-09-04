import { NextResponse } from "next/server";
import {
  errorPayload,
  generate,
  hasApiKey,
  readJson,
  readUsage,
} from "@/lib/gemini";
import { REFORMAT_BLOCK_TYPES, REFORMAT_SCHEMA } from "@/lib/schemas";
import { getNormalizedTableData } from "@/lib/exportImport";

export const dynamic = "force-dynamic";

const REFORMAT_PERSONA = `You are the Master Note Architect & Academic Structural Classifier in SocraticOS.

Your task is to take the learner's note and restructure it into clean, appropriately-typed SocraticOS blocks while preserving knowledge fidelity and repairing formatting errors.

CRITICAL DIRECTIVES:
1. CONTENT & KNOWLEDGE FIDELITY (DO NOT CHANGE MEANING):
   - Do NOT delete, summarize, truncate, or rewrite the learner's actual concepts, scientific facts, code logic, numbers, definitions, or underlying information.
   - Preserve all words, sentences, and explanations from the original note faithfully.
   - You are primarily classifying and assigning the appropriate block TYPE and structure for each section.
2. SYNTAX ERROR HEALING & FORMATTING REPAIR (ALLOWED EDITS):
   - LaTeX Math & Pathway Healing:
     * If an equation, reaction pathway, or formula has dangling, unbalanced, or missing math delimiters (e.g. starting with '\\text{Stimulus} \\rightarrow ... \\rightarrow \\text{Response}$$' missing opening '$$', or unclosed '$$', or raw LaTeX math lines without dollar signs), classify it as a 'math' block, repair the formula, and provide clean LaTeX in content without wrapping dollar signs.
     * Fix broken/unbalanced braces (e.g. '$I^A I^o}$' -> '$I^A I^o$'), missing backslashes ('frac{a}{b}' -> '\\frac{a}{b}'), and KaTeX syntax errors.
   - Markdown & Asterisk Symbol Healing:
     * Strip redundant markdown markers and asterisks from Heading blocks ('h1'–'h4'): do NOT output 'content: "**Eye Structures:**"' or 'content: "### 14.2 ..."'; output clean heading text like 'content: "Eye Structures"'.
     * Detect standalone bold category lines ending with a colon (e.g. '* **Eye Structures:**', '**Key Hormones & Sources:**') and classify them as clean 'h3' or 'h4' subheadings with outer asterisks stripped.
     * Strip redundant list markers ('* ', '- ') from the beginning of 'bullet' block content.
     * Fix malformed table pipes ('|'), misaligned rows, broken code fences, and unescaped brackets.

3. OPTIMAL BLOCK TYPING:
   - 'h1': Note main title or top-level topic breakdown.
   - 'h2': Primary concept sections (e.g. "Chapter 15: Drugs").
   - 'h3' / 'h4': Sub-topics and analytical components (e.g. "14.2 Sense Organs: The Eye", "Eye Structures", "Pupil Reflex").
   - 'text': Standard conceptual explanations and paragraphs.
   - 'bullet': Key takeaways, properties, characteristics, bullet lists. For nested sub-points, examples, or secondary details under a parent bullet, specify 'level' (0 for root bullet, 1 for sub-bullet, 2 for sub-sub-bullet).
   - 'number': Sequential steps, proofs, mechanisms, chronological processes.
   - 'callout': Core axioms, key takeaways, critical warnings, golden rules (assign appropriate calloutIcon: 💡, ⚠️, 📌, 🎯, ✨, 🧠, ⚡, 🔬).
   - 'quote': Notable definitions, historical quotes, or philosophical axioms.
   - 'toggle': Deep-dive proofs, secondary details, or collapsible derivations (set summary in content and body in details).
   - 'math': Display LaTeX mathematical formulas or multi-step reaction/reflex pathways (e.g. \\int_a^b f(x)dx = F(b) - F(a) or \\text{Stimulus} \\rightarrow \\text{Receptor} \\rightarrow \\text{Effector}). Do NOT wrap in dollar signs in content.
   - 'inlinemath': Inline equations or quick variables (e.g. E = mc^2).
   - 'code': Code snippets, algorithms, pseudocode, or queries (specify programming language in language).
   - 'todo': Actionable study tasks, revision checkpoints, self-test problems.
   - 'divider': Clean section dividers between major thematic transitions.
   - 'table': Structured comparisons, matrices, benchmark charts, data tables, or tabular parameter lists. Provide headers in tableHeaders and 2D cells in tableRows, or markdown table in content (e.g. | Feature | Option A | Option B |).
4. CONCISE ACADEMIC TITLE & EMOJI: Provide a title reflecting the note and a single relevant emoji (e.g. ⚛️, 🧬, 📐, 💻, 🧠, 📚, ⚡, 🌌).
5. OUTPUT FORMAT: Strictly output valid JSON matching the schema with no external markdown fences or XML tags.`;

function buildReformatPrompt({ title, noteContent }) {
  const sections = [REFORMAT_PERSONA];

  if (title?.trim()) {
    sections.push(`Current Note Title: "${title.trim()}"`);
  }

  if (noteContent?.trim()) {
    sections.push(
      `Learner's Original Note Content to Reformat (Preserve all text details verbatim; only classify and assign block types):

<original_notes>
${noteContent.trim()}
</original_notes>`
    );
  }

  return sections.join("\n\n");
}


export function normalizeReformattedNote(raw, fallbackTitle = "Untitled Note") {
  const str = (v) => String(v ?? "").trim();
  const list = (v) => (Array.isArray(v) ? v : []);

  const now = Date.now();
  const rawBlocks = list(raw?.blocks);

  const cleanBlocks = rawBlocks
    .filter((b) => b && (b.content !== undefined || b.type === "divider" || b.type === "table"))
    .map((b, idx) => {
      let type = REFORMAT_BLOCK_TYPES.includes(b.type) ? b.type : "text";
      const id = `blk_reformat_${now}_${idx}`;
      let content = str(b.content);

      // Auto-heal math if content starts or ends with $$ or contains LaTeX pathway commands
      if (
        type === "text" &&
        (content.endsWith("$$") || content.startsWith("$$") || (/^\\(text|frac|rightarrow|sum|int|sqrt|begin)/.test(content) && content.includes("\\")))
      ) {
        type = "math";
        content = content.replace(/^\$\$+|\$\$+$/g, "").trim();
      }

      if (type === "math" || type === "inlinemath") {
        content = content.replace(/^\$\$+|\$\$+$/g, "").replace(/^\$+|\$$/g, "").trim();
      }

      // Auto-heal headings (strip redundant asterisks / hashes)
      if (type === "h1" || type === "h2" || type === "h3" || type === "h4") {
        content = content
          .replace(/^(\*+|\#+|\s*)+/, "")
          .replace(/(\*+|\s*)+$/, "")
          .replace(/[:\s]+$/, "")
          .trim();
      }

      // Auto-heal bullets (strip redundant leading bullet markers, only convert to h3 if explicitly ending with colon)
      if (type === "bullet") {
        content = content.replace(/^[*•\-+]\s+/, "").trim();
        const boldHeadingMatch = content.match(/^\*\*([^*:]+)(?::\*\*|\*\*:)[\s]*$/);
        if (boldHeadingMatch) {
          type = "h3";
          content = boldHeadingMatch[1].trim();
        }
      }



      const block = { id, type, content };

      if (type === "bullet") {
        const rawLvl = b.level !== undefined ? parseInt(b.level, 10) : 0;
        block.level = Number.isInteger(rawLvl) && rawLvl > 0 ? Math.min(rawLvl, 4) : 0;
      }

      if (type === "callout") {
        block.calloutIcon = str(b.calloutIcon) || "💡";
      } else if (type === "toggle") {
        block.details = str(b.details);
        block.open = true;
      } else if (type === "code") {
        block.language = str(b.language) || "javascript";
        block.meta = { language: block.language };
      } else if (type === "todo") {
        block.checked = Boolean(b.checked);
      } else if (type === "site") {
        block.url = str(b.url);
      } else if (type === "table") {
        let headers = Array.isArray(b.tableHeaders) ? b.tableHeaders.map(str) : [];
        let rows = Array.isArray(b.tableRows) ? b.tableRows.map((r) => (Array.isArray(r) ? r.map(str) : [])) : [];
        if (headers.length === 0 && (content.includes("|") || (b.tableData && (b.tableData.headers || b.tableData.rows)))) {
          const norm = getNormalizedTableData(b.tableData, content);
          headers = norm.headers;
          rows = norm.rows;
        }
        block.tableData = {
          headers: headers.length > 0 ? headers : ["Column 1", "Column 2", "Column 3"],
          rows: rows.length > 0 ? rows : [["", "", ""], ["", "", ""]],
          hasHeaderRow: true,
        };
      }

      return block;
    });

  return {
    title: str(raw?.title) || str(fallbackTitle) || "Untitled Note",
    emoji: str(raw?.emoji) || null,
    blocks: cleanBlocks.length > 0 ? cleanBlocks : [{ id: `blk_reformat_${now}_0`, type: "text", content: "" }],
  };
}


/**
 * POST /api/reformat
 *
 * Body: { title, noteContent, blocks? }
 * 200 -> { reformatted: { title, emoji, blocks }, usage }
 */
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }

  const { title = "", noteContent = "" } = body ?? {};

  if (!noteContent || !noteContent.trim()) {
    return NextResponse.json(
      { error: "Cannot reformat an empty note. Please add some notes first." },
      { status: 400 }
    );
  }

  if (!(await hasApiKey())) {
    return NextResponse.json(
      {
        error:
          "Gemini API key is not configured in settings or environment.",
      },
      { status: 503 }
    );
  }

  const system = buildReformatPrompt({ title, noteContent });

  try {
    const payload = await generate({
      system,
      messages: [
        {
          role: "user",
          content: `Please read and intelligently reformat this note into clean, structured SocraticOS blocks with clear headings, callouts, math formulas, toggles, and checklists while preserving all detail.`,
        },
      ],
      temperature: 0.3,
      schema: REFORMAT_SCHEMA,
    });

    const parsedJson = readJson(payload);
    const reformatted = normalizeReformattedNote(parsedJson, title);

    return NextResponse.json({
      reformatted,
      usage: readUsage(payload),
    });
  } catch (error) {
    const { status, body: payload } = errorPayload(error);
    return NextResponse.json(payload, { status });
  }
}
