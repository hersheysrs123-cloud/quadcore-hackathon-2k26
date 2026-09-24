# File map — lib/

> Part of the [SocraticOS codebase reference](../../CODEBASE_SUMMARY.md). The pure engines (one per 3D topic) and the app services.

```
quadcore-hackathon-2k26/
├── lib/
│   ├── aiService.js                      # Isomorphic client-side AI service coordinating Gemini API & user keys
│   ├── backup.js                         # .socratic JSON workspace & space backup packager with folder/bookmark support
│   ├── blocks.js                         # Text extractors, concept mappers & slash-menu relevance ranking (`rankSlashItems`)
│   ├── buoyancy.js                       # PURE PHYSICS: Archimedes' principle, material vs envelope volume, fluid densities, waterline integration, hull displacement & apparent weight
│   ├── constants.js                      # Default SPACES definition (School, Personal, Misc, Journal)
│   ├── db.js                             # Dexie.js IndexedDB schema v8 (12 stores), auto-seeding & graphics detection
│   ├── demoNotes.js                      # 7 comprehensive seeded notes across all 4 spaces with full 19-block suites
│   ├── editorCaret.js                    # Notion-grade caret navigation, visual line calculations, inline math compilation & boundary traversal
│   ├── coasterEnergy.js                  # PURE PHYSICS: coaster track builder, energy budget, rail force & g-force
│   ├── exportImport.js                   # Full export/import engine for Netscape HTML Bookmarks, PDF, DOCX, HTML, MD, TXT
│   ├── eyeOptics.js                      # PURE PHYSICS: Gullstrand schematic eye, accommodation & pupil reflex
│   ├── hookesLaw.js                      # PURE PHYSICS: Hooke's law, elastic limit, plastic branch & permanent set
│   ├── inclineForces.js                  # PURE PHYSICS: weight resolution, static/kinetic friction & angle of repose
│   ├── muscleMechanics.js                # PURE PHYSICS: elbow lever torque, biceps force & moment arm, length–tension, fatigue, tendon strain
│   ├── reflexArc.js                      # PURE PHYSIOLOGY: reflex-arc stage timing, conduction velocities, synaptic delays, severed-root blocks
│   ├── transpiration.js                  # PURE PHYSIOLOGY: K⁺/turgor aperture, Tetens VPD, series conductances, cohesion–tension, ABA, cavitation
│   ├── peristalsis.js                    # PURE PHYSIOLOGY: wave/bolus kinematics, consistency & gravity slip, layer activation, lumen features
│   ├── carbonCycle.js                    # PURE EARTH SCIENCE: GtC/yr fluxes (GPP, respiration Q10, CO₂ fertilisation, fossil, land use, lagging ocean), log forcing, lagged anomaly, pure integrator
│   ├── foodChain.js                      # PURE ECOLOGY: 10 % trophic transfer, headcounts & viability, ×10 biomagnification & harm thresholds, trophic cascade multipliers
│   ├── timeline.js                       # PURE: staged timelines — makeTimeline, describeTimeline, stageProgress/Started/Done, ramp, smoothstep, pulse
│   ├── stageCycle.js                     # PURE: cyclical stage machine — makeCycle (hold points), wrapTime/describeCycle (laps), cycleDelta, advanceCycle (tempo, lock), stepper create/jump/next/prev/play/pause/lock/tick/snapshot
│   ├── cellDivision.js                   # PURE BIOLOGY: mitosis (6) & meiosis (11) stage cycles, chromosome/chromatid census per stage, chiasma plan & originAt colour bookkeeping, diversity (4→36 genotypes), divisionPose channels, colchicine arrest
│   ├── redox.js                          # PURE CHEMISTRY: reactivity series as E°, displacement outcome/rate (τ = 900·e^(−E°cell)) & balanced ionic/molecular equations, solution colour mixing, K-with-water; nail corrosion (both H₂O and O₂ or nothing), electrolyte factor, galvanic couple with anode lifetime
│   ├── separation.js                     # PURE CHEMISTRY: samples × solvents × stations, closed-form in model time — filtration (retained iff undissolved, first-order flow slowed by the cake), crystallisation (heat → boil → first crystals → flame off → cool for steep solubility curves, to dryness for flat ones), chromatography (front ∝ √t, spot = Rf·front); `stationFit` says whether a station is the right tool for a sample
│   ├── particleModel.js                  # PURE CHEMISTRY: 3 substances (H₂O / Ne / CO₂) with latent heats & Cp; Clausius–Clapeyron boiling/sublimation lines, melting slope (negative for water), triple & critical points; heatingCurve(substance, P) → piecewise T(E) segments; stepThermal integrates energy at HEATING_CONDUCTANCE × gap; describePhase (Solid Lattice / Liquid Flow / Gas Chaos / Supercritical, transitions named by direction), kineticReadout (³⁄₂kT, √(3RT/M)), columnHeights, molarVolumes
│   ├── radioactiveDecay.js               # PURE PHYSICS: 4 modes (²³⁸U α, ¹⁴C β⁻, ¹⁸F β⁺, ⁹⁹ᵐTc γ) as nuclide data; nuclearEquation builds and CHECKS ΣA/ΣZ; stepDecay rolls 1−e^(−λdt) per surviving atom (seedable rng), stamps N₀/2ⁿ times, 1 s count-rate bins; transmission/penetrates per barrier (paper / 5 mm Al / 10 cm Pb, γ attenuated not stopped), deflection by charge sign & mass, formatDuration / realSecondsPerSimSecond (1 t½ = 10 s on screen)
│   ├── combustion.js                     # PURE CHEMISTRY: collar → air fraction → 300–1400 °C, colour ramp, sootRate/CO, complete vs incomplete equation; stepCombustion(state, {collar, dt, events}) integrates the fire triangle (fuel purge, bell-jar O₂ burn-down to 16%, mist draining a heat reserve, striker on relight, basin soot)
│   ├── cardiacCycle.js                   # PURE PHYSIOLOGY: 5-stage beat, HR → real stage durations & stepper tempo, EDV/ESV/SV/CO/EF, LV/aortic/atrial pressure, volume, valves, ECG (P-QRS-T / fibrillation), sounds S1/S2/murmur, conduction, Wiggers samples
│   ├── pollination.js                    # PURE BIOLOGY: wind/insect vectors, six-stage pollination→fertilisation timeline, tube growth (mm/h), nuclei positions, double fertilisation
│   ├── pathogens.js                      # PURE BIOLOGY: bacterium/phage anatomy, living checklist, antibiotic targets & efficacy, lytic-cycle & penicillin timelines, burst size
│   ├── tubeTransit.js                    # PURE GEOMETRY: bump profiles, squeeze-to-fit, recycling stream, ring-stack tube vertices & indices
│   ├── simpleMachines.js                 # PURE PHYSICS: lever classes, block-and-tackle, distance ratio vs MA
│   ├── atomicStructure.js                # PURE CHEMISTRY: Bohr shells for H / C / Na / Cl, valence electrons, per-element bonding notes
│   ├── organic.js                        # PURE CHEMISTRY: six homologous series (alkane → ester), atom counts, derived formulas & names, hybridisation-driven chain geometry, cracking into a shorter alkane + ethene
│   ├── distillation.js                   # PURE CHEMISTRY: the six crude-oil fractions (boiling points, chain lengths, colours), which rise at a given heat; bitumen is the residue and never rises
│   ├── lattices.js                       # Facts and colour keys for each lattice (the Details panel and the scene share them)
│   ├── latticeGeometry.js                # PURE GEOMETRY: diamond (ball-cut diamond-cubic), α-quartz (P3₂21 from its Wyckoff sites) and ice Ih (wurtzite O net, H placed by the ice rules via Euler orientation); tested for coordination, lengths and angles
│   ├── electrolysis.js                   # PURE CHEMISTRY: 25 cm³ CuSO₄ microscale cell, copper vs inert-graphite electrodes, Faraday's law, electrolyte exhaustion
│   ├── vsepr.js                          # PURE CHEMISTRY: steric-number geometries, named shapes for every reachable bonding/lone-pair pair, measured-angle solver, distinct angles, polarity
│   ├── vseprMolecules.js                 # PURE DATA (no three.js): the 20 VSEPR molecules with measured bond angles, and element colours/sizes
│   ├── energetics.js                     # PURE CHEMISTRY: reaction energy profile, Ea / ΔH clamp, Arrhenius rate constant and catalyst speed-up
│   ├── enzymes.js                        # PURE BIOLOGY: enzyme rate as temperature × pH, single-valued denaturation, reversibility
│   ├── dna.js                            # PURE BIOLOGY: helix geometry, sequence generator (all four bases at every length), base colours, 2 vs 3 hydrogen bonds
│   ├── cellBiology.js                    # PURE BIOLOGY: organelle registry (plant vs animal), tonicity → turgid / flaccid / plasmolysed / crenated / lysed
│   ├── proteinFolding.js                 # PURE BIOLOGY: α-helix / β-sheet / coil, the 320–358 K denaturation window, folded fraction
│   ├── respiratory.js                    # PURE PHYSIOLOGY: breathing phases, thorax volume & pressure, muscle states — one set of constants shared by the scene, the HUD and the tests
│   ├── respiratoryCredits.js             # Open-source model credits shown by the respiratory scene
│   ├── binaryTree.js                     # PURE CS: BST / AVL insertion, rotations, traversals
│   ├── rayOptics.js                      # PURE PHYSICS: thin lenses and curved-mirror ray tracing
│   ├── induction.js                      # PURE PHYSICS: Faraday's law, dynamo EMF, bar-magnet and solenoid
│   ├── interference.js                   # PURE PHYSICS: two-source wave interference and double-slit fringes
│   ├── orbit.js                          # PURE PHYSICS: symplectic leapfrog orbits and the gravity well
│   ├── projectile.js                     # PURE PHYSICS: ballistic flight with quadratic drag
│   ├── circuits.js                       # PURE PHYSICS: series / parallel networks, Ohm's law, bulb power
│   ├── carriers.js                       # PURE PHYSICS: charge-carrier drift paths for the circuit and static scenes
│   ├── electrostatics.js                 # PURE PHYSICS: triboelectric transfer, Coulomb force, induction, humidity leakage
│   ├── heatTransfer.js                   # PURE PHYSICS: conduction, convection and radiation
│   ├── shadowSolids.js                   # Shadow-lab shape library (20 shapes) and solid builders
│   ├── gemini.js                         # Direct REST Gemini client with structured outputs & usage tracking
│   ├── mastery.js                        # Mastery status vocabulary (Solid ● / Shaky ◐ / Gap ○) & rollup algorithms
│   ├── mathUtils.js                      # LaTeX delimiter parsing & regex segmentation for MathText
│   ├── schemas.js                        # OpenAPI 3.0 schemas for Gemini structured outputs
│   ├── shadowOptics.js                   # Geometric shadow formation solver, bench constraints, umbra/penumbra, signed 3D rotation projection & materials
│   ├── noteHierarchy.js                  # Pure, cycle-safe nested sub-page helpers (tree build, descendants, ancestors/breadcrumbs, deep tree clone, restore parent resolution)
│   ├── storageService.js                 # Dexie CRUD service for notes (subtree-cascading trash/restore/move), folders, bookmarks, trash, calendar, alarms, quizzes, space documents, extractSyllabusTextFromFile & reset
│   ├── syntaxHighlighter.js              # PrismJS-powered AST tokenizer & syntax highlighter for 10 programming languages
│   ├── timerStore.js                     # Reactive Zustand multi-timer store with persist middleware, legacy migration & 0% idle CPU auto-sleep ticker
│   ├── tutorialData.js                   # Authoritative registry of 9 onboarding tutorial chapters & 19 editor blocks
│   └── urlUtils.js                       # URL normalization, domain extraction, Google favicon generator & title heuristics
```
