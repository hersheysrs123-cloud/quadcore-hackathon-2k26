import {
  blocksToMarkdownLossy,
  tryParseMarkdownToBlocks,
  blocksToHTMLLossy,
  tryParseHTMLToBlocks,
  blocksToPlainText,
  tryParsePlainTextToBlocks,
  blocksToDocxBlob,
} from "../lib/exportImport.js";

let failures = 0;

function assert(condition, name, details = "") {
  if (condition) {
    console.log(`  ok   ${name}`);
  } else {
    failures++;
    console.error(`  FAIL ${name} ${details}`);
  }
}

console.log("\n--- Testing In-Sentence Inline Math Export & Import Round-trips ---\n");

// Test 1: Markdown export & parse round-trip
const sampleBlocks = [
  { id: "b1", type: "h1", content: "1. Calculus: Derivative of $f(x)$" },
  { id: "b2", type: "text", content: "The formal derivative is $f'(x) = \\lim_{\\Delta x \\to 0} \\frac{f(x+\\Delta x) - f(x)}{\\Delta x}$ for all $x$." },
  { id: "b3", type: "bullet", content: "Power rule: $\\frac{d}{dx}[x^n] = n \\cdot x^{n-1}$." },
  { id: "b4", type: "math", content: "\\int a dx = ax + C" },
  { id: "b5", type: "text", content: "Conclusion text with $E = mc^2$." },
];

const md = blocksToMarkdownLossy(sampleBlocks);
assert(
  md.includes("$f'(x) = \\lim_{\\Delta x \\to 0} \\frac{f(x+\\Delta x) - f(x)}{\\Delta x}$"),
  "Markdown export preserves in-sentence $formula$",
  `Got: ${md}`
);
assert(
  md.includes("$\\frac{d}{dx}[x^n] = n \\cdot x^{n-1}$"),
  "Markdown export preserves in-sentence formula in list items",
  `Got: ${md}`
);

const parsedFromMd = tryParseMarkdownToBlocks(md);
const textBlockFromMd = parsedFromMd.find((b) => b.content?.includes("f'(x) ="));
assert(
  Boolean(textBlockFromMd && textBlockFromMd.type === "text"),
  "tryParseMarkdownToBlocks preserves in-sentence formula within text block",
  `Parsed types: ${parsedFromMd.map((b) => b.type).join(", ")}`
);

// Test 2: Plain Text export & parse round-trip
const txt = blocksToPlainText(sampleBlocks, "Calculus Notes");
assert(
  txt.includes("$f'(x) = \\lim_{\\Delta x \\to 0} \\frac{f(x+\\Delta x) - f(x)}{\\Delta x}$"),
  "Plain text export formats in-sentence formula as $formula$",
  `Got: ${txt}`
);

const parsedFromTxt = tryParsePlainTextToBlocks(txt);
const textBlockFromTxt = parsedFromTxt.find((b) => b.content?.includes("f'(x) ="));
assert(
  Boolean(textBlockFromTxt && textBlockFromTxt.type === "text"),
  "tryParsePlainTextToBlocks parses in-sentence formula as text block",
  `Parsed types: ${parsedFromTxt.map((b) => b.type).join(", ")}`
);

// Test 3: HTML export
const html = blocksToHTMLLossy(sampleBlocks, "Calculus Notes", "🎓");
assert(
  html.includes("katex") || html.includes("\\lim_{\\Delta x \\to 0}") || html.includes("$f'(x)"),
  "HTML export renders in-sentence formula",
  `Got html: ${html}`
);

// Test 4: DOCX blob generation
try {
  const docxBlob = await blocksToDocxBlob(sampleBlocks, "Calculus Notes", "🎓");
  assert(Boolean(docxBlob && docxBlob.size > 0), "DOCX export successfully generates binary blob with in-sentence math");
} catch (err) {
  assert(false, "DOCX export threw an error", err.message);
}

console.log(failures === 0 ? "\nALL IN-SENTENCE INLINE MATH TESTS PASSED!\n" : `\n${failures} TEST(S) FAILED!\n`);
process.exit(failures === 0 ? 0 : 1);
