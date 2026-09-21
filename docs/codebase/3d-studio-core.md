# 3D studio — architecture and HUD

> Part of the [SocraticOS codebase reference](../../CODEBASE_SUMMARY.md). How the studio, topic registry and HUD work. Per-subject scene descriptions are in the `3d-*.md` files.

### 🧪 C. Interactive 3D Visualization Studio (`components/ThreeDView.jsx`, `topics.js`, `VisualizationHUD.jsx`, `TopicSelectorDropdown.jsx`)
A comprehensive suite of **51 real-time interactive 3D simulations** across 5 STEM domains with a unified, distraction-free single top header, custom subject-separated `TopicSelectorDropdown` (with live search, discipline filter chips, and category groupings), dual-tab HUD (Controls & live Details readout with complete Visual Color Keys), resizable HUD panels (10%–80% viewport), speed-scaled physics engines (0.1×–3.0×), robust crash isolation via `<WebGLErrorBoundary />`, studio-wide `ACESFilmicToneMapping` with 2048×2048 shadow maps, and strict GPU lifecycle memory disposal:

6. **HUD Controls, Live Details Readout & Authoritative Visual Keys (`VisualizationHUD.jsx`)**:
   - **Docked Sidebar Architecture (Separate from 3D Viewport)**: Rendered side-by-side in a dedicated `flex-row` studio layout (`ThreeDView.jsx`), cleanly separating parameter controls and details from the 3D rendering space instead of floating as an obstructive overlay over the canvas. Legacy nested card borders (`rounded-xl border border-ink-800 shadow-2xl`) and outer margins are removed, so controls sit cleanly and directly within the solid rectangular sidebar panel.
   - **Toggleable Full-Space Viewport & Single Controls Trigger**: The sidebar is toggleable via the header action button (`X`), allowing the 3D canvas rendering space to expand to 100% full width. When collapsed, separate "Details" and "Key Concepts" buttons are removed in favor of a single elegant `[Controls]` button that reopens the sidebar, where students can switch between Controls and Details tabs.
   - Universal HUD header with category filters (Physics, Chemistry, Biology, CS, Math), parameter sliders, toggles, resets, and AI Explain & Quiz drawer integrations.
   - **Direct AI Explain, Quiz & Mastery Pipeline**: The "AI Concept Breakdown & Quiz" button in the HUD Details tab triggers `formatTopicStudyContext(topic, params)` to synthesize rich 3D topic details directly into the `ExplainPanel` drawer. Handover to `QuizPanel` ("🦆 Test me on this") generates dynamic AI questions and logs scores to the **Mastery Dashboard**.
   - **Universal Draggable Resizable HUD Panels**: Every 3D visualisation supports horizontal drag-to-resize sidebar controls from 10% (180px) to 80% screen width via grab bar and bottom-right corner grip, with persistent `localStorage` (`socratic_hud_panel_width`).
   - **Universal Animation Speed Slider**: Mounted directly below the tab switcher across animated 3D scenes (hidden via `topic.hideSpeedSlider` on Lenses and Orbits, which pace themselves; the Shadow Lab, Eye, Respiratory and Binary Tree scenes set `ownHud` and render their own controls), providing fine-grained $0.1\times$ to $3.0\times$ speed control (with paused/frozen states).
   - **Hardware Graphics Adaptation**: Device capability detection (`detectHardwareGraphics`) managing DPR (1.0–2.0), shadows, antialiasing, and dynamic `"demand"` vs `"always"` frameloops.
   - **Zen Focus Mode & Minimalist View**: 1-click toggle button (`Ctrl+Shift+F`) collapses the sidebar and hides top bars, leaving only an edge-to-edge canvas with a floating glassmorphic exit pill.

---
