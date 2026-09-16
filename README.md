# SocraticOS

> **quadcore-hackathon-2k26** — An intelligent, interactive study workspace, 3D scientific visualization studio & Socratic AI tutor.

A state-of-the-art learning environment built around one core premise: **rereading is not studying**. Take block-based notes, command your workspace with universal keyboard shortcuts, explore concepts in real-time 3D, receive structured explanations, test your understanding through interactive quizzes, and track sub-topic confidence over time on an aggregate mastery heatmap.

**Stack**: Next.js 15 (App Router) · React 19 · Zustand · PrismJS · usehooks-ts · Three.js / React Three Fiber · Tailwind CSS · Google Gemini AI API · IndexedDB (Dexie.js).

---

## ⚡ Quick Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure environment variables (Gemini API key)
cp .env.example .env.local   # fill in GOOGLE_API_KEY

# 3. Start local development server
npm run dev
```

Open [localhost:3000](http://localhost:3000) for the marketing landing page, or launch the app directly at [/workspace](http://localhost:3000/workspace).

> **Note**: `GOOGLE_API_KEY` is the only required key. Get one for free at [aistudio.google.com/apikey](https://aistudio.google.com/apikey). You can also provide your key directly inside the in-app Settings modal, where it is stored 100% privately in your browser's IndexedDB. Without an API key, the note editor, 39 3D simulations across 5 STEM domains, multi-timer HUD system, export/import, and local mastery heatmaps function normally offline; AI tutoring endpoints will gracefully report missing credentials.

---

## ✨ Key Features & Capabilities

### 📝 1. Notion-Style Block Note Editor
- **20 Block Types Supported**: Text, Nested Sub-Page card (`page`), Heading 1 (`h1`), Heading 2 (`h2`), Heading 3 (`h3`), Heading 4 (`h4`), Bullet List (with multi-level sub-bullet nesting), Numbered List (dynamic sequential & hierarchical indexing `1.`, `2.` with sub-bullets `a.`, `b.`, `c.`, etc.), To-Do List (interactive checkboxes with strikethrough), Toggle List (collapsible arrow `▶`/`▼` with auto-expanding details textarea and interactive status toggle badge), Callout Box (with 8 icon presets), Multi-Column Layout Block (`columns` 2 to 5 columns split layout with dynamic column count selector pills), Table (interactive grid table with streamlined Notion header, dynamic cell editing, focus-activated column & row drag handles `⠿` for drag-and-drop reordering with visual drop indicators, `+ Column`/`+ Row`, delete row/col, and `Tab` navigation), Quote (thick accent border), LaTeX Math Equation block (live KaTeX rendering, quick Presets toggle & symbols tray), Inline LaTeX Equation (`inlinemath` clear Notion-style `$formula$`), Divider (`hr`), Site Bookmark Embed (clickable card with live favicon), Media & YouTube Video Embed (Images and YouTube video players with 16:9 responsive embeds, timestamp support & **`25%` / `50%` / `100%` width resize presets**), and Code Snippet (10-language syntax highlighting).
- **Notion-Style Nested Sub-Pages**: Notes can live inside other notes to any depth. Type `/page`, click the gutter **`+` → Page**, or choose **New sub-page** in the `⋯` note menu to create a blank child page that opens immediately; the parent shows a clickable card (child's icon + title + `→`) that updates live when the child is renamed or re-iconed. The top header shows a clickable breadcrumb path (`Space / Parent / Chapter / Sub-Topic`, long chains collapse into `…`), the sidebar renders a collapsible ▶ / ▼ tree that auto-expands to the open note, and organisation is hierarchy-safe: moving a parent to another space brings every nested page along, deleting a parent trashes the whole tree together and restoring it restores all children, duplicating a parent deep-clones its sub-pages, and deleting a card moves its page to the Trash (undo shows a **Restore** card).
- **Hierarchical Sub-Bullets & Multi-Level Lists (Bullets & Numbers)**:
  - `Tab`: Indent active bullet or numbered item (empty or with content) to a sub-bullet (`level = level + 1`, up to level 4).
  - `Shift+Tab`: Outdent item (`level = level - 1`). If unindented at level 0 while empty, converts into a normal paragraph text block.
  - `Enter`: Pressing Enter on an empty sub-bullet unindents by 1 level before exiting; pressing Enter on a populated item inherits the current level.
  - `Backspace`: Pressing Backspace at offset 0 (or on an empty item) unindents by 1 level or converts to plain text.
  - **Hierarchical Numbering Sequence**: Level 0 renders decimal numbers (`1.`, `2.`), Level 1 renders lowercase letters (`a.`, `b.`) with `1.5rem` indent, Level 2 renders lowercase Roman numerals (`i.`, `ii.`) with `3.0rem` indent, and Level 3+ renders uppercase letters (`A.`, `B.`) with `4.5rem+` indent.
  - **Hierarchical Bullet Glyphs**: Level 0 renders a solid filled circle (`●`), Level 1 renders a hollow ring (`○`) with `1.5rem` indent, Level 2 renders a solid square (`■`) with `3.0rem` indent, and Level 3+ renders a hollow square with `4.5rem+` indent.
- **Notion-Grade Heading & Bullet Downward Flow**:
  - Pressing `Enter` at the start of any heading (`h1`–`h4`) creates a new blank paragraph above and shifts the heading and all following blocks downward, maintaining caret focus on the heading (Notion behavior).
  - Pressing `Enter` at the start of any bullet (`bullet`) or numbered item (`number`) with content (specifically the first bullet in a list) prepends an empty list item above and shifts the current item and downstream blocks down, maintaining caret focus at the start of the item on the next line.
  - **Accurate Whitespace Handling & Backspace Deletion**: Typing spaces in any block (text paragraph, list, heading, math, code) and pressing Backspace deletes the space character naturally instead of deleting the block. Blocks are only deleted on Backspace when truly empty (0 characters), matching standard Notion and Word editor mechanics.
- **Deeply Cloned History & Smart Focus Undo/Redo Engine**: Centralized immutable snapshot pipeline (`pushHistorySnapshot`) across all 19 block mutations, atomic block splitting on `Enter`, and intelligent neighboring focus resolution on both Undo and Redo (`Ctrl+Z`, `Ctrl+Y`, `Ctrl+Shift+Z`), completely preventing cursor loss or jumps to block 0.
- **Multi-Column Layout Block (`/2 columns` - `/5 columns`, `/split`, `/compare`)**: Dynamic 2 to 5 column split container for side-by-side concept comparisons (e.g. Mitosis vs Meiosis, Conductors vs Insulators, Cornell notes) with segmented column switcher pills (`[ 2 Cols ]` - `[ 5 Cols ]`), responsive grid cards, header titles, and auto-growing multi-line body.
- **Notion-Style Right-Side Outline (Minimap Ticks & Floating Card)**: Floating right-side outline panel with live `h1`–`h4` heading scanning, minimap dash strip with real-time scroll spy active-section tracking, and one-click smooth jumping with highlight ring pulse.
- **Inline Image & Video Resize Presets**: Width toggle pills (`25%`, `50%`, `100%`) for balanced diagram and video embedding into text flow.
- **External Smart Paste & Google Docs Sanitizer**: Automatically converts pasted rich HTML from lecture slides, Google Docs, Notion, and web pages into structured blocks (preserving bold, italics, headings, lists, tables, and embeds) without DOM corruption or foreign style pollution.
- **In-Context Slash Menu (`/`)**: Typing `/` triggers a relevance-ranked block-type selector directly underneath the active line, supporting quick filters like `/page`, `/columns`, `/2 columns`, `/3 columns`, `/4 columns`, `/5 columns`, `/split`, `/compare`, `/youtube`, `/video`, `/math`, `/table`.
- **Draggable 6-Dots Handles (`⠿`) & Context Formatting**: Hovering blocks displays aligned insert (`+`, opens a searchable *Insert below* menu including **Page**), delete (`🗑️`) and draggable `⠿` handles. Context popovers feature:
  - ✨ **Explain** / 🦆 **Quiz me** for that specific block.
  - **Inline Text Formatting**: Bold (`B`), Italic (`I`), Underline (`U`), Strikethrough (`S`), LaTeX Math ($x$).
  - 🔄 **Turn Into Submenu**: Convert block into any of the 19 block types.
  - 📋 **Duplicate Block**, ⬆️/⬇️ **Move Up/Down**, 📄 **Copy Content**.
- **Cover Banners**: Full horizontal width note headers with 5 gradient presets (*Cyberpunk*, *Sunset Amber*, *Ocean Teal*, *Midnight Blue*, *Socratic Gold*).
- **Custom Emoji Picker & Star Favorites (`⭐`)**: Assign note emojis and toggle star favorites to pin notes in the sidebar.
- **Real-Time Note Stats**: Live character count, word count, total block count, and estimated reading time aggregated across block text, toggle details, and LaTeX formulas.
- **Auto-Note Instantiation & Click-to-Append**: Typing inside an empty space automatically instantiates a new note; clicking blank space below blocks appends a new paragraph.


### 🔍 2. Universal Navigation, History & Instant Capture
- **In-Memory Keyboard Navigation History (`Alt + ←` / `Alt + →`)**: Instant back-and-forth traversal between recently visited notes across spaces, with visual `◀` / `▶` breadcrumb controls in the top bar.
- **Command Palette (`Ctrl+K` / `Cmd+K`)**: Fuzzy-search notes across all spaces (nested sub-pages show their parent path, e.g. `Space: School › Physics › Mechanics`), open workspace tabs (Notes, Calendar, 3D Studio, Mastery Dashboard), or open settings.
- **Multi-Note Selection & Bulk Operations Suite**: Select multiple notes one-by-one with an inline "Select" toggle in the notes list header. Provides live count badges, Select All / Deselect All, and a 4-action bulk toolbar: **Star/Unstar** in bulk, **Duplicate** all selected notes (titled "Copy of [note name]"), **Move** all to any destination space, and **Delete to Trash** with a mandatory safety confirmation modal.
- **Quick Save (`Ctrl+S`)**: Explicit keyboard shortcut to instantly save notes.

### ⚙️ 3. Space Hub & Per-Space Curriculum Management
- **Dedicated Full-Page Dashboard**: Accessible via the prominent `⚙️ Space Hub` button directly below the Spaces selector in the sidebar.
- **Multiple Documents per Space**: Upload multiple curriculum documents (`.pdf`, `.docx`, `.txt`, `.md`) such as official syllabus specifications, exam boundaries, lecture schedules, and formula sheets.
- **Active for AI Toggles**: Toggle switches per document control exactly which curriculum files are active and injected into the AI context for quiz generation, grading, and Socratic dialogues.
- **Per-Space AI Pedagogy Settings**:
  - **Academic Standard / Grade Level**: General, IGCSE / O-Level, IB Diploma (HL/SL), AP / College Board, University, Olympiad.
  - **AI Examiner Persona**: Standard Examiner, Strict Examiner, Socratic Guide, Friendly Coach, Olympiad Mentor.
  - **Distractor Toughness & Rigor**: Relaxed, Standard, High Rigor.
  - **Custom Space Identity & Full Editing**: Rename any space, pick from 26 curated emoji presets or type custom emojis, and customize descriptive taglines with permanent persistence across default and custom spaces. Dual edit triggers available via hover pencil in Sidebar (Grid and Dropdown views) and within the Space Hub.
  - **Permanent Default & Custom Space Deletion**: Deleting any space (including defaults like School, Personal, Misc, Journal) permanently removes it and related metadata across browser reloads without automatic recreation.
- **1-Click Subject Presets**: Rapidly load Cambridge IGCSE Gr.10, IB Diploma HL, AP College Board, or Foundational mastery presets.

### 🧑‍🏫 4. Interactive AI Tutor Doubt-Clearing Suite
- **Omnipresent Doubt Clearing**: Access anytime via the `🧑‍🏫 AI Tutor` top header button in the workspace HUD.
- **Full Space Curriculum Feeding**: Fed with all active curriculum documents (`Fed to AI`) from the active space.
- **Syllabus & Standard Calibrated**: Injects the active space's academic standard (IGCSE, IB HL, AP, College, Olympiad) and selected persona (Strict, Socratic, Coach, Mentor).
- **Active Note Context Awareness**: Grounds answers in the active note's text to explain what the student is currently writing or reading.
- **Rich Markdown, Tables & Syntax Highlighting**: Full Markdown decomposition (`MarkdownRenderer.jsx`) supporting structured headings, numbered/bullet lists, markdown tables, blockquotes, and fenced code blocks with 10-language syntax highlighting and 1-click code copying.
- **Native LaTeX Math Formatting**: Real-time KaTeX rendering for complex chemical formulas, physics integrals, and step-by-step mathematical derivations.
- **Quick Doubt Starters**: 1-click query pills for step-by-step derivations, common exam traps, and real-world intuition.

### 🧪 5. Interactive 3D Visualization Studio
A comprehensive suite of 39 real-time interactive 3D STEM simulations built using Three.js, `@react-three/fiber`, and custom WebGL Canvas engines with a clean single top bar, a custom subject-separated `TopicSelectorDropdown` (with live instant search, discipline filter pills, and category grouping), resizable sidebar panels (10%–80% viewport), and speed-scaled physics engines (0.1×–3.0×):

- ⚛️ **Physics Engine** ([`PhysicsCanvas.jsx`](file:///c:/Users/Sivabalan/Documents/GitHub/quadcore-hackathon-2k26/components/visualizations/PhysicsCanvas.jsx) & [`ShadowLabCanvas.jsx`](file:///c:/Users/Sivabalan/Documents/GitHub/quadcore-hackathon-2k26/components/visualizations/ShadowLabCanvas.jsx)):
  - **Wave Refraction & Snell's Law**: Multi-medium ray tracing (Air, Water, Glass, Diamond, Perspex), critical angle, total internal reflection, and Fresnel reflection rays.
  - **Motor Effect & Fleming's Left-Hand Rule**: Magnetic flux lines, current conductors, Lorentz force vectors, and Fleming's left-hand rule.
  - **Geometric Optics & Ray Diagrams**: Convex/concave lenses and spherical curved mirrors (concave/convex), adjustable object height, focal length controls, real/virtual images, principal ray tracing, and projection screen.
  - **Electromagnetic Induction & Faraday's Law**: Dual apparatus architecture (AC Generator Dynamo & Bar Magnet / Solenoid Rig), center-zero galvanometer, dynamic incandescent bulb load ($P \propto \mathcal{E}^{1.6}$), Lenz's law opposing field vectors, and top live AC EMF sine graph.
  - **Kinetic Gas Laws ($PV=nRT$)**: Kinetic particle container with collision vectors, temperature/volume controls, and pressure gauge readouts.
  - **2D Projectile Motion**: Ballistic trajectory with quadratic air resistance, ideal vacuum parabola comparison, ultra-light polished platinum laboratory cannon with champagne brass fittings and protractor quadrant, elevated zero-clipping runway alignment, 60 FPS zero-lag force vectors ($\vec{v}$, $\vec{W}$, $\vec{F}_{\text{drag}}$, $\vec{F}_{\text{net}}$), aerodynamic wake vortex particles, light porcelain metric distance runway, apex drop line, landing bullseyes, 3D label visibility toggle, and debounced smooth slider controls.
  - **Wave Interference & Double Slits**: Two-source wave interference ripples, coherent slit emitters, double-slit barrier, and screen intensity fringe maxima.
  - **Keplerian Orbits & Gravity Wells**: Gravitational spacetime potential well ($-GM/r$), central massive body, and orbiting satellites.
  - **Light, Shadows & Straight Lines** ([`ShadowLabCanvas.jsx`](components/visualizations/ShadowLabCanvas.jsx)): Torch, shape and screen on a ruled bench; the shadow is painted onto the screen as a live texture from `lib/shadowOptics.js`, with umbra/penumbra bands, six silhouettes, opaque/translucent/transparent materials, a predict-the-shadow game, and a 10%–80% resizable sidebar controls panel.
  - **Incline Plane — Newton's Laws & Friction** ([`InclineFrictionCanvas.jsx`](components/visualizations/InclineFrictionCanvas.jsx)): Adjustable ramp with a full free-body diagram drawn to one shared force scale ($W$, $mg\sin\theta$, $mg\cos\theta$, $N$, $f$, applied pull, resultant), a static-friction grip gauge showing $f \le \mu_s N$ as an inequality, the angle of repose $\tan\theta = \mu_s$, a live velocity trace, and responsive animation speed scaling.
  - **Hooke's Law & the Elastic Limit** ([`HookesLawCanvas.jsx`](components/visualizations/HookesLawCanvas.jsx)): Retort stand, helical coil, millimetre ruler and slotted masses, with a live force–extension graph showing the Hooke's law line, the plastic branch past the elastic limit, the unloading line, permanent set in coil geometry, and dynamic damped harmonic oscillations responding to animation speed.
  - **Simple Machines & Mechanical Advantage** ([`SimpleMachinesCanvas.jsx`](components/visualizations/SimpleMachinesCanvas.jsx)): Class 1/2/3 levers and a 1–4 sheave block and tackle running the same lifting job, with an animated stroke cycle that shows the distance cost, a work-in / work-out / wasted bar chart, and animation speed pacing.
  - **Energy Conservation — Loop-the-Loop** ([`RollerCoasterCanvas.jsx`](components/visualizations/RollerCoasterCanvas.jsx)): Drop tower, vertical loop and braking straight with a live GPE / KE / thermal bar chart whose stacked total never moves, a speedometer, passenger g-force dial ($N = mv^2/R - mg$), $h \ge 2.5R$ minimum-release-height threshold, and live coaster physics speed scaling.
  - **Series & Parallel Circuits on Breadboard** ([`CircuitBoardCanvas.jsx`](components/visualizations/CircuitBoardCanvas.jsx)): 3D breadboard circuits with battery pack, knife switch, incandescent light bulbs with thermodynamic filament heating, socket resistor color bands, multimeters, and electron drift carrier currents scaling dynamically with animation speed.
  - **Static Electricity & Charge Transfer** ([`StaticElectricityCanvas.jsx`](components/visualizations/StaticElectricityCanvas.jsx)): Triboelectric charge transfer, countable electron carriers, Coulomb inverse-square forces ($F = k q_1 q_2 / r^2$), neutral wall polarisation via induction, Van de Graaff repelling pie pan stack, air humidity leakage, interactive 3D balloon raycast dragging, and animation speed scaling.
  - **Archimedes' Principle & Buoyancy** ([`BuoyancyCanvas.jsx`](components/visualizations/BuoyancyCanvas.jsx)): Overflow can with spout, graduated measuring cylinder catching displaced fluid volume, spring scale measuring apparent weight loss ($F_b = \rho V g$), square-root density number line, dynamic buoyant water bobbing, and animation speed scaling.
  - **Heat Transfer — Three Modes** ([`HeatTransferCanvas.jsx`](components/visualizations/HeatTransferCanvas.jsx)): Conduction along copper/iron/glass/wood rods with paraffin wax bead drop tests and atomic lattice vibrations, convection currents with potassium permanganate dye tracers, and radiation absorption with a blackened plate, all responding in real time to the universal animation speed slider.

- 🧪 **Chemistry Engine** ([`ChemistryCanvas.jsx`](file:///c:/Users/Sivabalan/Documents/GitHub/quadcore-hackathon-2k26/components/visualizations/ChemistryCanvas.jsx)):
  - **Bohr Atom & Emission Spectra**: Quantized electron shells, core/valence electrons, and photon emission spectral wave packets.
  - **Organic Chemistry Builder**: 6 homologous series (Alkanes, Alkenes, Alkynes, Alcohols) with carbon backbone, hydrogen, oxygen, single sigma, and double/triple pi bonds.
  - **Fractional Distillation**: Multi-stage fractionating column, crude oil boiling point gradient, and color-coded petroleum fractions.
  - **3D Crystal Lattices**: Giant lattices: Sodium Chloride ($\text{NaCl}$), Diamond ($sp^3$), Graphite ($sp^2$ layers with delocalised electrons), Quartz ($\text{SiO}_2$), and Ice ($\text{H}_2\text{O}$).
  - **Electrolysis**: Beaker electrolyte bath, cathode reduction plating, anode oxidation dissolution, and rising gas bubble particle streams.
  - **VSEPR Molecular Geometry**: Steric numbers 2–6, central atom, bonded ligands, non-bonding lone pair electron clouds, and bond angle arcs.
  - **Reaction Energetics & Catalysis**: Exothermic/endothermic energy profile curves, transition states, forward/reverse activation energy $E_a$, enthalpy change $\Delta H$, and catalysed pathways.
  - **Separation Techniques Studio** ([`SeparationTechniquesCanvas.jsx`](components/visualizations/SeparationTechniquesCanvas.jsx) + [`lib/separation.js`](lib/separation.js)): Three switchable stations on one bench — gravity filtration (retort stand, ring, fluted paper, conical flask, pouring beaker), evaporating crystallisation (Bunsen, tripod, gauze, porcelain basin with steam and instanced crystals), and paper chromatography (tank, pencil baseline, rising solvent front, pigment spots) — for sand + salt water, copper sulfate solution or black marker dye in water or ethanol, with a live chromatogram and $R_f = d_\text{pigment} / d_\text{solvent}$ readout.
  - **Combustion & the Fire Triangle** ([`CombustionFireTriangleCanvas.jsx`](components/visualizations/CombustionFireTriangleCanvas.jsx) + [`lib/combustion.js`](lib/combustion.js)): A detailed Bunsen burner with a rotating air collar (yellow sooty $300\,^\circ\text{C}$ ↔ roaring blue $1400\,^\circ\text{C}$ with inner cone), needle valve, methane tap and hose, glass heat shield and thermocouple; three fire-triangle interrupters (gas tap, bell jar with a falling $\text{O}_2$ gauge, water mist) that each remove exactly one side; a cold basin held on tongs that collects soot only from an incomplete flame; and the live equation switching between $\text{CH}_4 + 2\text{O}_2 \rightarrow \text{CO}_2 + 2\text{H}_2\text{O}$ and $2\text{CH}_4 + 3\text{O}_2 \rightarrow 2\text{CO} + 4\text{H}_2\text{O}$.
  - **Particle Model of Matter & Phase Changes** ([`ParticleModelMatterCanvas.jsx`](components/visualizations/ParticleModelMatterCanvas.jsx) + [`lib/particleModel.js`](lib/particleModel.js)): 500 instanced particles in a sealed glass column on a hotplate/cryocooler under a pressure piston (0.5–10 atm), for water, neon or carbon dioxide. The sample has a temperature of its own that the hotplate drives, read off a heating curve that is flat across the latent heats — so the thermometer visibly stops at $0\,^\circ\text{C}$ and $100\,^\circ\text{C}$ while the lattice peels apart and the pool boils off. Boiling points follow Clausius–Clapeyron ($180\,^\circ\text{C}$ at 10 atm, $81\,^\circ\text{C}$ at 0.5 atm), dry ice sublimes at 1 atm and only gains a liquid above 5.1 atm, ice stands 9 % taller than the water it melts into. Live readouts: phase indicator (Solid Lattice / Liquid Flow / Gas Chaos / Supercritical Fluid), $\tfrac{3}{2}kT$ kinetic-energy gauge and $v_{\text{rms}}$, and the in-scene heating curve with $\Delta H_{\text{fus}}$ / $\Delta H_{\text{vap}}$ plateau markers.
  - **Radioactive Decay Modes & Half-Life** ([`RadioactiveDecayCanvas.jsx`](components/visualizations/RadioactiveDecayCanvas.jsx) + [`lib/radioactiveDecay.js`](lib/radioactiveDecay.js)): 100–10,000 nuclei as a single instanced mesh, each rolling its own die every frame ($1 - e^{-\lambda\,dt}$), for $^{238}\text{U}$ α, $^{14}\text{C}$ β⁻, $^{18}\text{F}$ β⁺ and $^{99\text{m}}\text{Tc}$ γ. Radiation tracers fly through +/− field plates (α bends down, β⁻ up and further, γ straight), a paper / 5 mm aluminium / 10 cm lead barrier, and a Geiger–Müller tube. Readouts: the balanced nuclear equation with its $\sum A$ / $\sum Z$ check, activity $\lambda N$ in Bq and the counted rate, a live $N(t)$ trace against the dashed $N_0 e^{-\lambda t}$, and the half-life timestamps with their intervals — tight at 10,000 atoms, scattered at 100. One half-life is 10 s on screen; the Details tab says what a second is worth for each isotope.
  - **Shared instanced-particle engine** ([`particle-population.jsx`](components/visualizations/particle-population.jsx)): typed-array populations flushed into one `InstancedMesh` (six numbers per instance, only when dirty) with explicit disposal of the instance buffers on unmount — 10,000 atoms at 60 fps with ~0.5 ms of JS per frame.

- 👁️ **Human Eye Optics** ([`EyeCanvas.jsx`](components/visualizations/EyeCanvas.jsx)): Cutaway eyeball driven by a Gullstrand two-element model in `lib/eyeOptics.js` — accommodation, the pupil reflex, live ray tracing onto the fovea, a blurred-vision preview from the real retinal blur circle, a front-facing iris viewport, an anatomy mode covering ten structures with per-coat visibility, and a 10%–80% resizable sidebar controls panel.

- 🧬 **Biology Engine** ([`BiologyCanvas.jsx`](file:///c:/Users/Sivabalan/Documents/GitHub/quadcore-hackathon-2k26/components/visualizations/BiologyCanvas.jsx) & [`RespiratoryCanvas.jsx`](file:///c:/Users/Sivabalan/Documents/GitHub/quadcore-hackathon-2k26/components/visualizations/RespiratoryCanvas.jsx)):
  - **Respiratory Mechanics & Thoracic Physics**: Genuine clinical CT-derived thoracic skeleton (`skeleton_ct.glb`; isolated 24 ribs, T1–T12 vertebrae, L1–L3 crura anchors, sternum, and clavicles) with bucket-handle and pump-handle breathing kinematics, photorealistic medical lungs scan (`lung.glb`), multi-layer antagonistic intercostal muscle bands spanning all 11 intercostal spaces (superficial external $+35^\circ$ vs deep internal $-45^\circ$ layers with layer isolation) with active scarlet vs relaxed deep crimson tension shaders, muscular diaphragm dome flattening dynamically ($Y = 1.05 \to 0.63$) with trifoliate central tendon (*centrum tendineum*), 3 anatomical apertures (Caval T8, Esophageal T10, Aortic T12), bilateral vertebral crura, Boyle's Law pressure gradients, dynamic airway particle vectors, 3-state phase selector, collapsible HUD, live SVG gauges, and an interactive **Open-Source Model Credits Suite** (`RESPIRATORY_MODEL_CREDITS`) detailing upstream MIT/AGPL licenses and direct links to upstream repositories.
  - **The Human Eye — Accommodation & Pupil Reflex**: Anatomical and physiological cutaway eyeball simulation with dynamic ciliary accommodation, crystalline lens curvature morphing, pupil light reflex, Gullstrand equivalent power calculations, and refractive error corrections.
  - **Plant & Animal Cell Explorer**: High-detail organelles (nucleus, mitochondria, chloroplasts, ER, Golgi, vacuoles, membrane, cell wall) with osmotic tonicity states.
  - **The Reflex Arc & Spinal Circuit** ([`ReflexArcCanvas.jsx`](components/visualizations/ReflexArcCanvas.jsx), [`lib/reflexArc.js`](lib/reflexArc.js)): A forearm reaching into a candle flame with the full withdrawal-reflex circuit — nociceptor → Aδ sensory neuron → dorsal root ganglion → relay neuron across a transverse spinal-cord section (grey-matter butterfly) → motor neuron out of the ventral root → biceps. Conduction-velocity timing model (≈ 30 ms stimulus-to-effector), real-time vs 10× slow-motion playback, sub-threshold warmth vs 80 °C flame, and severed dorsal/ventral root modes, with a live millisecond counter and milestone indicators in the Details tab.
  - **Antagonistic Muscle Pairs & the Levered Elbow** ([`AntagonisticMusclesCanvas.jsx`](components/visualizations/AntagonisticMusclesCanvas.jsx), [`lib/muscleMechanics.js`](lib/muscleMechanics.js)): Scapula, humerus, radius and ulna with textured, volume-preserving biceps and triceps bellies on visible tendons; 0–145° elbow slider, 0–25 kg dumbbell, and a lactic-acid fatigue trigger that makes the arm give way to the angle it can still hold. Live contracted/relaxed states for both muscles, joint torque τ = F·d, biceps force from the 4 cm moment arm, and tendon tensile strain. Both scenes share one arm rig ([`arm-rig.jsx`](components/visualizations/arm-rig.jsx)).
  - **Plant Transpiration — Roots, Xylem & Stomata** ([`TranspirationCanvas.jsx`](components/visualizations/TranspirationCanvas.jsx), [`lib/transpiration.js`](lib/transpiration.js)): Three magnifications of one pathway — root hairs in a cut-away soil block, a cut-away stem with three lignin-ringed xylem vessels and two phloem tubes, a leaf; a ×200 leaf section (cuticle, palisade, spongy mesophyll with air spaces, lower epidermis with the pore, vapour plume, boundary-layer haze, wind streaks); and a ×800 surface view of the stoma with two kidney-shaped guard cells that bow apart as K⁺ and water move in. Controls: light intensity, relative humidity, wind speed, hydrated vs drought soil. Steady-state model (Tetens VPD, stomatal + boundary-layer conductance in series, cohesion–tension column, ABA closure) with live transpiration rate (mL/hr), Open/Closed pore status, xylem tension (MPa) and a cavitation/embolism state.
  - **Peristalsis & Digestive Transit** ([`PeristalsisCanvas.jsx`](components/visualizations/PeristalsisCanvas.jsx), [`lib/peristalsis.js`](lib/peristalsis.js)): A 25 cm oesophagus stood on end with a glassy lumen, thirty circular-muscle rings that fatten and flush where they contract, and ten longitudinal fibres down the outside that brighten ahead of the bolus as that segment shortens and widens. Trigger-swallow button, bolus consistency (water / soft masticated food / dry bolus — the dry one distends the wall and slows the wave), and a gravity-inversion toggle that flips the tube while the world-fixed **g** arrow stays put. Live circular-wave position, longitudinal relaxation zone, bolus position and transit speed (cm/s) reported into the Details tab.
  - Both scenes are built on a shared tube-transit kit ([`tube-transit.jsx`](components/visualizations/tube-transit.jsx), [`lib/tubeTransit.js`](lib/tubeTransit.js)): a ring-stack `ProfiledTube` whose radius/centre/colour per ring are callbacks (rewritten in place each frame when dynamic), `TubeRings` (tori riding the profile in one draw call), and `TubeFlow` (instanced particles recycling along an open tube with a column front) — plus the pure profile, squeeze-to-fit and stream arithmetic behind them.
  - **The Carbon Cycle & Greenhouse Heat Trapping** ([`CarbonCycleCanvas.jsx`](components/visualizations/CarbonCycleCanvas.jsx), [`lib/carbonCycle.js`](lib/carbonCycle.js)): A planetary diorama under a hemisphere of air — an instanced forest that is felled to stumps as the cover slider drops, a fenced pasture whose cattle count grows on the cleared land, a coal plant with a furnace glow and twin stacks, a carbonate-flecked ocean basin, and a greenhouse band of CO₂/CH₄ molecules that thickens with ppm. Every carbon flow is an instanced particle stream at a rate set by the model (particle rate ∝ √GtC/yr) and a signed budget chart adds them up: fossil fuel, land use, respiration up; photosynthesis, ocean uptake down; net to air accented. Controls: fossil-fuel combustion 0–500 %, global forest cover 10–100 %, solar activity cycle (±0.15 % TSI), a photon-wavelength filter toggle (shortwave sunlight passing through and bouncing off the ground at 30 % albedo, or longwave infrared leaving the ground and being absorbed and re-emitted by the greenhouse layer) and a reset-to-present-day action. The model is a clock (2 sim-years per wall second): the atmosphere integrates the 2020s budget (120/117 GtC/yr photosynthesis/respiration, 9.5 fossil, 1.2 land use, 2.8 ocean), CO₂ fertilisation and Q10 respiration set the land sink, the surface ocean lags the air and can outgas, forcing is 5.35 ln(C/C₀) plus methane and solar terms, and the anomaly relaxes to 0.8 K/(W m⁻²) equilibrium over a 15-year ocean lag. Live readouts: atmospheric CO₂ (ppm) and trend, global mean temperature anomaly (Δ °C) with committed warming, the carbon-pool exchange balance (GtC/yr) and every flux, ocean pH, forcing breakdown and the share of outgoing IR trapped.
  - **Food Chains & the 10 % Energy Pyramid** ([`FoodChainPyramidCanvas.jsx`](components/visualizations/FoodChainPyramidCanvas.jsx), [`lib/foodChain.js`](lib/foodChain.js)): A stepped four-tier pyramid — Sun → oak leaves (10 000 kJ) → caterpillars (1 000 kJ) → blue tits (100 kJ) → sparrowhawk (10 kJ) — with slab widths on a log scale, instanced organisms standing on each slab (500 000 leaves → 5 000 caterpillars → 20 blue tits → 1 hawk, drawn in proportion), a gold stream climbing to each next tier and a rose stream nine times as dense pouring off the side as heat, waste and the uneaten, a dashed ghost slab for the fifth link that would receive 1 kJ and cannot be fed, and a log-scale energy chart whose ghost columns show what each tier received before its −90 %. Controls: primary solar insolation 50–150 % (at 50 % the hawk starves and the chain shortens to three), a persistent-bioaccumulative-toxin trigger (0.01 ppm on the leaves becomes 0.1 → 1 → 10 ppm up the chain, ×10 per link — eggshell thinning at 5 ppm, lethal at 25, at which point the hawk dies and the cascade follows) and an apex-predator-removal trigger that toggles a trophic cascade (blue tits ×2.2, caterpillars ×0.35, leaves ×1.3). Readouts: energy stored and flow per tier (kJ), headcounts, toxin concentration in fat (ppm) with status per tier, chain length and the fifth-link verdict.
  - Both ecosystem scenes share a diorama kit ([`ecosystem-diorama.jsx`](components/visualizations/ecosystem-diorama.jsx): `DioramaSlab`, `WaterBody`, `SkyEnvelope`, `SunSource`, an eased instanced `TreeStand` that leaves stumps, the ref-driven instanced `FluxStream` and a two-mode `PhotonShower` with albedo bounce and greenhouse trapping) and a chart kit ([`flux-chart.jsx`](components/visualizations/flux-chart.jsx): `SignedFluxBars` diverging about a zero line with a net column, and `LogTierBars` with ghost columns and decade gridlines). Bars are unit planes scaled per frame, so a chart re-rendering ten times a second allocates no new geometry.
  - **Flower Anatomy, Pollination & Pollen Tube Growth** ([`FlowerPollinationCanvas.jsx`](components/visualizations/FlowerPollinationCanvas.jsx), [`lib/pollination.js`](lib/pollination.js)): A flower cut down the middle with the front half removed — three petals and four sepals at the back, four stamens with pollen-dusted two-lobed anthers, and the carpel in the centre: stigma, cut-away style, and an ovary opened to show two ovules (integuments, embryo sac, egg cell with synergids, two polar nuclei, antipodals, micropyle). Vector choice restyles the flower: insect-pollinated (big pink petals, nectaries, sticky knob stigma, spiky pollen, a bee that visits the anther then the stigma) or wind-pollinated (small dull petals, dangling anthers, feathery stigma, a drifting cloud of smooth grains and wind streaks). "Trigger pollination" plays a six-stage timeline — arrival → landing (POLLINATION, labelled) → germination → tube growth down the style (a `TubeGeometry` whose draw range is the model's fraction, with the tube nucleus and generative nucleus travelling behind the tip, the latter dividing into two sperm nuclei part-way) → micropyle entry → double FERTILISATION (egg turns into the gold zygote 2n, the polar nuclei into the violet endosperm 3n). The time slider is the same clock: playing, the scene pushes the time into it; dragged, it scrubs and pauses. A vertical gauge reads the tube's length in mm of 12, and the HUD reports stage, pollinated/fertilised status, hours after pollination, growth rate, every nucleus's position, ploidy, and the vector's pollen/stigma/petal/nectar traits.
  - **Bacteria vs Virus — Anatomy & the Lytic Cycle** ([`BacteriaVsVirusCanvas.jsx`](components/visualizations/BacteriaVsVirusCanvas.jsx), [`lib/pathogens.js`](lib/pathogens.js)): A bacillus (peptidoglycan wall drawn as a lattice of rings and struts, membrane, cytoplasm, 110 instanced 70S ribosomes, a circular chromosome loop, a plasmid, a spinning helical flagellum, pili) beside a T4 phage (translucent icosahedral capsid with a DNA torus-knot inside, collar, ribbed contractile sheath, core, hexagonal baseplate, six tail fibres), each labelled. "Administer penicillin" rains hexagonal molecules over both: on the bacterium the lattice loses its struts as the model's wall integrity falls, the cell swells and bursts (ribosomes, chromosome fragments and plasmid fly out and fade) while the efficacy meter fills to 100 %; over the phage the molecules fall straight past and its meter stays at 0 %. "Trigger viral lytic cycle" sends a second phage across: it docks tail-first, its sheath contracts and the core pierces the wall, the DNA knot drains down a strand into the cell, the host chromosome fragments and the ribosomes turn violet as they are hijacked, instanced progeny assemble inside (counter 0 → 150), and the wall breaks — progeny burst outward. Whichever button was pressed last owns the cell (a fresh bacterium each time). The HUD carries the eight-point living-vs-non-living checklist (8/8 vs 2/8), the antibiotic efficacy meter with the reason, three antibiotic targets, both timelines' stages, wall integrity, genome injected, host DNA intact, ribosome hijack and the burst-size counter.
  - **Mitosis & Meiosis — Spindle Mechanics & Crossing Over** ([`MitosisMeiosisCanvas.jsx`](components/visualizations/MitosisMeiosisCanvas.jsx), [`lib/cellDivision.js`](lib/cellDivision.js)): A 2n = 4 cell — two homologous pairs, maternal red and paternal blue — whose membrane is a dynamic `ProfiledTube` lathe (two sphere profiles under a smooth-max: one sphere → stretched cell → two lobes → two cells), eight chromatids that are themselves dynamic tubes (sisters bowed into an X, arms swept into a V when pulled, distal arms dragged across to the homologue at a chiasma, every station vertex-coloured by which parent that stretch of DNA now comes from), an instanced spindle of kinetochore / interpolar / astral microtubules aimed pole → kinetochore each frame, nuclear envelopes and chromatin clouds that dissolve and re-form, and a contractile ring. Mode selector (mitosis: 6 stages · meiosis I & II: 11 stages, the second division in two smaller cells with the spindle turned 90°), a chiasma-frequency slider (0–4 events, meiosis only) and a colchicine button that dissolves the spindle and arrests the cell at metaphase — a cell already past metaphase runs forward round to the next one, never backwards. Live ploidy counter (2n = 4 → n = 2), chromosome vs chromatid counts per cell, recombinant-chromatid count and a genetic-diversity gauge (4 → 36 gamete genotypes).
  - **Cardiac Cycle & 4-Chambered Heart Hemodynamics** ([`CardiacCycleCanvas.jsx`](components/visualizations/CardiacCycleCanvas.jsx), [`lib/cardiacCycle.js`](lib/cardiacCycle.js)): A heart sectioned like a textbook plate — each chamber the back half of a thick-walled sphere whose cavity radius follows its volume and whose wall swells to keep its own volume (the left ventricle visibly thickens as it squeezes) with a dynamic cut-face annulus showing wall thickness — plus septa, great vessels, four valves whose leaflets swing on their annuli by the model's open fraction (thick calcified nodular leaflets under stenosis), instanced blood streams through every valve at the model's flow rate, and the conduction system (SA node → atria → AV node → bundle of His → Purkinje) as tubes revealed along their length as the impulse travels. Beside it a Wiggers panel (LV / aortic / atrial pressure, LV volume, ECG, phonocardiogram with S1 / S2 markers) sampled for one beat at the current rate and pathology with a cursor riding the live clock, and a scrolling live-ECG monitor strip. Heart-rate slider (40–180 bpm — systole and diastole shorten by their own physiological amounts, so stroke volume falls and output rises less than proportionally), pathology modes (sinus rhythm · ventricular fibrillation: chaotic sparks, quivering walls, no output, no sounds, a draining aorta · aortic stenosis: 32 % opening, an 80 mmHg gradient, an ejection murmur), and continuous vs step-by-step playback through the five phases.
  - Both staged-cycle scenes share a stage-stepper kit ([`stage-stepper.jsx`](components/visualizations/stage-stepper.jsx), [`lib/stageCycle.js`](lib/stageCycle.js)) and the HUD's `stepper` control type: a cyclical stage machine (wrap-around clock with lap count, a per-stage HOLD point the stepper parks on, shortest-way-round tweens between hold points, per-stage tempo, and a lock that arrests the clock at a stage) reconciled with two HUD params — the stage index and a playing flag — so chips / Prev / Next step to settled textbook tableaux and Play runs the film with the chips following it.
  - Both triggered scenes share a timeline kit ([`lib/timeline.js`](lib/timeline.js) — `makeTimeline`, `describeTimeline`, `stageProgress`, `ramp`/`smoothstep`/`pulse` — and [`timeline-kit.jsx`](components/visualizations/timeline-kit.jsx) — a `TimelineDriver` that restarts on an action counter, fills a ref every frame, ticks the HUD at 10 Hz and optionally two-way-binds a scrub slider, plus a `TimelineCaption` stage strip). Every animated element reads the timeline's snapshot in `useFrame`, so the burst and spray effects allocate nothing at runtime and dispose with the scene.
  - **Enzyme Kinetics & Lock-and-Key Model**: Substrate binding, active catalytic cleft, thermal denaturation cliffs, and pH stress curves.
  - **DNA Double Helix**: Antiparallel sugar-phosphate backbones, major/minor grooves, and A-T / G-C complementary base pairing.
  - **Protein Secondary Structure & Folding**: $\alpha$-Helix (3.6 res/turn), $\beta$-Pleated Sheet, random coils, hydrophobic core packing vs hydrophilic surface residues, and thermal denaturation.

- 💻 **Computer Science 3D Engine** ([`CSCanvas.jsx`](file:///c:/Users/Sivabalan/Documents/GitHub/quadcore-hackathon-2k26/components/visualizations/CSCanvas.jsx) & [`BinaryTree3D.jsx`](file:///c:/Users/Sivabalan/Documents/GitHub/quadcore-hackathon-2k26/components/visualizations/BinaryTree3D.jsx)):
  - **3D Binary Search Tree / AVL Tree**: Interactive node insertion, searching, depth planes, traversal animations, and complete Visual Tree Keys.
  - **3D Sorting Algorithm Visualizer**: Bubble, Insertion, Selection, Quicksort, and Merge Sort with unsorted bars, comparison highlights, swap transitions, and sorted states.

- 📐 **Mathematics 3D Engine** ([`MathCanvas.jsx`](file:///c:/Users/Sivabalan/Documents/GitHub/quadcore-hackathon-2k26/components/visualizations/MathCanvas.jsx)):
  - **3D Gradient Descent Optimization**: Topographic loss surfaces (Bowl, Saddle, Rosenbrock Valley, 4-Well Landscape), negative gradient $-\nabla f$ descent vectors, and optimization trails.
  - **Solids of Revolution & Integral Calculus**: 2D generating curves $r(y)$, Riemann approximating cylindrical discs $\pi r^2 \Delta y$, true solid shells, and rotation axes.
  - **Trigonometric Unit Circle & Wave Synthesis**: Unit circle orbital motion $(x, y) = (\cos\theta, \sin\theta)$, projected sinusoidal time traces, and Fourier square wave harmonic synthesis with Gibbs overshoot.

- 🧭 **Dual-Tab HUD, Speed Control & Authoritative Visual Keys** ([`VisualizationHUD.jsx`](file:///c:/Users/Sivabalan/Documents/GitHub/quadcore-hackathon-2k26/components/visualizations/VisualizationHUD.jsx)):
  - **Universal Draggable Resizable HUD Panels**: 100% of all 36 3D visualisations support horizontal drag-to-resize sidebar controls from 10% (180px) to 80% screen width via grab bar and corner grip, with persistent `localStorage` (`socratic_hud_panel_width`).
  - **Universal Animation Speed Slider**: Placed prominently directly below the Controls vs Details tab switcher on all 43 scenes (including all physics, chemistry, biology, math, and computer science simulations) for instant $0.1\times$ to $3.0\times$ pacing control.
  - Parameter controls, camera resets, category filters, and Socratic Quiz drawer.
  - Live **Details** tab with live calculated scientific state metrics, formula subtitles, and complete **Visual Keys** (color legends) documenting every line, ray, vector, and object in the scene.

### ⏱️ 4. Unified Multi-Timer HUD & Calming Study Break Alerts
- **Unified Global Timer HUD** ([`GlobalTimerHUD.jsx`](file:///c:/Users/Sivabalan/Documents/GitHub/quadcore-hackathon-2k26/components/GlobalTimerHUD.jsx)): Header dropdown managing Pomodoro Focus (25m), Short Break (5m), Long Break (15m), and custom duration timers simultaneously with live countdown rings and play/pause controls.
- **Study Calendar & Schedule** ([`CalendarView.jsx`](file:///c:/Users/Sivabalan/Documents/GitHub/quadcore-hackathon-2k26/components/CalendarView.jsx)): Event scheduling, month navigation, space tagging, 24-hour time picker, and custom recurring alarm integration.
- **Calming Study Break & Timer Alert** ([`AlarmOverlay.jsx`](file:///c:/Users/Sivabalan/Documents/GitHub/quadcore-hackathon-2k26/components/AlarmOverlay.jsx)): Glassmorphic modal alert (`✨ ☕ 🌱`) with harmonic C-major triad chime synthesis, dynamic browser tab indicator (`🦆` $\leftrightarrow$ `☕`), and friendly snooze/extend controls.

### 🦆 5. Socratic AI Tutor, Explain & Reformat
- **AI Explain (`POST /api/explain`)**: Returns structured note breakdowns containing TL;DR summaries, ordered mechanism steps, analogies with explicit limitations, common misconceptions, worked examples, and check-yourself questions.
- **Diagnostic Quiz Drawer (`components/QuizPanel.jsx`)**: Dedicated quiz assessment sidebar for active notes and selections, evaluating understanding through dynamic questions (5 multiple-choice, 3 short-answers; math block / value_input questions excluded from quick quizzes) and recording session scores directly into the mastery analytics store.


### 📊 6. Graded Quizzes, Quizzes Studio & Sub-Topic Mastery Heatmap
- **Dedicated Quizzes Studio & Custom AI Quiz Creator** ([`QuizStudioView.jsx`](file:///c:/Users/Sivabalan/Documents/GitHub/quadcore-hackathon-2k26/components/QuizStudioView.jsx) & [`CreateQuizModal.jsx`](file:///c:/Users/Sivabalan/Documents/GitHub/quadcore-hackathon-2k26/components/CreateQuizModal.jsx)):
  - **Multi-Note Selection**: Interactive combobox with live search filtering, "Select All" / "Clear" buttons, per-note checkboxes, selection count badges, and removable chips.
  - **Multi-Source AI Synthesis**: Feeds multiple notes into Gemini with structured section demarcations (`=== Source Note: "<Title>" ===`), creating diagnostic exams that synthesize cross-note relationships, comparisons, and mechanisms.
  - **Cross-Note Heading Scope**: Automatically extracts and scopes questions to specific headings (H1–H4) across multiple selected notes with note source attribution.
  - **Multi-Note Quiz Cards & Interactive Navigation**: Interactive quiz cards show multi-source badge indicators (`📚 X notes`) with quick-jump navigation links into each source note.
  - **Deletion Confirmation Modal**: Accessible confirmation dialog (`DeleteQuizConfirmModal`) guarding against accidental deletion when trashing quizzes, permanently deleting items, or emptying the 24-hour trash bin.
  - **Cambridge IGCSE Grade 10 Math & STEM Question Suite**:
    - **7 Supported Question Types**: Multiple Choice, Multi-Select ("Select all that apply"), Value Input (exact numerical/algebraic formula with virtual math symbol keyboard and live KaTeX preview), Code Input (inbuilt editor with Tab 2-space indentation and language tags), Step Ordering (scrambled proofs & derivations), Short Answer, and Long Essay.
    - **Virtual Math Symbol Keyboard & Live KaTeX Preview**: Real-time formula entry with quick symbol insertion (`\frac{a}{b}`, `\sqrt{x}`, `x^2`, `\pi`, `\pm`, `\theta`, `\le`, `\ge`, `\approx`, `\infty`, `\times`, `\div`, `^\circ`) for students unfamiliar with raw LaTeX.
    - **Inbuilt Code Editor**: Interactive code writing environment with Tab key 2-space indentation interception, language badging, and starter code.
    - **Step Ordering**: Interactive proof/derivation cards with ▲/▼ reordering controls and auto-scrambling.
    - **1-Click STEM Presets**: Instant configuration presets: 🎓 *IGCSE Gr.10 STEM*, 🧮 *Pure Math & Derivations*, 💻 *Computer Science*, and ⚡ *Quick 5 MCQ*.
  - **Redesigned Decluttered Quiz Runner**: Split-screen 2-column layout offering an expansive, distraction-free Q&A canvas (`max-w-4xl`) on the left and a dedicated Control & Navigation Station on the right (`w-80 lg:w-88`), equipped with an interactive 5-column question palette matrix, prominent next/skip/submit buttons, instant answer clearing (`Eraser`), and keyboard hotkey navigation (`ArrowLeft`/`ArrowRight`, `A`-`D`/`1`-`4`).
  - **Live Quiz Progress Auto-Saving & Resumption**: Continuous real-time auto-saving of answers and question index to IndexedDB on every option click, debounced text answer, and question navigation. In-progress quizzes display a `⏳ In Progress (X/Y)` badge and one-click "Resume Quiz" action, while the runner header features a live `✓ Progress saved` indicator.
  - **Zero-Lag Quiz Creator Interface**: Isolated slider components (`React.memo`), throttled pointer event tracking, $O(1)$ heading selection index, and non-blocking background evaluation ensure fluid 60/120fps quiz configuration even with hundreds of notes and section headings.
  - **LaTeX & Chemical Formula Typesetting**: Full inline and block KaTeX rendering (`MathText.jsx`) for physics/chemistry equations (`$E = mc^2$`, `\frac{a}{b}`) and chemical formulas (`\text{H}_2\text{SO}_4`, `\rightarrow`) across question prompts, options, rubrics, and review diagnostics.
- **Diagnostic Quiz Builder & Hybrid Grading Engine (`POST /api/quiz/generate` & `/grade`)**: Builds customizable quizzes from notes across all 7 types. Performs deterministic objective grading for multiple choice, multi-select set equality, step ordering sequences, and numerical value inputs within tolerance ($\pm \delta$), alongside LLM mechanism evaluation for code solutions and short answers with full multi-note rubric context and custom diagnostic review diffs.
- **AI Note Reformatter Visual Feedback**: Triggering "Reformat Note (AI)" displays active button loading states and a prominent top-center floating glassmorphic status banner with animated sparkles and live progress text.
- **Space-Scoped Mastery Analytics Dashboard** ([`MasteryDashboard.jsx`](file:///c:/Users/Sivabalan/Documents/GitHub/quadcore-hackathon-2k26/components/MasteryDashboard.jsx)): Consolidates session scores into topic heatmaps grouped by note, tracking sub-topic mastery over time (**Solid** `●` / **Shaky** `◐` / **Gap** `○`) with weakest-first study recommendations. Features an integrated Space Switcher dropdown to isolate progress per subject space or inspect an aggregated `All Spaces` view, with non-destructive session retention and space-safe history clearing.

### 🔖 8. Local-First Website Saver & Folder Manager
- **Website Bookmarking & Folder Trees** ([`WebSaverView.jsx`](file:///c:/Users/Sivabalan/Documents/GitHub/quadcore-hackathon-2k26/components/WebSaverView.jsx)): Save study links, lecture slides, research papers, and developer tools organized into collapsible folder hierarchies per space.
- **Dual-Pane UI**:
  - **Left Sidebar**: Expandable folder tree with parent/child folders, "All Bookmarks" & "Unorganized" filters, inline new folder modal, rename/delete context triggers, and drag-and-drop target support.
  - **Main Viewport**: Search bar with real-time matching across titles, URLs, domains, tags, and personal notes; tag filter chips; sorting options (Newest, Oldest, Title A-Z, Domain); and view toggles (Grid Cards vs Compact List).
- **Favicon & URL Normalization** ([`urlUtils.js`](file:///c:/Users/Sivabalan/Documents/GitHub/quadcore-hackathon-2k26/lib/urlUtils.js)): Automated protocol normalization (`https://`), domain extraction, high-resolution Google favicon resolution, and title heuristic extraction.
- **Netscape HTML Bookmarks Import & Export** ([`exportImport.js`](file:///c:/Users/Sivabalan/Documents/GitHub/quadcore-hackathon-2k26/lib/exportImport.js)): One-click import and export of standard Netscape HTML bookmarks files (`<!DOCTYPE NETSCAPE-Bookmark-file-1>`), compatible with Chrome, Firefox, Safari, Edge, Arc, and Brave.
- **Quick Add Bookmark Modal** ([`AddBookmarkModal.jsx`](file:///c:/Users/Sivabalan/Documents/GitHub/quadcore-hackathon-2k26/components/AddBookmarkModal.jsx)): Instant URL paste, live favicon preview, folder selector, tag management with chip badges, and keyboard shortcuts (`Escape` closes, `Ctrl+Enter` saves).

### 📦 9. Multi-Format Export, Import & Backup Engine
- **Workspace & Space Backups (.socratic)** ([`ExportImportModal.jsx`](file:///c:/Users/Sivabalan/Documents/GitHub/quadcore-hackathon-2k26/components/ExportImportModal.jsx)): Export entire spaces, folders, bookmarks, and individual notes into portable JSON `.socratic` packages.
- **Netscape HTML Bookmarks (`.html`)**: Export space-filtered or complete bookmarks into browser-compliant HTML bookmark collections with tags and notes.
- **Multi-Format Note Export with Pre-Download Preview** ([`ExportPreview.jsx`](file:///c:/Users/Sivabalan/Documents/GitHub/quadcore-hackathon-2k26/components/ExportPreview.jsx)): Preview files before downloading for **Word Document** (`.docx`), **HTML Web Page** (`.html`), **Plain Text** (`.txt`), and **Markdown** (`.md`). Features authentic Microsoft Word sheet layouts with heading colors, browser mockup frames with dynamic auto-height sandbox iframes & embedded KaTeX math formulas, monospace text editors, dedicated full-document scroll container with wheel forwarding, and rendered/source code view toggles. **PDF** directly launches the native browser print preview dialog (`window.print()`).
- **Drag-and-Drop Import**: Drag and drop `.socratic`, `.json`, `.docx`, `.html` (notes and browser bookmarks), `.txt`, or `.md` files directly into target spaces.

### 🎓 11. Interactive Onboarding Tutorial & Feature Walkthrough
- **9 Interactive Chapters Covering 100+ Capabilities** ([`InteractiveTutorial.jsx`](file:///c:/Users/Sivabalan/Documents/GitHub/quadcore-hackathon-2k26/components/InteractiveTutorial.jsx)):
  - **Philosophy & 100% Local-First Architecture**: Active retrieval vs rereading, 11-table Dexie.js v7 storage, and spaces workflow with interactive concept cards.
  - **19-Block Editor & KaTeX Studio**: Interactive category filter across all 19 block types and live typography font switcher (`Default Sans`, `Classic Serif`, `Developer Mono`, `Script`, `Grotesk`).
  - **AI Study Suite**: Interactive 3-way drawer preview (AI Tutor Socratic chat, Explain Panel structured breakdown, and an **interactive live mini-quiz** with real-time feedback).
  - **Quizzes Studio & 7 Question Types**: Interactive question type explorer and live step-ordering puzzle.
  - **Space Hub & Curriculum Grounding**: Interactive academic standard simulator (IGCSE, IB, AP, University).
  - **27-Topic 3D Simulation Studio**: Interactive domain switcher across Physics, Chemistry, Biology, CS, and Mathematics.
  - **Pomodoro Rhythm & Study Calendar**: Multi-timer HUD, study schedule agenda, and interactive Pomodoro cycle simulator.
  - **Web Saver & Bookmarks**: Dual-pane folder tree preview and live Google favicon resolution.
  - **Power Shortcuts & Data Safety**: Clickable hotkey grid (`Ctrl+K`, `Ctrl+I`, `Ctrl+S`, `Alt+←`/`Alt+→`, `/`, `$$`) and 24h trash auto-purge protection.
- **First-Time Visitor Auto-Start**: Automatically triggers on initial visit if `localStorage.getItem("socratic_tutorial_completed")` is not set or via URL parameter `?tour=true`.
- **Settings & Command Palette Replay**: Re-triggerable anytime via the "Restart Tutorial" action card in Settings (General tab) or via Command Palette (`Ctrl+K` → "Open Onboarding Tutorial & Guide").

---

## 📂 Codebase Architecture

```
app/
  page.js                       Landing page (Server Component, CSS-only animations)
  workspace/page.js             Main SocraticOS application page (<Workspace />)
  visualizations/page.jsx       Standalone 3D visualizer studio page
  layout.js                     Root shell & pre-paint theme bootstrap script
  globals.css                   Site-wide CSS variables for Dark & Light themes, print rules
  api/
    explain/route.js            POST  Structured note explanation generator
    quiz/generate/route.js      POST  Diagnostic quiz builder
    quiz/grade/route.js         POST  Quiz grading & sub-topic heatmap emitter
    tutor/chat/route.js         POST  Interactive space-grounded AI Tutor chat
    calendar/events/route.js    Local-first calendar events route fallback
    visualizations/route.js     Local-first 3D visualization persistence route
    reset/route.js              Local-first database factory reset route

components/
  Workspace.jsx                 Primary workspace layout container, HUD header & shortcuts
  Sidebar.jsx                   Spaces selector, note list, 24h trash drawer, Settings modal
  BlockNoteEditor.jsx           19 block types, slash menu (/), 6-dots handles, covers & stats
  WebSaverView.jsx              Dual-pane Web Saver & Bookmark folder manager with Netscape HTML support
  AddBookmarkModal.jsx          Instant bookmark capture modal with live favicon preview
  NoteMenu.jsx                  Note options dropdown (Favorite ⭐, 3-Font Typography, Stats, Export, Delete)
  CommandPalette.jsx            Ctrl+K global fuzzy search modal
  InstantNoteModal.jsx          Ctrl+I 75% screen quick note capture window
  InteractiveTutorial.jsx       9-chapter interactive onboarding walkthrough modal with live sandboxes
  CalendarView.jsx              Study schedule calendar & recurring alarm scheduler
  GlobalTimerHUD.jsx            Unified top HUD multi-timer manager
  AlarmOverlay.jsx              Calming study break alert modal with gentle chime
  ThreeDView.jsx                3D visualization studio container & control HUD
  ExplainPanel.jsx              Structured LLM explanation drawer
  QuizPanel.jsx                 Graded quiz drawer & knowledge assessment runner
  ConfidenceHeatmap.jsx         Per-session sub-topic confidence heatmap
  MasteryDashboard.jsx          Aggregate topic mastery analytics dashboard
  ExportImportModal.jsx         .socratic, HTML Bookmarks, PDF, DOCX, HTML, TXT & MD export/import modal
  ExportPreview.jsx             Pre-download document preview for Word (.docx), HTML, Plain text & Markdown
  FeatureRequestModal.jsx       User feedback & feature request submission modal
  visualizations/
    PhysicsCanvas.jsx           Gas laws, optics, induction, refraction, motor effect engines
    ChemistryCanvas.jsx         Organic builder, lattices, electrolysis, distillation, Bohr atom
    BiologyCanvas.jsx           Cell explorer, DNA double helix, enzyme lock-and-key engines
    BinaryTree3D.jsx            3D binary search tree / AVL tree engine
    cell-organelles.jsx         Procedural 3D organelle geometry models
    VisualizationHUD.jsx        3D controls overlay & quiz dialogs
    scene-kit.jsx               Shared Three.js lighting, camera, grid & label helpers
    media.js                    Refractive index presets and optical material properties

lib/
  db.js                         Dexie.js IndexedDB storage client (v5) & hardware graphics detection
  storageService.js             Dexie CRUD service for notes, trash, calendar, alarms, sessions
  aiService.js                  Client-side AI orchestrator for Gemini API & personal API keys
  gemini.js                     Direct REST Gemini client with OpenAPI 3.0 schemas
  schemas.js                    Structured Gemini JSON response schemas
  exportImport.js               PDF, Word (.docx), HTML, TXT & Markdown converters
  backup.js                     .socratic JSON workspace & space backup packager
  timerStore.js                 Reactive global multi-timer store
  mastery.js                    Mastery scoring & sub-topic rollup algorithms
  syntaxHighlighter.js          Tokenization & syntax highlighting for 10 programming languages
  demoNotes.js                  Seeded demonstration study notes
  blocks.js                     BlockNote document transformation & extraction utilities

tests/
  unit/                         Physics solvers, AVL tree, export/import, mastery rollup, quiz grading, timers, syntax, tables
  integration/                  3D topic schemas, 24h trash purge, Dexie backup/restore
  e2e/                          Keyboard shortcuts (Ctrl+K/I/S), block editor flow, theme toggle, export & print

scripts/
  test-inlinemath-roundtrip.mjs Unit test for in-sentence LaTeX math export/import round-trips
```

---

## 🎨 Design System & Aesthetics

- **Theme Tokens**: Dark Mode (*Sleek Slate* `#12151e`) and Light Mode (*Warm Stone* `#eef2f6`) configured via dynamic CSS variables on `data-theme`.
- **Surfaces & Accents**: Primary background (`bg-ink-950`), cards (`bg-ink-900`), inputs (`bg-ink-850`), primary accent duck gold (`text-duck-300`, `bg-duck-500/20`), delete controls (`text-rose-400`, `bg-rose-500/15`).
- **Modal Layering & Stacking Context**: Stacking tiers (`z-[100]`, `z-[9999]`) prevent 3D canvas labels from bleeding into modal dialogs.

---

## 🛡️ Offline-First & Privacy Architecture

- **IndexedDB via Dexie.js**: Primary user data resides locally in the browser (`SocraticOS_LocalDB`).
- **Graceful Cloud Route Resiliency**: All API endpoints support local-first operation (`200 { success: true, offline: true, localFirst: true }`), enabling uninterrupted offline editing.
- **Client-Side API Key Storage**: Personal Gemini API keys are saved exclusively in IndexedDB (Dexie) and never transmitted to external servers.

---

## 🎓 Interactive Onboarding Walkthrough & Guide

SocraticOS features an interactive onboarding walkthrough (`components/InteractiveTutorial.jsx`) that starts automatically on a student's first visit (`localStorage.getItem("socratic_tutorial_completed")`) or when navigating to `?tour=true`:

- **9 Comprehensive Interactive Chapters**:
  1. **Philosophy & Active Retrieval**: Core cognitive science foundations and 100% local-first storage model.
  2. **19-Block Notion-Grade Studio**: Slash menu (`/`), 6-dots drag handles, KaTeX equations, and live 3-font typography switcher (`sans`, `serif`, `mono`).
  3. **AI Study Suite**: Structured Explain Panel (4-part breakdown) and live interactive mini-quiz sandbox with instant grading.
  4. **Quizzes Studio**: 2-column test runner, draft answer persistence, 7 question types, and interactive step ordering puzzle.
  5. **Space Hub & Document Grounding**: Multi-discipline spaces, custom syllabus uploads, and interactive curriculum standard personas.
  6. **3D Scientific Simulation Studio**: 27 interactive simulations across Physics, Chemistry, Biology, CS, and Mathematics.
  7. **Focus Hub & Pomodoro Cycles**: Study calendar, multi-timer HUD, and interactive Pomodoro cycle visualizer with tab title notification preview (`🦆` ↔ `❗️`).
  8. **Web Saver & Bookmark Manager**: Dual-pane folder trees, Google favicon resolvers, and Netscape HTML import/export.
  9. **Power Shortcuts & Bulk Operations**: Multi-note bulk actions, 24h auto-purging trash, note navigation history (`Alt+←`/`Alt+→`), and clickable shortcut pills.
- **Restart Anytime**: Re-open the tutorial at any time via **Settings $\rightarrow$ General $\rightarrow$ "Restart Tutorial"** or via the **Command Palette (`Ctrl+K`)**.

---

## 🧪 Test Suite & Verification

```bash
# Run all unit test suites
npm test
```
