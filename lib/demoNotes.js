/**
 * Seed content for a first-run workspace.
 *
 * Grouped into notesBySpace. Authentic, textbook-grade study notes with
 * populated collapsible dropdown toggle sections, dedicated inline equation blocks,
 * display math KaTeX containers, code snippets, verified educational bookmarks, and media embeds.
 *
 * NOTE: Every note in DEMO_NOTES contains comprehensive textbook-grade study blocks.
 * Note 6 (Quantum Mechanics) contains EVERY SINGLE SUPPORTED BLOCK TYPE:
 * h1, h2, h3, h4, text, bullet, number, todo, toggle, callout, quote,
 * divider, code, math, inlinemath, site, media, table, and columns!
 */

const b = (id, type, content, extra = {}) => ({
  id,
  type,
  content,
  ...extra,
});

export const DEMO_NOTES = [
  // ── School Space (Note 1: Calculus — Differentiation, Integration & Differential Equations) ──
  {
    id: "note_calc",
    space: "School",
    spaceId: "School",
    title: "Calculus — Differentiation, Integration & Differential Equations",
    emoji: "📈",
    banner: "cyber",
    isFavorite: true,
    createdAt: "2026-07-24T09:12:00.000Z",
    updatedAt: "2026-07-30T14:03:00.000Z",
    blocks: [
      b(
        "calc_callout_intro",
        "callout",
        "Calculus Core Insight: Differentiation measures instantaneous rates of change, while Integration measures accumulated continuous quantities. The Fundamental Theorem of Calculus establishes that differentiation and integration are exact mathematical inverses of each other!",
        { calloutIcon: "💡" }
      ),
      b("calc_h1", "h1", "1. Foundations of Limits, Continuity & Instantaneous Variation"),
      b(
        "calc_text_intro",
        "text",
        "Calculus provides the rigorous mathematical framework for analyzing dynamic physical systems and continuous rates of change. The derivative of a single-variable real function is formally defined as the limiting value of the difference quotient as the interval shrinks to zero:"
      ),
      b(
        "calc_inlinemath_diff_quotient",
        "inlinemath",
        "$f'(x) = \\lim_{\\Delta x \\to 0} \\frac{f(x+\\Delta x) - f(x)}{\\Delta x}$"
      ),
      b(
        "calc_text_epsilon_delta",
        "text",
        "To establish this intuition on unshakeable foundations, Augustin-Louis Cauchy and Karl Weierstrass formulated the epsilon-delta definition of a limit, guaranteeing that output tolerances can be bounded by constraining input neighborhoods:"
      ),
      b(
        "calc_inlinemath_eps_delta",
        "inlinemath",
        "$\\forall \\epsilon > 0, \\exists \\delta > 0 : 0 < |x - c| < \\delta \\implies |f(x) - L| < \\epsilon$"
      ),
      b(
        "calc_quote",
        "quote",
        "\"Calculus is the most powerful weapon of thought ever devised by the human mind for analyzing the physical universe.\" — Sir Isaac Newton"
      ),
      b(
        "calc_site",
        "site",
        "Paul's Online Math Notes — Calculus I: Derivatives, Limits & Integrals",
        { url: "https://tutorial.math.lamar.edu/Classes/CalcI/CalcI.aspx" }
      ),
      b(
        "calc_toggle_ftc",
        "toggle",
        "Deep Dive: The Fundamental Theorem of Calculus (FTC Parts 1 & 2)",
        {
          open: true,
          details: "The Fundamental Theorem of Calculus unifies differential and integral calculus into a cohesive whole.\n\nPart 1: If a function is continuous on an interval, the definite accumulation function defines an antiderivative whose derivative recovers the original function.\n\nPart 2: The definite integral equals the difference between antiderivative evaluations at the upper and lower boundary points, providing an exact evaluation method without taking infinite Riemann sum limits.",
        }
      ),
      b("calc_h2", "h2", "2. Analytical Derivations & Numerical Integration Solvers"),
      b(
        "calc_text_deriv_rules",
        "text",
        "When evaluating composite functional mappings, the Chain Rule decomposes multi-layer rates into sequential product multiplications, while the Product Rule handles interdependent interacting terms:"
      ),
      b(
        "calc_inlinemath_product_rule",
        "inlinemath",
        "$\\frac{d}{dx}[u(x) \\cdot v(x)] = u'(x)v(x) + u(x)v'(x)$"
      ),
      b(
        "calc_math_ftc_display",
        "math",
        "\\frac{d}{dx}\\left[ f(g(x)) \\right] = f'(g(x)) \\cdot g'(x) \\qquad \\text{and} \\qquad \\int_{a}^{b} f(x)\\,dx = F(b) - F(a)"
      ),
      b(
        "calc_text_numerical",
        "text",
        "In physical engineering systems where symbolic antiderivatives do not exist in closed form, numerical integration schemes like Simpson's 1/3 Rule approximate the integrand with piecewise parabolic interpolations:"
      ),
      b(
        "calc_inlinemath_simpson_err",
        "inlinemath",
        "\\text{Error}_{\\text{Simpson}} = -\\frac{(b-a)^5}{2880 n^4} f^{(4)}(\\xi) \\quad \\text{for} \\quad \\xi \\in [a, b]"
      ),
      b(
        "calc_code_simpson",
        "code",
        "// 4th-Order Runge-Kutta (RK4) ODE Solver & Simpson's 1/3 Numerical Integrator\nfunction simpsonsRule(f, a, b, n = 100) {\n  if (n % 2 !== 0) n += 1;\n  const h = (b - a) / n;\n  let sum = f(a) + f(b);\n  for (let i = 1; i < n; i++) {\n    const x = a + i * h;\n    sum += (i % 2 === 0 ? 2 : 4) * f(x);\n  }\n  return (h / 3) * sum;\n}\n\nfunction rk4(dydt, y0, t0, tEnd, steps = 100) {\n  const h = (tEnd - t0) / steps;\n  let t = t0, y = y0;\n  for (let i = 0; i < steps; i++) {\n    const k1 = dydt(t, y);\n    const k2 = dydt(t + h / 2, y + (h / 2) * k1);\n    const k3 = dydt(t + h / 2, y + (h / 2) * k2);\n    const k4 = dydt(t + h, y + h * k3);\n    y += (h / 6) * (k1 + 2 * k2 + 2 * k3 + k4);\n    t += h;\n  }\n  return y;\n}\n\nconst f = (x) => Math.pow(x, 3) - 4 * x;\nconsole.log(\"∫[0,3] (x³ - 4x)dx =\", simpsonsRule(f, 0, 3).toFixed(4));",
        { language: "javascript" }
      ),
      b(
        "calc_num1",
        "number",
        "Construct the difference quotient across the test interval."
      ),
      b(
        "calc_num2",
        "number",
        "Evaluate the limit as interval delta approaches zero."
      ),
      b(
        "calc_num3",
        "number",
        "Verify differentiability and confirm convergence of left and right limits."
      ),
      b(
        "calc_num4",
        "number",
        "Apply Fundamental Theorem Part 1 to compute continuous accumulation functions."
      ),
      b(
        "calc_media",
        "media",
        "Calculus Tangent Line & Definite Integral Graph",
        { url: "https://images.unsplash.com/photo-1509228468518-180dd4864904", mediaKind: "image" }
      ),
      b("calc_h3", "h3", "3. Differential Equations, Integrating Factors & Taylor Expansions"),
      b(
        "calc_text_ode_intro",
        "text",
        "Differential equations model systems where the rate of growth depends dynamically on current state variables, such as population dynamics, RC electric circuits, and damped harmonic oscillators:"
      ),
      b(
        "calc_inlinemath_ode_std",
        "inlinemath",
        "\\frac{dy}{dx} + P(x)y = Q(x) \\implies \\mu(x) = \\exp\\left(\\int P(x)\\,dx\\right)"
      ),
      b(
        "calc_bullet1",
        "bullet",
        "Power Rule: Differentiating a monomial scales by the exponent and decreases degree by one."
      ),
      b(
        "calc_bullet2",
        "bullet",
        "Mean Value Theorem: Guarantees at least one point where instantaneous tangent slope equals average secant slope."
      ),
      b(
        "calc_bullet3",
        "bullet",
        "L'Hôpital's Rule: Resolves indeterminate forms by evaluating the ratio of derivative terms."
      ),
      b(
        "calc_bullet4",
        "bullet",
        "Taylor Series Expansion: Represents analytic functions as infinite polynomial series centered at a point."
      ),
      b(
        "calc_toggle_taylor",
        "toggle",
        "Taylor Series Expansion & Remainder Estimation Bounds",
        {
          open: false,
          details: "The Taylor series represents smooth analytic functions as infinite polynomial expansions with coefficients determined by successive derivatives at the expansion center.\n\nThe Lagrange error bound establishes that the remainder deviation is strictly constrained by the maximum higher-order derivative across the interval.",
        }
      ),
      b(
        "calc_divider",
        "divider",
        ""
      ),
      b("calc_h4", "h4", "4. Mastery Verification, Proof Drills & Problem Sets"),
      b(
        "calc_text_practice_intro",
        "text",
        "Verify theoretical mastery by working through these foundational derivations and analytical problem sets:"
      ),
      b(
        "calc_inlinemath_byparts",
        "inlinemath",
        "\\int u\\,dv = u v - \\int v\\,du \\qquad \\text{(Integration by Parts)}"
      ),
      b(
        "calc_todo1",
        "todo",
        "Master Integration by Parts derived from the Product Rule",
        { checked: true }
      ),
      b(
        "calc_todo2",
        "todo",
        "Solve related rates problem for a draining conical tank",
        { checked: true }
      ),
      b(
        "calc_todo3",
        "todo",
        "Verify Taylor Series expansion of trigonometric functions centered at zero",
        { checked: false }
      ),
      b(
        "calc_todo4",
        "todo",
        "Derive separation of variables solution for logistic population growth differential equation",
        { checked: false }
      ),
      b(
        "calc_callout_pitfall",
        "callout",
        "Calculus Exam Warning: When using the Chain Rule on composite functions like the square of a trigonometric sine term, differentiate the outer power first, then the sine term, and finally the innermost linear argument!",
        { calloutIcon: "⚠️" }
      ),
    ],
  },

  // ── School Space (Note 2: Cellular Bioenergetics — Photosynthesis & Respiration Cycles) ─────
  {
    id: "note_photo",
    space: "School",
    spaceId: "School",
    title: "Cellular Bioenergetics — Photosynthesis & Respiration Cycles",
    emoji: "🌿",
    banner: "ocean",
    isFavorite: false,
    createdAt: "2026-07-25T11:40:00.000Z",
    updatedAt: "2026-07-29T18:22:00.000Z",
    blocks: [
      b(
        "pho_callout_intro",
        "callout",
        "Biology Unit 4 Bioenergetics: Metabolic reactions couple exergonic electron transfers with endergonic ATP synthesis. Uncouplers dissipating the proton gradient collapse ATP generation while electron transport and oxygen consumption continue unimpeded!",
        { calloutIcon: "🌿" }
      ),
      b("pho_h1", "h1", "1. Solar Photon Transduction & Chloroplast Ultrastructure"),
      b(
        "pho_text_intro",
        "text",
        "Photosynthesis transduces solar electromagnetic radiation into stored chemical potential within organic carbon bonds. The light-dependent reactions occur across the thylakoid membrane, driven by the photolysis of water:"
      ),
      b(
        "pho_inlinemath_photolysis",
        "inlinemath",
        "$2\\text{H}_2\\text{O} \\xrightarrow{h\\nu} 4\\text{H}^+ + 4e^- + \\text{O}_2 \\uparrow$"
      ),
      b(
        "pho_text_redox",
        "text",
        "Terminal electron transfer reduces oxidized nicotinamide coenzymes to generate high-energy reducing equivalents for the Calvin Cycle:"
      ),
      b(
        "pho_inlinemath_nadph",
        "inlinemath",
        "$\\text{NADP}^+ + 2e^- + \\text{H}^+ \\xrightarrow{\\text{FNR}} \\text{NADPH}$"
      ),
      b(
        "pho_quote",
        "quote",
        "\"Oxygen gas evolved during photosynthesis originates entirely from photolysis of water in Photosystem II, not from carbon dioxide molecules.\" — Ruben & Kamen Isotopic Tracing Experiment (1941)"
      ),
      b(
        "pho_site",
        "site",
        "Nature Reviews Molecular Cell Biology — Structural Basis of Photosystem II",
        { url: "https://www.nature.com/nrm/" }
      ),
      b(
        "pho_toggle_pmf",
        "toggle",
        "Chemiosmotic Coupling & Mitchell's Proton Motive Force",
        {
          open: true,
          details: "Peter Mitchell's chemiosmotic hypothesis established that ATP synthesis is driven by an electrochemical proton gradient across the thylakoid membrane.\n\nThe proton motive force combines the electrical membrane potential and chemical pH gradient. In thylakoids, the pH gradient across the membrane accounts for over 80% of the total driving force.",
        }
      ),
      b("pho_h2", "h2", "2. The Z-Scheme Electron Transport Chain & Thermodynamic Yields"),
      b(
        "pho_text_zscheme",
        "text",
        "Excited electrons cascade down a redox potential gradient from Photosystem II (P680) through Plastoquinone, Cytochrome b6f, and Plastocyanin to Photosystem I (P700):"
      ),
      b(
        "pho_inlinemath_delta_g",
        "inlinemath",
        "$\\Delta G^\\circ = -n F \\Delta E^\\circ \\qquad (\\Delta G^\\circ = +2870\\text{ kJ/mol total for glucose})$"
      ),
      b(
        "pho_math_net_reaction",
        "math",
        "6\\text{CO}_2 + 6\\text{H}_2\\text{O} + h\\nu \\xrightarrow{\\text{chlorophyll}} \\text{C}_6\\text{H}_{12}\\text{O}_6 + 6\\text{O}_2 \\qquad (\\Delta G^\\circ = +2870\\text{ kJ/mol})"
      ),
      b(
        "pho_text_quantum_yield",
        "text",
        "Thermodynamic efficiency is governed by quantum yield: absorbing 8 photons minimum provides the 4 electrons necessary to reduce one molecule of carbon dioxide into carbohydrate:"
      ),
      b(
        "pho_inlinemath_atp_synthase",
        "inlinemath",
        "3\\text{ H}^+_{\\text{translocated}} \\xrightarrow{F_0F_1} 1\\text{ ATP}_{\\text{synthesized}}"
      ),
      b(
        "pho_code_bioenergetics",
        "code",
        "// Photosynthetic Energy Conversion Efficiency & Quantum Yield Calculator\nfunction calculateQuantumEfficiency(molesPhotonsAbsorbed, molesG3PSynthesized) {\n  const theoreticalMaxG3P = molesPhotonsAbsorbed / 8;\n  const efficiencyPercent = (molesG3PSynthesized / theoreticalMaxG3P) * 100;\n  const freeEnergyCapturedKcal = molesG3PSynthesized * 350;\n  return {\n    quantumYield: (molesG3PSynthesized / molesPhotonsAbsorbed).toFixed(4),\n    efficiency: `${efficiencyPercent.toFixed(2)}%`,\n    energyCapturedKcal: freeEnergyCapturedKcal.toFixed(1),\n    lightStatus: molesPhotonsAbsorbed > 1500 ? \"Light Saturated\" : \"Light Limited\"\n  };\n}\n\nconsole.log(calculateQuantumEfficiency(2400, 250));",
        { language: "javascript" }
      ),
      b(
        "pho_num1",
        "number",
        "Photons excite antenna chlorophyll complexes, funneling resonance energy to P680."
      ),
      b(
        "pho_num2",
        "number",
        "Water-splitting manganese complex extracts 4 electrons, releasing O2."
      ),
      b(
        "pho_num3",
        "number",
        "Plastoquinone and Cytochrome b6f translocate protons into thylakoid lumen."
      ),
      b(
        "pho_num4",
        "number",
        "Proton flux through ATP Synthase drives ADP phosphorylation while ferredoxin reduces NADP+."
      ),
      b(
        "pho_media",
        "media",
        "Plant Cell Chloroplast Structure Micrograph",
        { url: "https://images.unsplash.com/photo-1518531933037-91b2f5f229cc", mediaKind: "image" }
      ),
      b("pho_h3", "h3", "3. RuBisCO Kinetics, Photorespiration & C4/CAM Adaptations"),
      b(
        "pho_text_calvin",
        "text",
        "In the stroma, the enzyme RuBisCO fixes carbon dioxide onto ribulose-1,5-bisphosphate, initiating the three-phase Calvin Cycle (Fixation, Reduction, and RuBP Regeneration):"
      ),
      b(
        "pho_inlinemath_calvin_stoich",
        "inlinemath",
        "3\\text{ CO}_2 + 9\\text{ ATP} + 6\\text{ NADPH} \\to 1\\text{ G3P} + 9\\text{ ADP} + 6\\text{ NADP}^+"
      ),
      b(
        "pho_bullet1",
        "bullet",
        "Photorespiration: RuBisCO acts as oxygenase in hot dry conditions, producing toxic 2-phosphoglycolate."
      ),
      b(
        "pho_bullet2",
        "bullet",
        "C4 Kranz Anatomy: Spatial separation of initial PEP carboxylation in mesophyll from Calvin Cycle in bundle-sheath cells."
      ),
      b(
        "pho_bullet3",
        "bullet",
        "CAM Succulent Metabolism: Temporal separation where stomata open exclusively at night to store CO2 as malate."
      ),
      b(
        "pho_bullet4",
        "bullet",
        "Cyclic Photophosphorylation: Electrons cycle through PSI and Cytochrome b6f to generate additional ATP without NADPH."
      ),
      b(
        "pho_toggle_c4_cam",
        "toggle",
        "C4 Spatial Concentration vs CAM Temporal Separation Mechanisms",
        {
          open: false,
          details: "C4 Plants (Corn, Sugarcane) utilize PEP carboxylase to fix carbon dioxide into 4-carbon oxaloacetate, shuttling malate into bundle-sheath cells to maintain saturated carbon dioxide around RuBisCO.\n\nCAM Plants open stomata only at night to minimize transpirational water loss, storing malic acid in central vacuoles before daytime decarboxylation.",
        }
      ),
      b(
        "pho_divider",
        "divider",
        ""
      ),
      b("pho_h4", "h4", "4. Experimental Bioenergetics, Inhibitors & Diagnostic Tasks"),
      b(
        "pho_text_lab_analysis",
        "text",
        "Analyze experimental metabolic disruptions and evaluate energy conversion yields with these targeted diagnostic tasks:"
      ),
      b(
        "pho_inlinemath_dcmut",
        "inlinemath",
        "\\text{DCMU Inhibitor} \\implies \\text{Blocks } Q_B \\text{ site in PSII} \\implies \\text{Halts both ATP and NADPH synthesis}"
      ),
      b(
        "pho_todo1",
        "todo",
        "Memorize Calvin Cycle stoichiometry: 3 turns consume 9 ATP + 6 NADPH to net 1 G3P export",
        { checked: true }
      ),
      b(
        "pho_todo2",
        "todo",
        "Compare spatial Kranz anatomy in C4 plants vs temporal CO2 fixation in CAM succulents",
        { checked: false }
      ),
      b(
        "pho_todo3",
        "todo",
        "Evaluate non-cyclic photophosphorylation vs cyclic electron flow around Photosystem I",
        { checked: true }
      ),
      b(
        "pho_todo4",
        "todo",
        "Review Ruben & Kamen isotopic tracing experiments demonstrating oxygen evolution from water",
        { checked: false }
      ),
      b(
        "pho_callout_summary",
        "callout",
        "Metabolic Rule of Thumb: In non-cyclic photophosphorylation, the ratio of ATP to NADPH produced is approximately 1.28, but the Calvin cycle requires a 1.5 ratio. Cyclic electron flow makes up this exact ATP deficit!",
        { calloutIcon: "📌" }
      ),
    ],
  },

  // ── School Space (Note 3: Data Structures & Asymptotic Algorithmic Complexity) ─────────────
  {
    id: "note_bigo",
    space: "School",
    spaceId: "School",
    title: "Data Structures & Asymptotic Algorithmic Complexity",
    emoji: "⚡",
    banner: "cyber",
    isFavorite: true,
    createdAt: "2026-07-26T15:05:00.000Z",
    updatedAt: "2026-07-31T09:47:00.000Z",
    blocks: [
      b(
        "big_callout_intro",
        "callout",
        "CS 201: Asymptotic complexity describes how execution time and space requirements scale as input size N approaches infinity. Always drop constant scalar multipliers and non-dominant polynomial terms when determining Big-O bounds!",
        { calloutIcon: "⚡" }
      ),
      b("big_h1", "h1", "1. Asymptotic Analysis & Formal Mathematical Growth Bounds"),
      b(
        "big_text_intro",
        "text",
        "Big-O notation establishes a rigorous mathematical upper bound on algorithm resource consumption, formalizing the rate of growth beyond a threshold input scale:"
      ),
      b(
        "big_inlinemath_bigo_def",
        "inlinemath",
        "$f(N) = O(g(N)) \\iff \\exists c > 0, N_0 > 0 : |f(N)| \\le c \\cdot |g(N)| \\quad \\forall N \\ge N_0$"
      ),
      b(
        "big_text_omega_theta",
        "text",
        "Conversely, Big-Omega defines the asymptotic lower bound, and Big-Theta establishes tight asymptotic bounds where upper and lower constraints coincide:"
      ),
      b(
        "big_inlinemath_theta_def",
        "inlinemath",
        "$f(N) = \\Theta(g(N)) \\iff f(N) = O(g(N)) \\quad \\text{and} \\quad f(N) = \\Omega(g(N))$"
      ),
      b(
        "big_quote",
        "quote",
        "\"Premature optimization is the root of all evil in programming, but failing to understand asymptotic complexity leads to structural architectural collapse.\" — Donald Knuth"
      ),
      b(
        "big_site",
        "site",
        "Big-O Algorithm Complexity Cheat Sheet",
        { url: "https://www.bigocheatsheet.com/" }
      ),
      b(
        "big_toggle_amortized",
        "toggle",
        "Amortized Analysis: Aggregate, Accounting & Potential Methods",
        {
          open: true,
          details: "Amortized analysis averages the running time of operations over a sequence of actions, proving that an occasional expensive operation (such as array resizing) does not harm overall asymptotic efficiency.\n\nUnder geometric doubling, copying elements occurs only at powers of two, proving an amortized constant cost per insertion append.",
        }
      ),
      b("big_h2", "h2", "2. Divide and Conquer Recurrences & The Master Theorem"),
      b(
        "big_text_master_intro",
        "text",
        "The Master Theorem analyzes divide-and-conquer recurrences by comparing the cost of sub-problem division with the cost of combining intermediate results:"
      ),
      b(
        "big_inlinemath_master_form",
        "inlinemath",
        "$T(n) = a T\\left(\\frac{n}{b}\\right) + \\Theta(n^d)$"
      ),
      b(
        "big_math_master_theorem",
        "math",
        "T(n) = a T\\left(\\frac{n}{b}\\right) + f(n) \\qquad \\implies \\qquad T(n) = \\begin{cases} \\Theta(n^{\\log_b a}) & f(n) = O(n^{\\log_b a - \\epsilon}) \\\\ \\Theta(n^{\\log_b a} \\log^{k+1} n) & f(n) = \\Theta(n^{\\log_b a} \\log^k n) \\\\ \\Theta(f(n)) & f(n) = \\Omega(n^{\\log_b a + \\epsilon}) \\end{cases}"
      ),
      b(
        "big_text_mergesort",
        "text",
        "MergeSort divides arrays into 2 equal halves and merges in linear time, matching Case 2 of the Master Theorem to prove its optimal linearithmic worst-case bound:"
      ),
      b(
        "big_inlinemath_mergesort_bound",
        "inlinemath",
        "T(n) = 2 T\\left(\\frac{n}{2}\\right) + O(n) \\implies T(n) = \\Theta(n \\log n)"
      ),
      b(
        "big_code_algorithms",
        "code",
        "// Two-Sum Hash Map Optimization & MergeSort Implementation\nfunction twoSumOptimized(nums, target) {\n  const seen = new Map();\n  for (let i = 0; i < nums.length; i++) {\n    const complement = target - nums[i];\n    if (seen.has(complement)) return [seen.get(complement), i];\n    seen.set(nums[i], i);\n  }\n  return [];\n}\n\nfunction mergeSort(arr) {\n  if (arr.length <= 1) return arr;\n  const mid = Math.floor(arr.length / 2);\n  const left = mergeSort(arr.slice(0, mid));\n  const right = mergeSort(arr.slice(mid));\n  return merge(left, right);\n}\n\nfunction merge(left, right) {\n  const result = [];\n  let i = 0, j = 0;\n  while (i < left.length && j < right.length) {\n    if (left[i] < right[j]) result.push(left[i++]);\n    else result.push(right[j++]);\n  }\n  return result.concat(left.slice(i)).concat(right.slice(j));\n}",
        { language: "javascript" }
      ),
      b(
        "big_num1",
        "number",
        "Identify primary input scale parameter N and state variables."
      ),
      b(
        "big_num2",
        "number",
        "Express total operation count as an exact algebraic recurrence relation."
      ),
      b(
        "big_num3",
        "number",
        "Compare recursion branching factor a against problem size reduction factor b."
      ),
      b(
        "big_num4",
        "number",
        "Formulate tight Big-Theta bounds and verify auxiliary stack memory requirements."
      ),
      b(
        "big_media",
        "media",
        "Asymptotic Complexity Chart Graphic",
        { url: "https://images.unsplash.com/photo-1555066931-4365d14bab8c", mediaKind: "image" }
      ),
      b("big_h3", "h3", "3. Cache Locality, B-Trees & Space-Time Tradeoffs"),
      b(
        "big_text_cache_intro",
        "text",
        "Asymptotic Big-O assumes uniform memory access time. In modern CPU architectures, L1/L2/L3 cache misses and RAM fetch latencies introduce 100x cost penalties:"
      ),
      b(
        "big_inlinemath_cache_miss",
        "inlinemath",
        "\\text{L1 Cache Hit} \\approx 1\\text{ ns} \\qquad \\text{vs} \\qquad \\text{Main Memory Access} \\approx 100\\text{ ns}"
      ),
      b(
        "big_bullet1",
        "bullet",
        "O(1) Constant Time: Hash map lookups, array indexing, stack push/pop, doubly-linked list insertion."
      ),
      b(
        "big_bullet2",
        "bullet",
        "O(log N) Logarithmic Time: Binary search on sorted arrays, balanced AVL and Red-Black tree operations."
      ),
      b(
        "big_bullet3",
        "bullet",
        "O(N log N) Linearithmic Time: Optimal comparison-based sorting algorithms (MergeSort, HeapSort, QuickSort)."
      ),
      b(
        "big_bullet4",
        "bullet",
        "Quadratic Time: Nested pairwise iterations, bubble sort, insertion sort on inverted data."
      ),
      b(
        "big_toggle_btree",
        "toggle",
        "Cache Locality, CPU B-Trees & External Memory Hierarchy",
        {
          open: false,
          details: "Contiguous array memory layout enables hardware pre-fetching and SIMD vectorization, allowing an linear array scan to significantly outperform a pointer-chasing binary tree on practical dataset sizes.\n\nB-Trees exploit this principle by packing hundreds of keys into single cache block nodes, minimizing pointer traversals.",
        }
      ),
      b(
        "big_divider",
        "divider",
        ""
      ),
      b("big_h4", "h4", "4. Asymptotic Proofs, Tree Rotations & Benchmark Drills"),
      b(
        "big_text_practice_intro",
        "text",
        "Consolidate your algorithmic reasoning with these formal proofs and tree balancing tasks:"
      ),
      b(
        "big_inlinemath_avl_height",
        "inlinemath",
        "h_{\\text{AVL}} \\le 1.44 \\log_2(N + 2) - 0.328 \\implies O(\\log N) \\text{ guaranteed search}"
      ),
      b(
        "big_todo1",
        "todo",
        "Prove Master Theorem Case 1, 2, and 3 for divide-and-conquer recurrence relations",
        { checked: true }
      ),
      b(
        "big_todo2",
        "todo",
        "Implement Two-Sum with linear hash map vs quadratic brute force nested iteration",
        { checked: true }
      ),
      b(
        "big_todo3",
        "todo",
        "Prove amortized O(1) insertion cost for dynamic arrays with geometric doubling",
        { checked: false }
      ),
      b(
        "big_todo4",
        "todo",
        "Analyze AVL tree rebalancing rotations (LL, RR, LR, RL) and tree height bounds",
        { checked: false }
      ),
      b(
        "big_callout_summary",
        "callout",
        "Algorithm Strategy Tip: When designing graph algorithms, adjacency lists achieve linear traversal efficiency proportional to vertices plus edges for sparse graphs, whereas adjacency matrices require quadratic space and time regardless of edge count!",
        { calloutIcon: "📌" }
      ),
    ],
  },

  // ── School Space (Note 4: Wave Optics — Snell's Law, Total Internal Reflection & Thin-Film Interference) ──
  {
    id: "note_optics",
    space: "School",
    spaceId: "School",
    title: "Wave Optics — Snell's Law, Total Internal Reflection & Thin-Film Interference",
    emoji: "🌊",
    banner: "sunset",
    isFavorite: false,
    createdAt: "2026-07-27T08:30:00.000Z",
    updatedAt: "2026-07-28T20:15:00.000Z",
    blocks: [
      b(
        "opt_callout_intro",
        "callout",
        "Wave Optics Core Principle: Light propagates as transverse electromagnetic waves whose phase velocity decreases in optically denser media. When transitioning from a higher to lower index medium beyond the critical angle, refraction ceases and 100% of energy reflects via Total Internal Reflection!",
        { calloutIcon: "🌊" }
      ),
      b("opt_h1", "h1", "1. Wavefront Propagation, Fermat's Principle & Refraction"),
      b(
        "opt_text_intro",
        "text",
        "The wave theory of light models propagation through Huygens' Principle, where every point on a wavefront serves as a secondary source of spherical wavelets. The refractive index n defines the phase velocity ratio:"
      ),
      b(
        "opt_inlinemath_refractive_index",
        "inlinemath",
        "$n = \\frac{c}{v} = \\frac{\\lambda_0}{\\lambda_n} \\qquad (\\text{where } c \\approx 3.0 \\times 10^8 \\text{ m/s})$"
      ),
      b(
        "opt_text_fermat",
        "text",
        "Fermat's Principle of Least Time states that light travels along the path that minimizes transit time between two spatial points, directly yielding Snell's Law of Refraction:"
      ),
      b(
        "opt_inlinemath_snell",
        "inlinemath",
        "$n_1 \\sin(\\theta_1) = n_2 \\sin(\\theta_2)$"
      ),
      b(
        "opt_quote",
        "quote",
        "\"Nature always acts by the shortest and easiest path. Light in traversing different media chooses the path that minimizes total travel time.\" — Pierre de Fermat (1662)"
      ),
      b(
        "opt_site",
        "site",
        "HyperPhysics — Refraction, Snell's Law & Total Internal Reflection",
        { url: "http://hyperphysics.phy-astr.gsu.edu/hbase/geoopt/refr.html" }
      ),
      b(
        "opt_toggle_evanescent",
        "toggle",
        "Evanescent Wave Penetration & Frustrated Total Internal Reflection (FTIR)",
        {
          open: true,
          details: "Although Total Internal Reflection reflects 100% of time-averaged energy back into the denser medium, Maxwell's boundary conditions demand continuity of electric fields across the interface.\n\nThis generates an evanescent wave whose amplitude decays exponentially into the rarer medium. If a second dense medium is placed within a few wavelengths, energy tunnels through via Frustrated Total Internal Reflection (the optical analog of quantum tunneling!).",
        }
      ),
      b("opt_h2", "h2", "2. Critical Angle, Fresnel Reflection & Optical Solvers"),
      b(
        "opt_text_critical_angle",
        "text",
        "When light passes from an optically denser medium into a rarer medium, the angle of refraction exceeds the angle of incidence. At the Critical Angle, the refracted ray grazes along the boundary at exactly 90 degrees:"
      ),
      b(
        "opt_inlinemath_crit_angle",
        "inlinemath",
        "$\\theta_c = \\arcsin\\left(\\frac{n_2}{n_1}\\right) \\qquad (\\text{for } n_1 > n_2)$"
      ),
      b(
        "opt_math_fresnel",
        "math",
        "r_{\\perp} = \\frac{n_1 \\cos\\theta_1 - n_2 \\cos\\theta_2}{n_1 \\cos\\theta_1 + n_2 \\cos\\theta_2} \\qquad \\text{and} \\qquad r_{\\parallel} = \\frac{n_2 \\cos\\theta_1 - n_1 \\cos\\theta_2}{n_2 \\cos\\theta_1 + n_1 \\cos\\theta_2}"
      ),
      b(
        "opt_text_brewster",
        "text",
        "At Brewster's Angle, the parallel polarized reflection coefficient drops to zero, producing completely linearly polarized reflected light perpendicular to the plane of incidence:"
      ),
      b(
        "opt_inlinemath_brewster",
        "inlinemath",
        "\\tan(\\theta_B) = \\frac{n_2}{n_1} \\implies \\theta_1 + \\theta_2 = 90^\\circ"
      ),
      b(
        "opt_code_solver",
        "code",
        "// Snell's Law, Critical Angle & Fresnel Reflection Coefficient Calculator\nfunction calculateRefraction(n1, n2, theta1Degrees) {\n  const theta1Rad = (theta1Degrees * Math.PI) / 180;\n  const sinTheta1 = Math.sin(theta1Rad);\n  const sinTheta2 = (n1 / n2) * sinTheta1;\n  \n  if (sinTheta2 > 1.0) {\n    const criticalAngleDeg = (Math.asin(n2 / n1) * 180) / Math.PI;\n    return {\n      phenomenon: \"Total Internal Reflection (TIR)\",\n      criticalAngle: `${criticalAngleDeg.toFixed(2)}°`,\n      reflectance: \"100.0%\",\n      transmittance: \"0.0%\"\n    };\n  }\n  \n  const theta2Rad = Math.asin(sinTheta2);\n  const theta2Deg = (theta2Rad * 180) / Math.PI;\n  \n  // Fresnel perpendicular reflection\n  const cos1 = Math.cos(theta1Rad), cos2 = Math.cos(theta2Rad);\n  const rPerp = (n1 * cos1 - n2 * cos2) / (n1 * cos1 + n2 * cos2);\n  const RPerp = Math.pow(rPerp, 2);\n  \n  return {\n    phenomenon: \"Refraction\",\n    angleRefracted: `${theta2Deg.toFixed(2)}°`,\n    reflectancePerp: `${(RPerp * 100).toFixed(2)}%`,\n    transmittancePerp: `${((1 - RPerp) * 100).toFixed(2)}%`\n  };\n}\n\nconsole.log(calculateRefraction(1.5, 1.0, 45)); // Glass to Air at 45°",
        { language: "javascript" }
      ),
      b(
        "opt_num1",
        "number",
        "Identify refractive indices n1 (incident medium) and n2 (transmitting medium)."
      ),
      b(
        "opt_num2",
        "number",
        "Compute the critical angle from the ratio of transmitting to incident refractive indices if traveling from denser to rarer medium."
      ),
      b(
        "opt_num3",
        "number",
        "Evaluate Snell's Law to calculate the exact angle of refraction for incident angles below the critical threshold."
      ),
      b(
        "opt_num4",
        "number",
        "Calculate Fresnel reflection and transmission power coefficients across the interface."
      ),
      b(
        "opt_media",
        "media",
        "Laser Beam Refraction & Total Internal Reflection Diagram",
        { url: "https://images.unsplash.com/photo-1507413245164-6160d8298b31", mediaKind: "image" }
      ),
      b("opt_h3", "h3", "3. Thin-Film Interference & Phase Shifts"),
      b(
        "opt_text_interference_intro",
        "text",
        "Thin-film interference occurs when light waves reflected from the upper and lower boundaries of a thin dielectric film recombine, causing constructive or destructive interference based on optical path difference:"
      ),
      b(
        "opt_inlinemath_opd",
        "inlinemath",
        "\\Delta = 2 n d \\cos(\\theta_t) + \\delta_{\\text{phase}}"
      ),
      b(
        "opt_bullet1",
        "bullet",
        "Phase Inversion (180-degree shift): Reflection off a medium with higher refractive index introduces a half-wavelength phase shift."
      ),
      b(
        "opt_bullet2",
        "bullet",
        "Constructive Interference: Optical path difference matching odd half-wavelength multiples produces bright resonant color bands."
      ),
      b(
        "opt_bullet3",
        "bullet",
        "Destructive Interference: Phase inversion at both interfaces cancels reflected wavelengths, yielding complete transmission at target frequencies."
      ),
      b(
        "opt_bullet4",
        "bullet",
        "Fiber Optic Numerical Aperture: The refractive index differential between core and cladding dictates the maximum light acceptance cone angle."
      ),
      b(
        "opt_toggle_antireflection",
        "toggle",
        "Quarter-Wave Anti-Reflective Optical Coatings (e.g. Magnesium Fluoride MgF2)",
        {
          open: false,
          details: "To eliminate reflection on camera lenses, a thin film of Magnesium Fluoride is deposited at quarter-wavelength thickness. Since both boundary reflections experience a phase inversion, the round-trip path difference causes the two reflected waves to interfere destructively and cancel out completely, driving light transmission to nearly 100%!",
        }
      ),
      b(
        "opt_divider",
        "divider",
        ""
      ),
      b("opt_h4", "h4", "4. Laboratory Verification, Optical Setups & Problem Drills"),
      b(
        "opt_text_lab_drills",
        "text",
        "Verify your quantitative understanding of geometric and physical optics with these experimental derivations and problem sets:"
      ),
      b(
        "opt_inlinemath_young_fringe",
        "inlinemath",
        "y_m = \\frac{m \\lambda L}{d} \\qquad \\text{(Young's Double Slit Fringe Spacing)}"
      ),
      b(
        "opt_todo1",
        "todo",
        "Derive Snell's Law directly from Fermat's Principle of Least Time using calculus optimization",
        { checked: true }
      ),
      b(
        "opt_todo2",
        "todo",
        "Calculate critical angle for diamond (n = 2.42) into air (n = 1.00) vs water (n = 1.33)",
        { checked: true }
      ),
      b(
        "opt_todo3",
        "todo",
        "Design minimum quarter-wave coating thickness for 550nm green light on crown glass",
        { checked: false }
      ),
      b(
        "opt_todo4",
        "todo",
        "Verify Brewster's polarization angle for external reflection off water surface",
        { checked: false }
      ),
      b(
        "opt_callout_summary",
        "callout",
        "Optics Exam Trap: When calculating wavelength inside a dielectric medium, remember that frequency stays invariant! Only wave velocity and wavelength compress proportionally by the refractive index.",
        { calloutIcon: "📌" }
      ),
    ],
  },

  // ── Personal Space (Note 5: Cognitive Neuroscience & Deep Neural Networks) ────────────────
  {
    id: "note_neuro",
    space: "Personal",
    spaceId: "Personal",
    title: "Cognitive Neuroscience & Deep Neural Networks",
    emoji: "🧠",
    banner: "midnight",
    isFavorite: true,
    createdAt: "2026-07-28T10:00:00.000Z",
    updatedAt: "2026-08-01T16:30:00.000Z",
    blocks: [
      b(
        "neu_callout_intro",
        "callout",
        "Neuroscience & AI Convergence: Biological cortical columns inspired artificial convolutional and attention architectures. Synaptic plasticity governs biological learning, while backpropagation with gradient descent powers deep learning models!",
        { calloutIcon: "🧠" }
      ),
      b("neu_h1", "h1", "1. Biological Neurons & Artificial Perceptron Architectures"),
      b(
        "neu_text_intro",
        "text",
        "Biological neurons integrate electro-chemical dendritic signals at the axon hillock, firing all-or-none action potentials when voltage crosses threshold. Artificial perceptrons model this integration using non-linear activation functions:"
      ),
      b(
        "neu_inlinemath_activations",
        "inlinemath",
        "$\\sigma(z) = \\frac{1}{1 + e^{-z}} \\qquad \\text{and} \\qquad \\text{ReLU}(z) = \\max(0, z)$"
      ),
      b(
        "neu_text_backprop_intro",
        "text",
        "Backpropagation computes partial derivatives of the loss function with respect to weight matrices across all network layers using the multivariable chain rule:"
      ),
      b(
        "neu_inlinemath_gradient",
        "inlinemath",
        "$\\frac{\\partial \\mathcal{L}}{\\partial W^{[l]}} = \\frac{\\partial \\mathcal{L}}{\\partial Z^{[l]}} \\cdot (A^{[l-1]})^T$"
      ),
      b(
        "neu_quote",
        "quote",
        "\"When an axon of cell A is near enough to excite cell B and repeatedly or persistently takes part in firing it, some growth process takes place such that A's efficiency in firing B is increased.\" — Donald Hebb (1949)"
      ),
      b(
        "neu_site",
        "site",
        "Stanford CS231n — Deep Learning for Computer Vision",
        { url: "https://cs231n.stanford.edu/" }
      ),
      b(
        "neu_toggle_ltp",
        "toggle",
        "Long-Term Potentiation (LTP) & NMDA Receptor Calcium Influx",
        {
          open: true,
          details: "Long-Term Potentiation (LTP) is the primary cellular mechanism underlying learning and memory formation in the hippocampus.\n\nAt resting potential, NMDA receptors are blocked by extracellular magnesium ions. When intense depolarizing bursts unblock the channel, calcium ions rush into the postsynaptic dendritic spine, activating CaMKII and inserting additional AMPA receptors into the postsynaptic density, permanently strengthening synaptic transmission.",
        }
      ),
      b("neu_h2", "h2", "2. Hodgkin-Huxley Kinetics & Vectorized Backpropagation"),
      b(
        "neu_text_hodgkin",
        "text",
        "The biophysical Hodgkin-Huxley model describes the non-linear conductance kinetics of voltage-gated sodium and potassium ion channels governing action potential propagation:"
      ),
      b(
        "neu_inlinemath_hh_current",
        "inlinemath",
        "$I_{\\text{ion}} = \\bar{g}_{\\text{Na}} m^3 h (V - E_{\\text{Na}}) + \\bar{g}_{\\text{K}} n^4 (V - E_{\\text{K}}) + g_L (V - E_L)$"
      ),
      b(
        "neu_math_hh_equation",
        "math",
        "C_m \\frac{dV}{dt} = I_{\\text{inj}} - \\bar{g}_{\\text{Na}} m^3 h (V - E_{\\text{Na}}) - \\bar{g}_{\\text{K}} n^4 (V - E_{\\text{K}}) - g_L (V - E_L)"
      ),
      b(
        "neu_text_attention",
        "text",
        "Modern transformer architectures replace recurrent sequential bottlenecks with scaled dot-product self-attention mechanisms, computing context representations across entire token sequences simultaneously:"
      ),
      b(
        "neu_inlinemath_attention_def",
        "inlinemath",
        "\\text{Attention}(Q, K, V) = \\text{softmax}\\left(\\frac{Q K^T}{\\sqrt{d_k}}\\right) V"
      ),
      b(
        "neu_code_mlp",
        "code",
        "// Vectorized Multi-Layer Perceptron (Forward & Backward Pass) in JavaScript\nclass DenseLayer {\n  constructor(inputDim, outputDim) {\n    this.W = Array.from({ length: outputDim }, () =>\n      Array.from({ length: inputDim }, () => (Math.random() - 0.5) * Math.sqrt(2 / inputDim))\n    );\n    this.b = new Array(outputDim).fill(0);\n  }\n  forward(X) {\n    this.X = X;\n    this.Z = this.W.map((row, i) =>\n      row.reduce((sum, w, j) => sum + w * X[j], this.b[i])\n    );\n    this.A = this.Z.map((z) => Math.max(0, z)); // ReLU\n    return this.A;\n  }\n}\n\nconst layer = new DenseLayer(4, 2);\nconsole.log(\"Forward Activations:\", layer.forward([1.0, -0.5, 2.0, 0.1]));",
        { language: "javascript" }
      ),
      b(
        "neu_num1",
        "number",
        "Compute forward linear activations Z = W · A + b across all network layers."
      ),
      b(
        "neu_num2",
        "number",
        "Apply non-linear activation functions g(Z) to establish latent representation vectors."
      ),
      b(
        "neu_num3",
        "number",
        "Evaluate categorical cross-entropy loss against ground-truth target vectors."
      ),
      b(
        "neu_num4",
        "number",
        "Backpropagate error gradients and update weights via Adam optimizer with momentum."
      ),
      b(
        "neu_media",
        "media",
        "Neural Network Synaptic Connectome Graphic",
        { url: "https://images.unsplash.com/photo-1507413245164-6160d8298b31", mediaKind: "image" }
      ),
      b("neu_h3", "h3", "3. Spiking Networks, Neuromorphic Hardware & Transformers"),
      b(
        "neu_text_snn_intro",
        "text",
        "Unlike traditional deep artificial networks that evaluate dense floating-point operations on synchronous clocks, biological brains compute through event-driven asynchronous spike bursts:"
      ),
      b(
        "neu_inlinemath_spike_train",
        "inlinemath",
        "S(t) = \\sum_{k} \\delta(t - t_k) \\qquad \\text{(Discrete Dirac Spike Train)}"
      ),
      b(
        "neu_bullet1",
        "bullet",
        "Dendritic Integration: Spatial and temporal summation of excitatory and inhibitory postsynaptic potentials."
      ),
      b(
        "neu_bullet2",
        "bullet",
        "Action Potential Depolarization: Voltage-gated Na+ channels open rapidly, generating a +40mV depolarizing wave."
      ),
      b(
        "neu_bullet3",
        "bullet",
        "Hebbian Synaptic Potentiation: Repeated synchronous firing strengthens synaptic connection efficacy."
      ),
      b(
        "neu_bullet4",
        "bullet",
        "Matrix Backpropagation: Vectorized gradient calculations update millions of weights in parallel on GPUs."
      ),
      b(
        "neu_toggle_neuromorphic",
        "toggle",
        "Spiking Neural Networks (SNNs) & Neuromorphic Hardware Efficiency",
        {
          open: false,
          details: "Neuromorphic hardware executes event-driven compute where silicon neurons consume power only when transmitting discrete spike events, operating at milliwatt budgets comparable to the 20-watt human brain.",
        }
      ),
      b(
        "neu_divider",
        "divider",
        ""
      ),
      b("neu_h4", "h4", "4. Experimental Verification, Proofs & Problem Drills"),
      b(
        "neu_text_practice_drills",
        "text",
        "Consolidate your mastery of computational neuroscience and deep neural network mechanics with these exercises:"
      ),
      b(
        "neu_inlinemath_adam_update",
        "inlinemath",
        "\\theta_{t+1} = \\theta_t - \\frac{\\alpha}{\\sqrt{\\hat{v}_t} + \\epsilon} \\hat{m}_t \\qquad \\text{(Adam Optimizer)}"
      ),
      b(
        "neu_todo1",
        "todo",
        "Derive Hodgkin-Huxley voltage gate differential equations and activation curves",
        { checked: true }
      ),
      b(
        "neu_todo2",
        "todo",
        "Implement 2-layer MLP in NumPy from scratch with vectorized backpropagation",
        { checked: true }
      ),
      b(
        "neu_todo3",
        "todo",
        "Verify multi-head attention scale factor 1/sqrt(d_k) to prevent vanishing softmax gradients",
        { checked: false }
      ),
      b(
        "neu_todo4",
        "todo",
        "Compare Long-Term Potentiation (LTP) molecular cascades with artificial weight decay regularizers",
        { checked: false }
      ),
      b(
        "neu_callout_summary",
        "callout",
        "Deep Learning Heuristic: When training deep networks with ReLU activations, initialize weight matrices using He / Kaiming normal distribution scaled by the input fan-in dimension to maintain unit activation variance across dozens of layers!",
        { calloutIcon: "📌" }
      ),
    ],
  },

  // ── Misc Space (Note 6: Quantum Mechanics — Wavefunctions & Atomic Orbitals) ────────────────
  {
    id: "note_quantum",
    space: "Misc",
    spaceId: "Misc",
    title: "Quantum Mechanics — Wavefunctions & Atomic Orbitals",
    emoji: "🔮",
    banner: "gold",
    isFavorite: false,
    createdAt: "2026-07-29T14:15:00.000Z",
    updatedAt: "2026-08-02T11:00:00.000Z",
    blocks: [
      b(
        "qua_callout_intro",
        "callout",
        "Quantum Foundation: In quantum mechanics, physical states are represented by complex wavefunctions in Hilbert space. Observables correspond to Hermitian operators whose eigenvalues represent the only possible measurement outcomes!",
        { calloutIcon: "🔮" }
      ),
      b("qua_h1", "h1", "1. Postulates of Quantum Mechanics & Wave-Particle Duality"),
      b(
        "qua_text_intro",
        "text",
        "The state of a quantum physical system is completely specified by its wavefunction Ψ(r, t). Time evolution is governed deterministically by the continuous Schrödinger wave equation:"
      ),
      b(
        "qua_inlinemath_schrodinger_time",
        "inlinemath",
        "$\\hat{H}\\Psi(\\mathbf{r}, t) = i\\hbar \\frac{\\partial \\Psi(\\mathbf{r}, t)}{\\partial t}$"
      ),
      b(
        "qua_text_heisenberg",
        "text",
        "Non-commuting quantum operators give rise to the fundamental Heisenberg Uncertainty Principle between conjugate variables:"
      ),
      b(
        "qua_inlinemath_heisenberg_bound",
        "inlinemath",
        "$\\Delta x \\cdot \\Delta p \\ge \\frac{\\hbar}{2} \\qquad \\text{and} \\qquad [\\hat{x}, \\hat{p}] = i\\hbar \\hat{I}$"
      ),
      b(
        "qua_quote",
        "quote",
        "\"I think I can safely say that nobody understands quantum mechanics. If you can avoid it, do not keep saying to yourself 'how can it be like that?' because you will get down the drain into a blind alley from which nobody has escaped.\" — Richard P. Feynman"
      ),
      b(
        "qua_site",
        "site",
        "MIT OpenCourseWare — Quantum Physics I (8.04)",
        { url: "https://ocw.mit.edu/courses/8-04-quantum-physics-i-spring-2016/" }
      ),
      b(
        "qua_toggle_superposition",
        "toggle",
        "Quantum Superposition, Entanglement & Bell's Theorem",
        {
          open: true,
          details: "Quantum entanglement describes composite states that cannot be factored into product states of individual subsystems:\n\n|Φ⁺⟩ = (1/√2)(|00⟩ + |11⟩)\n\nJohn Bell proved that local hidden variable theories impose strict correlation bounds that are decisively violated by entangled photon measurements, proving that nature is fundamentally non-local.",
        }
      ),
      b(
        "qua_columns_interpretations",
        "columns",
        "",
        {
          columnCount: 2,
          columnsData: [
            {
              id: "col_copenhagen",
              title: "Copenhagen Interpretation",
              content: "Wavefunctions represent probability amplitudes. Physical measurement causes instantaneous, non-unitary wavefunction collapse into an observable eigenstate.",
            },
            {
              id: "col_manyworlds",
              title: "Many-Worlds Interpretation (Everett)",
              content: "Wavefunctions never collapse. Unitary Schrödinger evolution branches reality into decoherent non-interacting parallel universes for every possible outcome.",
            },
          ],
        }
      ),
      b("qua_h2", "h2", "2. The Time-Independent Schrödinger Equation & Energy Quantization"),
      b(
        "qua_text_tise_intro",
        "text",
        "For stationary states with constant energy E, the spatial wavefunction satisfies the Time-Independent Schrödinger Equation (TISE):"
      ),
      b(
        "qua_inlinemath_particle_box",
        "inlinemath",
        "$E_n = \\frac{n^2 \\pi^2 \\hbar^2}{2 m L^2} \\qquad \\text{for } n = 1, 2, 3, \\dots$"
      ),
      b(
        "qua_math_tise_display",
        "math",
        "-\\frac{\\hbar^2}{2m} \\nabla^2 \\psi(\\mathbf{r}) + V(\\mathbf{r})\\psi(\\mathbf{r}) = E\\psi(\\mathbf{r}) \\qquad \\text{where} \\qquad \\int_{\\mathbb{R}^3} |\\psi(\\mathbf{r})|^2 \\, d^3\\mathbf{r} = 1"
      ),
      b(
        "qua_text_tunneling",
        "text",
        "When a particle encounters a potential energy barrier higher than its total kinetic energy, the wavefunction decays exponentially inside the barrier with a finite transmission probability (Quantum Tunneling):"
      ),
      b(
        "qua_inlinemath_tunneling_prob",
        "inlinemath",
        "T \\approx e^{-2 \\kappa L} \\qquad \\text{where } \\kappa = \\frac{\\sqrt{2m(V_0 - E)}}{\\hbar}"
      ),
      b(
        "qua_code_hermite",
        "code",
        "// 1D Quantum Harmonic Oscillator Wavefunctions (Hermite Polynomials)\nfunction hermiteH(n, x) {\n  if (n === 0) return 1;\n  if (n === 1) return 2 * x;\n  let hPrev2 = 1, hPrev1 = 2 * x, hCurr = 0;\n  for (let i = 2; i <= n; i++) {\n    hCurr = 2 * x * hPrev1 - 2 * (i - 1) * hPrev2;\n    hPrev2 = hPrev1;\n    hPrev1 = hCurr;\n  }\n  return hCurr;\n}\n\nfunction quantumHarmonicWavefunction(n, x) {\n  const norm = 1 / Math.sqrt(Math.pow(2, n) * factorial(n) * Math.sqrt(Math.PI));\n  return norm * hermiteH(n, x) * Math.exp(-0.5 * x * x);\n}\n\nfunction factorial(n) {\n  return n <= 1 ? 1 : n * factorial(n - 1);\n}\n\nconsole.log(\"ψ₀(0) =\", quantumHarmonicWavefunction(0, 0).toFixed(4));",
        { language: "javascript" }
      ),
      b(
        "qua_num1",
        "number",
        "Construct the Hamiltonian differential operator for the potential geometry."
      ),
      b(
        "qua_num2",
        "number",
        "Impose spatial continuity and boundary conditions on wavefunction ψ and derivative ψ'."
      ),
      b(
        "qua_num3",
        "number",
        "Solve spatial eigenvalue ODE to extract quantized discrete energy levels."
      ),
      b(
        "qua_num4",
        "number",
        "Normalize the integral of the probability density wavefunction over all space to exactly unity."
      ),
      b(
        "qua_media",
        "media",
        "Hydrogen Atomic Orbital Probability Cloud",
        { url: "https://images.unsplash.com/photo-1635070041078-e363dbe005cb", mediaKind: "image" }
      ),
      b("qua_h3", "h3", "3. Hydrogen Orbitals, Spherical Harmonics & Spin"),
      b(
        "qua_text_hydrogen_intro",
        "text",
        "Solving the Schrödinger equation for the 3D spherically symmetric Coulomb potential decomposes the wavefunction into radial functions R_nl(r) and angular Spherical Harmonics Y_l^m(θ, φ):"
      ),
      b(
        "qua_inlinemath_orbital_decomp",
        "inlinemath",
        "\\psi_{nlm_l}(r, \\theta, \\phi) = R_{nl}(r) Y_l^{m_l}(\\theta, \\phi) \\chi_{m_s}"
      ),
      b(
        "qua_bullet1",
        "bullet",
        "Born Probability Interpretation: The probability density of finding a particle in volume dV is given by |Ψ(r, t)|² dV."
      ),
      b(
        "qua_bullet2",
        "bullet",
        "Quantum Tunneling: Finite potential barriers allow wavefunctions to decay exponentially with non-zero transmission probability."
      ),
      b(
        "qua_bullet3",
        "bullet",
        "Pauli Exclusion Principle: No two identical fermions may occupy the exact same quantum state simultaneously."
      ),
      b(
        "qua_bullet4",
        "bullet",
        "Atomic Orbitals: Solutions to Coulomb potential yield spherical harmonics labeled by quantum numbers (n, l, m_l, m_s)."
      ),
      b(
        "qua_table_quantum_numbers",
        "table",
        "",
        {
          title: "Principal Quantum Numbers & Electron Orbital States",
          tableData: {
            headers: ["Quantum Number", "Symbol", "Allowed Range", "Physical Property Determined"],
            rows: [
              ["Principal", "n", "1, 2, 3, ...", "Shell energy level and average orbital radius"],
              ["Azimuthal / Orbital", "l", "0, 1, ..., n-1", "Orbital angular momentum magnitude (s, p, d, f)"],
              ["Magnetic", "m_l", "-l, ..., 0, ..., +l", "Spatial orientation of angular momentum vector"],
              ["Spin", "m_s", "+1/2, -1/2", "Intrinsic fermion spin projection (up, down)"],
            ],
            hasHeaderRow: true,
          },
        }
      ),
      b(
        "qua_toggle_ladder",
        "toggle",
        "Quantum Harmonic Oscillator Ladder Operators (Creation & Annihilation)",
        {
          open: false,
          details: "The quantum harmonic oscillator Hamiltonian can be factorized using dimensionless creation and annihilation ladder operators:\n\nĤ = ℏω(a†a + 1/2)\n\nThe energy eigenvalues are equispaced, establishing a non-zero zero-point vacuum ground energy E₀ = (1/2)ℏω.",
        }
      ),
      b(
        "qua_divider",
        "divider",
        ""
      ),
      b("qua_h4", "h4", "4. Quantum Proofs, Boundary Values & Diagnostic Exercises"),
      b(
        "qua_text_practice_exercises",
        "text",
        "Work through these foundational quantum mechanical derivations and calculations:"
      ),
      b(
        "qua_inlinemath_bohr_radius",
        "inlinemath",
        "a_0 = \\frac{4\\pi \\epsilon_0 \\hbar^2}{m_e e^2} \\approx 0.529 \\text{ Å} \\qquad \\text{(Bohr Radius)}"
      ),
      b(
        "qua_todo1",
        "todo",
        "Normalize 1D Gaussian wavepacket and verify minimal uncertainty product",
        { checked: true }
      ),
      b(
        "qua_todo2",
        "todo",
        "Calculate quantum tunneling transmission coefficient through rectangular potential barrier",
        { checked: false }
      ),
      b(
        "qua_todo3",
        "todo",
        "Derive hydrogen 1s radial probability density peak at the Bohr radius",
        { checked: true }
      ),
      b(
        "qua_todo4",
        "todo",
        "Verify Bell Inequality violation using entangled singlet Bell states",
        { checked: false }
      ),
      b(
        "qua_callout_summary",
        "callout",
        "Quantum Measurement Heuristic: Quantum wavefunctions collapse into a single eigenstate only upon observation. Between measurements, the system evolves completely deterministically according to the unitary Schrödinger equation!",
        { calloutIcon: "📌" }
      ),
    ],
  },
];

export default DEMO_NOTES;

