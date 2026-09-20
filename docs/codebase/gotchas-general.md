# Developer gotchas — general

> Part of the [SocraticOS codebase reference](../../CODEBASE_SUMMARY.md). Gotchas 1–14: theme flash, hydration, seeding, WebGL cleanup, print/PDF, error boundaries and more. Per-scene gotchas are in [gotchas-3d-physics-scenes.md](gotchas-3d-physics-scenes.md).

## ⚙️ 6. Critical Developer Gotchas & Best Practices

1. **Pre-Paint Theme Flash Prevention**:
   - `app/layout.js` executes an inline synchronous `<script>` in `<head>` reading `localStorage.getItem("socratic_theme")` and setting `data-theme="light"` before initial paint, preventing theme flashing.
2. **SSR Hydration Guard**:
   - Always wrap client-only browser storage access (`localStorage`, `window`) inside a mounted state guard (`const [mounted, setMounted] = useState(false); useEffect(() => setMounted(true), []);`).
3. **Demo Note Seeding Flag, Non-Destructive Scope & Deletion Persistence**:
   - Seeding is gated by `DEMO_SEED_KEY = "socratic_demo_seeded_v14"` in `lib/db.js` and user deletion tombstones in `socratic_deleted_notes`. Both `resetNotesData()` and `factoryResetWorkspace()` write this exact key and clear tombstones to prevent demo notes from re-seeding immediately after a deliberate user reset.
   - `initAndSeedDatabase()` and `seedDemoContent()` operate non-destructively and strictly on notes: they never seed or modify Web Saver folders/bookmarks, and never call `db.notes.clear()` or delete existing user notes. User custom notes are 100% preserved. Missing demo notes are inserted, while any note ID recorded in `socratic_deleted_notes` is strictly skipped to prevent deleted demo notes from resurrecting on browser reload.
   - `Workspace.jsx` guards automatic fallback seeding so that deliberate note deletions or an intentionally empty workspace will never trigger unwanted re-seeding.
   - In `components/Sidebar.jsx`, "🌱 Restore Seed Notes" calls `seedDemoContent({ overwrite: false })`, which clears `socratic_deleted_notes` to allow users to explicitly restore sample notes on demand without touching custom notes or bookmarks.
4. **URL Protocol Normalization**:
   - Always wrap external URLs with `formatUrl(url)` before passing to `href` or `src` attributes to prevent relative path redirection (`http://localhost:3000/google.com`).
5. **Next.js Dev Cache Corruption**:
   - If running `npm run build` concurrently while a server is active on port 3000, Next.js chunk cache can become corrupted (`MODULE_NOT_FOUND`). Always terminate active port 3000 processes before running `npm run build`.
6. **WebGL Cleanup, Deep Material Cloning & Frameloop**:
   - Always clean up Three.js materials, procedural canvas textures (`.dispose()`), and geometries on component unmount across all object types (`isMesh || isLine || isPoints`) and restore `document.body.style.cursor = "auto"`.
   - In `scene-kit.jsx`, `WebGLCleanup` traverses materials and unbinds and disposes all texture properties (`map`, `normalMap`, `roughnessMap`, `envMap`, etc.).
   - When customizing materials on cloned GLTF models (`scene.clone(true)`), Three.js does NOT clone materials by default. Always clone `child.material` on traversal before mutating `.opacity` or `.transparent` to avoid corrupting shared cached GLTF assets.
   - Guard `useFrame` callbacks with `Math.min(rawDelta, 1 / 30)` to avoid delta explosion and object teleportation when returning from a backgrounded browser tab.
   - Throttled state updates (such as `StrokeClock` or motion samplers) should be throttled to 24–30 Hz with threshold checks to prevent 60–144 Hz React state thrashing and geometry rebuilds.
7. **Test Suites**:
   - Run `npm test` to execute all unit tests across the entire test suite.
8. **PDF Export & Chromium Print Canvas Dark Mode Reset**:
   - In Chromium/Blink, when printing while the web app is in dark mode, the `@page` margin box (`margin: 1.2cm 1.5cm`) is painted using the root canvas background color (`--color-ink-950`: `#12151e`), creating an unsightly black border framing the printed sheet.
   - Always guarantee pure white pages edge-to-edge by keeping `color-scheme: light !important; background-color: #ffffff !important;` on `:root, html, body` and `@page` in `@media print` (`app/globals.css`), overriding `--color-ink-950` to `#ffffff !important`, and having `exportToPdf()` (`lib/exportImport.js`) temporarily set `document.documentElement.style.colorScheme = "light"` before invoking `window.print()`.
9. **Print / PDF Block Specificity & Toggle Disclosure Alignment**:
   - In `@media print` (`app/globals.css`), avoid generic `input[type="text"]:first-of-type` selectors inside `[data-editor-root]` because they match nested `<input>` children such as media block captions (`data-media-caption="true"`), causing them to explode to 22pt title sizes. Use explicit attribute selectors (`input[data-note-title="true"]`).
   - In toggle collapsible blocks, the print disclosure chevron (`▼`) is centered directly over the 3px vertical accent line of the expanded details container (`border-left: 3px solid #cbd5e1` at `margin-left: 14pt`) by setting `margin-left: 10.5pt !important;` on `[class*="group/toggleblk"] > div:first-child span:first-child`, achieving 0.16px centered alignment.
10. **3D Visualization Studio Canvas Clear Colour (`CANVAS_BG = "#273043"`, `PALETTE.line = "#525e76"`)**:
    - WebGL scenes cannot read dynamic CSS variables in shader pipelines. The clear color in `scene-kit.jsx` is calibrated to `#273043` (mid-tone studio slate) to provide rich contrast and depth for 3D meshes, atoms, and rays in Dark Mode without harsh glare, while avoiding a stark pitch-black void in Light Mode. Applied uniformly across `ThreeDView.jsx`, `app/visualizations/page.jsx`, and `BinaryTree3D.jsx`.
11. **Editor Lasso Marquee & Side Margin Click Boundary Safety**:
    - When clicking on side margins or dragging marquee selection boxes, `data-editor-root` and `handleGlobalMouseUp` check `justFinishedMarquee.current` and verify whether clicks are vertically below `lastRect.bottom` before appending or focusing blocks. Clicks on side margins or following lasso selections never jump to the last block, strictly honoring the `clickToAppend` setting.
12. **React Dynamic Component Hook Rules (`InteractiveTutorial.jsx`)**:
    - When rendering dynamically selected components containing React hooks (such as tutorial chapters or step renderers in `TUTORIAL_STEPS`), NEVER execute them as plain function calls (`{step.render({...})}`). Calling functions with hooks executes them in the outer component's fiber, causing hook count mismatches (React Error #310) when switching between steps with different hook counts. Always render as a JSX element (`<StepComponent key={step.id} {...props} />`), which allocates an isolated child fiber and cleanly unmounts and remounts state on step transitions.
13. **App Router Error Boundaries & Build Artifact Integrity (`app/error.jsx`, `app/global-error.jsx`, `app/not-found.jsx`)**:
    - In Next.js 15 projects using exclusively the App Router, always provide explicit App Router error boundaries (`app/not-found.jsx`, `app/error.jsx`, `app/global-error.jsx`). Without explicit App Router error files, Next.js defaults to Pages Router fallback static generation, which triggers an `ENOENT: rename export/500.html -> server/pages/500.html` error on Windows platforms where the `server/pages/` directory does not exist.
14. **3D Studio Analytical Fourier Discontinuities & Camera View Rig (`MathCanvas.jsx`)**:
    - When drawing discontinuous target wave functions (Square, Sawtooth) in Three.js line strips, never sample $\operatorname{sgn}(\sin(\dots))$ or modulo across fixed spatial grid vertices. Fixed sampling causes vertical edges to render as slanted ramps that snap discretely across grid intervals, resulting in severe vibration and jitter at low speed. Instead, compute the exact floating-point discontinuity coordinates $x_m = \text{CIRCLE\_X} + (\theta - \text{offset}) / \text{WAVE\_K}$ and emit exact vertical step pairs $(x_m, y_{\text{prev}}) \to (x_m, y_{\text{next}})$.
    - For 1-click orthogonal camera view transitions (Front, Top, Barrel, Iso), use an in-canvas `<CameraRig>` that lerps both `camera.position` and `controls.target` smoothly with exponential damping (`1 - Math.exp(-delta * 6.5)`), syncing `controls.update()` each frame to allow seamless orbital takeover by the user.
