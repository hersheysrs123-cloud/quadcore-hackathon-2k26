# File map — tests/, scripts/, docs/ and root files

> Part of the [SocraticOS codebase reference](../../CODEBASE_SUMMARY.md). Test suites (including the four guardrails), scripts and documentation.

```
quadcore-hackathon-2k26/
├── tests/
│   ├── unit/
│   │   ├── ai-tutor.test.mjs             # AI Tutor curriculum injection, academic pedagogy & doubt starter validation
│   │   ├── avl-tree-3d.test.mjs          # 3D BST & AVL auto-balancing tree math & traversals
│   │   ├── bullet-list-undo-redo.test.mjs # Bullet and list undo/redo history state machine, deep cloning & smart focus
│   │   ├── bullet-number-heading-fixes.test.mjs # Bullet/number list indentation, hierarchical sub-bullets & heading enter flow
│   │   ├── editor-marquee-click.test.mjs # Marquee multi-block selection and click-to-append boundary guards
│   │   ├── export-import.test.mjs        # Markdown, HTML, DOCX, TXT lossless round-trips & blob generation
│   │   ├── export-preview.test.mjs       # Interactive pre-download export preview formatting and scroll mechanics
│   │   ├── eye-optics.test.mjs           # Eye optical model: Gullstrand equivalent power, accommodation, and retina focus
│   │   ├── inline-math-navigation.test.mjs # Seamless block navigation, math pill boundary traversal & auto-compilation
│   │   ├── interactive-tutorial.test.mjs # 9-step tutorial metadata, 19-block registry, and interactive state tests
│   │   ├── markdown-bullets-formatting.test.mjs # Markdown nested bold/italic compiler and bullet prefix preservation
│   │   ├── mastery-analytics.test.mjs    # Mastery rollup algorithms, trends, and weakest-first sorting
│   │   ├── math-question-types.test.mjs  # Value input, step ordering, and code input evaluation math
│   │   ├── math-text.test.mjs            # KaTeX math rendering, chemical formula parsing, and fallback safety
│   │   ├── multi-note-selection.test.mjs # Multi-note selection, bulk actions, and confirmation modals
│   │   ├── note-persistence-flow.test.mjs # Debounced save, unmount flush, and font/width persistence
│   │   ├── note-hierarchy.test.mjs        # Nested sub-page helpers: tree/descendants/ancestors, cycles & orphans, deep clone, restore semantics
│   │   ├── nested-sub-pages.test.mjs      # Sub-page wiring across editor/workspace/sidebar/storage, exporters & slash-menu ranking
│   │   ├── physics-solvers.test.mjs      # Refraction (Snell's law), thin lenses, gas laws, chemistry formulas
│   │   ├── quiz-grading.test.mjs         # Deterministic integer MC grading & fallback heatmap normalizer
│   │   ├── quiz-studio-flow.test.mjs     # 2-column exam runner layout, draft answer auto-saving, and question matrix
│   │   ├── reformat-note.test.mjs        # Multi-chunk note reformatting and hierarchical block structure generation
│   │   ├── muscle-mechanics.test.mjs     # Elbow lever torque, volume-preserving bulge, fatigue give-way & tendon strain
│   │   ├── reflex-arc.test.mjs           # Reflex stage timing, threshold & severed-root blocks, contraction clock
│   │   ├── transpiration.test.mjs        # Guard-cell aperture, VPD & conductances, xylem tension, drought closure & cavitation
│   │   ├── peristalsis.test.mjs          # Wave vs bolus speed, gravity asymmetry, ring/relaxation placement, layer activation, wall stretch
│   │   ├── carbon-cycle.test.mjs         # 2020s budget calibration, sinks vs sources, log forcing & 3 °C/doubling, ocean lag, integrator purity & bounds
│   │   ├── food-chain.test.mjs           # 10 % pyramid, headcounts, fifth-link starvation, dim-sun apex loss, biomagnification & lethal dose, cascade toggle
│   │   ├── timeline.test.mjs             # Stage layout, clock description & clamping, per-stage progress, advancing, easing helpers
│   │   ├── stage-cycle.test.mjs          # Cycle layout & wrapping, shortest-way deltas, tempo-split advancing, stepper play/pause/next/prev/jump, lock arrest & forward-only recovery
│   │   ├── cell-division.test.mjs        # Stage lists, census (chromosomes vs chromatids per stage), chiasma plan & swapped origins, diversity ladder, pose channels in range & every hold tableau distinct from its neighbours
│   │   ├── redox.test.mjs                # Series order vs E°, equation balancing/atom conservation, displace/less-reactive/same-metal/water outcomes, rate ordering, colour mixing, electron conservation, rust needs both, salt factor, couple direction, anode lifetime & exhaustion
│   │   ├── cardiac-cycle.test.mjs        # HR → systole/diastole shares & tempo, volumes/output, boundary continuity, isovolumetric holds, valve logic, Wiggers ranges, S1/S2 placement, ECG/conduction, fibrillation
│   │   ├── pollination.test.mjs          # Vectors, pollinated-vs-fertilised timing, hours after landing, monotonic tube growth, nuclei order & fusions
│   │   ├── pathogens.test.mjs            # Anatomy parts, living checklist, 100 %/0 % efficacy, wall shredding, lytic stages, burst size, host status
│   │   ├── tube-transit.test.mjs         # Profile bumps, squeeze-to-fit, recycling stream, tube winding vs analytic normals (via three.js)
│   │   ├── respiratory-mechanics.test.mjs # CT thoracic skeleton kinematics, diaphragm morphing, and Boyle's Law physics
│   │   ├── shadow-optics.test.mjs        # Shadow geometry: bench bounds, point/broad lamp penumbra, and material transmission
│   │   ├── space-hub.test.mjs            # Space Hub document uploads, active AI toggles, and pedagogy presets
│   │   ├── syntax-highlighter.test.mjs   # 10-language tokenizer & syntax highlighting rules
│   │   ├── table-block.test.mjs          # Interactive Table block parsing, HTML/plain-text conversion & serialization
│   │   ├── timer-store.test.mjs          # Multi-timer countdown math, duration clamping, pause/resume
│   │   ├── web-saver.test.mjs            # URL normalization, domain parsing, Netscape HTML export/import round-trips
│   │   ├── atomic-structure.test.mjs     # Bohr shells and per-element notes
│   │   ├── buoyancy.test.mjs             # Archimedes solver and vessel geometry
│   │   ├── carriers.test.mjs             # Charge-carrier paths
│   │   ├── cell-biology.test.mjs         # Organelle registry, tonicity states, lysis and crenation
│   │   ├── circuits.test.mjs             # Series / parallel circuit solver
│   │   ├── coaster-energy.test.mjs       # Loop-the-loop energy budget and g-force
│   │   ├── combustion.test.mjs           # Bunsen flame profile and fire-triangle model
│   │   ├── distillation.test.mjs         # Fractions, riser predicate, bitumen never rises
│   │   ├── dna-helix.test.mjs            # All four bases at every pair count, A–T / C–G bonds
│   │   ├── electrolysis.test.mjs         # Faraday's law and cell arithmetic
│   │   ├── electrolysis-electrodes.test.mjs # Copper vs graphite electrode behaviour
│   │   ├── electrostatics.test.mjs       # Coulomb force, induction, leakage
│   │   ├── energetics.test.mjs           # Energy profile, Arrhenius factor, catalyst effect
│   │   ├── enzymes.test.mjs              # Rate curve is single-valued; denaturation temperature
│   │   ├── eye-refractive-error.test.mjs # Short and long sight, far / near points, correcting lens
│   │   ├── heat-transfer.test.mjs        # Conduction, convection, radiation
│   │   ├── hookes-law.test.mjs           # Elastic limit, plastic branch, permanent set
│   │   ├── incline-forces.test.mjs       # Weight resolution, friction, angle of repose
│   │   ├── lattices.test.mjs             # Coordination numbers, quartz tetrahedra, ice angles
│   │   ├── organic-chemistry.test.mjs    # Formulas, names, geometry, cracking balance
│   │   ├── particle-model.test.mjs       # Phase boundaries, latent heats, r.m.s. speed
│   │   ├── protein-folding.test.mjs      # Folding window and denaturation
│   │   ├── radioactive-decay.test.mjs    # Nuclear equations and half-life statistics
│   │   ├── separation.test.mjs           # Filtration, crystallisation, chromatography Rf
│   │   ├── simple-machines.test.mjs      # Lever classes and block-and-tackle
│   │   ├── vsepr.test.mjs                # Every reachable shape is named; AX₄E₂ is square planar
│   │   ├── deleted-notes-spaces-persistence.test.mjs # Deleted demo notes and spaces stay deleted
│   │   ├── media-caption-input.test.mjs  # Media caption keystroke isolation
│   │   ├── topic-animation-speed.test.mjs # Universal speed slider wiring
│   │   ├── topic-selector-dropdown.test.mjs # Topic picker search and filters
│   │   ├── topic-sidebar-resize.test.mjs # 10%–80% resizable HUD panel
│   │   ├── legend-fidelity.test.mjs      # GUARDRAIL: every legend colour appears in the scene that draws it
│   │   ├── readout-parity.test.mjs       # GUARDRAIL: Details panel and scene read the same lib/ engine
│   │   ├── no-private-engines.test.mjs   # GUARDRAIL: a test may not assert against its own copy of the code
│   │   └── dead-parameters.test.mjs      # GUARDRAIL: every default parameter is a control, read, or declared computed
│   ├── integration/
│   │   ├── 3d-topic-schemas.test.mjs     # 3D scene topics, slider boundary validations & optical media
│   │   ├── trash-24h-purge.test.mjs      # 24-hour auto-purge expiration calculations & time formatting
│   │   └── dexie-backup-restore.test.mjs # Full .socratic workspace export/import round-trips & validation
│   ├── e2e/
│   │   ├── keyboard-shortcuts.spec.mjs   # Ctrl+K (Search), Ctrl+I (Instant Note), Ctrl+S (Save), Escape
│   │   ├── block-editor-flow.spec.mjs    # Slash menu (/), block reordering, undo/redo history snapshots
│   │   ├── theme-toggle.spec.mjs         # Dark <-> Light theme pre-paint validation
│   │   └── export-print.spec.mjs         # PDF print emulation & multi-format export dispatcher
│   ├── helpers/
│   │   └── source-registry.mjs           # Reads source files for the guardrail tests
│   ├── e2e_caret_navigation.test.js      # 82-case Notion-grade caret navigation suite (see docs/TEST_INFRA.md)
│   ├── m1_stress_challenge.test.js       # Editor stress challenge
│   └── tier5_adversarial_stress.test.js  # Tier-5 adversarial hardening
├── scripts/
│   ├── cdp_visual_tester.mjs             # Drives the running app over CDP for visual checks
│   ├── empirical-stress-test-m1.mjs      # Empirical editor stress run (part of npm test)
│   ├── test_exports_visual.mjs           # Visual check of the export pipeline
│   └── test-inlinemath-roundtrip.mjs     # Unit test for in-sentence LaTeX math round-trips
├── docs/
│   ├── BIO_CHEM_3D_AUDIT.md              # Biology & chemistry 3D audit: 87 defects, all fixed, and the four guardrails it added
│   ├── TEST_INFRA.md                     # Plan for the 82-case caret-navigation suite
│   ├── TEST_READY.md                     # Results write-up for that suite
│   ├── FEATURES.md                       # Full user-facing feature guide (the long-form README content)
│   ├── codebase/                         # This technical reference, split by topic (index: CODEBASE_SUMMARY.md)
│   └── design/                           # The design system, split by topic (index: DESIGN_SYSTEM.md)
├── DESIGN_SYSTEM.md                      # Official UI design system & CSS color tokens spec
├── AGENTS.md / GEMINI.md                 # Agent workflow rules (which docs to update after which kind of change)
├── PROJECT.md                            # Feature and milestone plan for the caret-navigation work
├── ANTIGRAVITY_BUG_FIXES.md              # Exhaustive summary of architectural fixes & test suites
├── README.md                             # Repository overview, setup guide & feature documentation
└── CODEBASE_SUMMARY.md                   # (This document)
```
