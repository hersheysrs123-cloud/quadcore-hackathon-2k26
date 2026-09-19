# Biology & Chemistry 3D Visualisation Audit

**Date:** 18 September 2026
**Scope:** all 16 biology topics and all 13 chemistry topics in the 3D suite — their scenes, their `lib/` engines, their entries in `topics.js`, and their Details panels in `VisualizationHUD.jsx`.
**Method:** line-by-line read of every scene, engine and readout; arithmetic checked against the syllabus values each file claims to implement; every reachable slider combination checked against the shape and the words it produces.

This is the biology/chemistry counterpart to `8bb971b` (*"fix(visualizations): correct physics and CS bugs found in a full topic audit"*), and it finds the same two classes of problem that commit did: **scenes that teach the wrong thing**, and **a test or a readout that agrees with a copy of the code rather than with the code that ships**.

---

## Contents

1. [Verdict](#1-verdict)
2. [Severity key](#2-severity-key)
3. [Cross-cutting findings](#3-cross-cutting-findings)
4. [Chemistry — findings by topic](#4-chemistry--findings-by-topic)
5. [Biology — findings by topic](#5-biology--findings-by-topic)
6. [Topics that came out clean](#6-topics-that-came-out-clean)
7. [Implementation plan](#7-implementation-plan)
8. [Appendix — full defect index](#8-appendix--full-defect-index)

---

## 1. Verdict

> ## ✅ ALL FIVE PHASES COMPLETE — 19 September 2026
>
> **87 of 87 defects fixed**, plus 12 more found while fixing them (10 by the
> legend-fidelity guardrail, 1 by the dead-parameter guardrail, 1 by writing
> the VSEPR tests).
>
> | Phase | What it did | Landed |
> |---|---|---|
> | 1 | Eleven `lib/` engines; all eleven drifted HUD cases rewritten to call them | `d909653` |
> | 2 | Cracking, three lattices, DNA bonds, cell lysis, respiratory throttle | `b610fde` `10e760d` |
> | 3 | Eleven test files (+211 assertions); `SceneReadout`/`SceneLegend` deleted (97 sites, 1,518 lines) | `639d08f` `661463a` |
> | 4 | All fifteen second-generation loose ends | `86e14ff` `e8c42fd` |
> | 5 | Four guardrails, each mutation-tested | `1e28a94` `7890d70` |
>
> **Tests: 1,310 → 1,784.** Production build clean throughout.
>
> The root cause named below — *"the Details panel is a hand-written second
> implementation of each scene's readout"* — is now structurally impossible to
> reintroduce silently. The second copy has no home (the placeholder
> components are gone), the shared engine is the only definition, and four CI
> guardrails fail the build if a panel, a key or a test starts drifting again.
>
> **Two follow-ups remain, both features rather than defects:**
> - Inert-graphite electrodes beside the copper purification cell (2.1's
>   richer form).
> - A myopia/hypermetropia mode for the eye. `lib/eyeOptics.js` already has
>   what it needs: a myopic eye is `axialLength` > `n / P`, and the blur
>   machinery would work unchanged.
>
> **One piece of deliberate debt:** three unit tests —
> `physics-solvers`, `quiz-grading`, `timer-store` — each assert against a
> private reimplementation of their subject rather than the shipping code.
> They are quarantined by guardrail 5.3, which enforces the rule everywhere
> else and fails if one of them is fixed without being taken off the list.


**87 defects across 29 topics.** They are not spread evenly. The suite is split cleanly in two:

| Generation | Topics | Engine | Tests | Readout | Defects |
|---|---|---|---|---|---|
| **First generation** | `bohr` `organic` `distillation` `lattice` `electrolysis` `vsepr` `energetics` `enzyme` `dna` `cell` `protein` | inline in the JSX | none | hand-written second copy in the HUD | **61** |
| **Second generation** | `reactivity_series` `rusting_galvanic` `separation_techniques` `combustion_fire_triangle` `particle_model_matter` `radioactive_decay` `reflex_arc` `antagonistic_muscles` `transpiration` `peristalsis` `carbon_cycle` `food_chain_pyramid` `flower_pollination` `bacteria_vs_virus` `mitosis_meiosis` `cardiac_cycle` | `lib/*.js` | unit-tested | derived from the same engine | **10** |
| **Bespoke** | `eye` `respiratory` | `lib/eyeOptics.js` / inline | eye yes, respiratory *no* | own HUD | **10** |

The second-generation topics are in good shape and their defects are cosmetic or latent. Nearly every real teaching error is in the eleven first-generation topics, and nearly all of those trace to one root cause: **the Details panel is a hand-written second implementation of each scene's readout that was never kept in sync with the scene.**

The five findings that most need fixing before this is put in front of a student:

- **C7 / C8** — the DNA panel prints a hard-coded base sequence that is not the one on screen, and every base colour in its key is wrong.
- **C9** — the default DNA helix contains **no thymine at all** on strand 1, on a scene whose entire subject is A–T and C–G pairing.
- **B10** — the organic panel reports ethanol, ethanoic acid and ethyl ethanoate as *unsaturated* and says they decolourise bromine water. They do not. This is the exact misconception the topic's own quiz tests.
- **B25** — the electrolysis scene blows H₂ and O₂ bubbles off copper electrodes in copper(II) sulfate. There are no bubbles in that cell; the scene's own labels say so two lines away.
- **B29** — the VSEPR panel names AX₄E₂ "Octahedral", contradicting the correct answer to the topic's own quiz question, which the scene itself gets right.

---

## 2. Severity key

| | Meaning |
|---|---|
| 🔴 **Teaches something false** | A student who reads the screen carefully comes away with a wrong fact. |
| 🟠 **Contradicts itself** | Two parts of the same screen disagree; the student cannot tell which to believe. |
| 🟡 **Model/behaviour defect** | The simulation is wrong or incomplete, but nothing states the wrong fact outright. |
| 🔵 **Correctness-adjacent** | Dead code, dead parameters, performance, latent bugs, doc drift. |

---

## 3. Cross-cutting findings

### X1 🔴 Every readout exists twice, and the second copy has drifted

`scene-kit.jsx` defines `SceneReadout` and `SceneLegend` as **components that return `null`**:

```js
// components/visualizations/scene-kit.jsx:186
export function SceneReadout() { return null; }
export function SceneLegend()  { return null; }
```

Every scene still passes them a full, carefully written readout — rows, notes, colour keys — computed from the live simulation state. **None of it renders.** What the student actually sees is `renderTopicDetailsReadout()` in `VisualizationHUD.jsx:992–3840`: a 2 800-line `switch` that recomputes each topic's numbers from `params` by hand.

For the second-generation topics this is harmless, because their HUD cases call the same `lib/` solver the scene calls. For the eleven first-generation topics the HUD case is an **independent reimplementation**, and in every single one of them it has drifted from the scene. Findings B1–B3, B9–B11, B14, B17–B19, B21–B22, B26–B27, B29–B32, B36, C1, C3, C5, C7–C8, C10–C11, C13–C14, C16–C17 and C21–C22, C24 are all instances of this one root cause — 34 of the 87.

Two knock-on effects:

- Roughly 900 lines of live, correct readout code in the scene files is unreachable.
- The HUD's copy has no access to the scene's clock, so it cannot report anything the simulation is actually doing — which is why it resorts to inventions like `Math.round(current * 14)` "Cu atoms" (B26).

### X2 🔵 Eleven topics have no engine and no tests

`bohr`, `organic`, `distillation`, `lattice`, `electrolysis`, `vsepr`, `energetics`, `enzyme`, `dna`, `cell` and `protein` keep their chemistry and biology inline in `ChemistryCanvas.jsx` and `BiologyCanvas.jsx`. There is no `lib/` module and no entry in `tests/unit/`. Every other topic in the suite has both. The commit message for `8bb971b` already made this argument for `lib/binaryTree.js`; it applies here to eleven topics at once.

### X3 🔴 `tests/unit/respiratory-mechanics.test.mjs` tests a private copy of the engine

```js
// tests/unit/respiratory-mechanics.test.mjs:1–4
import { describe, it } from "node:test";
import assert from "node:assert/strict";
// ─── Physiological Mechanics & Respiratory Simulation Engine ─────────
export const RESPIRATORY_PHASES = { ... };
export function calculateThoraxVolume(expansion) { ... }
```

The file imports nothing from the application. It **defines** the engine it then asserts against. `RespiratoryCanvas.jsx` imports nothing from it and implements its own, different arithmetic inline (see C30 — three different tidal volumes for the same phase). This is precisely the failure mode `8bb971b` fixed for the binary tree: *"Its test file held a private copy of that logic, so it passed for months while the shipping scene had no rotations at all."*

Two other test files do the same (`physics-solvers.test.mjs`, `timer-store.test.mjs`) but are out of scope here.

### X4 🟠 The `TONES` map has no `sky` or `neutral`

```js
// components/visualizations/VisualizationHUD.jsx:336
const TONES = { default: …, gold: …, good: …, warn: …, bad: … };
// :348
<p className={`… ${TONES[tone]}`}>
```

Three rows in the `respiratory` case pass `"neutral"` and two pass `"sky"` (lines 2927–2932). `TONES[tone]` is `undefined`, so the rendered class string literally ends in `"undefined"` and the value falls back to inherited colour. (`unitcircle` at line 3793–3794 does the same with `"rose"` and `"sky"`; out of scope but fixed by the same change.)

### X5 🔵 The `respiratory` HUD case is dead code

`topics.js:2806` sets `ownHud: true`, and `ThreeDView.jsx:261` skips `VisualizationHUD` entirely for such topics. The 40-line `case "respiratory"` block at `VisualizationHUD.jsx:2914` can never render — which is why nobody noticed X4 in it.

### X6 🟠 `bohr` and `enzyme` render two animation-speed sliders

`VisualizationHUD.jsx:4055` renders a universal **"⚡ Animation Speed"** slider (0.1 – 3.0) for every topic without `hideSpeedSlider`. Both `bohr` (`topics.js:1568`, "Orbit speed", 0 – 3) and `enzyme` (`topics.js:2552`, "Animation speed", 0.2 – 2) *also* declare a `speed` slider in their own `controls`. The result is two sliders bound to the same key with different ranges, sitting a few pixels apart — and only the topic-specific one can reach 0 ("paused").

---

## 4. Chemistry — findings by topic

### 4.1 `bohr` — Bohr Atom & Orbital Shells

| # | Sev | Finding |
|---|---|---|
| **B1** | 🔴 | **Selecting Hydrogen prints the carbon explanation.** `VisualizationHUD.jsx:1975` is a two-branch ternary on `Na` / `Cl` with everything else falling through to *"Carbon shares 4 valence electrons via covalent bonds."* Pick H and the panel says hydrogen shares four valence electrons. |
| **B2** | 🔴 | **The key advertises a "Photon Wave Packet · Quantized light emission during shell drop"** (`VisualizationHUD.jsx:1988`). There is no photon, no emission and no shell drop anywhere in `BohrAtomScene`. The student is told to look for something that does not exist. |
| **B3** | 🟠 | Colour key does not match the scene. Protons are keyed `#ef4444`; `Nucleus` draws them `PALETTE.rose` = `#fb7185` (`ChemistryCanvas.jsx:139`). Valence electrons are keyed gold unconditionally, but `Shell` only colours them gold when `highlightValence` is on. |
| **B4** | 🔵 | **Dead parameter.** `BohrAtomScene` reads `params.spin !== false` to drive `autoRotate` (`ChemistryCanvas.jsx:213`), but `spin` is in neither `defaults` nor `controls`. It is permanently `undefined`, so the camera auto-rotate can never be switched off. (`spinNucleus` is a separate, working toggle.) |
| **B5** | 🟠 | Duplicate speed slider — see X6. |

### 4.2 `organic` — Organic Chemistry & Isomer Builder

| # | Sev | Finding |
|---|---|---|
| **B6** | 🔴 | **Esters are named from a lookup table unrelated to the molecule built.** `ESTER_NAMES` (`ChemistryCanvas.jsx:324`) is a fixed list indexed by carbon count. The geometry always builds an *n*-carbon acyl chain plus a **methyl** R-group (`:457–485`). So `n = 3` draws methyl propanoate and labels it **"ethyl methanoate"**; `n = 4` draws methyl butanoate and labels it "ethyl ethanoate"; and so on for every *n* ≥ 3. Only `n = 1` and `n = 2` are right, by coincidence. |
| **B7** | 🔴 | **Methyl methanoate is missing its formyl hydrogen.** The acid branch explicitly adds it (`:447`, *"Methanoic acid (n=1) has a formyl C-H bond"*); the ester branch does not. `n = 1` therefore reports **C₂H₃O₂** instead of C₂H₄O₂ — an impossible formula, and the drawn carbonyl carbon has only three bonds. |
| **B8** | 🔴 | **"Trigger cracking" does not crack.** `Molecule` partitions the existing atoms and bonds either side of a cut and slides the halves apart (`:663–718`). No bond is ever promoted to `double`, no hydrogen moves, and both fragments are left as radicals. Meanwhile the readout promises *"this alkane breaks into a shorter alkane plus a useful alkene"* (`:741`) and `topics.js:1641` makes it one of the topic's three headline concepts. No C=C ever appears. |
| **B9** | 🔴 | **The panel shows the wrong formula for acids and esters.** `VisualizationHUD.jsx:2000–2004` handles alkane/alkene/alkyne/alcohol and falls through to `C{n}H{2n+2}` for everything else. Propanoic acid (C₃H₆O₂) is displayed as **"C3H8"** — propane. |
| **B10** | 🔴 | **Alcohols, acids and esters are reported unsaturated, and as decolourising bromine water.** `const saturated = family === "alkane"` (`VisualizationHUD.jsx:1997`) drives both the "Saturated" row and the "Bromine test" row. Select Alcohol and the panel states *"Saturated: No (unsaturated)"* and *"Bromine test: Decolourised (Clear)"*. Ethanol does neither. The scene's own (unrendered) readout gets this right — it lists `["alkane","alcohol","acid","ester"]` as saturated (`ChemistryCanvas.jsx:751`). The topic's second quiz question tests exactly this distinction. |
| **B11** | 🟠 | **The bond colour key is inverted.** `VisualizationHUD.jsx:2027–2028` keys single bonds gold `#fbbf24` and double/triple bonds grey `#94a3b8`. The scene draws single bonds grey `#3f4854`, double bonds gold, and triple bonds sky `#38bdf8` (`ChemistryCanvas.jsx:577–619`). Each colour points at the wrong thing. |
| **B12** | 🟡 | **C=C is drawn 5 % too long.** The chain builder advances `x += L * CHAIN_X` while holding the vertical rise fixed at the C–C value (`:378–390`). For `L = CC_DOUBLE = 1.34` the resulting 3D separation is **1.41 Å**, not 1.34. Single bonds come out at exactly 1.540 Å, so the error is specific to the alkene bond the topic is about. |
| **B13** | 🟡 | **The kink out of an alkyne's sp carbons is half-sized.** `:391` puts C0–C2 on `y = 0` and then resumes the zig-zag, so C2→C3 gets one `rise` of vertical travel instead of two. The bond is drawn at **1.33 Å** instead of 1.54, and the angle at C2 is wrong. Affects every alkyne with n ≥ 4. |
| **B14** | 🔵 | The HUD prints ASCII digits ("C3H8", "C2H4") beside the scene's proper subscripts. `ChemistryCanvas.jsx:29` opens with a comment complaining about exactly this: *"'C3H8' on screen next to CₙH₂ₙ₊₂ in the same panel reads as a typo."* The scene was fixed; the HUD was not. |
| **B15** | 🔵 | `buildMolecule` is computed twice per render — once in `OrganicBuilderScene` (`:725`) and again inside `Molecule` (`:669`). |

### 4.3 `distillation` — Fractional Distillation Column

| # | Sev | Finding |
|---|---|---|
| **B16** | 🔴 | **Bitumen vaporises.** `FRACTIONS[5]` is flagged `residue: true` with the comment *"Too heavy to vaporise at all"* (`ChemistryCanvas.jsx:813`), and the legend says *"never vaporises — drained off at the base"*. But nothing reads that flag. Above `heat ≈ 0.757` its tray lights up, its take-off pipe glows, its vapour particles climb the column, and `rising` counts it (`:884`) — while the readout in the same panel still says *"Left at the base: bitumen"*. |
| **B17** | 🔴 | **The HUD's fraction table is a different dataset from the one on screen.** `VisualizationHUD.jsx:2035–2042` defines its own six fractions with different boiling points (20/70/120/170/270/350 °C against the scene's 25/75/150/240/320/400), different chain ranges (C50+ against C₃₀+, C10–C16 against C₁₁–C₁₆) and **completely different colours** — refinery gases keyed red `#ef4444` where the scene draws them pale blue `#7dd3fc`. The "Fractions Key (Top to Bottom)" matches nothing in the viewport. |
| **B18** | 🟠 | **The two "fractions vaporised" counts use different formulas.** HUD: `min(6, max(1, floor(heat*7)))`. Scene: `heat − i·0.14 > 0.05`. At the default `heat = 0.7` the HUD says 4 and the scene lights 5 trays. |
| **B19** | 🟡 | `["Highest riser", FRACTIONS[0].name]` is a constant (`ChemistryCanvas.jsx:1049`; HUD `:2050`). At `heat = 0.15` only one fraction rises and at very low heat none does, but the panel still names refinery gases as the highest riser. |

### 4.4 `lattice` — Crystal Lattices

| # | Sev | Finding |
|---|---|---|
| **B20** | 🔴 | **Quartz is built with six-coordinate silicon.** `buildQuartz` (`ChemistryCanvas.jsx:1192`) puts Si on a simple-cubic lattice and drops an O at the midpoint of every nearest-neighbour pair. Interior silicons therefore carry **six** oxygens at 180° Si–O–Si angles. Both readouts insist otherwise: the scene's says *"Silicon atoms linked tetrahedrally"* (`:1294`), the HUD's says *"Structure: Tetrahedral Silica"* and *"Each silicon bonds to 4 oxygen atoms"* (`:2136–2140`). The stoichiometry happens to come out 1 : 2, which is presumably why this survived. |
| **B21** | 🔴 | **The graphite key names two things that are not drawn.** `VisualizationHUD.jsx:2124–2125` keys a gold *"Delocalised Electron"* and a grey dashed *"Interlayer Force"*. `buildGraphite` draws neither — there are no electrons in the scene, and bonds are only ever built *within* a sheet (`:1163–1173`, the inner loop never crosses layers). Worse, the gold it points at is actually the **middle layer's carbon atoms**, which the scene colours gold so the shear is visible. |
| **B22** | 🟠 | Bond colours in the key (`#38bdf8` for NaCl ionic attraction, diamond covalent bonds and Si–O bonds) do not match the drawn bonds (`#3f4854` in all three cases). |
| **B23** | 🟡 | **Ice has a 123° H–O–H angle.** The hydrogen offsets at `ChemistryCanvas.jsx:1237–1238` are `(±0.35, +0.22, ±0.2)`, which subtend 122.8°. Water's bond angle is 104.5°, and the *open* tetrahedral cage the readout describes depends on it. |
| **B24** | 🔵 | The `slide` control — the whole point of the graphite structure — has no representation in the HUD readout. The scene's unrendered readout does not mention it either. |

### 4.5 `electrolysis` — Electrolysis of CuSO₄

| # | Sev | Finding |
|---|---|---|
| **B25** | 🔴 | **Gas bubbles off copper electrodes in copper(II) sulfate.** `ChemistryCanvas.jsx:1809–1811` renders two `ElectrodeBubbles` columns under the comment *"Rising H₂ gas bubbles at cathode (−), O₂ at anode (+)"*. With copper electrodes in CuSO₄ neither gas is produced — the copper anode dissolves in preference to oxidising water, and Cu²⁺ discharges in preference to H⁺. Six lines later the scene's own labels read *"anode (+) · wastes away · Cu → Cu²⁺ + 2e⁻"*, the anode radius shrinks as the cathode plates, and the subtitle says *"Copper electrodes"*. The bubbles belong to the inert-electrode version of the experiment. |
| **B26** | 🔴 | **A fabricated readout.** `const deposit = Math.round(current * 14)` (`VisualizationHUD.jsx:2179`) is printed as **"Cathode Deposit: 14 Cu atoms"**. It is not atoms, it does not change as the reaction runs, and it is unrelated to the scene's own arrival counter (`ChemistryCanvas.jsx:1652`) which does track the simulation. At 1.0 A it reads "14 Cu atoms" for ever. |
| **B27** | 🟠 | The electrode colour key is green `#34d399` for the cathode and red `#ef4444` for the anode (`VisualizationHUD.jsx:2196–2197`). Both electrodes are drawn in copper browns (`#b45309` and `#7c3f12`). |
| **B28** | 🔵 | `SulfateIon` creates four `lineSegments` with their own `bufferGeometry` per ion (`ChemistryCanvas.jsx:1478–1489`) — 52 undisposed geometries — and `Ions` seeds respawn positions from `performance.now()`, breaking the deterministic-seed convention the rest of the suite follows. |

### 4.6 `vsepr` — VSEPR Molecular Geometry

The 3D geometry here is genuinely good — the bisection solver lands water on 104.5° and correctly leaves XeF₄ at 90° because its lone pairs cancel. The panel then undoes all of it.

| # | Sev | Finding |
|---|---|---|
| **B29** | 🔴 | **The panel cannot name half the shapes, including the one its own quiz asks about.** `molecularShape` (`VisualizationHUD.jsx:2223`) covers only 2-0, 3-0, 2-1, 4-0, 3-1, 2-2, 5-0 and 6-0. The sliders reach 4-1, 3-2, 2-3, 3-3, 5-1 and 4-2, all of which the scene renders correctly. Selecting 4 bonding + 2 lone gives **"Octahedral (4 bonds, 2 lone)"** — while `topics.js:1877` asks *"A molecule has 4 bonding pairs and 2 lone pairs. What is its shape?"* with **"Square planar"** as the correct answer. The Details panel contradicts the quiz. Seesaw, T-shaped, square pyramidal and linear XeF₂ are lost the same way. |
| **B30** | 🔴 | **"Angle Compression: 5.0° squeeze" for XeF₄.** `VisualizationHUD.jsx:2240` computes `lone × 2.5°` unconditionally. For AX₄E₂ the scene reports the true 90.0° and explains *"the lone pairs sit opposite each other, so their repulsions cancel"* — the exact point the quiz explanation makes. The panel asserts a 5° squeeze that neither exists nor is drawn. |
| **B31** | 🟠 | `steric = bonding + lone` is not clamped (`:2212`). For AX₁ (steric 1) `electronGeom` falls through to its `|| "Tetrahedral"` default; the scene clamps to 2 and draws linear. |
| **B32** | 🔵 | The panel omits **Polarity** and **Actual angle**, both of which the scene computes from the geometry it actually drew — the two rows that would make the scene's careful solver visible. |

### 4.7 `energetics` — Reaction Energy Profile

| # | Sev | Finding |
|---|---|---|
| **B33** | 🔵 | **Dead parameter.** `showReverse: true` sits in `defaults` (`topics.js:1895`), has no control, and `EnergyProfileScene` never destructures it. |
| **B34** | 🟡 | **High barriers leave the frame.** `peakY = effectiveEa × 0.028` and the "transition state" label sits at `peakY + 0.5`. At the slider's maximum Ea of 160 kJ/mol that is y ≈ 4.98, against roughly ±4.46 of visible height for the fixed camera (`[0, 1.2, 10.5]`, fov 46). The summit and its label clip off the top. |
| **B35** | 🔵 | The Ea arrow is drawn at `x = −1.55` (`ChemistryCanvas.jsx:2296`), which is inside the curve's rising flank — the arrow passes through the line it is measuring. |
| **B36** | 🔵 | The HUD omits **rate constant k** and **Rate ×** (the catalyst speed-up), which the scene computes and which are the two numbers that make the Arrhenius point. It also omits the ΔH-clamp explanation, so when the sliders hit `Ea < ΔH` the panel silently shows a different Ea from the one asked for. |

### 4.8 `reactivity_series` & `rusting_galvanic` (lib-backed)

| # | Sev | Finding |
|---|---|---|
| **B37** | 🟡 | **`solveCouple.deltaE` has the wrong sign for the copper couple.** `lib/redox.js:424` computes `IRON_POTENTIAL_V − P.potential`, giving **−0.78 V** for Fe/Cu. The cell is spontaneous with E°cell = +0.78 V (cathode Cu, anode Fe). It is only invisible today because `VisualizationHUD.jsx:2404` wraps it in `Math.abs`. Any future consumer of `deltaE` inherits the bug. |
| **B38** | 🟠 | **The magnesium hydrogen bubbles never stop.** `lib/redox.js:457` exports `bubbleRate: partner === "magnesium" && partnerRemaining > 0 ? 0.5 : 0` — written precisely so the fizzing stops when the ribbon is consumed. `RustingGalvanicCanvas.jsx:375` ignores it and hard-codes `rate={0.5}`. The field is dead and the bubbles outlive the metal. |
| **B39** | 🟠 | **Labels and geometry read different clocks.** Both scenes ease a displayed clock (`m.shownDays`, `m.seconds`) while the `SceneLabel`s and the HUD read the slider/param value (`days`, `liveSeconds`). During playback and during the ease-in after a scrub the numbers on the labels do not describe the nails and strips beside them. |
| **B40** | 🟡 | **Solid salt crystals on the floor of the brine tubes.** `SaltCrystals` (`RustingGalvanicCanvas.jsx:309`) draws ten undissolved cubes whenever `electrolyte === "saltwater"`. A 3 % NaCl solution is nowhere near saturated; there is no solid phase. It reads as "the salt didn't dissolve". |
| **B41** | 🔵 | **"Anode used up" is effectively unreachable.** Zinc's computed lifetime is 241 days (69 in brine) against a 30-day maximum; magnesium's is 104 days (29.6 in brine). Only magnesium-in-brine-at-day-30 ever trips `partnerExhausted`, so the `"anode used up — rusting again"` verdict, its dedicated HUD note and the two-regime `meanFactor` maths are almost entirely untestable from the UI. |
| **B42** | 🔵 | The electron stream is drawn at `STRIP.thickness / 2 + 0.05` — just *outside* the strip, in the solution — while the legend beside it insists electrons "move inside the metal, never through the solution". |

### 4.9 `combustion_fire_triangle`

| # | Sev | Finding |
|---|---|---|
| **B43** | 🔵 | **Inconsistent enthalpy basis.** `EQUATIONS.complete` (−890) and `EQUATIONS.incomplete` (−607) are per mol CH₄ with **liquid** water; `EQUATIONS.soot` (−409) is per mol CH₄ with **gaseous** water (`lib/combustion.js:92–113`). On the liquid basis it should be ≈ −497. `EQUATIONS.soot` is currently unreferenced, so nothing displays it yet. |

---

## 5. Biology — findings by topic

### 5.1 `enzyme` — Enzyme Action & Denaturation

| # | Sev | Finding |
|---|---|---|
| **C1** | 🔴 | **The scene and the panel denature at different temperatures.** Scene: `temperature > 50` (`BiologyCanvas.jsx:69`). Panel: `temp > 55` (`VisualizationHUD.jsx:2763`) — while the panel's own note says *"Excessive temperature (>50 °C)"*. Set 52 °C: the scene collapses the rate to 9 %, gapes the active site open and labels it "denatured enzyme"; the panel reports **40 %** and **"Active Site State: Complementary Lock"**. |
| **C2** | 🟠 | **The substrate keeps being catalysed after denaturation.** `Substrate` is told `denatured={denature > 0.25}` (`BiologyCanvas.jsx:366`), and `denature = (T − 50)/26`, so rejection only starts at **56.5 °C**. Between 50 and 56.5 the readout says the active site is the wrong shape while the animation shows the substrate binding and splitting perfectly. |
| **C3** | 🟠 | **Two different rate models.** Scene: a product of Gaussians in temperature and pH (`enzymeRate`). Panel: a product of linear triangles (`VisualizationHUD.jsx:2765`). At 30 °C / pH 7 the marker on the scene's curve sits at 84 % and the panel says 72 %. |
| **C4** | 🟡 | **The rate curve has a vertical jump.** `enzymeRate` returns `0.557` just below 50 °C and `0.12` just above — a discontinuity, drawn as a vertical segment of the "rate against temperature" line. Real denaturation is steep but continuous, and a graph is not allowed to be multivalued. |
| **C5** | 🟠 | Colour key wrong: the enzyme is keyed blue `#3b82f6` (drawn emerald→rose), and "Catalysed Products" is keyed violet `#a78bfa` (drawn gold / gold-dim). |
| **C6** | 🟡 | The **"Reversible?"** row keys on temperature only, so extreme-pH denaturation — which the scene models with `phStress` and which the topic's own concept text calls out — is reported as reversible. |

### 5.2 `dna` — DNA Double Helix & Base Pairing

| # | Sev | Finding |
|---|---|---|
| **C7** | 🔴 | **The panel prints a hard-coded sequence that is not the one on screen.** `VisualizationHUD.jsx:2799` defines `["A","T","G","C","C","A","T","G",…]` and prints it as "Strand 1 (5′→3′)". The scene generates its own from `hashRandom(i + 5)` (`BiologyCanvas.jsx:479`). Side by side at the default 16 pairs:<br>**On screen:** `C-G-G-G-G-C-C-A-G-A-G-A-A-G-A-C`<br>**In the panel:** `A-T-G-C-C-A-T-G-A-T-C-G-T-A-G-C`<br>Not one base matches. |
| **C8** | 🔴 | **Every base colour in the key is wrong.** Key (`:2810–2813`) against scene (`BiologyCanvas.jsx:426`):<br>A keyed red `#ef4444`, drawn green `#4ade80`<br>T keyed sky `#38bdf8`, drawn rose `#fb7185`<br>C keyed gold `#fbbf24`, drawn sky `#38bdf8`<br>G keyed green `#34d399`, drawn gold `#fbbf24`<br>A student matching colours to labels identifies every base incorrectly — and the swaps are circular, so nothing looks obviously broken. |
| **C9** | 🔴 | **The default helix contains no thymine at all.** `hashRandom` is a `sin`-based hash intended for varied seeds; fed the consecutive integers 5…20 it produces a strongly correlated stream. Strand 1 composition by slider position:<br>`pairs=8` → A 1, **T 0**, C 3, G 4<br>`pairs=16` (default) → A 5, **T 0**, C 4, G 7<br>`pairs=20` → A 7, T 1, C 4, G 8<br>On a scene whose headline is A–T and C–G pairing, and whose legend lists Thymine as one of four colours, thymine does not appear on the primary strand until the slider passes 19. |
| **C10** | 🟠 | **Silent truncation.** `pairs` runs to 26 (`topics.js:2597`) but the panel's base array is 16 long and it `slice`s without comment — pairs 17–26 are simply not shown, and the row is still headed "Strand 1 (5′→3′)". |
| **C11** | 🟠 | The key describes hydrogen bonds as a white dashed line `#e8ebf0` (`:2815`). The scene draws them as solid cylinders coloured by base. |
| **C12** | 🟡 | **A–T has 2 hydrogen bonds, C–G has 3** — stated in both readouts and represented nowhere. Every rung is an identical single cylinder, so the fact that G–C is the stronger pair (the reason GC-rich DNA has a higher melting point) has no visual anchor. |
| **C13** | 🔵 | The two backbones are different greys (`#64748b` / `#94a3b8`); only one appears in either key. |

### 5.3 `cell` — Cell Organelle Explorer

| # | Sev | Finding |
|---|---|---|
| **C14** | 🔴 | **The panel and the scene disagree about the cell's state across most of the slider.** `tonicity` runs −1 → +1. Panel thresholds: ±0.05 (`VisualizationHUD.jsx:2838`). Scene thresholds: `> 0.45` plasmolysed / `< −0.3` turgid / else flaccid for plants; `±0.45` for animals (`BiologyCanvas.jsx:880`). At `tonicity = 0.1` the panel declares **"Plasmolysed (Hypertonic)"** while the scene's own state model says **"Flaccid"** and the membrane has barely moved. **"Flaccid" never appears in the panel at all**, despite being one of the three states the topic teaches. |
| **C15** | 🔴 | **"Lysed (burst)" and "Crenated" are named but never drawn.** The animal cell's only response to tonicity is a uniform scale between 0.90 and 1.20 (`BiologyCanvas.jsx:877`). A "burst" cell is drawn as a cell 20 % larger than normal, still perfectly intact, with its membrane and every organelle in place. |
| **C16** | 🟠 | **The organelle key ignores the cell type.** `VisualizationHUD.jsx:2865–2873` lists Chloroplast, Permanent Vacuole and Cellulose Cell Wall for animal cells, where none are drawn. Symmetrically, the scene's own key lists Lysosomes for plant cells, where `PLANT_LAYOUT.lysosomes` is `[]`. |
| **C17** | 🟠 | **Half the clickable organelles have no key entry.** Smooth ER, free ribosomes, lysosomes, centrioles and the cytoskeleton are all rendered and all selectable, and none is in the HUD key. Rough ER and the cell membrane are both keyed `#38bdf8`. |
| **C18** | 🟡 | The scene's own key omits the **cell membrane** for plant cells (`BiologyCanvas.jsx:1069`) even though it is drawn, clickable and has a dedicated bilayer inset. |
| **C19** | 🔵 | `ORGANELLES[*].both` (`BiologyCanvas.jsx:626`) — a plant/animal flag on all twelve organelles — is never read. It is exactly the data C16 needs. |
| **C20** | 🔵 | `["Cell Status", stateText, … : "default"]` (`:2848`) passes the literal string `"default"` as a tone. It happens to be a valid `TONES` key, but it is the same pattern as X4. |

### 5.4 `protein` — Protein Folding & Secondary Structure

| # | Sev | Finding |
|---|---|---|
| **C21** | 🔴 | **A visibly folded helix labelled "Denatured (Random Coil)".** Panel: `denatured = temperature > 320 \|\| fold < 0.35` (`VisualizationHUD.jsx:2881`). Scene: a 320 → 358 K *window* applied multiplicatively, `folded = fold × heatFactor`, denatured below 0.35 (`BiologyCanvas.jsx:1196–1200`). At 330 K with the fold slider at 1.0 the scene draws a 74 %-folded helix with its i→i+4 bonds intact; the panel calls it a random coil. The whole 320–358 K window — the partial-unfolding behaviour the scene was built to show — is reported as fully denatured. |
| **C22** | 🟠 | **"Folded Progress" ignores temperature.** `:2885` prints the raw `fold` slider. At 340 K with `fold = 1` it reads **100 %** over a chain the scene has half unravelled. |
| **C23** | 🟠 | **The scene blames heat for a cold unfolding.** `denatured = folded < 0.35` conflates a low fold slider with thermal denaturation, so dragging fold to 0.2 at 300 K produces the note *"Above about 47 °C the hydrogen bonds … break"* — a false cause stated for a state the user created with a different control. |
| **C24** | 🔵 | The key uses `#fbbf24` for both "Hydrophobic Residue" and "Denatured State" (`:2896`, `:2900`) — the same swatch for two mutually exclusive meanings. |
| **C25** | 🔵 | Doc drift: the header says the helix is *"scaled from the real 0.54 nm rise per 3.6 residues"*, but `HELIX_RADIUS 0.95` against `HELIX_RISE 0.42` gives a radius-to-pitch ratio of 0.63 where the real one is 0.43. The drawn helix is noticeably fatter than an α-helix. |

### 5.5 `eye` — Accommodation & Pupil Reflex

`lib/eyeOptics.js` is the strongest engine in the suite — Gullstrand's relation solved rather than approximated, the lens separation derived rather than guessed, blur measured off the marginal ray. Findings are peripheral.

| # | Sev | Finding |
|---|---|---|
| **C26** | 🟡 | **The eye is the only topic whose state is not in `params`.** `EyeCanvas({ onOpenQuiz })` (`:1343`) ignores the `params` / `setParam` props `BiologyCanvas` passes it and keeps all sixteen of its controls in local `useState`. Switching topics and back resets the whole scene, and nothing about the eye participates in the shared parameter state the other 28 topics use. |
| **C27** | 🔵 | Doc drift in `lib/eyeOptics.js`: `lensRadiusOfCurvature` claims *"near 9.9 mm relaxed and near 6.2 mm fully accommodated"*; the code returns **8.2 mm** and **5.1 mm**. `LENS_COUPLING` is documented as "~84 %" and computes to **79.7 %**. The lens *thickness* figures the same code produces (3.70 mm / 4.75 mm) are spot on, so this is comment-only. |
| **C28** | 🔵 | `topics.js:2759` advertises the keywords *"blurred vision short sight long sight"*. There is no myopia/hyperopia mode — the three modes are Focusing, Pupil and Anatomy. Searching for "short sight" lands on a scene that cannot show it. |

### 5.6 `respiratory` — Respiratory Mechanics

| # | Sev | Finding |
|---|---|---|
| **C29** | 🔴 | **Seven React `setState` calls per frame at 60 Hz.** `handleFrameUpdate` (`RespiratoryCanvas.jsx:1415–1483`) calls `setExpansion`, `setPhase`, `setVolume`, `setPressure`, `setFlowRate`, `setExtTension` and `setIntTension` every single frame, re-rendering a 2 080-line component that mounts two multi-megabyte GLB scenes. Every other canvas in the suite mutates refs in `useFrame` and pushes to React on a throttle — `TimelineDriver` uses `pushEvery = 0.1` (10 Hz), `ArmDriver` uses `PUSH_EVERY_S = 0.2` (5 Hz). This scene is 6–12× over that budget and is the heaviest in the app. |
| **C30** | 🔴 | **`FrameController` is declared inside the component body** (`:1489`). React sees a brand-new component *type* on every render, so it unmounts and remounts the subtree — tearing down and re-creating the `useFrame` subscription. Combined with C29 that is 60 subscribe/unsubscribe cycles per second. |
| **C31** | 🟠 | **Three different tidal volumes for the same phase.** Auto-loop peaks at `2.8 + 1 × 0.7 = 3.50 L` (`:1441`); the manual branch lerps to **3.65 L** (`:1463`); the HUD fallback string says **"3.50 L"** (`:2916`); and the private test copy's formula gives 3.50. Pressures diverge the same way (−0.28 / −0.32 / −0.28 kPa). |
| **C32** | 🟠 | **Forced expiration is unreachable while the animation is playing.** The auto-loop only ever sets `INSPIRATION` and `QUIET_EXPIRATION` (`:1425–1436`); the `FORCED_EXPIRATION` branch exists only in the manual path. One of the topic's three phases cannot be seen in the default mode. |
| **C33** | 🔵 | The unit test asserts against a private copy of an engine the scene does not import — see **X3**. |
| **C34** | 🔵 | Dead HUD case with invalid `TONES` keys — see **X4**, **X5**. |
| **C35** | 🔵 | `Math.random()` at `:1111–1112` for particle jitter, where the rest of the suite uses the deterministic `hashRandom`. Memoised, so stable within a mount, but it makes the scene non-reproducible across mounts and across screenshots. |

### 5.7 `food_chain_pyramid`

| # | Sev | Finding |
|---|---|---|
| **C36** | 🟠 | **During a trophic cascade the energy-transfer rows describe a pyramid that is not on screen.** `solveFoodChain` (`lib/foodChain.js:206–226`) multiplies each tier's `energyKJ` by its cascade factor (leaves ×1.3, caterpillars ×0.35, blue tits ×2.2) but computes `receivedKJ` and `lostKJ` from the **intact** chain. With the hawk removed the bars show blue tits holding 220 kJ above caterpillars holding 350 kJ, while the rows still report the clean 1000 → 100 kJ / "90 % lost" arithmetic. The cascade is a real ecological point, but the readout should stop claiming the 10 % rule while it is running. |

### 5.8 `mitosis_meiosis`

| # | Sev | Finding |
|---|---|---|
| **C37** | 🟡 | **Chromosome condensation pops at interkinesis.** `restCondense` is applied only when `division === 1` (`lib/cellDivision.js:290`), so condensation holds at 0.35 through telophase I and cytokinesis I and then jumps straight to **0** at the first frame of prophase II before ramping back up. Interkinesis is supposed to be the one place chromosomes *don't* fully decondense — the model says so in its own comment and then discards it at the division boundary. |
| **C38** | 🔵 | `diversity().index` is documented as running "0 → 1 across the slider's range" (`:243`) but returns **0.387** at zero crossovers, because it is `log₂(4)/log₂(36)`. Any gauge bound to it starts 39 % full. |

---

## 6. Topics that came out clean

These were audited to the same depth and the arithmetic checks out. Listing them so the report is a statement about the whole suite, not just its bad half.

- **`separation_techniques`** — filtration, crystallisation and chromatography all solved from `lib/separation.js`; the HUD reads the same solver. Rf, solubility and pore-size logic are correct.
- **`particle_model_matter`** — phase boundaries, latent heats, r.m.s. speed and the critical point are all consistent; the CO₂ sublimation branch correctly refuses to produce a liquid below the triple-point pressure.
- **`radioactive_decay`** — all four nuclear equations are correct (²³⁸U→²³⁴Th+α, ¹⁴C→¹⁴N+β⁻+ν̄ₑ, ¹⁸F→¹⁸O+β⁺+νₑ, ⁹⁹ᵐTc→⁹⁹Tc+γ) and A/Z conservation is checked in code rather than asserted in prose.
- **`transpiration`** — Tetens, series conductances, cohesion–tension and the ABA/K⁺ drought override are all right, and cavitation is reachable only under the conditions that should cause it.
- **`peristalsis`** — the gravity asymmetry (a bolus can outrun the wave downward but cannot fall back against a closed ring) is modelled correctly and is the topic's whole point.
- **`carbon_cycle`**, **`cardiac_cycle`**, **`reflex_arc`**, **`antagonistic_muscles`**, **`flower_pollination`**, **`bacteria_vs_virus`** — engines and readouts agree; no findings.
- **`reactivity_series`** / **`rusting_galvanic`** — the electrochemistry in `lib/redox.js` is correct throughout (balanced equations verified for every reachable metal/solution pair, including the charge-1/charge-2 scaling); findings B37–B42 are presentation and plumbing.

---

## 7. Implementation plan

Five phases. Each is independently shippable and independently reviewable. Phases 1 and 2 are the ones that matter.

---

### Phase 1 — Make the Details panel tell the truth *(highest value, lowest risk)*

> **STATUS: LANDED (18 Sep 2026).** All eleven drifted cases now derive their
> readout from the same module the scene draws from. Ten new `lib/` modules were
> added rather than correcting the panel in place, because the HUD cannot import
> the scenes — `VisualizationHUD → BiologyCanvas → RespiratoryCanvas →
> VisualizationHUD` is a cycle — and a third copy of each constant would have
> been worse than the second. That makes it a down payment on Phase 3.
>
> New modules: `atomicStructure` · `organic` · `distillation` · `lattices` ·
> `electrolysis` · `vsepr` · `energetics` · `enzymes` · `dna` · `cellBiology` ·
> `proteinFolding`.
>
> Four Phase 2 items came forward because leaving them would have made the
> corrected panel contradict the scene instead: **B7** (ester formyl hydrogen),
> **B16** (residue no longer vaporises), **B25** (electrode bubbles removed) and
> **C9** (sequence generator replaced — all four bases now appear at every
> slider position). **C2** came forward with the shared enzyme solver.
>
> Verified: `npm test` 1310/1310 pass; production build clean; DNA, organic,
> VSEPR, enzyme, protein and cell panels checked against their scenes in the
> browser. The electrolysis run clock could not be exercised in-browser —
> `requestAnimationFrame` does not fire in the automated pane, so `useFrame`
> never runs and `reactivity_series` (untouched, same pattern) reads 0.0 s too.
> Its arithmetic is verified separately against the standard 1 A / 30 min /
> 0.592 g copper result.


**Goal:** no screen contradicts itself. Fixes 35 defects without touching a single 3D scene.

The root cause is X1: the panel is a second implementation. The full fix is Phase 3; Phase 1 is the surgical version — correct the eleven drifted cases in place, so the panel stops asserting falsehoods while the refactor is designed.

**1.1 — Fix the `TONES` map** *(X4, C20)*

```js
// components/visualizations/VisualizationHUD.jsx:336
const TONES = {
  default: "text-ink-100",
  neutral: "text-ink-100",   // alias — used by respiratory and others
  gold:    "text-duck-300",
  good:    "text-emerald-400",
  warn:    "text-amber-400",
  bad:     "text-rose-400",
  sky:     "text-sky-400",
  rose:    "text-rose-400",
};
```
Then make `Stat` fall back safely: `TONES[tone] ?? TONES.default`. One line; removes the possibility of this class of bug recurring.

**1.2 — Correct the eleven drifted cases.** In priority order:

| Case | Change |
|---|---|
| `dna` | Delete the hard-coded `bases` array. Export the scene's generator from `BiologyCanvas.jsx` (or, better, from the new `lib/dna.js` in Phase 3) and call it, so the panel prints the helix that is on screen. Recolour the four base entries to `BASE_COLOURS`. Recolour the hydrogen-bond entry and change its shape to `line`. Label the strand rows with the count actually shown. *(C7, C8, C10, C11)* |
| `organic` | Add `acid` and `ester` to the formula branch. Change `saturated` to `["alkane","alcohol","acid","ester"].includes(family)` and make the bromine-water row read from it. Swap the two bond-colour entries to match `PALETTE`. Route the formula through the scene's `sub()` helper. *(B9, B10, B11, B14)* |
| `vsepr` | Extend `molecularShape` with `4-1` Seesaw, `3-2` T-shaped, `2-3` Linear, `3-3` T-shaped, `5-1` Square pyramidal, `4-2` Square planar. Clamp `steric` to 2–6. Replace the `lone × 2.5°` row with the scene's measured `smallestAngle`, and add the Polarity row. *(B29, B30, B31, B32)* |
| `cell` | Replace the ±0.05 thresholds with the scene's (`+0.45` / `−0.3` plant, `±0.45` animal) and add the missing **Flaccid** state. Filter the organelle key on `cellType` using the existing `ORGANELLES[*].both` flag. Add smooth ER, ribosomes, lysosomes, centrioles; give the membrane its own colour. *(C14, C16, C17, C19)* |
| `protein` | Replace `temperature > 320 \|\| fold < 0.35` with the scene's `folded = fold × heatFactor; denatured = folded < 0.35`, and print `folded` — not `fold` — as "Folded Progress". De-duplicate the `#fbbf24` key entries. *(C21, C22, C24)* |
| `enzyme` | Replace the local rate formula and the `> 55` threshold with the scene's `enzymeRate()`. Recolour the enzyme and product key entries. *(C1, C3, C5)* |
| `distillation` | Delete the local `fractions` table; import the scene's `FRACTIONS`. Use the scene's `rising` predicate. Make "Highest riser" read the highest fraction that actually rises. *(B17, B18, B19)* |
| `electrolysis` | Delete `Math.round(current * 14)`. Have the scene push its real arrival count through `setParam("liveDeposit", …)` on the established 5 Hz cadence, exactly as `reactivity_series` does with `liveSeconds`. Recolour the electrode key entries to copper. *(B26, B27)* |
| `bohr` | Add the Hydrogen branch to the note ternary. Delete the "Photon Wave Packet" key entry. Recolour protons to `PALETTE.rose`; make the valence entry conditional on `highlightValence`. *(B1, B2, B3)* |
| `lattice` | Delete the "Delocalised Electron" and "Interlayer Force" key entries (or implement them — see 2.4). Recolour all bond entries to `#3f4854`. *(B21, B22)* |
| `energetics` | Add the rate-constant and Rate-× rows, and surface the ΔH clamp. *(B36)* |

**1.3 — Delete the dead `respiratory` case** *(X5)*, or — better — leave a three-line comment at `:2914` pointing at `ownHud: true` and at `RespiratoryCanvas`'s own panel, so the next person does not re-add it.

**1.4 — Remove the duplicate speed sliders** *(X6).* Delete `{ key: "speed" }` from `bohr.controls` and `enzyme.controls`. If `bohr` needs to reach a true pause, lower the universal slider's `min` to 0 and let its `format` say "paused" — it already does.

---

### Phase 2 — Correct the scenes that teach the wrong thing

> **STATUS: LANDED (18 Sep 2026), with one item partially done.**
>
> | Item | State |
> |---|---|
> | 2.1 bubbles removed | done in Phase 1. The richer electrode-material choice (copper vs inert graphite) is **not** done — see Open below. |
> | 2.2 cracking | done. Products are real molecules now: CₙH₂ₙ₊₂ → C₍ₙ₋₂₎H₂₍ₙ₋₂₎₊₂ + C₂H₄, verified balanced for every reachable n. |
> | 2.3 chain geometry | done, and taken further than planned: each turn now takes the angle its carbon's hybridisation dictates, so alkanes are 1.540 Å / 109.5°, alkenes 1.340 Å / 120° on the sp² carbons, alkynes 1.200 Å / 180° on the sp carbons. |
> | 2.4 quartz + graphite | done. Quartz rebuilt as β-cristobalite, max Si coordination now 4 (was 6). Graphite's delocalised electrons and interlayer forces are **drawn** rather than deleted from the key. |
> | 2.5 ice | done. H–O–H is exactly 104.50° for every molecule (was 123°), O–H 0.96 Å, O···O 2.76 Å. |
> | 2.6 residue flag | done in Phase 1. |
> | 2.7 enzyme | done in Phase 1 (C2, C4, C6). |
> | 2.8 dna | done. Generator replaced in Phase 1; A–T now drawn with two hydrogen bonds and C–G with three. |
> | 2.9 lysis / crenation | done. Membrane shape is driven by tonicity and ruptures past the threshold, with cytoplasm escaping. |
> | 2.10 respiratory | **partial.** `FrameController` hoisted, constants unified into `lib/respiratory.js`, the React push quantised and throttled to 10 Hz, forced expiration made reachable while looping, and the test rewired to the shipping engine — which immediately caught a real bug in the new forced-expiration curve. The full ref-mutation conversion is NOT done. |
>
> **Why 2.10 is only partial:** the animated values (`expansion`, `extTension`,
> `intTension`) are threaded as props through hundreds of inline material
> properties across `RealisticCTSkeleton`, the intercostal arrays, the
> diaphragm and the lungs. Converting those to ref reads is a real refactor
> that needs visual verification, and `requestAnimationFrame` does not fire in
> this environment's automated browser pane, so no animation-driven change
> could be watched. The throttle takes the cost from ~420 setState calls a
> second to at most 70; the remaining work is tracked as **C29-residual**.
>
> **Also open from Phase 2:** the electrode-material choice for `electrolysis`
> (2.1's richer form). The bubbles are gone and the cell is correct as a
> copper-on-copper purification cell; adding the inert-graphite comparison is
> a feature, not a defect fix.
>
> Verified: `npm test` 1315/1315 (5 new); production build clean; bond lengths,
> bond angles, Si coordination, H–O–H angle, cracking balance and the breath
> curve all checked numerically.

---

#### Original plan



**Goal:** a student who watches the animation carefully is not misled. These are model changes, so each needs a visual check.

**2.1 — `electrolysis`: remove the bubbles** *(B25)*

The cell is copper-on-copper in CuSO₄. Delete both `ElectrodeBubbles` at `ChemistryCanvas.jsx:1809–1811`.

The richer fix — and the one that earns its keep — is to add an **electrode material** choice (`copper` / `inert graphite`) to the topic. Copper: anode dissolves, cathode plates, no gas. Graphite: O₂ at the anode, Cu at the cathode until the Cu²⁺ runs out, then H₂. That turns a deleted feature into the comparison the syllabus actually asks for, and it gives the existing bubble component a correct home.

**2.2 — `organic`: make cracking crack** *(B8)*

`Molecule`'s `fragments` memo (`:673–697`) already partitions the molecule. Extend it:

- Cut between C1 and C2 rather than after C0, so the alkane fragment is realistic (C₃H₈ → CH₄ + C₂H₄ is the textbook case, and decane → octane + ethene is the one in the syllabus).
- Rebuild the right-hand fragment through `buildMolecule("alkene", …)` at the split, so a real C=C appears with the correct `double: true` flag and the correct hydrogen count.
- Drop one hydrogen from the alkene fragment and add it to the alkane fragment, so neither is a radical.
- Update the formula/name labels to show the two products once the split completes.

This is the largest single change in the plan and deserves its own commit.

**2.3 — `organic`: fix the chain geometry** *(B6, B7, B12, B13)*

- Replace `ESTER_NAMES` with a generated name: `"methyl " + ACID_NAMES[n-1].replace("ic acid", "oate")`, matching the methyl R-group the code actually builds. Alternatively add an R-group control and name from both halves.
- Add the formyl hydrogen to the `n === 1` ester case, mirroring `:447`.
- In the chain loop, decompose each bond from its *own* length: `x += L * CHAIN_X; y = ±(L * CHAIN_Y)/2` rather than holding the rise at the C–C value. That fixes the C=C length and the post-sp-carbon kink in one change.

**2.4 — `lattice`: rebuild quartz tetrahedrally** *(B20)*, and decide about graphite's key *(B21)*

Replace `buildQuartz` with a **β-cristobalite** net — the standard teaching model for silica: silicon on the diamond-cubic lattice (`buildDiamond` already generates it) with a bridging oxygen at the midpoint of every Si–Si bond. That gives 4-coordinate Si, 2-coordinate O, an Si–O–Si angle near the real 144° once the oxygens are nudged off the bond axis, and the same 1 : 2 stoichiometry. `buildDiamond` can be parameterised to return the point set so both structures share it.

For graphite, either delete the two phantom key entries (Phase 1.2) or draw them: dashed interlayer lines between vertically aligned carbons, and a handful of drifting electron sprites within each sheet. Drawing them is worth more — delocalisation is the reason graphite conducts, which is the topic's headline.

**2.5 — `lattice`: fix the water geometry** *(B23)*

Set the two hydrogen offsets from the real 104.5° angle and a 0.96 Å O–H length, then build the hydrogen-bond search from the O···O distance (2.76 Å) rather than the current `0.4 < d < 1.35` H···O window.

**2.6 — `distillation`: honour the `residue` flag** *(B16)*

Three call sites: the `rising` count (`:884`), the tray glow (`:912`), and `Vapours`' `reach` (`:840`). Gate all three on `!fraction.residue`. Draw bitumen instead as a pool draining out of the base — which is what the label already says happens.

**2.7 — `enzyme`: line the model up with itself** *(C2, C4, C6)*

- Pass `denatured={denatured}` to `Substrate` rather than `denature > 0.25`, so rejection starts at 50 °C, where the readout says it does.
- Replace the discontinuity at 50 °C with a steep sigmoid so the drawn curve is single-valued: `rate = tempTerm × phTerm × (1 − smoothstep((T − 48)/6))`, tuned to preserve the shape.
- Make "Reversible?" account for pH as well as temperature.

**2.8 — `dna`: fix the sequence generator and show the bond counts** *(C9, C12)*

- Replace `hashRandom(i + 5)` with a properly-mixed integer hash (xorshift or a `mulberry32` seeded once per `pairs` value) and assert in the new unit test that all four bases appear at the default 16 pairs. The cheapest interim fix — widening the seed stride to `hashRandom(i * 7.3 + 5)` — should be verified with the same test rather than trusted.
- Draw A–T rungs as two thin cylinders and C–G as three. It is a small geometry change and it makes the topic's second-most-important fact visible.

**2.9 — `cell`: draw lysis and crenation** *(C15)*

The animal cell's only tonicity response is a uniform scale. At `tonicity < −0.45`, drive the blob's `amp` toward 0 (a sphere under tension), then, past a threshold, tear the membrane — raise its opacity, scatter a few cytoplasm fragments outward, and hold. At `tonicity > 0.45`, raise `amp` sharply so the surface crenates into spicules rather than shrinking smoothly. `makeBlobGeometry` already takes `amp` and `freq`; both can be driven from tonicity.

**2.10 — `respiratory`: move the simulation off React** *(C29, C30, C31, C32)*

- Hoist `FrameController` to module scope and pass the handler as a prop.
- Move `expansion`, `volume`, `pressure`, `flowRate`, `extTension` and `intTension` into a single `useRef` state object mutated in `useFrame`, exactly as `ArmDriver` and `RustDriver` do. Meshes and materials read the ref directly.
- Push to React on a `pushEvery = 0.1` throttle for the HUD only.
- Pick one set of phase constants, put them in the new `lib/respiratory.js`, and have the auto-loop, the manual path and the panel all read it.
- Give the auto-loop an occasional forced-expiration cycle, or a toggle, so the third phase is reachable while playing.

---

### Phase 3 — Extract the engines and delete the duplication

> **STATUS: LANDED (19 Sep 2026).**
>
> | Item | Outcome |
> |---|---|
> | 3.1 eleven `lib/` modules | done in Phase 1, out of necessity — see below. |
> | 3.2 eleven HUD cases call `solveX()` | done in Phase 1, same reason. |
> | 3.3 retire `SceneReadout` / `SceneLegend` | done. 97 call sites and both definitions deleted: **1,518 lines**. |
> | 3.4 eleven test files | done. 211 new assertions, 1315 → **1526**. |
>
> **Why 3.1 and 3.2 landed early.** The plan assumed the HUD cases could be
> corrected in place. They could not: `VisualizationHUD → BiologyCanvas →
> RespiratoryCanvas → VisualizationHUD` is an import cycle, so the HUD cannot
> read anything a scene owns. Sharing had to go through `lib/`, which is
> exactly what 3.1 asks for — so it was pulled forward rather than adding a
> third copy of each constant and deleting it a phase later.
>
> **Which 3.3 route, and why the plan's preference was overtaken.** The plan
> preferred route two: scenes export their readout spec, the HUD renders it.
> That route is now both blocked and unnecessary. Blocked by the same cycle
> that forced 3.1 — `VisualizationHUD` is upstream of every scene. Unnecessary
> because the single definition the route was reaching for already exists:
> it is the `lib/` module, which the scene and the HUD both import freely.
> Re-exporting a spec from the scene would move the definition *out* of that
> shared home. So the components and their call sites were deleted.
>
> What was deleted was not inert. Every one of the 97 call sites carried a
> full second copy of its scene's readout and colour key, rendering nowhere:
> the enzyme scene still held its own `rate > 0.6` threshold and a "~50 °C"
> denaturation note, the crystal scene still keyed bonds in a colour it had
> stopped drawing them in. That is X1's supply, and it is gone.
>
> **One new defect, found by writing 3.4.** `solveVsepr` measured compression
> as `ideal − smallestAngle`, and `IDEAL_ANGLE` carries the rounded 109.5°
> the syllabus prints rather than the 109.4712° the geometry is built from —
> so a plain tetrahedron with no lone pairs reported a 0.03° compression.
> Compression is now zero when there are no lone pairs, by definition. The
> HUD already read "none — ideal angles" below its 0.05° threshold, so nothing
> on screen changed; the number is simply honest now.
>
> **The bar each test file meets:** every reachable slider combination
> produces a named shape, formula or state, with no fall-through to another
> family's answer and no `undefined`; every formula the readout prints is
> derived rather than hard-coded; and the regressions in this report are
> locked in by name — no-thymine, ester naming, AX₄E₂ = square planar,
> alcohols and acids saturated, bitumen never rising, flaccid reachable, a
> 74 %-folded helix at 330 K not called denatured, and the enzyme collapse
> staying single-valued.
>
> Verified: `npm test` 1526/1526; production build clean; and all eleven
> topics opened in a browser after the deletion — readouts still derive
> correctly (DNA strand carries all four bases with 41 hydrogen bonds,
> cell reads Flaccid at isotonic, bitumen never rises, VSEPR AX₄ reports
> no compression).
>
> **Still open:** 2.1's richer form, carried from Phase 2 and now logged as a
> feature request. Phase 4 and Phase 5 untouched.
>
> **C29-residual — reduced, not closed (19 Sep 2026).** On Harshith's
> instruction the intercostal muscle geometry was removed outright:
> `PhotorealisticIntercostalMuscles` drew 11 rib spaces x two oblique layers,
> every mesh carrying an inline material that read `expansion`, `extTension`
> and `intTension` as props. That was 485 lines and roughly 130 meshes, and it
> was the bulk of what made the ref-mutation conversion a large job.
>
> `extTension` and `intTension` now have **no 3D consumers at all** — they feed
> only the DOM gauges. The antagonistic pair survives as physiology: the gauges
> still read `muscleStates()` from `lib/respiratory.js`, and the concept text is
> unchanged. What is lost is the visual of the pair, which is a real cost and
> was flagged before the cut.
>
> Removed with it, because they described geometry that is no longer drawn: the
> two 3D anatomical labels, the "Striated Intercostal Muscles" visibility
> toggle, the three-way muscle-layer selector, and a credits line claiming
> original authorship of the muscle meshes. The three ribcage kinematic arrows
> were **kept** — bucket-handle and pump-handle are rib motion, not muscle — and
> lifted into a `RibcageKinematicVectors` component of their own.
>
> `expansion` still threads as a prop to the diaphragm, the lungs and the
> skeleton, so the 10 Hz throttle is still doing real work and the conversion
> is still unfinished. It is now a much smaller job than it was.


**Goal:** make Phase 1 permanent. Until the readout is derived from the same code the scene runs, it will drift again.

**3.1 — Create eleven `lib/` modules**, following the shape of `lib/redox.js` and `lib/transpiration.js` — pure functions, no React, no three.js, one exported `solveX()` returning everything a scene or a readout could want:

| New module | Moves out of | Headline export |
|---|---|---|
| `lib/atomicStructure.js` | `ChemistryCanvas` | `ELEMENTS`, `describeAtom()` |
| `lib/organic.js` | `ChemistryCanvas` | `buildMolecule()`, `crack()`, `nameFor()` |
| `lib/distillation.js` | `ChemistryCanvas` | `FRACTIONS`, `solveColumn(heat)` |
| `lib/lattices.js` | `ChemistryCanvas` | `buildLattice(structure, slide)`, `LATTICE_FACTS` |
| `lib/electrolysis.js` | `ChemistryCanvas` | `solveCell({ current, electrode, seconds })` |
| `lib/vsepr.js` | `ChemistryCanvas` | `vseprGeometry()`, `SHAPES` |
| `lib/energetics.js` | `ChemistryCanvas` | `solveProfile({ activation, deltaH, … })` |
| `lib/enzymes.js` | `BiologyCanvas` | `enzymeRate()`, `solveEnzyme()` |
| `lib/dna.js` | `BiologyCanvas` | `sequenceFor(pairs)`, `HELIX`, `BASE_COLOURS` |
| `lib/cellBiology.js` | `BiologyCanvas` | `ORGANELLES`, `solveOsmosis({ cellType, tonicity })` |
| `lib/proteinFolding.js` | `BiologyCanvas` | `solveFolding({ structure, residues, fold, temperature })` |

**3.2 — Rewrite the eleven HUD cases to call `solveX()`**, so each becomes a dozen lines of formatting like `case "reactivity_series"` already is. This deletes roughly 700 lines of duplicated arithmetic from `VisualizationHUD.jsx`.

**3.3 — Retire `SceneReadout` / `SceneLegend`.** They are no-op components receiving a page of props each. Either delete them and their ~900 lines of call sites, or — the better option — make them the *single* definition: have each scene export its readout spec, and have the HUD render that spec instead of a `switch`. The second route is the one that structurally prevents X1 from recurring, and it is what the components' own doc comments say was intended.

**3.4 — Write eleven test files** mirroring `tests/unit/redox.test.mjs`. Minimum bar per topic: every reachable slider combination produces a named shape/formula/state; every formula the readout prints is derived, not hard-coded; the specific regressions in this report are locked in (no-thymine, ester naming, AX₄E₂ = square planar, alcohol = saturated, bitumen never rises).

---

### Phase 4 — Fix the second-generation loose ends

> **STATUS: LANDED (19 Sep 2026).** All fifteen items. Two were resolved
> earlier: **B33** by the Phase 5.4 guardrail, which found it on its first
> run, and **C29-residual** by the intercostal removal in Phase 3.
>
> | Item | Outcome |
> |---|---|
> | B33 | done in Phase 5.4 — the guardrail found it. |
> | B34 | done. Scale 0.028 → 0.023, verified at both slider extremes. |
> | B37 | done. `deltaE` is a magnitude; polarity stays in `direction`. |
> | B38 | done. Bubbles stop when the anode is consumed. |
> | B39 | done for the rusting rack; the reactivity rack already did it. |
> | B40 | done. Salt is a label now, not ten undissolved cubes. |
> | B41 | done. `MAX_DAYS` 30 → 90, so both anodes can exhaust. |
> | B42 | done. Electrons run inside the strip, as the key says. |
> | B43 | done. Soot on the liquid-water basis, −409 → −497. |
> | C26 | done. Fifteen controls moved into the shared parameter state. |
> | C27 | done. Three comment numbers corrected; a fourth was already right. |
> | C28 | done. The keywords stopped promising a defect mode. |
> | C36 | done. Transfers derive from the cascaded chain. |
> | C37 | done. Interkinesis no longer pops. |
> | C38 | done. Comment corrected rather than the code. |
>
> **Where the plan's two options diverged, and why.**
>
> *B41* offered "lower `wrapMassG` or raise `MAX_DAYS`". Lowering the mass
> would have been wrong: the wraps are the same ribbon in each metal, and
> 0.5 g zinc to 0.12 g magnesium is exactly their density ratio. The run is
> longer instead — zinc exhausts at ~69 days, magnesium at ~30.
>
> *C38* offered "normalise `index` so it starts at 0, or correct the comment".
> Normalising would have been wrong: with no crossovers at all, independent
> assortment has still produced four distinct gametes, and a gauge reading
> zero there would say the opposite of what meiosis does. The comment was the
> thing that was false.
>
> *C27* listed three wrong numbers. There were three — 20 D (really 21.3),
> ~84 % coupling (really 80 %), 9.9/6.2 mm radii (really 8.2/5.1) — and a
> fourth that looked wrong and was not: "9.0 mm across relaxed" is a
> diameter, and the function returns a semi-diameter of 4.50 mm.
>
> *C28* offered "trim the keywords or add a defect mode". Trimmed. A defect
> mode is a feature, and `lib/eyeOptics.js` does have what it needs for one
> (a myopic eye is `axialLength` > `n / P`) — it is worth building, not worth
> claiming in a keyword list until it exists.
>
> **B34 is the one that needed eyes.** The arithmetic said the summit fitted:
> camera at z = 10.5 with a 46° vertical fov gives a half-height of 4.46, so a
> peak at 4.48 with a label at 4.98 looked marginal but survivable. It was
> not. The camera sits at y = 1.2 looking at the origin, so it is pitched down
> ~6.5° and the top edge only reaches y ≈ 4.3 at the z = 0 plane. The
> transition state was off-screen entirely at high Ea. Found and fixed against
> screenshots, not against the formula.
>
> Verified: `npm test` 1784/1784; production build clean; the energy profile
> and the eye both checked in a browser.


Small, isolated, low-risk.

- **B37** `lib/redox.js:424` — make `deltaE` the true cell potential: `Math.abs(IRON_POTENTIAL_V − P.potential)`, or rename it `ironMinusPartnerV` and have the HUD drop its `Math.abs`.
- **B38** `RustingGalvanicCanvas.jsx:375` — `rate={couple.bubbleRate}` instead of `rate={0.5}`.
- **B39** Both rack scenes — push `shownDays` / `m.seconds` through `setParam` on the existing throttle and read *that* for the labels, so the words and the picture share a clock.
- **B40** `SaltCrystals` — replace the cubes with a faint tint and a "3 % NaCl (aq)" label, or gate them behind a "saturated brine" option.
- **B41** Either lower `PARTNERS[*].wrapMassG` so the anode is consumable inside 30 days, or raise `MAX_DAYS`. As it stands a modelled behaviour with its own verdict string and HUD note is unreachable.
- **B42** Move the electron stream inside the strip (`STRIP.thickness / 2 − 0.02`) so it matches its own legend.
- **B43** `lib/combustion.js:113` — put `EQUATIONS.soot` on the liquid-water basis (≈ −497 kJ/mol) to match its two siblings.
- **B33** Delete `showReverse` from `energetics.defaults`, or implement the reverse-Ea arrow it was clearly meant to toggle.
- **B34** Clamp `ENERGY_SCALE` or pull the camera back as a function of `effectiveEa` so the summit never clips.
- **C36** `lib/foodChain.js` — compute `receivedKJ` / `lostKJ` from the cascaded energies, and have the HUD say plainly that the chain is out of equilibrium while a cascade is running.
- **C37** `lib/cellDivision.js:290` — carry `restCondense` into division 2's prophase so interkinesis does not pop.
- **C38** `lib/cellDivision.js:243` — either normalise `index` so it starts at 0, or correct the comment.
- **C26** `EyeCanvas` — accept `params` / `setParam` and move its sixteen controls into the shared parameter state.
- **C27** `lib/eyeOptics.js` — correct the three numbers in the comments to the ones the code returns.
- **C28** Trim "short sight / long sight" from the eye's keywords, or add a defect mode. `lib/eyeOptics.js` already has everything needed: a myopic eye is `axialLength` > `n / P`, and the blur machinery would then work unchanged.

---

### Phase 5 — Guardrails

> **STATUS: LANDED (19 Sep 2026).** All four, and they are not decorative —
> each was mutation-tested by injecting the defect it exists to catch.
>
> | Item | Outcome |
> |---|---|
> | 5.1 legend fidelity | done. Found **10** real mismatches on its first run. |
> | 5.2 readout parity | done, in two halves: structural and behavioural. |
> | 5.3 no private engines | done. Three existing violations quarantined, not excused. |
> | 5.4 dead parameters | done. Found **B33** on its first run. |
>
> **What 5.1 found.** In every case the legend had been written with an
> approximate Tailwind hex while the scene drew a `PALETTE` value: the motor's
> N/S poles keyed `#ef4444`/`#3b82f6` against rose/sky; the hot gas particle
> keyed pure red when the particles lerp sky → rose and never reach it; three
> lens colours; the refraction medium block keyed `#0ea5e9`, which is no
> medium's colour at all. Two more were gaps in Phase 1's own work — the
> electrolysis scene never imported `CELL_COLOURS`, it re-typed the same
> literals, and the vsepr and energetics legends re-typed `PALETTE` hexes.
> All now name the shared table.
>
> **How 5.2 works without being able to run the HUD.** `VisualizationHUD.jsx`
> is JSX using the `@/` alias, so node cannot import it. Structural parity is
> therefore checked by reading it: both sides must reference the same lib/
> engine, and the HUD must not contain the arithmetic it used to duplicate —
> its own Gaussian enzyme model, its own Boltzmann factor, a hard-coded
> Faraday constant, its own denaturation window, its own osmosis thresholds,
> the flat `lone × 2.5` squeeze. Behavioural parity sweeps the control ranges
> read out of `topics.js`, so the grid is what the sliders can actually
> produce rather than one the test invented.
>
> **5.3's quarantine is debt, not approval.** `physics-solvers.test.mjs`,
> `quiz-grading.test.mjs` and `timer-store.test.mjs` each define a working
> model of their subject and assert against it, so each proves nothing about
> what ships — the X3 pattern exactly. `physics-solvers` also carries a
> `getHydrocarbonFormula` that duplicates `lib/organic.js`. They are listed so
> the rule can be enforced everywhere else today; the list is checked in both
> directions, so fixing one fails the test until it is taken off.
>
> Verified: `npm test` 1782/1782; production build clean.


The point of this phase is that no future audit has to find X1 again.

**5.1 — A legend-fidelity test.** Every `legend.items[].color` must appear as a literal in the scene file that topic dispatches to. That single assertion would have caught B3, B11, B17, B21, B22, B27, C5, C8 and C11 — nine defects, including the worst one in the report.

**5.2 — A readout-parity test.** For each topic, sample its parameter space on a grid and assert that the HUD's derived values equal the scene's. Trivial once Phase 3 lands, because both sides call the same `solveX()`; before that it is the regression net that stops the drift returning.

**5.3 — A "no private engines in tests" check.** Fail CI on any `tests/unit/*.test.mjs` that declares more than two top-level functions without importing from `lib/`. Catches X3 and the two out-of-scope instances.

**5.4 — A dead-parameter check.** For every topic, assert that each key in `defaults` is either in `controls`, read by the scene, or explicitly listed as computed. Catches B4 and B33.

---

## 8. Appendix — full defect index

**Cross-cutting (6)** — X1 🔴 duplicated readouts · X2 🔵 no engines/tests for 11 topics · X3 🔴 private engine in respiratory test · X4 🟠 missing TONES keys · X5 🔵 dead respiratory HUD case · X6 🟠 duplicate speed sliders

**Chemistry (43)**
`bohr` — B1 🔴 · B2 🔴 · B3 🟠 · B4 🔵 · B5 🟠
`organic` — B6 🔴 · B7 🔴 · B8 🔴 · B9 🔴 · B10 🔴 · B11 🟠 · B12 🟡 · B13 🟡 · B14 🔵 · B15 🔵
`distillation` — B16 🔴 · B17 🔴 · B18 🟠 · B19 🟡
`lattice` — B20 🔴 · B21 🔴 · B22 🟠 · B23 🟡 · B24 🔵
`electrolysis` — B25 🔴 · B26 🔴 · B27 🟠 · B28 🔵
`vsepr` — B29 🔴 · B30 🔴 · B31 🟠 · B32 🔵
`energetics` — B33 🔵 · B34 🟡 · B35 🔵 · B36 🔵
`reactivity_series` / `rusting_galvanic` — B37 🟡 · B38 🟠 · B39 🟠 · B40 🟡 · B41 🔵 · B42 🔵
`combustion_fire_triangle` — B43 🔵

**Biology (38)**
`enzyme` — C1 🔴 · C2 🟠 · C3 🟠 · C4 🟡 · C5 🟠 · C6 🟡
`dna` — C7 🔴 · C8 🔴 · C9 🔴 · C10 🟠 · C11 🟠 · C12 🟡 · C13 🔵
`cell` — C14 🔴 · C15 🔴 · C16 🟠 · C17 🟠 · C18 🟡 · C19 🔵 · C20 🔵
`protein` — C21 🔴 · C22 🟠 · C23 🟠 · C24 🔵 · C25 🔵
`eye` — C26 🟡 · C27 🔵 · C28 🔵
`respiratory` — C29 🔴 · C30 🔴 · C31 🟠 · C32 🟠 · C33 🔵 · C34 🔵 · C35 🔵
`food_chain_pyramid` — C36 🟠
`mitosis_meiosis` — C37 🟡 · C38 🔵

**Totals** — 🔴 26 · 🟠 23 · 🟡 13 · 🔵 25 = **87**

*Breakdown:* cross-cutting 6 · chemistry 43 · biology 38.
