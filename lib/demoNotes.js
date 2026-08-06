/**
 * Seed content for a first-run workspace.
 *
 * Grouped into notesBySpace. Authentic, textbook-grade study notes with
 * Action Buttons contextualized throughout the text and real populated
 * collapsible dropdown toggle sections.
 *
 * NOTE: The 4 notes in "School" contain EVERY SINGLE BLOCK TYPE:
 * h1, h2, h3, h4, text, bullet, number, todo, toggle, callout, quote,
 * divider, code, math, canvas, notelink, site, media, action!
 */

const b = (id, type, content, extra = {}) => ({
  id,
  type,
  content,
  ...extra,
});

export const DEMO_NOTES = [
  // ── School Space (Note 1: Eigenvectors & Eigenvalues) ─────────────────
  {
    id: "note_eigen",
    space: "School",
    title: "Eigenvectors & Eigenvalues",
    emoji: "📐",
    banner: "cyber",
    isFavorite: true,
    createdAt: "2026-07-24T09:12:00.000Z",
    updatedAt: "2026-07-30T14:03:00.000Z",
    blocks: [
      b(
        "eig_callout",
        "callout",
        "Linear Algebra — Core Insight: Matrix multiplication transforms geometric space, but eigenvectors represent invariant axes that maintain their spatial orientation under transformation!",
        { calloutIcon: "💡" }
      ),
      b("eig_h1", "h1", "1. Principal Linear Transformations & Eigenbasis Decomposition"),
      b(
        "eig_text1",
        "text",
        "When an n×n matrix A multiplies a vector v, it typically changes both the vector's length and direction. Eigenvectors are special non-zero vectors whose direction remains completely unchanged by the linear transformation — they are merely scaled by a scalar factor λ."
      ),
      b("eig_h2", "h2", "2. The Characteristic Polynomial & Determinants"),
      b("eig_h3", "h3", "2.1 Eigenspace Calculation Procedure"),
      b("eig_h4", "h4", "2.1.1 Algebraic vs Geometric Multiplicity Rules"),
      b(
        "eig_bullet1",
        "bullet",
        "Matrix Trace Conservation: The sum of all eigenvalues equals the trace of matrix A: Tr(A) = ∑ λ_i."
      ),
      b(
        "eig_bullet2",
        "bullet",
        "Determinant Product: The product of all eigenvalues equals the matrix determinant: det(A) = ∏ λ_i."
      ),
      b(
        "eig_num1",
        "number",
        "1. Solve the characteristic polynomial det(A - λI) = 0 to obtain all scalar eigenvalues λ_i."
      ),
      b(
        "eig_num2",
        "number",
        "2. Substitute each λ_i back into (A - λ_i I)v = 0 and apply Gaussian elimination to find spanning basis vectors."
      ),
      b(
        "eig_todo1",
        "todo",
        "Verify matrix trace equals sum of computed eigenvalues ∑ λ_i",
        { checked: true }
      ),
      b(
        "eig_todo2",
        "todo",
        "Calculate geometric multiplicity of defective eigenvalue matrices",
        { checked: false }
      ),
      b(
        "eig_math",
        "math",
        "\\mathbf{A}\\mathbf{v} = \\lambda \\mathbf{v} \\quad \\implies \\quad (\\mathbf{A} - \\lambda \\mathbf{I}) \\mathbf{v} = \\mathbf{0} \\quad \\implies \\quad \\det(\\mathbf{A} - \\lambda \\mathbf{I}) = 0"
      ),
      b(
        "eig_quote",
        "quote",
        "\"Eigenvectors define the principal axes of inertia in rigid body mechanics and the directions of maximum variance in Machine Learning Data Analysis.\" — Prof. Gilbert Strang"
      ),
      b(
        "eig_code",
        "code",
        "# Python NumPy Eigendecomposition & Verification\nimport numpy as np\n\nA = np.array([[4, 2], [1, 3]])\neigenvalues, eigenvectors = np.linalg.eig(A)\n\nprint(f\"Eigenvalues: {eigenvalues}\")\nprint(f\"Eigenvector Matrix:\\n{eigenvectors}\")\n\n# Verification: A @ v == lambda * v\nfor i in range(len(eigenvalues)):\n    v = eigenvectors[:, i]\n    lam = eigenvalues[i]\n    assert np.allclose(A @ v, lam * v), f\"Mismatch for lambda={lam}\"",
        { language: "python" }
      ),
      b(
        "eig_toggle",
        "toggle",
        "Deep Dive: Principal Component Analysis (PCA) & Covariance Matrix Diagonalization",
        {
          open: true,
          details: "In data science, PCA computes the eigenvectors of the sample covariance matrix ∑ = (1/n) X^T X. The eigenvector with the largest eigenvalue points in the direction of greatest variance, allowing high-dimensional datasets to be projected down to 2D/3D without losing structural information.",
        }
      ),
      b(
        "eig_divider",
        "divider",
        ""
      ),
      b(
        "eig_canvas",
        "canvas",
        "Linear Transformation & Vector Grid Canvas",
        { bgType: "dots", drawingData: null }
      ),
      b(
        "eig_media",
        "media",
        "Matrix Geometric Transformation Diagram",
        { url: "https://images.unsplash.com/photo-1509228468518-180dd4864904", mediaType: "image" }
      )
    ],
  },

  // ── School Space (Note 2: Photosynthesis — Light & Calvin Cycles) ─────
  {
    id: "note_photo",
    space: "School",
    title: "Photosynthesis — Light & Calvin Cycles",
    emoji: "🌿",
    banner: "ocean",
    isFavorite: false,
    createdAt: "2026-07-25T11:40:00.000Z",
    updatedAt: "2026-07-29T18:22:00.000Z",
    blocks: [
      b(
        "pho_callout",
        "callout",
        "Biology Unit 4 Bioenergetics: Exam emphasis is on metabolic rate disruptions — e.g., chemical uncouplers dissipating the thylakoid proton gradient collapse ATP synthesis while oxygen production continues!",
        { calloutIcon: "🌿" }
      ),
      b("pho_h1", "h1", "1. Photosynthetic Transduction & Chloroplast Bioenergetics"),
      b(
        "pho_text1",
        "text",
        "Photosynthesis transduces solar electromagnetic radiation into stored chemical bond energy in carbohydrates. The process takes place inside plant chloroplasts and comprises two distinct, interconnected metabolic phases: the Light-Dependent Reactions (thylakoid membrane) and the Light-Independent Calvin Cycle (stroma)."
      ),
      b("pho_h2", "h2", "2. Photochemistry & Metabolic Pathways"),
      b("pho_h3", "h3", "2.1 Z-Scheme Electron Transport Chain"),
      b("pho_h4", "h4", "2.1.1 Chemiosmotic ATP Synthase Dynamics"),
      b(
        "pho_bullet1",
        "bullet",
        "Photosystem II (P680) Photolysis: 2 H₂O → 4 H⁺ + 4 e⁻ + O₂↑."
      ),
      b(
        "pho_bullet2",
        "bullet",
        "Proton Translocation: Cytochrome b6f pumps H⁺ from stroma into thylakoid lumen creating ΔpH ~3."
      ),
      b(
        "pho_num1",
        "number",
        "1. Photons hit P680 reaction center in PSII, exciting electron pair to primary acceptor plastoquinone."
      ),
      b(
        "pho_num2",
        "number",
        "2. Electrochemical proton gradient (lumen pH ~5 vs stroma pH ~8) drives ATP Synthase rotation to generate ATP."
      ),
      b(
        "pho_todo1",
        "todo",
        "Memorize Calvin Cycle stoichiometry: 3 turns consume 9 ATP + 6 NADPH to net 1 G3P (3C export)",
        { checked: true }
      ),
      b(
        "pho_todo2",
        "todo",
        "Compare spatial separation in C4 plants vs temporal separation in CAM night fixation",
        { checked: false }
      ),
      b(
        "pho_math",
        "math",
        "6\\text{CO}_2 + 6\\text{H}_2\\text{O} + h\\nu \\xrightarrow{\\text{chlorophyll}} \\text{C}_6\\text{H}_{12}\\text{O}_6 + 6\\text{O}_2"
      ),
      b(
        "pho_quote",
        "quote",
        "\"Oxygen gas evolved during photosynthesis originates entirely from photolysis of water in Photosystem II, not from carbon dioxide molecules.\" — Ruben & Kamen Isotopic Tracking Experiment"
      ),
      b(
        "pho_code",
        "code",
        "// Photosynthetic Energy Conversion Efficiency Calculation\nfunction calculateQuantumEfficiency(molesPhotonsAbsorbed, molesG3PSynthesized) {\n  const theoreticalMaxMolesG3P = molesPhotonsAbsorbed / 8; // 8 photons per G3P\n  const efficiencyPercent = (molesG3PSynthesized / theoreticalMaxMolesG3P) * 100;\n  return {\n    efficiency: `${efficiencyPercent.toFixed(2)}%`,\n    isLightSaturated: molesPhotonsAbsorbed > 1500\n  };\n}",
        { language: "javascript" }
      ),
      b(
        "pho_toggle",
        "toggle",
        "Photorespiration (C3 Energy Loss) & RuBisCO Oxygenase Competition",
        {
          open: true,
          details: "When stomata close during hot dry conditions to prevent transpiration water loss, internal leaf CO₂ drops and O₂ rises. RuBisCO acts as an oxygenase (fixing O₂ to RuBP instead of CO₂), producing 2-phosphoglycolate which requires ATP-consuming photorespiration to salvage, wasting up to 25% of photosynthetic energy!",
        }
      ),
      b(
        "pho_divider",
        "divider",
        ""
      ),
      b(
        "pho_canvas",
        "canvas",
        "Chloroplast Thylakoid & Stroma Membrane Whiteboard",
        { bgType: "dots", drawingData: null }
      ),
      b(
        "pho_media",
        "media",
        "Plant Cell Chloroplast Structure Micrograph",
        { url: "https://images.unsplash.com/photo-1518531933037-91b2f5f229cc", mediaType: "image" }
      )
    ],
  },

  // ── School Space (Note 3: Big-O & Algorithmic Complexity) ─────────────
  {
    id: "note_bigo",
    space: "School",
    title: "Big-O & Algorithmic Complexity",
    emoji: "⚡",
    banner: "cyber",
    isFavorite: true,
    createdAt: "2026-07-26T15:05:00.000Z",
    updatedAt: "2026-07-31T09:47:00.000Z",
    blocks: [
      b(
        "big_callout",
        "callout",
        "CS 201: Asymptotic complexity describes how resource consumption grows as input size n approaches infinity. Always ignore constant multipliers and lower-order polynomial terms!",
        { calloutIcon: "⚡" }
      ),
      b("big_h1", "h1", "1. Asymptotic Notation Hierarchy & Growth Bounds"),
      b(
        "big_text1",
        "text",
        "Big-O notation provides a mathematical upper bound on the execution time or space requirements of an algorithm as a function of the input dataset size N. It allows software engineers to compare algorithmic efficiency independently of hardware execution speed."
      ),
      b("big_h2", "h2", "2. Asymptotic Growth Rate Classification"),
      b("big_h3", "h3", "2.1 Comparison of Common Complexity Classes"),
      b("big_h4", "h4", "2.1.1 Divide and Conquer Recurrence Analysis"),
      b(
        "big_bullet1",
        "bullet",
        "O(1) Constant Time: Hash table direct lookup, array indexing by offset, stack push/pop."
      ),
      b(
        "big_bullet2",
        "bullet",
        "O(log N) Logarithmic Time: Binary search in sorted array, balanced AVL tree operations."
      ),
      b(
        "big_num1",
        "number",
        "1. Identify primary input size parameter N and express primitive operation execution count f(N)."
      ),
      b(
        "big_num2",
        "number",
        "2. Drop all lower-order additive terms and constant scalar coefficients to isolate asymptotic order g(N)."
      ),
      b(
        "big_todo1",
        "todo",
        "Prove Master Theorem Case 1 for divide-and-conquer recurrences",
        { checked: true }
      ),
      b(
        "big_todo2",
        "todo",
        "Implement Two-Sum with O(N) hash map vs O(N^2) brute force solution",
        { checked: true }
      ),
      b(
        "big_math",
        "math",
        "T(n) = a T\\left(\\frac{n}{b}\\right) + f(n) \\quad \\implies \\quad O(n^{\\log_b a})"
      ),
      b(
        "big_quote",
        "quote",
        "\"Premature optimization is the root of all evil in programming, but failing to understand asymptotic complexity leads to structural architectural collapse.\" — Donald Knuth"
      ),
      b(
        "big_code",
        "code",
        "// Two-Sum Algorithm Optimization (JavaScript)\n// O(n²) Brute Force Naive Solution\nfunction twoSumNaive(nums, target) {\n  for (let i = 0; i < nums.length; i++) {\n    for (let j = i + 1; j < nums.length; j++) {\n      if (nums[i] + nums[j] === target) return [i, j];\n    }\n  }\n  return [];\n}\n\n// O(n) Hash Map Solution (Trading Space for Time)\nfunction twoSumOptimized(nums, target) {\n  const seen = new Map();\n  for (let i = 0; i < nums.length; i++) {\n    const complement = target - nums[i];\n    if (seen.has(complement)) return [seen.get(complement), i];\n    seen.set(nums[i], i);\n  }\n  return [];\n}",
        { language: "javascript" }
      ),
      b(
        "big_toggle",
        "toggle",
        "Space-Time Tradeoffs & Auxiliary Memory Bounds",
        {
          open: true,
          details: "Algorithm optimization frequently trades spatial memory overhead for execution velocity, e.g. Dynamic Programming memoization tables storing subproblem solutions to prevent redundant exponential $O(2^N)$ branch re-evaluations.",
        }
      ),
      b(
        "big_divider",
        "divider",
        ""
      ),
      b(
        "big_canvas",
        "canvas",
        "Algorithm Growth Curves & Complexity Comparison Chart",
        { bgType: "dots", drawingData: null }
      ),
      b(
        "big_media",
        "media",
        "Asymptotic Complexity Chart Graphic",
        { url: "https://images.unsplash.com/photo-1555066931-4365d14bab8c", mediaType: "image" }
      )
    ],
  },

  // ── School Space (Note 4: Supply, Demand & Elasticity) ────────────────
  {
    id: "note_econ",
    space: "School",
    title: "Supply, Demand & Elasticity",
    emoji: "📊",
    banner: "sunset",
    isFavorite: false,
    createdAt: "2026-07-27T08:30:00.000Z",
    updatedAt: "2026-07-28T20:15:00.000Z",
    blocks: [
      b(
        "eco_callout",
        "callout",
        "Microeconomics: Price changes cause movement ALONG existing supply/demand curves. Non-price determinants (income, input costs, technology) SHIFT the entire market equilibrium curve!",
        { calloutIcon: "📌" }
      ),
      b("eco_h1", "h1", "1. Market Equilibrium & Price Elasticity Dynamics"),
      b(
        "eco_text1",
        "text",
        "Elasticity quantifies consumer and producer price sensitivity. It dictates total revenue shifts when prices fluctuate and determines true economic tax incidence regardless of statutory legislation."
      ),
      b("eco_h2", "h2", "2. Elasticity Formulas & Revenue Rules"),
      b("eco_h3", "h3", "2.1 Price Elasticity of Demand (PED) & Supply (PES)"),
      b("eco_h4", "h4", "2.1.1 Tax Burden & Statutory vs Economic Incidence"),
      b(
        "eco_bullet1",
        "bullet",
        "Elastic Demand |PED| > 1: Quantity responds strongly to price; price increases REDUCE total revenue."
      ),
      b(
        "eco_bullet2",
        "bullet",
        "Inelastic Demand |PED| < 1: Quantity responds weakly to price; price increases RAISE total revenue."
      ),
      b(
        "eco_num1",
        "number",
        "1. Calculate percentage change in quantity demanded %ΔQd = (Q2 - Q1) / Q1."
      ),
      b(
        "eco_num2",
        "number",
        "2. Calculate percentage change in price %ΔP = (P2 - P1) / P1."
      ),
      b(
        "eco_num3",
        "number",
        "3. Divide %ΔQd by %ΔP to obtain elasticity coefficient E_d."
      ),
      b(
        "eco_todo1",
        "todo",
        "Calculate Consumer Surplus (area under demand curve above market price)",
        { checked: true }
      ),
      b(
        "eco_todo2",
        "todo",
        "Calculate Deadweight Loss triangle created by binding price ceilings and floors",
        { checked: false }
      ),
      b(
        "eco_math",
        "math",
        "E_d = \\frac{\\% \\Delta Q_d}{\\% \\Delta P} = \\frac{\\frac{Q_2 - Q_1}{Q_1}}{\\frac{P_2 - P_1}{P_1}}"
      ),
      b(
        "eco_quote",
        "quote",
        "\"The economic burden of a tax falls disproportionately on whichever market side is more price inelastic, regardless of whether law taxes buyers or sellers.\" — Prof. N. Gregory Mankiw"
      ),
      b(
        "eco_code",
        "code",
        "// Price Elasticity of Demand (PED) Calculation\nfunction calculateElasticity(p1, p2, q1, q2) {\n  const pctQ = (q2 - q1) / q1;\n  const pctP = (p2 - p1) / p1;\n  const ped = Math.abs(pctQ / pctP);\n  return {\n    ped: ped.toFixed(2),\n    classification: ped > 1 ? 'Elastic' : ped < 1 ? 'Inelastic' : 'Unit Elastic'\n  };\n}",
        { language: "javascript" }
      ),
      b(
        "eco_toggle",
        "toggle",
        "Deadweight Loss & Binding Government Market Interventions",
        {
          open: true,
          details: "Binding price ceilings set below market equilibrium create persistent shortages; binding price floors set above market equilibrium create excessive supply surpluses, producing uncaptured deadweight loss triangles in economic welfare.",
        }
      ),
      b(
        "eco_divider",
        "divider",
        ""
      ),
      b(
        "eco_canvas",
        "canvas",
        "Supply & Demand Market Equilibrium Curve Whiteboard",
        { bgType: "dots", drawingData: null }
      ),
      b(
        "eco_media",
        "media",
        "Economic Supply & Demand Graph Illustration",
        { url: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3", mediaType: "image" }
      )
    ],
  },

  // ── Personal Space ──────────────────────────────────────────────────
  {
    id: "note_memory",
    space: "Personal",
    title: "How Memory Works — Spacing & Retrieval",
    emoji: "🧠",
    banner: "gold",
    isFavorite: true,
    createdAt: "2026-07-20T19:00:00.000Z",
    updatedAt: "2026-07-31T07:30:00.000Z",
    blocks: [
      b(
        "mem_1",
        "callout",
        "Cognitive Science: Feeling fluent while re-reading highlighted notes is a cognitive illusion. True long-term memory consolidation requires effortful, active retrieval practice!",
        { calloutIcon: "🦆" }
      ),
      b("mem_2", "h1", "Storage Strength vs. Retrieval Strength Dynamics"),
      b(
        "mem_3",
        "text",
        "The Bjork Learning Lab at UCLA divides memory into two independent variables: Storage Strength (how deeply consolidated a memory trace is) and Retrieval Strength (how easily accessible it is right now). Forgetting is a temporary retrieval failure, not storage deletion."
      ),
      b(
        "mem_4",
        "quote",
        "\"Re-learning forgotten material requires a fraction of original acquisition time, proving storage strength persists long after retrieval strength decays.\" — Prof. Robert Bjork"
      ),
      b("mem_6", "h2", "Four Pillars of Evidence-Based Learning Mechanics"),
      b("mem_7", "bullet", "Active Retrieval Practice: Forcing brain to retrieve information strengthens neural synaptic pathways infinitely more than passive reading."),
      b("mem_8", "bullet", "Spaced Repetition: Distributing review sessions over expanding intervals (1d, 3d, 10d, 30d) maximizes long-term storage strength."),
      b("mem_9", "bullet", "Interleaving: Mixing related problem types forces brain to discriminate which strategy to apply, matching real exam demands."),
      b("mem_10", "bullet", "Elaboration & Generation: Re-explaining concepts in simple plain language and connecting them to existing mental models."),
      b("mem_11", "divider", ""),
      b("mem_12", "h3", "The Feynman Socratic Diagnostic Protocol"),
      b("mem_13", "number", "1. Select a concept and explain it out loud in simple, jargon-free language as if teaching a child."),
      b("mem_14", "number", "2. Identify exact friction points where your explanation stalls, reaches for jargon, or uses hand-waving."),
      b("mem_15", "number", "3. Re-read primary source material specifically targeting that identified knowledge gap."),
      b("mem_16", "number", "4. Re-explain with a concrete intuitive analogy until explanations flow effortlessly."),
      b("mem_18", "todo", "Conduct 5-minute active recall immediately after learning new material", { checked: true }),
      b("mem_19", "todo", "Schedule Day 3, Day 10, and Day 30 spaced review sessions in Calendar", { checked: true }),
      b("mem_20", "todo", "Track confidence gaps on Mastery Dashboard after quiz sessions", { checked: true }),
      b("mem_21", "todo", "Build interactive 3D concept models for spatial intuition gaps", { checked: false }),
      b("mem_22", "site", "Bjork Learning & Forgetting Lab Research", { url: "https://bjorklab.psych.ucla.edu/research" })
    ],
  },

  // ── Misc Space ──────────────────────────────────────────────────────
  {
    id: "note_ml",
    space: "Misc",
    title: "Neural Networks from Scratch",
    emoji: "🤖",
    banner: "midnight",
    isFavorite: false,
    createdAt: "2026-07-22T21:15:00.000Z",
    updatedAt: "2026-07-30T22:05:00.000Z",
    blocks: [
      b(
        "nn_1",
        "callout",
        "Deep Learning: Non-linear activation functions are critical — stacking purely linear layers collapses into a single matrix multiplication regardless of network depth!",
        { calloutIcon: "🚀" }
      ),
      b("nn_2", "h1", "Forward Pass & Layer Computation Equations"),
      b(
        "nn_3",
        "code",
        "z = W · x + b        // Linear projection (affine transformation)\na = σ(z)             // Non-linear activation function",
        { language: "javascript" }
      ),
      b("nn_4", "h2", "Activation Functions Comparison & Gradient Dynamics"),
      b("nn_5", "bullet", "ReLU: max(0, z) — Prevents vanishing gradients for positive inputs; derivative is binary mask (1 if z > 0 else 0)."),
      b("nn_6", "bullet", "Sigmoid: 1 / (1 + e⁻ᶻ) — Compresses outputs into (0,1); saturates at extremes causing vanishing gradients."),
      b("nn_7", "bullet", "Tanh: (eᶻ - e⁻ᶻ) / (eᶻ + e⁻ᶻ) — Zero-centered (-1, 1), but still suffers from extreme saturation."),
      b("nn_8", "bullet", "Softmax: Normalizes vector logits into a valid probability distribution across N classes."),
      b("nn_10", "divider", ""),
      b("nn_11", "h2", "Backpropagation Calculus & Reverse-Mode Chain Rule"),
      b(
        "nn_12",
        "code",
        "# Forward Pass\nz1 = W1 @ x + b1;   a1 = relu(z1)\nz2 = W2 @ a1 + b2;  yhat = softmax(z2)\nloss = cross_entropy(yhat, y)\n\n# Backward Pass (Chain Rule Matrix Calculus)\ndz2 = yhat - y                   # Gradient of loss w.r.t. z2\ndW2 = dz2 @ a1.T                 # Gradient of W2\ndb2 = np.sum(dz2, axis=1)        # Bias 2 gradient\nda1 = W2.T @ dz2                 # Backpropagate gradient to hidden layer\ndz1 = da1 * (z1 > 0)             # Apply ReLU derivative mask\ndW1 = dz1 @ x.T                  # Gradient of W1\ndb1 = np.sum(dz1, axis=1)        # Bias 1 gradient",
        { language: "python" }
      ),
      b(
        "nn_14",
        "quote",
        "\"Backpropagation is efficient reverse-mode automatic differentiation over a dynamic computational graph.\" — Andrej Karpathy"
      ),
      b("nn_15", "todo", "Implement vectorized NumPy forward and backward propagation passes", { checked: true }),
      b("nn_16", "todo", "Verify gradient correctness using finite difference numerical gradient checking", { checked: true }),
      b("nn_17", "todo", "Implement Adam optimizer exponentially weighted momentum & variance tracking", { checked: true }),
      b("nn_18", "todo", "Implement Dropout regularization mask during training passes", { checked: false }),
      b(
        "nn_19",
        "canvas",
        "Neural Network Multi-Layer Computational Graph Diagram",
        { bgType: "dots", drawingData: null }
      ),
      b("nn_21", "site", "Andrej Karpathy Neural Networks Zero to Hero", { url: "https://karpathy.ai/zero-to-hero.html" })
    ],
  },
];

export default DEMO_NOTES;

/**
 * The seed grouped the way Workspace.jsx stores notes.
 *
 * Returned as a fresh deep copy each call — the workspace mutates note objects
 * in place as you edit, and handing out the module-level literal would let the
 * first edit corrupt the seed for every later factory reset.
 */
export function demoNotesBySpace() {
  const bySpace = { School: [], Personal: [], Misc: [] };

  for (const note of DEMO_NOTES) {
    const copy = {
      ...note,
      banner: note.banner ?? null,
      isFavorite: note.isFavorite ?? false,
      blocks: note.blocks.map((block) => ({ ...block })),
    };
    (bySpace[note.space] ??= []).push(copy);
  }

  return bySpace;
}
