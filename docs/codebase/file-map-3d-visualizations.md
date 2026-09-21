# File map — components/visualizations/

> Part of the [SocraticOS codebase reference](../../CODEBASE_SUMMARY.md). Every 3D scene, shared kit and the topic registry.

```
quadcore-hackathon-2k26/
├── components/
│   └── visualizations/
│       ├── BiologyCanvas.jsx             # Cell explorer with organelle cutaways & enzyme kinetics
│       ├── ReflexArcCanvas.jsx           # Withdrawal reflex: hand in a flame, sensory/relay/motor neurons through a spinal-cord section, timed impulse
│       ├── AntagonisticMusclesCanvas.jsx # Biceps/triceps pair on a levered elbow: dumbbell load, τ = F·d overlay, fatigue give-way
│       ├── TranspirationCanvas.jsx       # Root hair → cut-away xylem → leaf section → ×800 stoma with bowing guard cells; vapour plume, wind, embolism
│       ├── PeristalsisCanvas.jsx         # Gut on end: deforming lumen, circular rings & longitudinal fibres lit by the wave, textured bolus, gravity flip
│       ├── CarbonCycleCanvas.jsx         # Planetary diorama on a clock: felled forest, pasture cattle, coal plant, carbonate ocean, greenhouse band, photon filter, signed budget chart
│       ├── FoodChainPyramidCanvas.jsx    # Stepped log-width trophic pyramid with instanced organisms, 10 %/90 % streams, toxin spray & cascade, log energy chart
│       ├── ecosystem-diorama.jsx         # SHARED: DioramaSlab, WaterBody, SkyEnvelope, SunSource, eased TreeStand (stumps), FluxStream, two-mode PhotonShower
│       ├── flux-chart.jsx                # SHARED: SignedFluxBars (diverging + net column, staggered labels) & LogTierBars (ghost columns, decade grid)
│       ├── FlowerPollinationCanvas.jsx   # Dissected flower: bee/wind delivery, pollen tube by draw range, travelling nuclei, double fertilisation, mm gauge, scrubbable clock
│       ├── BacteriaVsVirusCanvas.jsx     # Bacillus (shreddable lattice wall, ribosomes, nucleoid, plasmid, flagellum) vs T4 phage; penicillin rain, lytic cycle, instanced burst
│       ├── timeline-kit.jsx              # SHARED: TimelineDriver (trigger counter → clock in useFrame, live ref, 10 Hz ticks, two-way scrub slider) & TimelineCaption
│       ├── stage-stepper.jsx             # SHARED: StageCycleDriver (HUD stage index + playing flag ⇄ pure stepper machine; tweens to hold points, plays & wraps, per-stage tempo, lock/arrest, onFrame/onTick) & StageCaption
│       ├── MitosisMeiosisCanvas.jsx      # 2n = 4 cell: lathe membrane that furrows into daughters, 8 vertex-coloured dynamic-tube chromatids (X / V / chiasma), instanced spindle, envelopes, chromatin, colchicine arrest; meiosis II in two turned cells
│       ├── CardiacCycleCanvas.jsx        # Sectioned 4-chamber heart: half-shell chambers + dynamic cut faces, hinged valve leaflets, blood streams, conduction tubes with draw-range sweep, Wiggers panel + live ECG strip
│       ├── RespiratoryCanvas.jsx         # Photorealistic CT thorax, lungs & deforming diaphragm driven by shared breath constants, vector arrows, and resizable HUD
│       ├── tube-transit.jsx              # SHARED: ProfiledTube (in-place ring-stack tube), TubeRings (tori on a profile), TubeFlow (recycling stream)
│       ├── arm-rig.jsx                   # SHARED: scapula/humerus/radius/ulna/hand kinematic chain, volume-preserving muscle bellies & tendons
│       ├── ChemistryCanvas.jsx           # Bohr atom, organic builder C1-C12, distillation, lattices, electrolysis, VSEPR, energetics + dispatcher for the split-out redox scenes
│       ├── ReactivitySeriesCanvas.jsx    # 4 beakers (CuSO₄/FeSO₄/AgNO₃/MgSO₄) + gantry dipping arm carrying 4 strips of one metal: solutions recolour, instanced deposit nodules, ion arrive/leave swarm, electron stream, K fizz; pushes liveSeconds
│       ├── RustingGalvanicCanvas.jsx     # 4-tube rack (water+air / boiled under oil / desiccant+stopper / coupled): nails with crust+flakes biased to the waterline, thinning wrap rings, e⁻ stream + arrow, day scrub/play driver
│       ├── SeparationTechniquesCanvas.jsx # Three-station bench (filtration / crystallisation / chromatography): pouring beaker in a clamp, drips, residue mound, basin steam + instanced crystals, rising solvent front, live Rf chromatogram board; one station's clock runs at a time
│       ├── CombustionFireTriangleCanvas.jsx # Detailed Bunsen (rotating collar, needle valve, tap + hose, heat shield, thermocouple that swings clear), bell jar on a hoist, spray-bottle mist + steam, instanced soot, cold basin on tongs → display cradle, in-scene fire triangle
│       ├── ParticleModelMatterCanvas.jsx # 500 instanced particles in a sealed glass column: lattice / pool / gas driven by the energy-state thermal model, hotplate-cryocooler glow, piston on a rod, thermometer + setpoint tick, KE gauge, in-scene heating curve with ΔH_fus / ΔH_vap plateau labels and a frame-loop marker
│       ├── RadioactiveDecayCanvas.jsx    # Up to 10 000 instanced nuclei in a lead holder (colour flips on decay), ring-buffered radiation tracers (α/β⁻/β⁺/γ/ν) through charged plates → barrier → GM tube, live decay-curve trace vs dashed N₀e^(−λt), half-life stamp lines, nuclear equation with A/Z check
│       ├── particle-population.jsx       # SHARED ENGINE: createPopulation (typed arrays at capacity), spawn/kill/colour helpers, flushPopulation (writes only scale + translation into instanceMatrix, colour into instanceColor, only when dirty), InstancedPopulation (one InstancedMesh; disposes mesh + geometry + material on unmount so instance buffers are freed), makeRng / gaussian
│       ├── live-trace.jsx                # SHARED: LiveTrace — a THREE.Line over a preallocated position buffer, grown via ref.push with drawRange + updateRanges; no React re-render, no geometry rebuild
│       ├── lab-bench.jsx                 # Shared lab-bench kit: cm() scale, GLASS/PORCELAIN/STEEL/BRASS presets, LabBench, HeatMat, RetortStand (ring/clamp fittings), Tripod, BunsenBurner (ref-driven flame), LiquidStack, ConicalFlask, Funnel, EvaporatingBasin, GlassJar, HeatShield, Tongs, SprayBottle
│       ├── vessel-rack.jsx               # SHARED: Bench, VesselRack (pad/ring slots + numbered tags), Beaker & TestTube (liquidRef group, meniscus, oil, stopper, desiccant), ElectronStream, ElectronArrow, BubbleColumn, relaxTo
│       ├── PhysicsCanvas.jsx             # Wave refraction, motor effect, thin lenses, induction, kinetic gas laws, projectile motion (quadratic drag solver, forward upright cannon, zero-Z-fight runway), gravity wells & orbital motion (symplectic leapfrog orbits, banked perimeter retaining rim lip & high-speed satellite containment) + dispatcher for split-out physics scenes
│       ├── EyeCanvas.jsx                 # Cutaway human eye: accommodation, pupil reflex & anatomy mode with resizable controls HUD
│       ├── ShadowLabCanvas.jsx           # Torch/object/screen bench; 20 shapes (incl. ring with open hole & pyramid), dynamic 3D rotation shadow tracking & backside reversal for L/T shapes, smooth continuous corner rounding, dynamic anti-clipping pedestal clearance, elevated lamp heights & forward-mounted pinpoint torch, and resizable HUD
│       ├── InclineFrictionCanvas.jsx     # Ramp free-body diagram, static/kinetic friction & right telemetry sidebar HUD (2D velocity graph, static grip capacity bar, forces & dynamics stats grid; decluttered 3D viewport with collapsible sidebar)
│       ├── HookesLawCanvas.jsx           # Spring, ruler & slotted masses with live force-extension graph embedded in the left HUD sidebar & compact controls layout (speed-scaled; centered 3D camera & zero in-canvas billboard clutter)
│       ├── SimpleMachinesCanvas.jsx      # Zero-state useFrame 60fps animation, authentic lever hinges (Class 1 triangular wedge vs Class 2/3 stanchion clevis), under-beam suspended slotted load, verified rim-tangent 4-rope non-crossing reeving, widened workbench base with dedicated Laboratory Dynamometer Stand (x = -3.75), and smooth CSS transition right sidebar HUD
│       ├── RollerCoasterCanvas.jsx       # Drop, vertical loop & brakes with solid bottom bar HUD (energy budget bars, analog speed dial, passenger g-force gauge, clearance verdict), tubular spine track with cross-ties & concrete piers, and detailed aerodynamic coaster car (chin splitter, intake grille, flank skirts, cyan pinstripes, rear airfoil wing & diffuser, racing bucket seats with headrests, chrome roll hoops, 4-point harnesses, helmets with visors, underside magnetic brake blade, and bogie dampers; zero floating lights)
│       ├── CircuitBoardCanvas.jsx        # 3D breadboard circuits, bulbs, resistors, meters & electron drift flow (speed-scaled)
│       ├── StaticElectricityCanvas.jsx   # Balloon, wool sweater, wall induction & Van de Graaff charge transfers (speed-scaled)
│       ├── BuoyancyCanvas.jsx            # Overflow can, measuring cylinder, spring scale & floating hull bobbing (speed-scaled)
│       ├── HeatTransferCanvas.jsx        # Conduction rods, convection currents/dye, & radiation plate/beam (speed-scaled)
│       ├── TopicSelectorDropdown.jsx     # Custom styled subject-separated 3D model selector dropdown with instant search, discipline quick-filters & dark ink styling
│       ├── ShapeDropdown.jsx             # Shadow-lab shape picker: 20 shapes in two groups (13 solids, 7 flat cut-outs) with previews
│       ├── force-diagram.jsx             # SHARED: free-body arrows on one force scale, GraphPanel, rolling traces, slope frames & speed integration
│       ├── charge-carriers.jsx           # SHARED: electron & charge flow paths, carrier instancing, charge signs
│       ├── energy-bars.jsx               # SHARED: energy/work column charts with Y-axis line & horizontal scale grid divisions, calibrated scaleMax (grouped + stacked total) & needle DialGauge
│       ├── cell-organelles.jsx           # Procedural 3D organelle geometry (nucleus, mitochondria, chloroplast, etc.)
│       ├── BinaryTree3D.jsx              # Interactive 3D Binary Search Tree (BST) visualizer for node insertion, searching, traversals, and tree metrics
│       ├── CSCanvas.jsx                  # Computer Science canvas dispatcher (BST / AVL tree and 3D sorting visualizer)
│       ├── MathCanvas.jsx                # Gradient descent on loss surfaces (smooth 60fps direct-ref tangent vector & non-occluded surface-subdivided trail), solids of revolution (flush 1.0 thickness & high-contrast gold/bronze layers), unit circle & Fourier series (multi-waveform Fourier synthesis, tangent geometry & 3D phase helix)
│       ├── media.js                      # Refractive index presets (air, water, glass, diamond, perspex)
│       ├── topic-options.js              # Presets and options for VSEPR, 3D sorting, surface functions, and revolution curves
│       ├── topics.js                     # Topic registry: category, controls schema, concepts & quiz for all 51 topics with speed: 1 defaults
│       ├── scene-kit.jsx                 # Shared Three.js lighting, camera, grid, bounding box & label helpers
│       └── VisualizationHUD.jsx          # Resizable HUD control overlays, universal animation speed slider (0.1×–3×), camera reset & quiz overlays
```
