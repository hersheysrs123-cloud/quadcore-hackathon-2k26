import fs from "fs";
import path from "path";
import {
  filterBlocksForExport,
  blocksToMarkdownLossy,
  tryParseMarkdownToBlocks,
  blocksToHTMLLossy,
  tryParseHTMLToBlocks,
  blocksToPlainText,
  tryParsePlainTextToBlocks,
  blocksToDocxBlob,
  tryParseDocxToBlocks,
  exportBookmarksToHtml,
  parseNetscapeBookmarksHtml
} from "../lib/exportImport.js";

// Let's create an ultra-comprehensive demo note that has all 19 block types
const megaDemoNote = {
  id: "mega_demo_note_001",
  title: "Quantum Mechanics & Wave-Particle Duality Master Class",
  emoji: "⚛️",
  space: "Physics",
  spaceId: "Physics",
  banner: "cyber",
  isFavorite: true,
  createdAt: "2026-08-31T10:00:00.000Z",
  updatedAt: "2026-08-31T12:00:00.000Z",
  blocks: [
    {
      id: "blk_callout_1",
      type: "callout",
      content: "Foundational Principle: In quantum mechanics, physical observables correspond to Hermitian operators whose eigenvalues represent possible measurement outcomes.",
      calloutIcon: "💡"
    },
    {
      id: "blk_h1_1",
      type: "h1",
      content: "1. Historical Axioms & Wave-Particle Duality"
    },
    {
      id: "blk_p_1",
      type: "text",
      content: "Light exhibits both **wave properties** (such as *interference* and *diffraction*) and **particle properties** (such as the *photoelectric effect* and *Compton scattering*). In 1924, Louis de Broglie proposed that matter also exhibits wave nature with de Broglie wavelength: $\\lambda = \\frac{h}{p}$ where $h$ is Planck's constant and $p$ is momentum."
    },
    {
      id: "blk_quote_1",
      type: "quote",
      content: "If quantum mechanics hasn't profoundly shocked you, you haven't understood it yet. — Niels Bohr"
    },
    {
      id: "blk_site_1",
      type: "site",
      content: "Stanford Encyclopedia of Philosophy — Quantum Mechanics",
      url: "https://plato.stanford.edu/entries/qm/"
    },
    {
      id: "blk_h2_1",
      type: "h2",
      content: "2. The Schrödinger Wave Equation & Hilbert Space Operators"
    },
    {
      id: "blk_p_2",
      type: "text",
      content: "The time-dependent Schrödinger equation governs the continuous deterministic time evolution of the state vector in Hilbert space:"
    },
    {
      id: "blk_math_1",
      type: "math",
      content: "i \\hbar \\frac{\\partial}{\\partial t} \\Psi(\\mathbf{r}, t) = \\hat{H} \\Psi(\\mathbf{r}, t) = \\left[ -\\frac{\\hbar^2}{2m} \\nabla^2 + V(\\mathbf{r}, t) \\right] \\Psi(\\mathbf{r}, t)"
    },
    {
      id: "blk_inlinemath_1",
      type: "inlinemath",
      content: "\\hat{p} = -i\\hbar\\nabla \\qquad \\text{and} \\qquad [\\hat{x}, \\hat{p}] = i\\hbar"
    },
    {
      id: "blk_toggle_1",
      type: "toggle",
      content: "Deep Dive: Heisenberg Uncertainty Principle & Operator Commutators",
      open: true,
      details: "For any two Hermitian operators A and B, the Robertson-Schrödinger relation states:\n$$\\sigma_A \\sigma_B \\ge \\frac{1}{2} |\\langle [\\hat{A}, \\hat{B}] \\rangle|$$\nFor position and momentum, $[\\hat{x}, \\hat{p}] = i\\hbar$, yielding the famous uncertainty bound $\\Delta x \\Delta p \\ge \\frac{\\hbar}{2}$."
    },
    {
      id: "blk_h3_1",
      type: "h3",
      content: "3. Numerical Quantum Harmonic Oscillator Solver"
    },
    {
      id: "blk_code_1",
      type: "code",
      language: "python",
      content: `import numpy as np
import scipy.linalg as la

def solve_quantum_harmonic_oscillator(N=500, L=10.0):
    """Numerically solve 1D Quantum Harmonic Oscillator via Finite Difference."""
    x = np.linspace(-L/2, L/2, N)
    dx = x[1] - x[0]
    # Kinetic energy matrix (-hbar^2 / 2m * d^2/dx^2, with hbar=m=1)
    T = -0.5 * (np.diag(-2*np.ones(N)) + np.diag(np.ones(N-1), 1) + np.diag(np.ones(N-1), -1)) / (dx**2)
    # Harmonic potential V(x) = 0.5 * m * omega^2 * x^2 (omega=1)
    V = np.diag(0.5 * x**2)
    H = T + V
    eigenvalues, eigenvectors = la.eigh(H)
    return eigenvalues[:5]  # Expected: [0.5, 1.5, 2.5, 3.5, 4.5]`
    },
    {
      id: "blk_h3_2",
      type: "h3",
      content: "4. Experimental Observations & Quantum Numbers"
    },
    {
      id: "blk_num_1",
      type: "number",
      content: "Principal quantum number $n \\in \\{1, 2, 3, \\dots\\}$ defines energy shell."
    },
    {
      id: "blk_num_2",
      type: "number",
      content: "Azimuthal quantum number $l \\in \\{0, 1, \\dots, n-1\\}$ defines orbital angular momentum."
    },
    {
      id: "blk_num_3",
      type: "number",
      content: "Magnetic quantum number $m_l \\in \\{-l, \\dots, +l\\}$ defines spatial orientation."
    },
    {
      id: "blk_num_4",
      type: "number",
      content: "Spin quantum number $m_s \\in \\{-\\frac{1}{2}, +\\frac{1}{2}\\}$ defines intrinsic angular momentum."
    },
    {
      id: "blk_bullet_1",
      type: "bullet",
      content: "**Superposition:** Linear combinations $\\alpha|0\\rangle + \\beta|1\\rangle$ where $|\\alpha|^2 + |\\beta|^2 = 1$."
    },
    {
      id: "blk_bullet_2",
      type: "bullet",
      content: "**Entanglement:** Non-separable Bell states like $|\\Phi^+\\rangle = \\frac{1}{\\sqrt{2}}(|00\\rangle + |11\\rangle)$."
    },
    {
      id: "blk_bullet_3",
      type: "bullet",
      content: "**No-Cloning Theorem:** Unknown quantum states cannot be duplicated perfectly."
    },
    {
      id: "blk_table_1",
      type: "table",
      content: "",
      tableData: {
        headers: ["Quantum State", "Energy Eigenvalue", "Parity", "Degeneracy"],
        rows: [
          ["Ground State $|0\\rangle$", "$\\frac{1}{2}\\hbar\\omega$", "Even (+1)", "1"],
          ["1st Excited State $|1\\rangle$", "$\\frac{3}{2}\\hbar\\omega$", "Odd (-1)", "1"],
          ["2nd Excited State $|2\\rangle$", "$\\frac{5}{2}\\hbar\\omega$", "Even (+1)", "1"],
          ["$n$-th State $|n\\rangle$", "$(n+\\frac{1}{2})\\hbar\\omega$", "$(-1)^n$", "1"]
        ],
        hasHeaderRow: true
      }
    },
    {
      id: "blk_canvas_1",
      type: "canvas",
      content: "Bloch Sphere & Wavefunction Probability Density Plot"
    },
    {
      id: "blk_media_1",
      type: "media",
      content: "Double Slit Electron Diffraction Pattern",
      url: "https://images.unsplash.com/photo-1507413245164-6160d8298b31",
      mediaKind: "image"
    },
    {
      id: "blk_divider_1",
      type: "divider",
      content: ""
    },
    {
      id: "blk_h4_1",
      type: "h4",
      content: "Mastery Review Checklist"
    },
    {
      id: "blk_todo_1",
      type: "todo",
      content: "Derive time-independent Schrödinger equation from separation of variables",
      checked: true
    },
    {
      id: "blk_todo_2",
      type: "todo",
      content: "Calculate transmission coefficient for finite square potential barrier (Quantum Tunneling)",
      checked: true
    },
    {
      id: "blk_todo_3",
      type: "todo",
      content: "Prove orthogonality of energy eigenfunctions with distinct eigenvalues",
      checked: false
    },
    {
      id: "blk_todo_4",
      type: "todo",
      content: "Simulate Stern-Gerlach magnetic field deflection of silver atoms",
      checked: false
    }
  ]
};

async function testAllExports() {
  const outDir = path.resolve("./tests/export_outputs");
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  console.log("=== Testing Note Export Across All Formats ===");
  console.log(`Target Note: "${megaDemoNote.title}" with ${megaDemoNote.blocks.length} diverse blocks\n`);

  // 1. Markdown Export (.md)
  console.log("1. Generating Markdown (.md)...");
  const mdContent = blocksToMarkdownLossy(megaDemoNote.blocks);
  fs.writeFileSync(path.join(outDir, "quantum_note.md"), mdContent, "utf-8");
  console.log(`   ✓ Written ${mdContent.length} bytes to quantum_note.md`);

  // Round-trip parse Markdown
  const mdParsedBlocks = tryParseMarkdownToBlocks(mdContent);
  console.log(`   ✓ Markdown round-trip parsed: ${mdParsedBlocks.length} blocks reconstructed`);

  // 2. HTML Export (.html)
  console.log("2. Generating Standalone HTML Web Page (.html)...");
  const htmlContent = blocksToHTMLLossy(megaDemoNote.blocks, megaDemoNote.title, megaDemoNote.emoji);
  fs.writeFileSync(path.join(outDir, "quantum_note.html"), htmlContent, "utf-8");
  console.log(`   ✓ Written ${htmlContent.length} bytes to quantum_note.html`);

  // Round-trip parse HTML
  const htmlParsedBlocks = tryParseHTMLToBlocks(htmlContent);
  console.log(`   ✓ HTML round-trip parsed: ${htmlParsedBlocks.length} blocks reconstructed`);

  // 3. Plain Text Export (.txt)
  console.log("3. Generating Plain Text (.txt)...");
  const txtContent = blocksToPlainText(megaDemoNote.blocks, megaDemoNote.title);
  fs.writeFileSync(path.join(outDir, "quantum_note.txt"), txtContent, "utf-8");
  console.log(`   ✓ Written ${txtContent.length} bytes to quantum_note.txt`);

  // Round-trip parse TXT
  const txtParsedBlocks = tryParsePlainTextToBlocks(txtContent);
  console.log(`   ✓ Plain text round-trip parsed: ${txtParsedBlocks.length} blocks reconstructed`);

  // 4. DOCX Word Document (.docx)
  console.log("4. Generating Word Document (.docx)...");
  const docxBlob = await blocksToDocxBlob(megaDemoNote.blocks, megaDemoNote.title, megaDemoNote.emoji);
  const docxBuffer = Buffer.from(await docxBlob.arrayBuffer());
  fs.writeFileSync(path.join(outDir, "quantum_note.docx"), docxBuffer);
  console.log(`   ✓ Written ${docxBuffer.length} bytes to quantum_note.docx`);

  // Round-trip parse DOCX via mammoth
  const docxParsedBlocks = await tryParseDocxToBlocks(docxBuffer);
  console.log(`   ✓ DOCX round-trip parsed: ${docxParsedBlocks.length} blocks reconstructed`);

  // 5. JSON / Socratic Backup Format (.socratic / .json)
  console.log("5. Generating Socratic Package / JSON format...");
  const socraticPayload = {
    version: "2.0.0",
    format: "socratic-backup-v2",
    timestamp: new Date().toISOString(),
    space: "Physics",
    notes: [megaDemoNote],
    folders: [],
    bookmarks: [],
    flashcardDecks: [],
    studySessions: []
  };
  const jsonContent = JSON.stringify(socraticPayload, null, 2);
  fs.writeFileSync(path.join(outDir, "quantum_note.socratic"), jsonContent, "utf-8");
  fs.writeFileSync(path.join(outDir, "quantum_note.json"), jsonContent, "utf-8");
  console.log(`   ✓ Written ${jsonContent.length} bytes to quantum_note.socratic and .json`);

  console.log("\n=== Export File Generation Summary ===");
  console.log(`Outputs located in: ${outDir}`);
}

testAllExports().catch((err) => {
  console.error("Export test failed:", err);
  process.exit(1);
});
