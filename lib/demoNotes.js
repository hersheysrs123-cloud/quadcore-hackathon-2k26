/**
 * Seed content for a first-run workspace.
 *
 * Grouped into notesBySpace. Authentic, textbook-grade study notes with
 * real populated collapsible dropdown toggle sections, inline equation blocks, and authentic educational resources.
 *
 * NOTE: The 4 notes in "School" contain EVERY SINGLE CURRENT BLOCK TYPE (except canvas):
 * h1, h2, h3, h4, text, bullet, number, todo, toggle, callout, quote,
 * divider, code, math, inlinemath, site, media!
 */

const b = (id, type, content, extra = {}) => ({
  id,
  type,
  content,
  ...extra,
});

export const DEMO_NOTES = [
  // ── School Space (Note 1: Calculus — Differentiation & Integration) ──
  {
    id: "note_calc",
    space: "School",
    title: "Calculus — Differentiation & Integration",
    emoji: "📈",
    banner: "cyber",
    isFavorite: true,
    createdAt: "2026-07-24T09:12:00.000Z",
    updatedAt: "2026-07-30T14:03:00.000Z",
    blocks: [
      b(
        "calc_callout",
        "callout",
        "Calculus Core Insight: Differentiation measures instantaneous rates of change, while Integration measures accumulated continuous quantities. The Fundamental Theorem proves these operations are mathematical inverses!",
        { calloutIcon: "💡" }
      ),
      b("calc_h1", "h1", "1. Foundations of Limits, Derivatives & Instantaneous Rates of Change"),
      b(
        "calc_text1",
        "text",
        "Calculus provides the mathematical foundation for analyzing continuous variation. The derivative of a function f(x) represents the instantaneous rate of change of y with respect to x."
      ),
      b(
        "calc_inline1",
        "inlinemath",
        "f'(x) = \\lim_{\\Delta x \\to 0} \\frac{f(x+\\Delta x) - f(x)}{\\Delta x}"
      ),
      b("calc_h2", "h2", "2. Formal Rules of Differentiation"),
      b("calc_h3", "h3", "2.1 The Chain Rule, Product Rule & Power Rule"),
      b(
        "calc_inline2",
        "inlinemath",
        "\\frac{d}{dx}[x^n] = n \\cdot x^{n-1}"
      ),
      b(
        "calc_inline3",
        "inlinemath",
        "\\frac{d}{dx}[e^{kx}] = k \\cdot e^{kx}"
      ),
      b("calc_h4", "h4", "2.1.1 Implicit Differentiation & Related Rates Applications"),
      b(
        "calc_text2",
        "text",
        "When evaluating composite functions f(g(x)), the Chain Rule states that the derivative is the derivative of the outer function evaluated at the inner function, multiplied by the derivative of the inner function."
      ),
      b(
        "calc_math",
        "math",
        "\\frac{d}{dx}\\left[ f(g(x)) \\right] = f'(g(x)) \\cdot g'(x) \\quad \\text{and} \\quad \\int_{a}^{b} f(x)\\,dx = F(b) - F(a)"
      ),
      b(
        "calc_bullet1",
        "bullet",
        "Power Rule: d/dx(xⁿ) = n·xⁿ⁻¹ for any real power n."
      ),
      b(
        "calc_bullet2",
        "bullet",
        "Product Rule: d/dx[u(x)v(x)] = u'(x)v(x) + u(x)v'(x)."
      ),
      b(
        "calc_bullet3",
        "bullet",
        "Quotient Rule: d/dx[u(x)/v(x)] = [u'(x)v(x) - u(x)v'(x)] / [v(x)]²."
      ),
      b(
        "calc_num1",
        "number",
        "1. Construct the secant line difference quotient."
      ),
      b(
        "calc_num2",
        "number",
        "2. Evaluate the limit as Δx → 0 to obtain derivative f'(x)."
      ),
      b(
        "calc_num3",
        "number",
        "3. Apply Fundamental Theorem Part 1 to accumulation functions."
      ),
      b(
        "calc_inline4",
        "inlinemath",
        "\\frac{d}{dx} \\left[ \\int_{a}^{x} f(t) dt \\right] = f(x)"
      ),
      b(
        "calc_todo1",
        "todo",
        "Master Integration by Parts formula derived from Product Rule",
        { checked: true }
      ),
      b(
        "calc_inline5",
        "inlinemath",
        "\\int u \\, dv = u v - \\int v \\, du"
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
        "Verify Taylor Series expansion of sin(x) centered at 0",
        { checked: false }
      ),
      b(
        "calc_quote",
        "quote",
        "\"Calculus is the most powerful weapon of thought ever devised by the human mind for analyzing the physical universe.\" — Sir Isaac Newton"
      ),
      b(
        "calc_code",
        "code",
        "// Numerical Integration via Simpson's 1/3 Rule & Central Difference\nfunction simpsonsRule(f, a, b, n = 100) {\n  if (n % 2 !== 0) n += 1;\n  const h = (b - a) / n;\n  let sum = f(a) + f(b);\n  for (let i = 1; i < n; i++) {\n    const x = a + i * h;\n    sum += (i % 2 === 0 ? 2 : 4) * f(x);\n  }\n  return (h / 3) * sum;\n}\n\nfunction centralDifference(f, x, h = 1e-5) {\n  return (f(x + h) - f(x - h)) / (2 * h);\n}\n\nconst f = (x) => Math.pow(x, 3) - 4 * x;\nconsole.log(\"f'(2) ≈\", centralDifference(f, 2).toFixed(4));\nconsole.log(\"∫[0,3] f(x)dx ≈\", simpsonsRule(f, 0, 3).toFixed(4));",
        { language: "javascript" }
      ),
      b(
        "calc_toggle",
        "toggle",
        "Deep Dive: The Fundamental Theorem of Calculus (FTC Parts 1 & 2)",
        {
          open: true,
          details: "The Fundamental Theorem of Calculus unifies differential and integral calculus into a cohesive system. Part 1 proves g'(x) = f(x). Part 2 evaluates definite integrals via F(b) - F(a).",
        }
      ),
      b(
        "calc_divider",
        "divider",
        ""
      ),
      b(
        "calc_site",
        "site",
        "Paul's Online Math Notes — Calculus I: Derivatives & Integrals",
        { url: "https://tutorial.math.lamar.edu/Classes/CalcI/CalcI.aspx" }
      ),
      b(
        "calc_media",
        "media",
        "Calculus Graph & Tangent Line Illustration",
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
      b("pho_h1", "h1", "1. Solar Transduction & Chloroplast Ultrastructure"),
      b(
        "pho_text1",
        "text",
        "Photosynthesis transduces solar electromagnetic energy into stored chemical potential in carbohydrates. Taking place in eukaryotic chloroplasts, it connects Light-Dependent Reactions with the Light-Independent Calvin Cycle."
      ),
      b("pho_h2", "h2", "2. Photochemistry & Z-Scheme Electron Transport Chain"),
      b(
        "pho_inline1",
        "inlinemath",
        "2 \\text{H}_2\\text{O} \\xrightarrow{h\\nu} 4 \\text{H}^+ + 4 e^- + \\text{O}_2 \\uparrow"
      ),
      b("pho_h3", "h3", "2.1 Oxygenic Photolysis & Proton Gradient Generation"),
      b(
        "pho_inline2",
        "inlinemath",
        "\\text{NADP}^+ + 2e^- + \\text{H}^+ \\xrightarrow{\\text{reductase}} \\text{NADPH}"
      ),
      b("pho_h4", "h4", "2.1.1 Chemiosmotic Coupling & ATP Synthase Kinetics"),
      b(
        "pho_text2",
        "text",
        "Photons excite reaction center chlorophyll p680 in Photosystem II. Excited electrons move down the Electron Transport Chain to Photosystem I (p700), triggering proton translocation into the thylakoid lumen."
      ),
      b(
        "pho_math",
        "math",
        "6\\text{CO}_2 + 6\\text{H}_2\\text{O} + h\\nu \\xrightarrow{\\text{chlorophyll}} \\text{C}_6\\text{H}_{12}\\text{O}_6 + 6\\text{O}_2"
      ),
      b(
        "pho_bullet1",
        "bullet",
        "Photosystem II Photolysis: 2 H₂O → 4 H⁺ + 4 e⁻ + O₂ (Oxygen gas evolved originates entirely from water photolysis)."
      ),
      b(
        "pho_bullet2",
        "bullet",
        "Proton Translocation: Cytochrome b6f complex pumps protons into thylakoid lumen."
      ),
      b(
        "pho_inline3",
        "inlinemath",
        "\\Delta\\text{pH} \\approx 3.0 \\quad (\\text{pH}_{\\text{lumen}} \\approx 5.5 \\text{ vs } \\text{pH}_{\\text{stroma}} \\approx 8.0)"
      ),
      b(
        "pho_num1",
        "number",
        "1. Photon absorption excites P680 reaction center electrons."
      ),
      b(
        "pho_num2",
        "number",
        "2. Protons accumulate inside lumen, establishing electrochemical gradient."
      ),
      b(
        "pho_num3",
        "number",
        "3. Proton flux through F₀F₁ ATP Synthase rotor drives ADP phosphorylation."
      ),
      b(
        "pho_inline4",
        "inlinemath",
        "3 \\text{ CO}_2 + 9 \\text{ ATP} + 6 \\text{ NADPH} \\to 1 \\text{ G3P}"
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
        "pho_quote",
        "quote",
        "\"Oxygen gas evolved during photosynthesis originates entirely from photolysis of water in Photosystem II, not from carbon dioxide molecules.\" — Ruben & Kamen Isotopic Tracing Experiment (1941)"
      ),
      b(
        "pho_code",
        "code",
        "// Photosynthetic Energy Conversion Efficiency Calculator\nfunction calculateQuantumEfficiency(molesPhotonsAbsorbed, molesG3PSynthesized) {\n  const theoreticalMaxG3P = molesPhotonsAbsorbed / 8;\n  const efficiencyPercent = (molesG3PSynthesized / theoreticalMaxG3P) * 100;\n  return {\n    efficiency: `${efficiencyPercent.toFixed(2)}%`,\n    lightStatus: molesPhotonsAbsorbed > 1500 ? \"Light Saturated\" : \"Light Limited\"\n  };\n}",
        { language: "javascript" }
      ),
      b(
        "pho_toggle",
        "toggle",
        "Photorespiration (C3 Energy Loss) & RuBisCO Oxygenase Competition",
        {
          open: true,
          details: "When leaf stomata close during hot dry conditions, internal leaf CO₂ drops while O₂ builds up. RuBisCO acts as an oxygenase, wasting up to 25% of fixed carbon and ATP!",
        }
      ),
      b(
        "pho_divider",
        "divider",
        ""
      ),
      b(
        "pho_site",
        "site",
        "Khan Academy Biology — Photosynthesis & Light-Dependent Reactions",
        { url: "https://www.khanacademy.org/science/biology/photosynthesis-in-plants" }
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
        "CS 201: Asymptotic complexity describes how execution time and space requirements scale as input size N approaches infinity. Always drop constant scalar multipliers and non-dominant polynomial terms!",
        { calloutIcon: "⚡" }
      ),
      b("big_h1", "h1", "1. Asymptotic Analysis & Growth Bounds"),
      b(
        "big_text1",
        "text",
        "Big-O notation provides a mathematical upper bound on algorithm resource consumption in terms of input length N."
      ),
      b(
        "big_inline1",
        "inlinemath",
        "f(N) = O(g(N)) \\iff \\exists c > 0, N_0 > 0 : f(N) \\le c \\cdot g(N) \\quad \\forall N \\ge N_0"
      ),
      b("big_h2", "h2", "2. Formal Mathematical Growth Hierarchy"),
      b(
        "big_inline2",
        "inlinemath",
        "O(1) \\subset O(\\log N) \\subset O(N) \\subset O(N \\log N) \\subset O(N^2) \\subset O(2^N)"
      ),
      b("big_h3", "h3", "2.1 Classification of Asymptotic Time Complexities"),
      b("big_h4", "h4", "2.1.1 Divide and Conquer & Master Theorem Framework"),
      b(
        "big_text2",
        "text",
        "The Master Theorem analyzes divide-and-conquer recurrences."
      ),
      b(
        "big_inline3",
        "inlinemath",
        "T(n) = a T\\left(\\frac{n}{b}\\right) + \\Theta(n^d)"
      ),
      b(
        "big_math",
        "math",
        "T(n) = a T\\left(\\frac{n}{b}\\right) + f(n) \\quad \\implies \\quad T(n) = \\Theta(n^{\\log_b a})"
      ),
      b(
        "big_bullet1",
        "bullet",
        "O(1) Constant Time: Hash table lookup, array element access by index, stack push/pop operations."
      ),
      b(
        "big_bullet2",
        "bullet",
        "O(log N) Logarithmic Time: Binary search on sorted arrays, balanced Binary Search Tree operations."
      ),
      b(
        "big_bullet3",
        "bullet",
        "O(N log N) Linearithmic Time: Optimal comparison sorts (MergeSort, HeapSort, QuickSort)."
      ),
      b(
        "big_num1",
        "number",
        "1. Identify primary input scale parameter N."
      ),
      b(
        "big_num2",
        "number",
        "2. Discard low-order additive terms and constant scalar coefficients."
      ),
      b(
        "big_num3",
        "number",
        "3. Formulate Big-O definition constants."
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
        "Implement Two-Sum with O(N) hash map vs O(N^2) brute force nested iteration",
        { checked: true }
      ),
      b(
        "big_quote",
        "quote",
        "\"Premature optimization is the root of all evil in programming, but failing to understand asymptotic complexity leads to structural architectural collapse.\" — Donald Knuth"
      ),
      b(
        "big_code",
        "code",
        "// Two-Sum Algorithm Optimization Comparison (JavaScript)\nfunction twoSumOptimized(nums, target) {\n  const seen = new Map();\n  for (let i = 0; i < nums.length; i++) {\n    const complement = target - nums[i];\n    if (seen.has(complement)) return [seen.get(complement), i];\n    seen.set(nums[i], i);\n  }\n  return [];\n}",
        { language: "javascript" }
      ),
      b(
        "big_toggle",
        "toggle",
        "Space-Time Tradeoffs & Auxiliary Memory Bounds",
        {
          open: true,
          details: "Algorithmic optimization frequently trades auxiliary memory for speed. Dynamic Programming uses memoization tables to convert exponential O(2ᴺ) search into linear O(N) evaluation.",
        }
      ),
      b(
        "big_divider",
        "divider",
        ""
      ),
      b(
        "big_site",
        "site",
        "Big-O Algorithm Complexity Cheat Sheet",
        { url: "https://www.bigocheatsheet.com/" }
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
        "Microeconomics: Price changes cause movement ALONG existing supply and demand curves. Non-price determinants (consumer income, input costs, technology, expectations) SHIFT the entire market equilibrium curve!",
        { calloutIcon: "📌" }
      ),
      b("eco_h1", "h1", "1. Market Equilibrium & Price Elasticity Dynamics"),
      b(
        "eco_text1",
        "text",
        "Elasticity measures how buyers and sellers react to changes in market variables."
      ),
      b("eco_h2", "h2", "2. Elasticity Formulas & Market Revenue Dynamics"),
      b(
        "eco_inline1",
        "inlinemath",
        "E_d = \\left| \\frac{\\% \\Delta Q_d}{\\% \\Delta P} \\right| = \\left| \\frac{(Q_2 - Q_1)/Q_1}{(P_2 - P_1)/P_1} \\right|"
      ),
      b("eco_h3", "h3", "2.1 Price Elasticity of Demand (PED) & Supply (PES)"),
      b(
        "eco_inline2",
        "inlinemath",
        "|E_d| > 1 \\implies \\text{Elastic Demand } (\\Delta \\text{Revenue} < 0 \\text{ on } P \\uparrow)"
      ),
      b(
        "eco_inline3",
        "inlinemath",
        "|E_d| < 1 \\implies \\text{Inelastic Demand } (\\Delta \\text{Revenue} > 0 \\text{ on } P \\uparrow)"
      ),
      b("eco_h4", "h4", "2.1.1 Statutory vs Economic Tax Incidence Analysis"),
      b(
        "eco_text2",
        "text",
        "When demand is inelastic, consumers cannot easily substitute away from the good, enabling sellers to raise prices to increase total revenue."
      ),
      b(
        "eco_math",
        "math",
        "E_d = \\frac{\\% \\Delta Q_d}{\\% \\Delta P} = \\frac{\\frac{Q_2 - Q_1}{Q_1}}{\\frac{P_2 - P_1}{P_1}}"
      ),
      b(
        "eco_bullet1",
        "bullet",
        "Elastic Demand (|PED| > 1): Quantity change > price change; price increase decreases Total Revenue."
      ),
      b(
        "eco_bullet2",
        "bullet",
        "Inelastic Demand (|PED| < 1): Quantity change < price change; price increase increases Total Revenue."
      ),
      b(
        "eco_num1",
        "number",
        "1. Compute percentage change in quantity demanded."
      ),
      b(
        "eco_num2",
        "number",
        "2. Compute percentage change in price."
      ),
      b(
        "eco_num3",
        "number",
        "3. Divide %ΔQd by %ΔP."
      ),
      b(
        "eco_todo1",
        "todo",
        "Calculate Consumer Surplus (triangle under demand curve above equilibrium price)",
        { checked: true }
      ),
      b(
        "eco_todo2",
        "todo",
        "Calculate Deadweight Loss triangle created by binding price ceilings and price floors",
        { checked: false }
      ),
      b(
        "eco_quote",
        "quote",
        "\"The economic burden of a tax falls disproportionately on whichever market side is more price inelastic, regardless of whether statutory law taxes buyers or sellers.\" — Prof. N. Gregory Mankiw, Harvard University"
      ),
      b(
        "eco_code",
        "code",
        "// Price Elasticity of Demand (PED) & Revenue Analyzer\nfunction calculateElasticity(p1, p2, q1, q2) {\n  const pctQ = (q2 - q1) / q1;\n  const pctP = (p2 - p1) / p1;\n  const ped = Math.abs(pctQ / pctP);\n  return {\n    pedCoefficient: ped.toFixed(2),\n    classification: ped > 1 ? \"Elastic\" : ped < 1 ? \"Inelastic\" : \"Unit Elastic\"\n  };\n}",
        { language: "javascript" }
      ),
      b(
        "eco_toggle",
        "toggle",
        "Deadweight Loss & Binding Government Market Interventions",
        {
          open: true,
          details: "Binding price ceilings cause sustained market shortages, while binding price floors cause market surpluses, generating uncaptured Deadweight Loss triangles.",
        }
      ),
      b(
        "eco_divider",
        "divider",
        ""
      ),
      b(
        "eco_site",
        "site",
        "Investopedia — Price Elasticity of Demand Definition & Formula",
        { url: "https://www.investopedia.com/terms/e/priceelasticity.asp" }
      ),
      b(
        "eco_media",
        "media",
        "Economic Supply & Demand Graph Illustration",
        { url: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3", mediaType: "image" }
      )
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
