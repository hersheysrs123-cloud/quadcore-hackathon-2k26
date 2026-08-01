/**
 * Seed content for a first-run workspace.
 *
 * Grouped into notesBySpace. Authentic, textbook-grade study notes with
 * Action Buttons contextualized throughout the text and real populated
 * collapsible dropdown toggle sections:
 *   - Headings (h1, h2, h3, h4)
 *   - Plain text & Quote blocks
 *   - Bullet, Numbered, and To-Do lists
 *   - Callout frames with custom icons (💡, 🌿, ⚡, 📌, 🧠, 🤖, 🚀, 🔬)
 *   - Code blocks with syntax highlighting & complete implementations
 *   - Populated Dropdown Toggles with sub-panels
 *   - Horizontal dividers
 *   - Interactive Canvas drawing blocks (pre-configured with dotted grid)
 *   - Note Link embeds & Website Bookmarks
 *   - Contextually distributed Action buttons
 */

const b = (id, type, content, extra = {}) => ({
  id,
  type,
  content,
  ...extra,
});

export const DEMO_NOTES = [
  // ── School ──────────────────────────────────────────────────────────
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
        "eig_1",
        "callout",
        "Linear Algebra — Lecture 7. Core Insight: Matrix multiplication transforms geometric space, but eigenvectors represent invariant axes that maintain their spatial orientation under transformation!",
        { calloutIcon: "💡" }
      ),
      b("eig_2", "h1", "Linear Transformations & Eigenbasis Decomposition"),
      b(
        "eig_3",
        "text",
        "When an n×n matrix A multiplies a vector v, it typically changes both the vector's length and direction. Eigenvectors are special non-zero vectors whose direction remains completely unchanged by the linear transformation — they are merely scaled by a scalar factor λ."
      ),
      b("eig_4", "h2", "The Master Transformation Equation"),
      b(
        "eig_5",
        "code",
        "A v = λ v\n\nWhere:\n  A  — n×n linear transformation matrix\n  v  — non-zero eigenvector (invariant direction axis)\n  λ  — eigenvalue scalar (scaling factor along the vector axis)"
      ),
      b("eig_6", "action", "🦆 Test Equation Understanding with Rubber Duck", { actionKind: "socratic" }),
      b(
        "eig_7",
        "quote",
        "\"Most vectors get knocked off their line by a matrix transformation. Eigenvectors are the invariant directions that survive it.\" — Prof. Gilbert Strang (MIT)"
      ),
      b("eig_8", "h3", "Geometric & Physical Spectrum of Eigenvalues (λ)"),
      b("eig_9", "number", "1. λ > 1 — Vector stretches outward along its span line; spatial orientation remains strictly unchanged."),
      b("eig_10", "number", "2. 0 < λ < 1 — Vector squashes inward toward the origin along its original vector span."),
      b("eig_11", "number", "3. λ < 0 — Vector flips 180° into the exact opposite direction along the exact same line through the origin."),
      b("eig_12", "number", "4. λ = 0 — Vector falls inside the matrix null space; matrix A completely collapses it to the origin point."),
      b("eig_13", "divider", ""),
      b("eig_14", "h2", "Step-by-Step Characteristic Polynomial Derivation"),
      b(
        "eig_15",
        "text",
        "To find eigenvalues, rearrange Av = λv into the homogeneous equation (A − λI)v = 0. A non-zero vector v exists if and only if matrix (A − λI) is singular (non-invertible), which requires its determinant to equal zero."
      ),
      b("eig_16", "todo", "Form the characteristic equation: det(A − λI) = 0", { checked: true }),
      b("eig_17", "todo", "Compute characteristic polynomial & find roots λ₁, λ₂, ..., λₙ", { checked: true }),
      b("eig_18", "todo", "Substitute each λₖ back into (A − λₖI)v = 0 to solve null space for basis vectors", { checked: true }),
      b("eig_19", "todo", "Verify linear independence of eigenvectors to confirm diagonalizability", { checked: false }),
      b("eig_20", "action", "⚡ Generate Practice Quiz on Polynomial Derivation", { actionKind: "quiz" }),
      b(
        "eig_21",
        "code",
        "Example Matrix A = [[2, 1],\n                    [1, 2]]\n\n1. Characteristic Equation:\n   det(A - λI) = det([[2-λ, 1], [1, 2-λ]]) = (2-λ)² - 1 = λ² - 4λ + 3 = 0\n   Factoring: (λ - 3)(λ - 1) = 0  =>  Eigenvalues: λ₁ = 3,  λ₂ = 1\n\n2. Eigenvector for λ₁ = 3:\n   (A - 3I)v = [[-1, 1], [1, -1]][x, y]ᵀ = [0, 0]ᵀ  =>  -x + y = 0  =>  v₁ = [1, 1]ᵀ\n\n3. Eigenvector for λ₂ = 1:\n   (A - 1I)v = [[1, 1], [1, 1]][x, y]ᵀ = [0, 0]ᵀ  =>  x + y = 0  =>  v₂ = [1, -1]ᵀ"
      ),
      b(
        "eig_22",
        "toggle",
        "Deep Dive: Matrix Diagonalization A = PDP⁻¹ & Computational Efficiency",
        {
          open: true,
          details: "If matrix A has n linearly independent eigenvectors, we construct modal matrix P (columns are eigenvectors) and diagonal matrix D (entries are eigenvalues). Then A = PDP⁻¹. Computing matrix powers Aᵏ simplifies from O(k · n³) matrix multiplications down to Aᵏ = P Dᵏ P⁻¹, where Dᵏ is computed in O(n) by raising diagonal entries to power k!",
        }
      ),
      b("eig_23", "action", "✨ Explain Matrix Diagonalization Concept", { actionKind: "explain" }),
      b(
        "eig_24",
        "toggle",
        "Geometric Edge Cases: Shear Transformations & Complex Conjugates",
        {
          open: true,
          details: "A shear matrix [[1,1],[0,1]] has only ONE eigenvector direction [1,0]ᵀ despite being a 2×2 matrix. Geometrically, horizontal lines remain horizontal, but off-axis vectors tilt. Pure 2D rotation matrices have no real eigenvectors because all real vectors rotate off their line; their eigenvalues are complex conjugate pairs e^(iθ).",
        }
      ),
      b(
        "eig_25",
        "canvas",
        "Interactive Vector Span & Eigenbasis Visual Whiteboard",
        {
          bgType: "dots",
          drawingData: null,
        }
      ),
      b("eig_26", "action", "🧊 View 3D Spatial Vector Model", { actionKind: "3d" }),
      b("eig_27", "h3", "Real-World Applications Across Science & Engineering"),
      b("eig_28", "bullet", "Google PageRank: Web ranking vector is the dominant eigenvector of the stochastic web link transition matrix (Power Iteration method)."),
      b("eig_29", "bullet", "Principal Component Analysis (PCA): Eigenvectors of dataset covariance matrix define orthogonal axes of maximum variance."),
      b("eig_30", "bullet", "Vibrational Modes & Civil Engineering: Natural frequencies of bridges and buildings are square roots of stiffness matrix eigenvalues."),
      b("eig_31", "bullet", "Quantum Mechanics: Physical observables correspond to eigenvalues of Hermitian operators in Hilbert space."),
      b("eig_32", "notelink", "Algorithmic Complexity Connection", { targetNoteTitle: "Big-O & Algorithmic Complexity" }),
      b("eig_33", "site", "3Blue1Brown Essence of Linear Algebra", { url: "https://www.3blue1brown.com/topics/linear-algebra" }),
      b("eig_34", "action", "📊 View Mastery Gap Heatmap", { actionKind: "mastery" })
    ],
  },

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
        "pho_1",
        "callout",
        "Biology Unit 4: Exam emphasis is on metabolic rate disruptions — e.g., how chemical uncouplers dissipating the thylakoid proton gradient collapse ATP synthesis while oxygen production continues!",
        { calloutIcon: "🌿" }
      ),
      b("pho_2", "h1", "Photosynthetic Bioenergetics & Metabolic Pathways"),
      b(
        "pho_3",
        "text",
        "Photosynthesis transduces solar electromagnetic radiation into stored chemical bond energy in carbohydrates. The process takes place inside plant chloroplasts and comprises two distinct, interconnected metabolic phases: the Light-Dependent Reactions (thylakoid) and the Light-Independent Calvin Cycle (stroma)."
      ),
      b("pho_4", "h2", "Balanced Master Reaction Equation"),
      b("pho_5", "code", "6 CO₂ + 6 H₂O + Photons (hv) → C₆H₁₂O₆ (Glucose) + 6 O₂"),
      b(
        "pho_6",
        "quote",
        "\"Oxygen gas evolved during photosynthesis originates entirely from photolysis of water in Photosystem II, not from carbon dioxide molecules.\" — Ruben & Kamen Isotopic Tracking"
      ),
      b("pho_7", "h2", "Stage 1 — Light-Dependent Reactions (Thylakoid Membrane)"),
      b("pho_8", "bullet", "Photons hit P680 reaction center in Photosystem II (PSII), exciting pair of electrons to high energy state."),
      b("pho_9", "bullet", "Photolysis of H₂O: Water-splitting complex extracts 4 e- from 2 H₂O, releasing 4 H+ into lumen and 1 O₂ gas molecule."),
      b("pho_10", "bullet", "Plastoquinone (PQ) and Cytochrome b6f complex transfer electrons down chain, pumping H+ from stroma into thylakoid lumen."),
      b("pho_11", "bullet", "Chemiosmotic ATP Synthesis: Electrochemical proton gradient (pH ~5 in lumen vs pH ~8 in stroma) drives ATP Synthase rotation to produce ATP."),
      b("pho_12", "bullet", "Photosystem I (PSI): Photons re-excite electrons at P700; Ferredoxin-NADP+ reductase (FNR) reduces NADP+ + H+ into NADPH."),
      b("pho_13", "action", "⚡ Launch Fast Recall Quiz on Light Reactions", { actionKind: "quiz" }),
      b("pho_14", "divider", ""),
      b("pho_15", "h2", "Stage 2 — Light-Independent Calvin-Benson Cycle (Stroma)"),
      b("pho_16", "number", "1. Carbon Fixation: RuBisCO catalyzes carboxylation of 5C RuBP with CO₂, forming unstable 6C intermediate splitting into 2x 3-PGA."),
      b("pho_17", "number", "2. Reduction Phase: ATP phosphorylates 3-PGA to 1,3-BPG; NADPH reduces it to glyceraldehyde-3-phosphate (G3P)."),
      b("pho_18", "number", "3. Regeneration Phase: 5 out of every 6 G3P molecules are rearranged using ATP to regenerate 3 molecules of RuBP (5C)."),
      b("pho_19", "action", "✨ Explain Calvin Cycle Concept", { actionKind: "explain" }),
      b("pho_20", "todo", "Memorize stoichiometry: 3 turns consume 9 ATP + 6 NADPH to net 1 G3P (3C export)", { checked: true }),
      b("pho_21", "todo", "Memorize full glucose synthesis requirement: 6 turns, 18 ATP + 12 NADPH", { checked: true }),
      b("pho_22", "todo", "Compare spatial separation (C4 Bundle Sheath) vs temporal separation (CAM Night Fixation)", { checked: true }),
      b("pho_23", "todo", "Review RuBisCO oxygenase competitive binding affinity under elevated temperature", { checked: false }),
      b(
        "pho_24",
        "toggle",
        "Photorespiration (C3 Efficiency Loss) & Evolutionary Adaptations (C4 & CAM)",
        {
          open: true,
          details: "When stomata close during hot dry conditions to prevent transpiration water loss, internal leaf CO₂ drops and O₂ rises. RuBisCO acts as an oxygenase (fixing O₂ to RuBP instead of CO₂), producing 2-phosphoglycolate which requires ATP-consuming photorespiration to salvage, wasting up to 25% of photosynthetic energy!",
        }
      ),
      b("pho_25", "h3", "Comparative Evolutionary Workarounds"),
      b("pho_26", "bullet", "C4 Plants (Maize, Sugarcane): PEP carboxylase fixes CO₂ into 4C oxaloacetate in mesophyll cells; concentrates CO₂ around RuBisCO in specialized bundle sheath cells."),
      b("pho_27", "bullet", "CAM Plants (Pineapples, Cacti): Open stomata at night to fix CO₂ into malic acid stored in vacuoles; release CO₂ during daytime for Calvin cycle with closed stomata."),
      b("pho_28", "action", "📅 Open Study Timer & Calendar", { actionKind: "calendar" }),
      b("pho_29", "site", "Khan Academy Photosynthesis Bioenergetics", { url: "https://www.khanacademy.org/science/biology/photosynthesis-in-plants" }),
      b("pho_30", "action", "🦆 Test Understanding with Rubber Duck", { actionKind: "socratic" })
    ],
  },

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
        "big_1",
        "callout",
        "CS 201: Asymptotic complexity describes how resource consumption grows as input size n approaches infinity. Always ignore constant multipliers and lower-order polynomial terms!",
        { calloutIcon: "⚡" }
      ),
      b("big_2", "h1", "Asymptotic Notation Hierarchy & Growth Rates"),
      b("big_3", "bullet", "O(1) — Constant Time: Hash table lookup, direct array indexing, stack push/pop."),
      b("big_4", "bullet", "O(log n) — Logarithmic Time: Binary search in sorted arrays, balanced BST operations."),
      b("big_5", "bullet", "O(n) — Linear Time: Single-pass array traversal, linear search, counting sort."),
      b("big_6", "bullet", "O(n log n) — Linearithmic Time: Optimal comparison sorting (Merge Sort, Timsort, QuickSort average)."),
      b("big_7", "bullet", "O(n²) — Quadratic Time: Double nested loops over input (Bubble, Selection, Insertion Sort)."),
      b("big_8", "bullet", "O(n³) — Cubic Time: Matrix multiplication naive algorithms."),
      b("big_9", "bullet", "O(2ⁿ) — Exponential Time: Recursive subset generation, brute-force knapsack."),
      b("big_10", "bullet", "O(n!) — Factorial Time: Generating all permutations of an array (Heap's Algorithm)."),
      b("big_11", "divider", ""),
      b("big_12", "h2", "Case Study: Optimizing Two-Sum Algorithm from O(n²) to O(n)"),
      b(
        "big_13",
        "code",
        "// O(n²) Brute Force Solution — Nested Loops (Space O(1))\nfunction twoSumNaive(nums, target) {\n  for (let i = 0; i < nums.length; i++) {\n    for (let j = i + 1; j < nums.length; j++) {\n      if (nums[i] + nums[j] === target) return [i, j];\n    }\n  }\n  return [];\n}\n\n// O(n) Optimized Solution — Hash Map Lookup (Space O(n))\nfunction twoSumOptimized(nums, target) {\n  const seen = new Map();\n  for (let i = 0; i < nums.length; i++) {\n    const complement = target - nums[i];\n    if (seen.has(complement)) return [seen.get(complement), i];\n    seen.set(nums[i], i);\n  }\n  return [];\n}"
      ),
      b("big_14", "action", "✨ Explain Complexity Tradeoffs", { actionKind: "explain" }),
      b(
        "big_15",
        "quote",
        "\"Trading memory space for execution speed is the single most recurring optimization paradigm in software engineering.\" — Jon Bentley"
      ),
      b("big_16", "h3", "Rigorous Theoretical Proofs & Boundaries"),
      b(
        "big_17",
        "text",
        "Why is comparison sorting bounded by Ω(n log n)? Any comparison sort can be modeled as a decision tree with n! leaf nodes (possible permutations). A binary tree of height h has at most 2ʰ leaves. Thus 2ʰ ≥ n! => h ≥ log₂(n!) = Θ(n log n) by Stirling's approximation! Counting sort bypasses this floor because it uses key-indexed array placement instead of pairwise element comparison."
      ),
      b("big_18", "action", "⚡ Launch Fast Quiz Drill on Comparison Bounds", { actionKind: "quiz" }),
      b("big_19", "todo", "Understand decision tree proof showing comparison sort lower bound is Ω(n log n)", { checked: true }),
      b("big_20", "todo", "Distinguish Amortized O(1) push operations from worst-case dynamic array resizing O(n)", { checked: true }),
      b("big_21", "todo", "Account for auxiliary call stack frame space in recursive algorithm space complexity", { checked: true }),
      b("big_22", "todo", "Master Master Theorem cases for divide-and-conquer recurrence T(n) = aT(n/b) + f(n)", { checked: false }),
      b(
        "big_23",
        "toggle",
        "Amortized Analysis Methods (Aggregate Method, Accounting Method, Potential Method)",
        {
          open: true,
          details: "Amortized analysis guarantees average cost per operation over a worst-case sequence of operations. For dynamic arrays (vector in C++), capacity doubles when full. Resizing costs O(n), but occurs only at insertions n = 1, 2, 4, 8, 16... Total cost for n insertions is n + (1 + 2 + 4 + ... + n) < 3n, giving an amortized cost of O(1) per push!",
        }
      ),
      b("big_24", "notelink", "Neural Network Computational Complexity", { targetNoteTitle: "Neural Networks from Scratch" }),
      b("big_25", "site", "Big-O Cheat Sheet Matrix Reference", { url: "https://www.bigocheatsheet.com" }),
      b("big_26", "action", "📊 View Mastery Gap Heatmap", { actionKind: "mastery" }),
      b("big_27", "action", "🦆 Test Understanding with Rubber Duck", { actionKind: "socratic" })
    ],
  },

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
        "eco_1",
        "callout",
        "Microeconomics: Price changes cause movement ALONG existing curves. Non-price determinants (income, technology, input costs) SHIFT the entire market equilibrium curve!",
        { calloutIcon: "📌" }
      ),
      b("eco_2", "h1", "Market Price Elasticity of Demand (PED) & Supply (PES)"),
      b(
        "eco_3",
        "text",
        "Elasticity quantifies consumer and producer price sensitivity. It dictates total revenue shifts when prices fluctuate and determines true economic tax incidence."
      ),
      b("eco_4", "h2", "Elasticity Formulas & Revenue Rules"),
      b(
        "eco_5",
        "code",
        "PED = (% Change in Quantity Demanded) / (% Change in Price)\n\n|PED| > 1  →  Elastic (Quantity responds more than price; price increase REDUCES Total Revenue)\n|PED| < 1  →  Inelastic (Quantity responds less than price; price increase RAISES Total Revenue)\n|PED| = 1  →  Unit Elastic (Total Revenue remains unchanged)"
      ),
      b("eco_6", "action", "🧊 View 3D Interactive Spatial Model", { actionKind: "3d" }),
      b("eco_7", "h3", "Determinants of Price Elasticity"),
      b("eco_8", "number", "1. Availability of close substitutes (more substitutes = significantly higher elasticity)."),
      b("eco_9", "number", "2. Necessity vs. Luxury classification (necessities like insulin/petrol are highly inelastic)."),
      b("eco_10", "number", "3. Budget share (goods taking large percentage of income are more elastic)."),
      b("eco_11", "number", "4. Time horizon allowed for consumer behavioral adjustment (longer time = higher elasticity)."),
      b("eco_12", "divider", ""),
      b("eco_13", "h3", "Tax Incidence & Welfare Economics"),
      b(
        "eco_14",
        "quote",
        "\"The economic burden of a tax falls disproportionately on whichever market side is more price inelastic, regardless of whether statutory law taxes buyers or sellers.\""
      ),
      b("eco_15", "action", "🦆 Test Understanding with Rubber Duck", { actionKind: "socratic" }),
      b("eco_16", "todo", "Calculate Consumer Surplus (area under demand curve above market equilibrium price)", { checked: true }),
      b("eco_17", "todo", "Calculate Producer Surplus (area above supply curve below market equilibrium price)", { checked: true }),
      b("eco_18", "todo", "Derive Deadweight Loss triangle created by binding price ceilings and price floors", { checked: true }),
      b("eco_19", "todo", "Calculate tax revenue rectangle vs welfare loss under inelastic demand", { checked: false }),
      b(
        "eco_20",
        "canvas",
        "Supply & Demand Market Equilibrium & Elasticity Whiteboard",
        { bgType: "dots", drawingData: null }
      ),
      b("eco_21", "site", "Investopedia Price Elasticity Overview", { url: "https://www.investopedia.com/terms/e/elasticity.asp" }),
      b("eco_22", "action", "⚡ Launch Fast Recall Quiz", { actionKind: "quiz" }),
      b("eco_23", "action", "📊 View Mastery Gap Heatmap", { actionKind: "mastery" })
    ],
  },

  // ── Personal ────────────────────────────────────────────────────────
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
      b("mem_5", "action", "🦆 Start Rubber Duck Socratic Session", { actionKind: "socratic" }),
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
      b("mem_17", "action", "📅 Open Study Timer & Calendar", { actionKind: "calendar" }),
      b("mem_18", "todo", "Conduct 5-minute active recall immediately after learning new material", { checked: true }),
      b("mem_19", "todo", "Schedule Day 3, Day 10, and Day 30 spaced review sessions in Calendar", { checked: true }),
      b("mem_20", "todo", "Track confidence gaps on Mastery Dashboard after quiz sessions", { checked: true }),
      b("mem_21", "todo", "Build interactive 3D concept models for spatial intuition gaps", { checked: false }),
      b("mem_22", "site", "Bjork Learning & Forgetting Lab Research", { url: "https://bjorklab.psych.ucla.edu/research" }),
      b("mem_23", "action", "📊 View Mastery Gap Heatmap", { actionKind: "mastery" }),
      b("mem_24", "action", "⚡ Launch Fast Recall Quiz", { actionKind: "quiz" })
    ],
  },

  // ── Misc ────────────────────────────────────────────────────────────
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
        "z = W · x + b        // Linear projection (affine transformation)\na = σ(z)             // Non-linear activation function"
      ),
      b("nn_4", "h2", "Activation Functions Comparison & Gradient Dynamics"),
      b("nn_5", "bullet", "ReLU: max(0, z) — Prevents vanishing gradients for positive inputs; derivative is binary mask (1 if z > 0 else 0)."),
      b("nn_6", "bullet", "Sigmoid: 1 / (1 + e⁻ᶻ) — Compresses outputs into (0,1); saturates at extremes causing vanishing gradients."),
      b("nn_7", "bullet", "Tanh: (eᶻ - e⁻ᶻ) / (eᶻ + e⁻ᶻ) — Zero-centered (-1, 1), but still suffers from extreme saturation."),
      b("nn_8", "bullet", "Softmax: Normalizes vector logits into a valid probability distribution across N classes."),
      b("nn_9", "action", "⚡ Launch Fast Recall Quiz on Activations", { actionKind: "quiz" }),
      b("nn_10", "divider", ""),
      b("nn_11", "h2", "Backpropagation Calculus & Reverse-Mode Chain Rule"),
      b(
        "nn_12",
        "code",
        "# Forward Pass\nz1 = W1 @ x + b1;   a1 = relu(z1)\nz2 = W2 @ a1 + b2;  yhat = softmax(z2)\nloss = cross_entropy(yhat, y)\n\n# Backward Pass (Chain Rule Matrix Calculus)\ndz2 = yhat - y                   # Gradient of loss w.r.t. z2\ndW2 = dz2 @ a1.T                 # Gradient of W2\ndb2 = np.sum(dz2, axis=1)        # Bias 2 gradient\nda1 = W2.T @ dz2                 # Backpropagate gradient to hidden layer\ndz1 = da1 * (z1 > 0)             # Apply ReLU derivative mask\ndW1 = dz1 @ x.T                  # Gradient of W1\ndb1 = np.sum(dz1, axis=1)        # Bias 1 gradient"
      ),
      b("nn_13", "action", "✨ Explain Backprop Concept", { actionKind: "explain" }),
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
      b("nn_20", "action", "🧊 View 3D Neural Tensor Model", { actionKind: "3d" }),
      b("nn_21", "site", "Andrej Karpathy Neural Networks Zero to Hero", { url: "https://karpathy.ai/zero-to-hero.html" }),
      b("nn_22", "action", "📊 View Mastery Gap Heatmap", { actionKind: "mastery" })
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
