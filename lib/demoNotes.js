/**
 * Seed content for a first-run workspace.
 *
 * Shaped for the note model in Workspace.jsx — { id, title, space, emoji,
 * banner, isFavorite, blocks: [{ id, type, content }] } — and grouped into
 * notesBySpace at the bottom of this file. Every block type used here
 * (text / h2 / bullet / code) is one BlockNoteEditor already renders.
 *
 * Every id is a literal and nothing here reads the clock: this same object is
 * used as the seed on first mount, so it must be stable.
 */

const b = (id, type, content) => ({ id, type, content });

export const DEMO_NOTES = [
  // ── School ──────────────────────────────────────────────────────────
  {
    id: "note_eigen",
    space: "School",
    title: "Eigenvectors & Eigenvalues",
    emoji: "📐",
    createdAt: "2026-07-24T09:12:00.000Z",
    updatedAt: "2026-07-30T14:03:00.000Z",
    blocks: [
      b(
        "eig_2",
        "text",
        "Linear Algebra — Lecture 7. The whole chapter hangs on one equation, so the goal is to be able to explain it without looking at it.",
      ),
      b("eig_3", "h2", "The one equation"),
      b(
        "eig_4",
        "code",
        "A v = λ v\n\nA  — an n×n matrix (the transformation)\nv  — a non-zero vector (the eigenvector)\nλ  — a scalar (the eigenvalue)",
      ),
      b(
        "eig_5",
        "text",
        "Read it as a claim about direction, not about numbers: applying A to v gives back something on the exact same line through the origin. Most vectors get knocked off their line by a transformation. Eigenvectors are the ones that survive it.",
      ),
      b("eig_6", "h2", "What λ actually tells you"),
      b("eig_7", "bullet", "λ > 1 — the vector stretches, direction unchanged."),
      b("eig_8", "bullet", "0 < λ < 1 — it squashes toward the origin."),
      b("eig_9", "bullet", "λ < 0 — it flips to the opposite side of the origin, still on the same line."),
      b("eig_10", "bullet", "λ = 0 — v is in the null space; A collapses it to a point."),
      b("eig_11", "h2", "Finding them"),
      b(
        "eig_12",
        "text",
        "Av = λv rearranges to (A − λI)v = 0. A non-zero v can only satisfy that if (A − λI) is singular, which means its determinant is zero. That gives the characteristic polynomial det(A − λI) = 0; its roots are the eigenvalues.",
      ),
      b(
        "eig_13",
        "code",
        "A = [[2, 1],\n     [1, 2]]\n\ndet(A - λI) = (2-λ)² - 1 = λ² - 4λ + 3 = 0\n            → λ = 3  and  λ = 1\n\nλ = 3 → eigenvector [1,  1]   (the 45° line, stretched ×3)\nλ = 1 → eigenvector [1, -1]   (the anti-diagonal, untouched)",
      ),
      b("eig_14", "h2", "Where my intuition breaks"),
      b(
        "eig_15",
        "text",
        "A shear matrix [[1,1],[0,1]] has only ONE eigenvector direction, even though it is 2×2. I can compute that result but I cannot yet say why geometrically — every other line seems like it should come back to itself too, and it doesn't.",
      ),
      b(
        "eig_16",
        "text",
        "Also unclear: a rotation in 2D has no real eigenvectors at all, which makes sense geometrically (nothing stays on its line), but then the complex eigenvalues supposedly still mean something. What?",
      ),
      b("eig_17", "h2", "Why anyone cares"),
      b("eig_18", "bullet", "Diagonalisation: A = PDP⁻¹ turns Aⁿ into a cheap Dⁿ."),
      b("eig_19", "bullet", "PCA: the eigenvectors of the covariance matrix are the axes of greatest variance."),
      b("eig_20", "bullet", "PageRank: the ranking vector is the dominant eigenvector of the link matrix."),
      b("eig_21", "bullet", "Stability: a system decays iff every |λ| < 1."),
    ],
  },

  {
    id: "note_photo",
    space: "School",
    title: "Photosynthesis — Light & Calvin Cycles",
    emoji: "🌿",
    createdAt: "2026-07-25T11:40:00.000Z",
    updatedAt: "2026-07-29T18:22:00.000Z",
    blocks: [
      b(
        "pho_2",
        "text",
        "Biology, Unit 4. The exam question is never 'what is the equation' — it is always 'what happens if you change one input', so the notes below are organised around the mechanism rather than the summary.",
      ),
      b("pho_3", "h2", "The summary equation (necessary, not sufficient)"),
      b("pho_4", "code", "6 CO₂ + 6 H₂O + light → C₆H₁₂O₆ + 6 O₂"),
      b(
        "pho_5",
        "text",
        "Worth remembering that this hides two separate processes happening in two separate places, connected only by ATP and NADPH.",
      ),
      b("pho_6", "h2", "Stage 1 — Light-dependent reactions (thylakoid membrane)"),
      b("pho_7", "bullet", "Photons hit chlorophyll in photosystem II and excite an electron."),
      b("pho_8", "bullet", "The lost electron is replaced by splitting water — this is where the O₂ we breathe comes from. It is a waste product, not the goal."),
      b("pho_9", "bullet", "The excited electron falls down the electron transport chain, and the energy released pumps protons into the thylakoid lumen."),
      b("pho_10", "bullet", "That proton gradient drives ATP synthase — chemiosmosis. Photosystem I re-excites the electron to make NADPH."),
      b(
        "pho_11",
        "text",
        "Output: ATP and NADPH. Both are short-lived energy carriers, which is why the two stages have to run in the same place at roughly the same time.",
      ),
      b("pho_12", "h2", "Stage 2 — Calvin cycle (stroma)"),
      b("pho_13", "bullet", "Carbon fixation: RuBisCO attaches CO₂ to RuBP (5C), making an unstable 6C that immediately splits into two 3-PGA."),
      b("pho_14", "bullet", "Reduction: ATP and NADPH convert 3-PGA into G3P."),
      b("pho_15", "bullet", "Regeneration: five out of every six G3P are spent rebuilding RuBP so the cycle can continue."),
      b(
        "pho_16",
        "text",
        "It takes three turns to net one G3P and six turns to net one glucose. The cycle is called 'light-independent', but it stops within seconds in the dark because ATP and NADPH run out — a distinction I keep getting wrong.",
      ),
      b("pho_17", "h2", "Limiting factors"),
      b("pho_18", "bullet", "Light intensity — the rate plateaus once every photosystem is saturated."),
      b("pho_19", "bullet", "CO₂ concentration — usually the real limit for a plant on a bright day."),
      b("pho_20", "bullet", "Temperature — enzyme-controlled, so the rate falls off a cliff past the optimum rather than tapering."),
      b(
        "pho_21",
        "text",
        "Photorespiration: RuBisCO grabs O₂ instead of CO₂ when it is hot and dry and the stomata close. C4 and CAM plants are two different workarounds for the same problem — I can name them but I could not explain how they differ.",
      ),
    ],
  },

  {
    id: "note_bigo",
    space: "School",
    title: "Big-O & Algorithmic Complexity",
    emoji: "⚡",
    createdAt: "2026-07-26T15:05:00.000Z",
    updatedAt: "2026-07-31T09:47:00.000Z",
    blocks: [
      b(
        "big_2",
        "text",
        "CS 201, week 3. Big-O describes how a cost grows as the input grows — it deliberately throws away constants and lower-order terms, because those stop mattering once n is large.",
      ),
      b("big_3", "h2", "The ladder"),
      b("big_4", "bullet", "O(1) — hash lookup, array index. Input size is irrelevant."),
      b("big_5", "bullet", "O(log n) — binary search. Halving the search space each step."),
      b("big_6", "bullet", "O(n) — a single pass over the data."),
      b("big_7", "bullet", "O(n log n) — merge sort, heap sort. The practical floor for comparison sorting."),
      b("big_8", "bullet", "O(n²) — nested loops over the same collection."),
      b("big_9", "bullet", "O(2ⁿ) — naive recursive subsets. Unusable past roughly n = 40."),
      b("big_10", "h2", "Why the comparison-sort floor is n log n"),
      b(
        "big_11",
        "text",
        "There are n! possible orderings, and each comparison splits the remaining possibilities in half at best, so you need at least log₂(n!) comparisons — which is Θ(n log n) by Stirling. This is a proof about comparisons specifically, which is why counting sort can beat it: it never compares two elements.",
      ),
      b("big_12", "h2", "Worked example — the two-sum"),
      b(
        "big_13",
        "code",
        "// O(n²) — every pair\nfor (let i = 0; i < a.length; i++)\n  for (let j = i + 1; j < a.length; j++)\n    if (a[i] + a[j] === target) return [i, j];\n\n// O(n) — trade memory for time\nconst seen = new Map();\nfor (let i = 0; i < a.length; i++) {\n  if (seen.has(target - a[i])) return [seen.get(target - a[i]), i];\n  seen.set(a[i], i);\n}",
      ),
      b(
        "big_14",
        "text",
        "The second version is the whole idea of the course in miniature: O(n) extra space buys a factor of n in time. Almost every complexity improvement is a trade like this rather than a cleverer loop.",
      ),
      b("big_15", "h2", "Amortised vs average"),
      b(
        "big_16",
        "text",
        "A dynamic array push is O(n) whenever it resizes, but resizing doubles capacity, so across k pushes the total is O(k) and each push is amortised O(1). This is a worst-case guarantee over a sequence, not a probabilistic average — quicksort's O(n log n) is the other kind, and I mix these two up constantly.",
      ),
      b("big_17", "h2", "Things that trip me up"),
      b("big_18", "bullet", "O is an upper bound; Θ is a tight bound. Saying merge sort is O(n²) is technically true and useless."),
      b("big_19", "bullet", "Space complexity counts the recursion stack — 'in-place' quicksort still costs O(log n)."),
      b("big_20", "bullet", "Constants matter in the real world: an O(n log n) sort with terrible cache behaviour can lose to O(n²) on small n."),
    ],
  },

  {
    id: "note_econ",
    space: "School",
    title: "Supply, Demand & Elasticity",
    emoji: "📊",
    createdAt: "2026-07-27T08:30:00.000Z",
    updatedAt: "2026-07-28T20:15:00.000Z",
    blocks: [
      b(
        "eco_2",
        "text",
        "Intro Micro, chapters 3–5. The models are simple; the marks are lost on the difference between moving ALONG a curve and shifting the whole curve.",
      ),
      b("eco_3", "h2", "The distinction that everything else depends on"),
      b("eco_4", "bullet", "A change in the good's own price → movement along the curve. Quantity demanded changes."),
      b("eco_5", "bullet", "A change in anything else → the curve itself shifts. Demand changes."),
      b(
        "eco_6",
        "text",
        "Shifters of demand: income, price of substitutes and complements, tastes, expectations, number of buyers. Shifters of supply: input costs, technology, taxes and subsidies, number of sellers.",
      ),
      b("eco_7", "h2", "Elasticity"),
      b("eco_8", "code", "PED = %Δ quantity demanded / %Δ price\n\n|PED| > 1  →  elastic    (quantity reacts more than price)\n|PED| < 1  →  inelastic  (quantity barely reacts)\n|PED| = 1  →  unit elastic"),
      b(
        "eco_9",
        "text",
        "The revenue rule follows directly: if demand is inelastic, raising the price raises total revenue, because you lose proportionally less volume than you gain in price. If it is elastic, raising the price destroys revenue.",
      ),
      b("eco_10", "bullet", "Necessities and addictive goods are inelastic — insulin, petrol, cigarettes."),
      b("eco_11", "bullet", "Goods with close substitutes are elastic — one brand of cereal."),
      b("eco_12", "bullet", "Elasticity rises with the time horizon: petrol is inelastic this week and elastic over five years."),
      b("eco_13", "h2", "Tax incidence"),
      b(
        "eco_14",
        "text",
        "Who legally pays a tax has nothing to do with who actually bears it. The burden falls on whichever side is less elastic, because that side has fewer alternatives. This is the result I can state but could not derive under pressure.",
      ),
      b("eco_15", "h2", "Surplus and deadweight loss"),
      b("eco_16", "bullet", "Consumer surplus — the area under the demand curve and above the price."),
      b("eco_17", "bullet", "Producer surplus — the area above the supply curve and below the price."),
      b("eco_18", "bullet", "A price ceiling below equilibrium causes shortage; a floor above it causes surplus. Both create deadweight loss — trades that both sides wanted and no longer happen."),
    ],
  },

  // ── Personal ────────────────────────────────────────────────────────
  {
    id: "note_memory",
    space: "Personal",
    title: "How Memory Works — Spacing & Retrieval",
    emoji: "🧠",
    createdAt: "2026-07-20T19:00:00.000Z",
    updatedAt: "2026-07-31T07:30:00.000Z",
    blocks: [
      b(
        "mem_2",
        "text",
        "Notes from Make It Stick and the Bjork lab papers. Reason for writing this down: almost everything I did through school was the least effective option available, and I want to know why rather than just be told.",
      ),
      b("mem_3", "h2", "Storage strength vs retrieval strength"),
      b(
        "mem_4",
        "text",
        "The Bjorks split memory into two quantities. Storage strength is how well something is learned and it apparently never decreases. Retrieval strength is how accessible it is right now, and it decays. Forgetting is a retrieval failure, not a storage deletion — which is why a forgotten thing is relearned much faster the second time.",
      ),
      b("mem_5", "h2", "Desirable difficulty"),
      b(
        "mem_6",
        "text",
        "The counter-intuitive core: conditions that make practice feel harder and slower usually produce better long-term retention. Feeling fluent during study is a bad signal, because fluency comes from high retrieval strength, which decays. This is why rereading feels productive and isn't.",
      ),
      b("mem_7", "h2", "What actually works"),
      b("mem_8", "bullet", "Retrieval practice — testing yourself is a memory-modifying act, not just a measurement of one."),
      b("mem_9", "bullet", "Spacing — the same total study time, split across days, produces far better retention than one block."),
      b("mem_10", "bullet", "Interleaving — mixing problem types forces you to select the method, which is the part the exam actually tests."),
      b("mem_11", "bullet", "Elaboration — explaining a thing in your own words and connecting it to what you already know."),
      b("mem_12", "bullet", "Generation — attempting an answer before being told, even when you get it wrong. Especially then."),
      b("mem_13", "h2", "The Feynman technique"),
      b(
        "mem_14",
        "text",
        "Explain the concept out loud in plain language as if to someone who has never heard of it. Wherever the explanation goes vague or reaches for jargon, that is the gap. Go back to the source for that specific thing, then explain again. The value is entirely in noticing where you stall.",
      ),
      b(
        "mem_15",
        "text",
        "Open question I have not resolved: this is obviously the same mechanism as retrieval practice, but nobody seems to say whether the explaining or the noticing is doing the work.",
      ),
      b("mem_16", "h2", "A schedule I could actually keep"),
      b("mem_17", "bullet", "Same day — a five-minute recall with the notes closed."),
      b("mem_18", "bullet", "Day 3 — explain the hardest section out loud."),
      b("mem_19", "bullet", "Day 10 — mixed problems from this topic and the previous two."),
      b("mem_20", "bullet", "Day 30 — one hard question. If it is easy, stretch the interval; if it is not, halve it."),
    ],
  },

  // ── Misc ────────────────────────────────────────────────────────────
  {
    id: "note_ml",
    space: "Misc",
    title: "Neural Networks from Scratch",
    emoji: "🤖",
    createdAt: "2026-07-22T21:15:00.000Z",
    updatedAt: "2026-07-30T22:05:00.000Z",
    blocks: [
      b(
        "nn_2",
        "text",
        "Working through the 3Blue1Brown series plus Karpathy's micrograd. Goal is to be able to derive backprop on paper, not to call fit().",
      ),
      b("nn_3", "h2", "A single neuron"),
      b("nn_4", "code", "z = w · x + b        // weighted sum, a linear function\na = σ(z)             // activation, where the non-linearity enters"),
      b(
        "nn_5",
        "text",
        "Without the activation function, stacking layers is pointless: a composition of linear maps is just another linear map, so a 50-layer network would have exactly the expressive power of one layer. The non-linearity is the entire reason depth buys anything.",
      ),
      b("nn_6", "h2", "Activations"),
      b("nn_7", "bullet", "Sigmoid — squashes to (0,1), saturates at both ends, gradients vanish."),
      b("nn_8", "bullet", "Tanh — zero-centred, same saturation problem."),
      b("nn_9", "bullet", "ReLU — max(0, z). Cheap, gradient is exactly 1 for positive inputs, so it does not vanish. Can die at zero."),
      b("nn_10", "h2", "Backpropagation"),
      b(
        "nn_11",
        "text",
        "Backprop is the chain rule applied over the computation graph, in reverse, with the intermediate results cached. That caching is the whole trick — the naive approach recomputes the same partial derivatives an exponential number of times.",
      ),
      b(
        "nn_12",
        "code",
        "# forward\nz1 = W1 @ x  + b1;  a1 = relu(z1)\nz2 = W2 @ a1 + b2;  y  = softmax(z2)\nL  = cross_entropy(y, target)\n\n# backward — each step is one chain-rule factor\ndz2 = y - target\ndW2 = dz2 @ a1.T\nda1 = W2.T @ dz2\ndz1 = da1 * (z1 > 0)      # relu's derivative is a mask\ndW1 = dz1 @ x.T",
      ),
      b("nn_13", "h2", "Gradient descent"),
      b(
        "nn_14",
        "text",
        "The gradient points uphill, so we step against it: w ← w − η·∂L/∂w. Too large a learning rate overshoots and diverges; too small and it crawls or settles into the first flat region it finds.",
      ),
      b("nn_15", "bullet", "Batch — one step per full pass. Stable, slow, memory-hungry."),
      b("nn_16", "bullet", "Stochastic — one step per example. Noisy, and the noise helps escape bad minima."),
      b("nn_17", "bullet", "Mini-batch — 32 to 256 examples. What everyone actually uses."),
      b("nn_18", "h2", "Still fuzzy"),
      b(
        "nn_19",
        "text",
        "Why does Adam work better than plain SGD in practice? I understand it keeps per-parameter running averages of the gradient and its square, but not why that specifically helps, or why it sometimes generalises worse than SGD with momentum.",
      ),
      b(
        "nn_20",
        "text",
        "Also unresolved: why do heavily over-parameterised networks generalise at all, when classical statistics says they should overfit catastrophically?",
      ),
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
      isFavorite: false,
      blocks: note.blocks.map((block) => ({ ...block })),
    };
    (bySpace[note.space] ??= []).push(copy);
  }

  return bySpace;
}
