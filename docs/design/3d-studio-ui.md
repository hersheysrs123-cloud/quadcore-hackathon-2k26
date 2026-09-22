# Design — 3D studio interface

> Part of the [SocraticOS design system](../../DESIGN_SYSTEM.md). Diagram tokens, contextual controls, sidebar resizing, respiratory tokens, model credits modal and the topic selector (sections 21–24, 27 and convention 15).

### 21. Physics Diagram Tokens (`force-diagram.jsx` / `energy-bars.jsx`)

Two shared modules own the colour vocabulary for the mechanics scenes, so the same quantity is the same colour in every scene, in its in-scene arrow, in its bar and in the HUD's Details colour key.

- **Free-body forces** (`FORCE_COLOURS`): Weight `#fb7185` (rose) · W∥ = mg sinθ `#fb923c` (orange) · W⊥ = mg cosθ `#a78bfa` (violet) · Normal `#38bdf8` (sky) · Friction `#2dd4bf` (teal) · Applied `#fbbf24` (gold) · Resultant `#34d399` (emerald) · Elastic limit `#f43f5e`.
  - The two components of the weight are deliberately different hues from each other but both warm, so they read as halves of the red weight vector they were resolved from.
- **Energy & work stores** (`ENERGY_COLOURS`): GPE `#a78bfa` (violet) · KE `#38bdf8` (sky) · Thermal / wasted `#fb7185` (rose) · Work in `#fbbf24` (gold) · Work out `#34d399` (emerald) · Total `#e8ebf0` (bone).
- **Arrow scaling**: `useForceScale` normalises the largest force in a diagram to a fixed 1.75 world units. Fixing the scale instead sends arrows off-screen when the mass slider moves; scaling each arrow to its own length destroys the comparison a free-body diagram exists for.
- **Panel chrome**: instrument backings are `#0d121c` at `0.88`–`0.90` opacity; gridlines and axes use `PALETTE.line` / `PALETTE.slate`; every panel is titled with an `accent` `SceneLabel` and captioned with a `text-ink-400` one.
- **`DialGauge`**: 240° sweep, needle in the series colour, and an optional `redline` arc in the thermal rose — a reading past the redline recolours the needle, so a dangerous value says so without a caption.

### 22. Contextual Controls in the HUD Schema (`when`)

A topic's `controls` entry may carry `when: (params) => boolean`. `VisualizationHUD` filters on it before rendering, so a control that only applies to one of a topic's modes is hidden rather than shown inert — the simple-machines bench swaps its fulcrum-position slider for a sheave count when the machine type changes to the block and tackle. Controls without a `when` are always shown, so the field is fully backwards-compatible.

### 23. Universal 3D Visualization Sidebar Controls Resizability Standard
All 3D interactive visualizations across SocraticOS (including shared `VisualizationHUD.jsx`, dedicated `ShadowLabCanvas.jsx`, `EyeCanvas.jsx`, `BinaryTree3D.jsx`, and `RespiratoryCanvas.jsx`) implement a unified, responsive drag-to-resize sidebar pattern:
- **Docked Flex-Row Layout**: The sidebar sits as a dedicated `<aside>` flex item alongside the WebGL viewport `<main className="relative flex-1 h-full w-full min-w-0 min-h-0">`, ensuring the rendering space is physically separated from controls rather than occluded by a floating overlay. The legacy nested card border (`rounded-xl border border-ink-800 shadow-2xl`) has been removed, so controls reside directly in the sleek full-height rectangular sidebar container (`border-r border-ink-800 bg-ink-900/95`).
- **Toggleable Full-Space Viewport**: Collapsing the sidebar via the header action button (`X`) unmounts the sidebar from the layout flow, allowing the 3D rendering canvas to seamlessly expand to 100% full width.
- **Single Controls Toggle Trigger**: When collapsed, legacy separate "Details" and "Key Concepts" buttons are removed in favor of a single floating `[Controls]` button (`absolute left-4 top-4 z-20`) on the canvas. When pressed, the sidebar expands, and users can switch tabs between "Controls" and "Details" directly in the header tab switcher.
- **Panel Width Range**: Dynamically clamped between `Math.max(180, Math.floor(window.innerWidth * 0.10))` (minimum 10% viewport / 180px) and `Math.floor(window.innerWidth * 0.80)` (maximum 80% viewport).
- **Persistent Width Storage**: Persisted under `localStorage.getItem("socratic_hud_panel_width")` with SSR-safe initial mount fallback (286px–300px).
- **Right Edge Drag Handle**: `cursor-ew-resize` pill element (`h-14 w-1 rounded-full bg-ink-700/50 group-hover:bg-duck-400/80 group-hover:h-20`) with active drag scaling (`bg-duck-400 shadow-md scale-y-110`).
- **Bottom-Right Corner Grip Indicator**: `cursor-nwse-resize` 3-dot SVG grip pattern (`text-ink-600 hover:text-duck-400`).
- **Scroll Container**: Inner content is encased in a flex column with `overflow-y-auto p-3` preventing viewport overflow.

### 24. 3D Respiratory Mechanics & Thoracic Physics Tokens
- **Antagonistic Intercostal Tension (gauges only)**: The intercostal muscle meshes and their tension shaders were removed to keep the scene light, along with the layer-isolation selector. The antagonistic pair is now shown as two live tension gauges fed by `muscleStates()` in `lib/respiratory.js`: external intercostals contract on inspiration, internal intercostals on forced expiration.
- **Diaphragm Dome Architecture**:
  - Muscular Rim: Deep crimson (`#881337`) with PBR striated myofibril texture, morphing downwards dynamically during active contraction ($Y = 1.05 \to 0.63$), recoiling into an elevated high dome.
  - Central Tendon (*Centrum Tendineum*): Pearly glistening collagen aponeurosis disc (`#f8fafc`) with trifoliate cloverleaf anatomy (anterior, right, and left leaflets).
  - Anatomical Apertures: Caval foramen (T8), esophageal hiatus (T10), and aortic hiatus (T12) with bilateral lumbar crura anchoring into L1–L3.
- **Dynamic Airway Particle Vectors**:
  - Inflow Stream: Crisp sky blue (`#38bdf8`, emissive `1.8`) representing fresh ambient oxygenated air streaming down trachea into bronchi.
  - Outflow Stream: Warm amber gold (`#fbbf24`, emissive `1.8`) representing expired carbon dioxide streams moving upward and out.
- **Real-Time Synchronized SVG Physics Gauges**:
  - Thorax Volume (L): Gradient fill `from-duck-500 via-emerald-400 to-sky-400` with vertical resting FRC marker line (`2.8 L`).
  - Intra-Thoracic Pressure $\Delta P$ (kPa): Bi-directional bar centered at atmospheric zero ($0\text{ kPa}$). Sub-atmospheric vacuum spans left in sky blue (`bg-sky-500`); positive compression spans right in rose (`bg-rose-500`).
  - Air Flow Rate $\dot{V}$ (L/s): Real-time vector meter displaying instantaneous volumetric flow velocity into or out of the lungs.
- **3D Kinematic Motion Arrows**:
  - Ribcage displacement vectors: `PALETTE.rose` (elevation & bucket-handle expansion) vs `PALETTE.sky` (recoil depression).
  - Sternal pump-handle vector: `PALETTE.gold` anteroposterior lift.

### 27. 3D Model Credits & Open-Source Attribution Modal (`RespiratoryCanvas.jsx`)
- **Quick-Access Floating Pill Button**:
  - Container / Placement: `absolute top-3 right-3 z-20 pointer-events-auto`.
  - Styling: `flex items-center gap-1.5 rounded-lg border border-ink-800/90 bg-ink-900/90 px-2.5 py-1.5 text-xs font-semibold text-ink-300 shadow-xl backdrop-blur-md transition-all hover:border-duck-500/50 hover:bg-ink-850 hover:text-duck-300 cursor-pointer`.
- **HUD Header Credits Trigger**:
  - Inactive State: `border-ink-700 bg-ink-800 text-ink-400 hover:text-ink-200 hover:border-ink-600`.
  - Active / Open State: `border-duck-500/50 bg-duck-500/20 text-duck-300`.
- **In-HUD Deep Link**:
  - Styling: `pt-2 border-t border-ink-800/60 flex items-center justify-between text-[10px] text-ink-400` with action link `text-duck-400 hover:text-duck-300 hover:underline font-semibold cursor-pointer`.
- **Credits Modal Backdrop & Dialog**:
  - Backdrop: `fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-ink-950/80 backdrop-blur-sm animate-fade-in`.
  - Dialog Frame: `relative w-full max-w-xl max-h-[88vh] flex flex-col rounded-2xl border border-ink-700/80 bg-ink-900/98 shadow-2xl backdrop-blur-xl text-ink-100 overflow-hidden animate-scale-in`.
  - Header: `flex items-start justify-between gap-3 border-b border-ink-800 px-5 py-4 shrink-0 bg-ink-900`.
  - Open Source Badge: `rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-300`.
- **Attribution Cards**:
  - Card Box: `rounded-xl border border-ink-800 bg-ink-850/70 p-3.5 transition-colors hover:border-ink-700`.
  - Semantic License Badges:
    - CC-BY-4.0 & MIT: `bg-sky-500/15 text-sky-300 border-sky-500/30`.
    - CC-BY-4.0 (Commercial Permitted): `bg-emerald-500/15 text-emerald-300 border-emerald-500/30`.
    - Original Shader / Kinematics (Commercial Permitted): `bg-purple-500/15 text-purple-300 border-purple-500/30` / `bg-rose-500/15 text-rose-300 border-rose-500/30`.
  - Outbound Links: Dual links to original Sketchfab artists and GitHub hosting repositories with `ExternalLink` icon and `target="_blank" rel="noopener noreferrer"`.
- **Accessibility & Dismissal**:
  - Dismissible via top-right `X` icon, bottom `Close Credits` button, backdrop click, or native `Escape` key event listener.

15. **3D Studio Single Top Bar & TopicSelectorDropdown Architecture (`TopicSelectorDropdown.jsx`)**:
    - **Single Distraction-Free Header**: Eliminates redundant secondary horizontal category scroll strips, maximizing viewport height for 3D canvases across both Workspace and `/visualizations` routes.
    - **Trigger Button Design Tokens**:
      - Shell: `rounded-xl border py-1.5 pl-2.5 pr-3 text-xs font-semibold cursor-pointer select-none transition-all`.
      - Closed State: `border-ink-700 bg-ink-850 text-ink-100 hover:border-duck-500/40 hover:bg-ink-800 shadow-sm`.
      - Active/Open State: `border-duck-500/60 bg-ink-800 text-duck-300 ring-2 ring-duck-500/20 shadow-md`.
      - Discipline Badge: `rounded-md bg-ink-900/90 px-1.5 py-0.5 text-[10.5px] font-bold text-ink-300 border border-ink-800 shadow-inner shrink-0` showing subject emoji + capitalized title.
      - Topic Title: Truncated max-width (`max-w-[160px] sm:max-w-[220px] md:max-w-[280px]`) accompanied by rotating chevron (`transition-transform duration-200`).
    - **Dropdown Popover Design Tokens**:
      - Shell: `w-[340px] sm:w-[420px] rounded-2xl border border-ink-750 bg-ink-900/98 shadow-2xl backdrop-blur-2xl z-50 ring-1 ring-black/40 overflow-hidden`.
      - Search Input Header: `p-2.5 border-b border-ink-800 bg-ink-900/90` with embedded `Search` and clear `X` buttons, `bg-ink-950/80 border-ink-750 text-xs text-ink-100 placeholder:text-ink-500 focus:border-duck-500/50`.
      - Subject Quick-Filter Pills: Horizontal pill strip (`bg-ink-950/50 border-b border-ink-800/80 px-2.5 py-1.5`) supporting 1-click discipline filtering:
        - Active Pill: `bg-duck-500/20 text-duck-300 border border-duck-500/50 shadow-sm`.
        - Inactive Pill: `text-ink-400 hover:text-ink-200 hover:bg-ink-850 border border-transparent`.
      - Sticky Discipline Headers: `sticky top-0 z-10 bg-ink-900/95 backdrop-blur-md border-b border-ink-800/80 px-3 py-1.5 text-[11px] font-bold text-ink-300 shadow-sm` with model count badge (`bg-ink-800/80 px-2 py-0.5 rounded-full border border-ink-700/60`).
      - Topic Item Rows: `group flex w-full items-center justify-between gap-3 px-3 py-2 text-left cursor-pointer transition-all`:
        - Active Option: `bg-duck-500/15 border-l-2 border-duck-400 text-duck-200` with `Check` icon in `text-duck-400`.
        - Inactive Option: `hover:bg-ink-850/80 text-ink-300 hover:text-ink-100 border-l-2 border-transparent`.
      - Popover Footer: `px-3 py-2 border-t border-ink-800 bg-ink-950/70 text-[10px] text-ink-500` displaying model counts across 5 disciplines and `Esc to close` shortcut hint.
