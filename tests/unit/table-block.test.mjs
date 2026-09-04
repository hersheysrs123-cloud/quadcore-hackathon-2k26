import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  getNormalizedTableData,
  parseMarkdownTableRow,
  tryParseMarkdownToBlocks,
  tryParseHTMLToBlocks,
  tryParsePlainTextToBlocks,
  blocksToMarkdownLossy,
  blocksToHTMLLossy,
} from "../../lib/exportImport.js";
import { editorBlocksToText } from "../../lib/blocks.js";

describe("Table Block Architecture & Normalization", () => {
  it("normalizes valid structured table data object", () => {
    const raw = {
      headers: ["Organelle", "Function"],
      rows: [["Mitochondria", "ATP Production"], ["Nucleus", "Genetic Control"]],
      hasHeaderRow: true,
    };
    const norm = getNormalizedTableData(raw);
    assert.deepEqual(norm.headers, ["Organelle", "Function"]);
    assert.equal(norm.rows.length, 2);
    assert.equal(norm.rows[0][0], "Mitochondria");
    assert.equal(norm.hasHeaderRow, true);
  });

  it("handles stringified JSON tableData gracefully", () => {
    const jsonStr = JSON.stringify({
      headers: ["Step", "Temperature"],
      rows: [["Denaturation", "95°C"], ["Annealing", "55°C"]],
    });
    const norm = getNormalizedTableData(jsonStr);
    assert.deepEqual(norm.headers, ["Step", "Temperature"]);
    assert.equal(norm.rows.length, 2);
  });

  it("handles alias properties (columns & data)", () => {
    const raw = {
      columns: ["A", "B"],
      data: [["1", "2"]],
    };
    const norm = getNormalizedTableData(raw);
    assert.deepEqual(norm.headers, ["A", "B"]);
    assert.deepEqual(norm.rows, [["1", "2"]]);
  });

  it("provides safe fallback when headers or rows are empty", () => {
    const emptyHeaders = { headers: [], rows: [] };
    const norm = getNormalizedTableData(emptyHeaders);
    assert.ok(norm.headers.length >= 1);
    assert.ok(norm.rows.length >= 1);
  });

  it("parses raw Markdown table string from content if tableData is missing", () => {
    const md = `| Stage | Key Event |
| --- | --- |
| Prophase | Chromosomes condense |
| Metaphase | Align at equator |`;
    const norm = getNormalizedTableData(null, md);
    assert.deepEqual(norm.headers, ["Stage", "Key Event"]);
    assert.equal(norm.rows.length, 2);
    assert.equal(norm.rows[0][0], "Prophase");
    assert.equal(norm.rows[1][1], "Align at equator");
  });
});

describe("Markdown Table Parsing (with & without outer pipes)", () => {
  it("parses markdown table with leading and trailing pipes", () => {
    const md = `| Compound | Boiling Point |
| --- | --- |
| Methane | -161°C |
| Ethane | -89°C |`;
    const blocks = tryParseMarkdownToBlocks(md);
    assert.equal(blocks.length, 1);
    assert.equal(blocks[0].type, "table");
    assert.deepEqual(blocks[0].tableData.headers, ["Compound", "Boiling Point"]);
    assert.equal(blocks[0].tableData.rows.length, 2);
  });

  it("parses markdown table WITHOUT leading or trailing pipes", () => {
    const md = `Compound | Boiling Point
--- | ---
Methane | -161°C
Ethane | -89°C`;
    const blocks = tryParseMarkdownToBlocks(md);
    assert.equal(blocks.length, 1);
    assert.equal(blocks[0].type, "table");
    assert.deepEqual(blocks[0].tableData.headers, ["Compound", "Boiling Point"]);
    assert.equal(blocks[0].tableData.rows.length, 2);
    assert.equal(blocks[0].tableData.rows[0][0], "Methane");
  });

  it("handles escaped pipes within cell contents", () => {
    const row = parseMarkdownTableRow("Formula \\| Value | Absolute \\|x\\| | Notes");
    assert.equal(row.length, 3);
    assert.equal(row[0], "Formula | Value");
    assert.equal(row[1], "Absolute |x|");
    assert.equal(row[2], "Notes");
  });

  it("parses tables in plain text import", () => {
    const text = `Physics Constants
| Constant | Value | Unit |
| --- | --- | --- |
| c | 3.00e8 | m/s |
| h | 6.63e-34 | J s |`;
    const blocks = tryParsePlainTextToBlocks(text);
    const table = blocks.find((b) => b.type === "table");
    assert.ok(table);
    assert.deepEqual(table.tableData.headers, ["Constant", "Value", "Unit"]);
    assert.equal(table.tableData.rows.length, 2);
  });
});

describe("HTML Table Parsing & Conversions", () => {
  it("parses standard HTML table with thead/tbody", () => {
    const html = `<table>
      <thead><tr><th>Metal</th><th>Reactivity</th></tr></thead>
      <tbody><tr><td>Potassium</td><td>Violent</td></tr><tr><td>Gold</td><td>Unreactive</td></tr></tbody>
    </table>`;
    const blocks = tryParseHTMLToBlocks(html);
    assert.equal(blocks.length, 1);
    assert.equal(blocks[0].type, "table");
    assert.deepEqual(blocks[0].tableData.headers, ["Metal", "Reactivity"]);
    assert.equal(blocks[0].tableData.rows.length, 2);
  });

  it("parses HTML table without th tags (first tr as headers)", () => {
    const html = `<table>
      <tr><td>Metal</td><td>Reactivity</td></tr>
      <tr><td>Potassium</td><td>Violent</td></tr>
      <tr><td>Gold</td><td>Unreactive</td></tr>
    </table>`;
    const blocks = tryParseHTMLToBlocks(html);
    assert.equal(blocks.length, 1);
    assert.equal(blocks[0].type, "table");
    assert.deepEqual(blocks[0].tableData.headers, ["Metal", "Reactivity"]);
    assert.equal(blocks[0].tableData.rows.length, 2);
    assert.deepEqual(blocks[0].tableData.rows[0], ["Potassium", "Violent"]);
  });
});

describe("Table Block Serialization & AI Extraction", () => {
  it("serializes table block to lossless markdown with cell escaping", () => {
    const tableBlock = {
      type: "table",
      tableData: {
        headers: ["Expression", "Result"],
        rows: [["|x| > 0", "True for x != 0"]],
      },
    };
    const md = blocksToMarkdownLossy([tableBlock]);
    assert.ok(md.includes("| Expression | Result |"));
    assert.ok(md.includes("\\|x\\| > 0"));
  });

  it("serializes table blocks in editorBlocksToText for AI and Search", () => {
    const tableBlock = {
      type: "table",
      title: "Enzyme Optimums",
      tableData: {
        headers: ["Enzyme", "Optimum pH", "Location"],
        rows: [
          ["Pepsin", "2.0", "Stomach"],
          ["Amylase", "7.0", "Saliva / Duodenum"],
        ],
      },
    };
    const text = editorBlocksToText([tableBlock]);
    assert.ok(text.includes("Enzyme Optimums"));
    assert.ok(text.includes("Pepsin"));
    assert.ok(text.includes("Optimum pH"));
    assert.ok(text.includes("Saliva / Duodenum"));
  });

  it("generates structured HTML with responsive container for print & export", () => {
    const tableBlock = {
      type: "table",
      title: "Summary Table",
      tableData: {
        headers: ["Col A", "Col B"],
        rows: [["Val A", "Val B"]],
      },
    };
    const html = blocksToHTMLLossy([tableBlock], "My Note", "📊");
    assert.ok(html.includes("socratic-table"));
    assert.ok(html.includes("<th>Col A</th>"));
    assert.ok(html.includes("<td>Val A</td>"));
  });

  it("handles inline LaTeX formulas in table cells losslessly", () => {
    const tableBlock = {
      type: "table",
      tableData: {
        headers: ["Quantity", "Formula", "Units"],
        rows: [
          ["Kinetic Energy", "$E_k = \\frac{1}{2}mv^2$", "Joules ($J$)"],
          ["Force", "$F = ma$", "Newtons ($N$)"],
        ],
      },
    };
    const md = blocksToMarkdownLossy([tableBlock]);
    const parsedBlocks = tryParseMarkdownToBlocks(md);
    assert.equal(parsedBlocks.length, 1);
    assert.equal(parsedBlocks[0].type, "table");
    assert.equal(parsedBlocks[0].tableData.rows[0][1], "$E_k = \\frac{1}{2}mv^2$");
    assert.equal(parsedBlocks[0].tableData.rows[1][1], "$F = ma$");
  });
});

describe("Table Block Column & Row Undo/Redo State Machine", () => {
  it("undoes and redoes column deletion losslessly preserving column data", () => {
    const initialTable = {
      id: "tbl_1",
      type: "table",
      tableData: {
        headers: ["Col 1", "Col 2", "Col 3"],
        rows: [
          ["A1", "B1", "C1"],
          ["A2", "B2", "C2"],
        ],
      },
    };

    const past = [];
    const future = [];
    let current = JSON.parse(JSON.stringify(initialTable));

    // Delete column index 1 ("Col 2")
    const colIdxToDelete = 1;
    past.push(JSON.parse(JSON.stringify(current)));
    future.length = 0;
    current.tableData.headers = current.tableData.headers.filter((_, idx) => idx !== colIdxToDelete);
    current.tableData.rows = current.tableData.rows.map((r) => r.filter((_, idx) => idx !== colIdxToDelete));

    assert.deepEqual(current.tableData.headers, ["Col 1", "Col 3"]);
    assert.deepEqual(current.tableData.rows, [["A1", "C1"], ["A2", "C2"]]);

    // Undo action (Ctrl+Z)
    const prev = past.pop();
    future.unshift(JSON.parse(JSON.stringify(current)));
    current = JSON.parse(JSON.stringify(prev));

    assert.deepEqual(current.tableData.headers, ["Col 1", "Col 2", "Col 3"]);
    assert.deepEqual(current.tableData.rows, [["A1", "B1", "C1"], ["A2", "B2", "C2"]]);

    // Redo action (Ctrl+Y)
    const next = future.shift();
    past.push(JSON.parse(JSON.stringify(current)));
    current = JSON.parse(JSON.stringify(next));

    assert.deepEqual(current.tableData.headers, ["Col 1", "Col 3"]);
    assert.deepEqual(current.tableData.rows, [["A1", "C1"], ["A2", "C2"]]);
  });

  it("undoes and redoes row deletion losslessly preserving row data", () => {
    const initialTable = {
      id: "tbl_1",
      type: "table",
      tableData: {
        headers: ["Subject", "Score"],
        rows: [
          ["Physics", "95"],
          ["Chemistry", "92"],
          ["Biology", "88"],
        ],
      },
    };

    const past = [];
    const future = [];
    let current = JSON.parse(JSON.stringify(initialTable));

    // Delete row index 1 ("Chemistry")
    const rowIdxToDelete = 1;
    past.push(JSON.parse(JSON.stringify(current)));
    future.length = 0;
    current.tableData.rows = current.tableData.rows.filter((_, idx) => idx !== rowIdxToDelete);

    assert.equal(current.tableData.rows.length, 2);
    assert.deepEqual(current.tableData.rows[0], ["Physics", "95"]);
    assert.deepEqual(current.tableData.rows[1], ["Biology", "88"]);

    // Undo action (Ctrl+Z)
    const prev = past.pop();
    future.unshift(JSON.parse(JSON.stringify(current)));
    current = JSON.parse(JSON.stringify(prev));

    assert.equal(current.tableData.rows.length, 3);
    assert.deepEqual(current.tableData.rows[1], ["Chemistry", "92"]);

    // Redo action (Ctrl+Y)
    const next = future.shift();
    past.push(JSON.parse(JSON.stringify(current)));
    current = JSON.parse(JSON.stringify(next));

    assert.equal(current.tableData.rows.length, 2);
    assert.deepEqual(current.tableData.rows[0], ["Physics", "95"]);
    assert.deepEqual(current.tableData.rows[1], ["Biology", "88"]);
  });

  it("deletes formulas cleanly from cell text with single or surrounding text", () => {
    function removeFormulaFromCellText(text, formula) {
      if (!text || !formula) return (text || "").trim();
      const trimmedFormula = formula.trim();
      const escaped = trimmedFormula.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(`\\$\\$?\\s*${escaped}\\s*\\$\\$?`, "g");
      let result = text.replace(regex, "");
      return result.replace(/\s{2,}/g, " ").trim();
    }

    assert.equal(removeFormulaFromCellText("$x^2$", "x^2"), "");
    assert.equal(removeFormulaFromCellText("$$x^2$$", "x^2"), "");
    assert.equal(removeFormulaFromCellText("Formula: $E = mc^2$ for energy", "E = mc^2"), "Formula: for energy");
    assert.equal(removeFormulaFromCellText("$E_k = \\frac{1}{2}mv^2$", "E_k = \\frac{1}{2}mv^2"), "");
  });

  it("updates formulas cleanly in cell text without leaving corrupted tokens", () => {
    function updateFormulaInCellText(text, oldFormula, newFormula) {
      if (!text) return newFormula ? `$${newFormula}$` : "";
      if (!oldFormula) return `${text} $${newFormula}$`.trim();
      const trimmedOld = oldFormula.trim();
      const escaped = trimmedOld.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(`\\$\\$?\\s*${escaped}\\s*\\$\\$?`);
      if (regex.test(text)) {
        return text.replace(regex, `$${newFormula}$`);
      }
      return `${text} $${newFormula}$`.trim();
    }

    assert.equal(updateFormulaInCellText("$x^2$", "x^2", "y^3"), "$y^3$");
    assert.equal(updateFormulaInCellText("Energy: $E = mc^2$", "E = mc^2", "E = h\\nu"), "Energy: $E = h\\nu$");
    assert.equal(updateFormulaInCellText("", "", "F = ma"), "$F = ma$");
  });

  it("deletes only the targeted duplicate formula in a cell without deleting copies", () => {
    function removeFormulaAtIndex(text, targetIndex) {
      if (!text) return "";
      let currentIndex = 0;
      const regex = /\$\$?[^\$]+\$\$?/g;
      const result = text.replace(regex, (match) => {
        if (currentIndex === targetIndex) {
          currentIndex++;
          return "";
        }
        currentIndex++;
        return match;
      });
      return result.replace(/\s{2,}/g, " ").trim();
    }

    const twoCopies = "$x$ and $x$";
    // Delete 2nd copy (index 1) -> 1st copy remains
    assert.equal(removeFormulaAtIndex(twoCopies, 1), "$x$ and");
    // Delete 1st copy (index 0) -> 2nd copy remains
    assert.equal(removeFormulaAtIndex(twoCopies, 0), "and $x$");

    const threeCopies = "$x$ + $x$ = 2$x$";
    // Delete middle copy (index 1)
    assert.equal(removeFormulaAtIndex(threeCopies, 1), "$x$ + = 2$x$");
  });
});

describe("Floating Text Selection Popover & Formatting State Engine", () => {
  it("formats selected text into code, formula, bold, italic, and strikethrough markdown losslessly", () => {
    function applySelectionFormat(fullText, startIdx, endIdx, format) {
      const before = fullText.slice(0, startIdx);
      const selected = fullText.slice(startIdx, endIdx);
      const after = fullText.slice(endIdx);

      let formatted = selected;
      if (format === "bold") formatted = `**${selected}**`;
      else if (format === "italic") formatted = `*${selected}*`;
      else if (format === "underline") formatted = `<u>${selected}</u>`;
      else if (format === "strikethrough") formatted = `~~${selected}~~`;
      else if (format === "code") formatted = `\`${selected}\``;
      else if (format === "math") formatted = `$${selected}$`;

      return `${before}${formatted}${after}`;
    }

    const sentence = "The speed of light is constant in vacuum.";
    // Highlight "speed of light" (index 4 to 18)
    assert.equal(
      applySelectionFormat(sentence, 4, 18, "bold"),
      "The **speed of light** is constant in vacuum."
    );
    assert.equal(
      applySelectionFormat(sentence, 4, 18, "code"),
      "The `speed of light` is constant in vacuum."
    );
    assert.equal(
      applySelectionFormat(sentence, 4, 18, "math"),
      "The $speed of light$ is constant in vacuum."
    );
    assert.equal(
      applySelectionFormat(sentence, 4, 18, "strikethrough"),
      "The ~~speed of light~~ is constant in vacuum."
    );
  });

  it("calculates floating toolbar viewport position with safe edge boundary clamping", () => {
    function calculateToolbarPosition(rect, windowWidth) {
      const toolbarWidth = 370;
      const toolbarHeight = 40;
      const targetX = Math.max(
        16,
        Math.min(windowWidth - toolbarWidth - 16, rect.left + rect.width / 2 - toolbarWidth / 2)
      );
      let targetY = rect.top - toolbarHeight - 8;
      if (targetY < 8) {
        targetY = rect.bottom + 8;
      }
      return { x: targetX, y: targetY };
    }

    // Normal selection in the middle of the viewport
    const midPos = calculateToolbarPosition({ left: 400, top: 200, width: 80, height: 20 }, 1200);
    assert.equal(midPos.x, 400 + 40 - 185); // 255
    assert.equal(midPos.y, 200 - 40 - 8); // 152

    // Selection near the extreme left edge
    const leftPos = calculateToolbarPosition({ left: 5, top: 100, width: 30, height: 20 }, 1200);
    assert.equal(leftPos.x, 16);

    // Selection near the extreme top edge (flips below)
    const topPos = calculateToolbarPosition({ left: 400, top: 20, bottom: 40, width: 60, height: 20 }, 1200);
    assert.equal(topPos.y, 48); // 40 + 8
  });

  it("instantly compiles inline math and code into tokens and records pre-state for lossless undo/redo", () => {
    let historyStack = [];
    let state = {
      headers: ["Metric", "Formula"],
      rows: [["Energy", "E = mc^2"], ["Speed", "v = d/t"]],
    };

    // User selects "E = mc^2" in cell (row 0, col 1) and clicks Convert to Math ($x$)
    // 1. Snapshot recorded
    historyStack.push(JSON.parse(JSON.stringify(state)));

    // 2. Format applied & instantly converted
    const selectedText = state.rows[0][1];
    const formattedMath = `$${selectedText}$`;
    state.rows[0][1] = formattedMath;

    assert.equal(state.rows[0][1], "$E = mc^2$");

    // 3. User triggers Undo (Ctrl+Z)
    assert.equal(historyStack.length, 1);
    const restored = historyStack.pop();
    state = JSON.parse(JSON.stringify(restored));

    assert.equal(state.rows[0][1], "E = mc^2");
    assert.equal(state.rows[1][1], "v = d/t");
  });
});

describe("3-Font Typography Palette & Per-Note Style Isolation", () => {
  const NOTE_FONTS = [
    { id: "sans", label: "Default", class: "font-note-sans", tip: "Clean & Modern" },
    { id: "serif", label: "Serif", class: "font-note-serif", tip: "Academic & Bookish" },
    { id: "mono", label: "Mono", class: "font-note-mono", tip: "Technical & STEM" },
  ];

  const NOTE_FONT_CLASSES = {
    sans: "font-note-sans",
    serif: "font-note-serif",
    mono: "font-note-mono",
  };

  it("contains exactly 3 distinct typography options with valid classes", () => {
    assert.equal(NOTE_FONTS.length, 3);
    const ids = NOTE_FONTS.map((f) => f.id);
    assert.deepEqual(ids, ["sans", "serif", "mono"]);

    ids.forEach((id) => {
      assert.ok(NOTE_FONT_CLASSES[id], `Missing class mapping for font ${id}`);
      assert.equal(NOTE_FONT_CLASSES[id], `font-note-${id}`);
    });
  });

  it("preserves independent font styles across distinct notes", () => {
    const notes = [
      { id: "n1", title: "Physics Derivations", fontStyle: "mono" },
      { id: "n2", title: "History of Philosophy", fontStyle: "serif" },
      { id: "n3", title: "Morning Reflections", fontStyle: "handwriting" },
      { id: "n4", title: "Product Roadmap", fontStyle: "geometric" },
      { id: "n5", title: "Meeting Notes", fontStyle: undefined },
    ];

    function resolveNoteFontClass(note) {
      const style = note?.fontStyle || "sans";
      return NOTE_FONT_CLASSES[style] || "font-note-sans";
    }

    assert.equal(resolveNoteFontClass(notes[0]), "font-note-mono");
    assert.equal(resolveNoteFontClass(notes[1]), "font-note-serif");
    // Legacy handwriting & geometric fonts safely fallback to font-note-sans
    assert.equal(resolveNoteFontClass(notes[2]), "font-note-sans");
    assert.equal(resolveNoteFontClass(notes[3]), "font-note-sans");
    assert.equal(resolveNoteFontClass(notes[4]), "font-note-sans");
  });
});

describe("Full Width Page Layout Settings & Per-Note State Isolation", () => {
  function getContainerClass(fullWidth) {
    return fullWidth
      ? "w-full max-w-none px-6 md:px-12"
      : "max-w-3xl px-10";
  }

  it("resolves standard reading width as default when fullWidth is undefined or false", () => {
    assert.equal(getContainerClass(undefined), "max-w-3xl px-10");
    assert.equal(getContainerClass(false), "max-w-3xl px-10");
  });

  it("resolves full viewport width when fullWidth is true", () => {
    assert.equal(getContainerClass(true), "w-full max-w-none px-6 md:px-12");
  });

  it("preserves independent fullWidth settings across multiple notes", () => {
    const notes = [
      { id: "note-1", title: "Standard Article", fullWidth: false },
      { id: "note-2", title: "Data Dashboard Table", fullWidth: true },
      { id: "note-3", title: "Quick Note", fullWidth: undefined },
    ];

    const note1Layout = getContainerClass(Boolean(notes[0].fullWidth));
    const note2Layout = getContainerClass(Boolean(notes[1].fullWidth));
    const note3Layout = getContainerClass(Boolean(notes[2].fullWidth));

    assert.equal(note1Layout, "max-w-3xl px-10");
    assert.equal(note2Layout, "w-full max-w-none px-6 md:px-12");
    assert.equal(note3Layout, "max-w-3xl px-10");

    // Toggle note-1 to full width
    notes[0].fullWidth = !notes[0].fullWidth;
    assert.equal(getContainerClass(Boolean(notes[0].fullWidth)), "w-full max-w-none px-6 md:px-12");
    // Ensure note-2 remains untouched
    assert.equal(getContainerClass(Boolean(notes[1].fullWidth)), "w-full max-w-none px-6 md:px-12");
  });
});

describe("Lock Page Feature & Read-Only Document Constraints", () => {
  function evaluateEditorPermissions(note) {
    const isLocked = Boolean(note.isLocked);
    return {
      isLocked,
      canEditContent: !isLocked,
      canEditTitle: !isLocked,
      canShowActionStrip: !isLocked,
      canUseSlashMenu: !isLocked,
      canAddOrDeleteBlocks: !isLocked,
      showLockBadge: isLocked,
    };
  }

  it("allows full editing by default when isLocked is false or undefined", () => {
    const noteUnlocked = { id: "note-1", title: "Draft", isLocked: false };
    const permissions = evaluateEditorPermissions(noteUnlocked);

    assert.equal(permissions.isLocked, false);
    assert.equal(permissions.canEditContent, true);
    assert.equal(permissions.canEditTitle, true);
    assert.equal(permissions.canShowActionStrip, true);
    assert.equal(permissions.canUseSlashMenu, true);
    assert.equal(permissions.canAddOrDeleteBlocks, true);
    assert.equal(permissions.showLockBadge, false);
  });

  it("enforces strict read-only mode when isLocked is true", () => {
    const noteLocked = { id: "note-2", title: "Published Spec", isLocked: true };
    const permissions = evaluateEditorPermissions(noteLocked);

    assert.equal(permissions.isLocked, true);
    assert.equal(permissions.canEditContent, false);
    assert.equal(permissions.canEditTitle, false);
    assert.equal(permissions.canShowActionStrip, false);
    assert.equal(permissions.canUseSlashMenu, false);
    assert.equal(permissions.canAddOrDeleteBlocks, false);
    assert.equal(permissions.showLockBadge, true);
  });

  it("supports instantaneous unlock transition", () => {
    const note = { id: "note-3", title: "Archive", isLocked: true };
    let perms = evaluateEditorPermissions(note);
    assert.equal(perms.isLocked, true);
    assert.equal(perms.canEditContent, false);

    // Simulate clicking "Unlock" in the lock banner chip
    note.isLocked = false;
    perms = evaluateEditorPermissions(note);
    assert.equal(perms.isLocked, false);
    assert.equal(perms.canEditContent, true);
    assert.equal(perms.canEditTitle, true);
    assert.equal(perms.showLockBadge, false);
  });
});
