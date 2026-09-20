# Design — 3D scene tokens: optics, fields and orbits

> Part of the [SocraticOS design system](../../DESIGN_SYSTEM.md). Refraction, ray optics, induction, projectile, gravity wells and the shadow lab (conventions 18–23).

18. **3D Wave Refraction & Optical Media Tokens (`PhysicsCanvas.jsx`, `media.js`)**:
    - **Optical Media Distinct Color Ramps**:
      - Air ($n = 1.0$): `#e0f2fe` (luminous ethereal sky white)
      - Ice ($n = 1.31$): `#67e8f9` (crisp glacial cyan)
      - Water ($n = 1.33$): `#0284c7` (deep luminous ocean cobalt)
      - Perspex ($n = 1.49$): `#c084fc` (vibrant optical acrylic violet)
      - Glass ($n = 1.50$): `#60a5fa` (bright optical crown blue)
      - Diamond ($n = 2.42$): `#fef08a` (radiant prism crystalline gold-yellow)
    - **Atmospheric Surrounding Medium Visibility**: Baseline opacity boosted to $0.12$ minimum (`clamp(0.12 + (n1 - 1) * 0.16, 0.12, 0.35)`), ensuring air and ambient environments are visually delineated from the canvas background.
    - **Refracting Block Luminescence**: Surface boundary lines reinforced at $2.8\text{ px}$ width (`0.95` opacity), edge cage opacity at `0.92`, and block mesh emissive intensity at `0.16`.

19. **3D Ray Optics Bench, Curved Mirrors & Lens Tokens (`PhysicsCanvas.jsx`, `scene-kit.jsx`)**:
    - **Optical Bench Track & Saddles (`OpticalRail`, `OpticalCarrier`)**:
      - Bench Track: Bright anodized laboratory aluminum rail (`#94a3b8`, metalness 0.55, roughness 0.35) with satin center channel (`#cbd5e1`), dual polished chrome guidance rails (`#f1f5f9`, metalness 0.95, roughness 0.10), and central gold zero-reference mark (`#fbbf24`).
      - Sliding Saddle Carriers: Precision sliding blocks in bright satin aluminum (`#cbd5e1`, metalness 0.70, roughness 0.30) with polished stainless steel clamp thumbscrews (`#f8fafc`, metalness 0.95, roughness 0.15) clamped beneath the object, optical element, and projection screen.
    - **Optical Glass Lenses (`DetailedOptic`)**:
      - Convex & Concave Elements: Lathe geometry with smooth bevel edge, high transmission glass material (`#a5f3fc`, opacity 0.34, roughness 0.05, metalness 0.12, emissive `#38bdf8` at 0.25).
      - Retaining Bezel Collar: Bright satin aluminum collar (`#cbd5e1`, metalness 0.75, roughness 0.25) with front/rear circular retention lips (`#e2e8f0`) and knurled brass top set screw (`#fbbf24`). Stray horizontal torus ring eliminated.
      - Vertical Support Post: Polished stainless steel rod (`#f8fafc`, metalness 0.95, roughness 0.15).
    - **Spherical Curved Mirrors with Calibrated Flush Casing (`DetailedOptic`, `mirrorProfile`)**:
      - Concave Mirror: Lathe dish curving from front rim at $X = 0$ to center bowl at $X = +0.16$ with silver front face (`#ffffff`, metalness 0.98, roughness 0.02, emissive `#e0f2fe` at 0.15). Fully enclosed by a cylindrical satin bezel ($X \in [-0.02, +0.22]$) with rear titanium protective plate (`#64748b` at $X = 0.215$).
      - Convex Mirror: Lathe dome cresting from apex at $X = -0.04$ to rim at $X = +0.12$. Held securely in a bezel casing ($X \in [0.05, 0.19]$) with rear protective plate at $X = 0.185$.
    - **Adaptive Vector Arrow Tokens (`VectorArrow` in `scene-kit.jsx`)**:
      - Eliminated hard cutoff pruning (`length < headLength * 1.1`).
      - Dynamic scaling: `effHeadLength = Math.min(headLength, length * 0.45)`, `effHeadRadius = Math.max(0.02, headRadius * (effHeadLength / headLength))`, `effRadius = Math.max(0.008, Math.min(radius, effHeadRadius * 0.45))`.
      - Short arrows of any diminutive length (e.g. $0.05\text{ cm}$ to $0.35\text{ cm}$) render with scaled heads and shafts without vanishing.
    - **Ray Construction Palette**:
      - Object: Radiant gold arrow (`#fbbf24`, `PALETTE.gold`).
      - Ray 1 (Parallel $\to$ Focus): Luminous emerald green (`#34d399`, `PALETTE.emerald`, lineWidth 2.4).
      - Ray 2 (Optical Center / Pole Reflection): Sky cyan (`#38bdf8`, `PALETTE.sky`, lineWidth 2.4).
      - Ray 3 (Focal Ray): Violet (`#a855f7`, `PALETTE.violet`, lineWidth 2.2).
      - Formed Image: Real image in solid emerald green (`#10b981`); virtual image in radiant rose (`#f43f5e`, `PALETTE.rose`, opacity 0.70).
      - Virtual Ray Extensions: Dashed construction lines (`opacity: 0.60`, `dashSize: 0.22`, `gapSize: 0.16`).
    - **Real Image Screen (`Screen`)**:
      - Frosted white projection diffuser card (`#f8fafc`, opacity 0.28, roughness 0.75) mounted on a bright stainless steel rod (`#f8fafc`) and satin bench carriage (`#cbd5e1`).

20. **3D Electromagnetic Induction & Faraday's Law Apparatus Tokens (`PhysicsCanvas.jsx`)**:
    - **Dual Apparatus Architecture**:
      - **AC Generator (Dynamo)**: Rotating rectangular copper loop in uniform field $B$ between permanent magnet poles with slip rings, brush contacts, live AC sinusoidal trace, and load indicators.
      - **Bar Magnet & Solenoid Coil**: Multi-turn copper solenoid wound on a transparent acrylic tube with an axial cylindrical bar magnet sliding along chrome guide rails, visualizing Lenz's Law and the $d\Phi/dt = 0$ stationary constraint.
    - **Live AC e.m.f. Top Sine Graph Waveform (`EmfTrace`)**:
      - Elevation: Mounted on top of the apparatus at `position={[0, 4.0, 0]}`, creating $0.8$ units of clear air above the generator magnet poles ($Y = 2.0$) and eliminating bottom viewport occlusion.
      - Graph Chrome: Midnight backing plate (`#0d121c` at $0.88$ opacity, border `#363d54`), horizontal center voltage zero line (`#525e76`), peak threshold dashed limit lines (`#334155`), and real-time scrolling sinusoidal trace in vibrant sky blue (`#38bdf8`, lineWidth 2.4).
      - Title & Scale Labels: Prominent title mounted above the graph grid at `position={[0, TRACE.height + 0.35, 0]}` ($Y = 5.25$, `#f8fafc`, font-bold), with dynamic peak voltage indicator ($\pm V_{\text{peak}}\text{ V}$).
    - **Laboratory Center-Zero Galvanometer (`LaboratoryGalvanometer`)**:
      - Chassis: Anodized slate aluminum enclosure (`#334155`, roughness 0.4, metalness 0.6).
      - Bezel & Dial: Polished chrome front bezel (`#e2e8f0`, metalness 0.9) with porcelain white dial face (`#f8fafc`, roughness 0.8).
      - Scale & Ticks: Center zero arc with graduation marks (`#64748b` / `#475569`, lineWidth 1.8), "+ / −" polarity markings, and brass center pivot cap (`#fbbf24`).
      - Needle: High-visibility pivoted red needle (`#ef4444`, emissive `#ef4444` at 0.90) dynamically tracking instantaneous e.m.f. with angular damping.
      - Stationary Anchor: Permanently positioned at $X = -1.3, Y = -3.30, Z = 1.35$ (right edge at $X = -0.2$), balanced beside the light bulb with fixed wiring leads.
    - **Demonstration Incandescent Light Bulb (`DemonstrationBulb`)**:
      - Socket Base: Ivory ceramic insulator block (`#f8fafc`, roughness 0.3) with threaded brass screw collar (`#d97706`, metalness 0.85, roughness 0.20) and brass binding posts (`#fbbf24`), standing upright on the bench in the foreground at fixed coordinates $X = 1.8, Y = -3.30, Z = 1.35$.
      - Glass Envelope: Blown glass envelope with physical transmission (`color: "#ffffff"`, transmission 0.88, roughness 0.12, opacity 0.38, ior 1.5).
      - Filament: Tungsten hairpin loop with perceptual non-linear voltage power scaling $\text{power} = \operatorname{clamp}((|\mathcal{E}| / V_{\text{rated}})^{1.6}, 0, 2.8)$ ($V_{\text{rated}} = 115\text{ V}$ generator, $85\text{ V}$ solenoid). Ramps dynamically from cold gray (`#64748b`) when unpowered to radiant orange (`#ea580c`), glowing gold, and brilliant incandescent white-hot (`#fef08a`, emissive intensity up to $7.5$) with localized `<pointLight>` intensity scaling from $0$ up to $9.0$ lumens.
    - **Lowered Laboratory Bench & Fixed Meter Anchoring (`LaboratoryBench`)**:
      - Elevation: Baseplate lowered to $Y = -3.48$ (tabletop surface flush at $Y = -3.30$, thickness $0.36$), bevelled edge molding (`#94a3b8`), and grounded rubber feet extending down to $Y = -3.70$.
      - Meter Decoupling & Wire Stability: Both `LaboratoryGalvanometer` ($X = -1.3, Y = -3.30, Z = 1.35$) and `DemonstrationBulb` ($X = 1.8, Y = -3.30, Z = 1.35$) maintain fixed coordinates regardless of `showBulb` state. Toggling the light bulb seamlessly mounts or unmounts the bulb without shifting the galvanometer or breaking wiring leads.
      - Riser Pedestal Flush Boundary: Pedestals extended to `boxGeometry args={[0.85, 1.7, 3.4]}` at $Y = -2.45$, meeting `MagnetPole` at $Y = -1.60$ flush with zero penetration. Central drive shaft extended to height $2.6$, guide rail stanchions to height $2.60$, and solenoid acrylic tube stanchions to height $3.50$.
    - **Laboratory Copper Coils & Rotor Apparatus (`RotatingCoil`)**:
      - Coil Windings: Metallic copper conductors (`#ea580c`, emissive `#fb923c` at 0.20, metalness 0.80, roughness 0.20) wound in $N$ stacked turns.
      - Axle & Slip Rings: Polished stainless steel drive axle (`#f1f5f9`, metalness 0.90, roughness 0.15) with dual polished brass slip rings (`#fbbf24`, metalness 0.88, roughness 0.18).
      - Brush Carriers: Lightened brass mounts (`#cbd5e1` / `#d97706`) with graphite contact blocks (`#475569`, roughness 0.70).
      - Translucent Flux Sheet: Planar rectangular sheet spanning coil aperture (`#38bdf8`, transparent, opacity $[0.04, 0.42]$ tracking $\Phi = B A \sin\theta$).
      - Circulating Charge Flow: 16 glowing charge carrier particles (`#fef08a`, emissive intensity 2.5) circulating along coil edges at speed $\propto \mathcal{E}(t)$.
    - **Bar Magnet & Solenoid Tokens (`SolenoidRig`)**:
      - Support Tube: Transparent acrylic core tube (`#e2e8f0`, opacity 0.22, transmission 0.85, roughness 0.10) held by twin anodized stanchions (`#94a3b8`).
      - Bar Magnet: Cylindrical magnet ($r=0.62$, $L=2.8$) with North pole (ruby red `#ef4444`), South pole (cobalt blue `#3b82f6`), and central chrome divider (`#f8fafc`), mounted on a guide rail sled.
      - 3D Dipole Field Loops: 6 curved elliptical field lines (`#38bdf8`, dashed, opacity 0.35) moving synchronously with the magnet.
      - Lenz's Law Vector: Emerald green arrow (`PALETTE.emerald`) dynamically appearing at solenoid center to indicate induced opposing magnetic field $\vec{B}_{\text{induced}}$.

21. **3D Projectile Motion & Air Resistance Apparatus Tokens (`PhysicsCanvas.jsx`)**:
    - **Upright Forward-Aiming Laboratory Cannon (`LaboratoryCannon`)**:
      - Elevation & Bore Alignment: Pivoting at $[0, \text{LAUNCH\_Y}, 0]$ with barrel tube extending forward along $+X$ ($X = 0$ to $X = +0.52\text{ m}$) towards the flight path. Front open muzzle bore with champagne gold crown ring (`#fde047`) and chrome bevel lip (`#ffffff`) points naturally up into the sky at elevation angle $\theta$. Closed hemispherical breech dome (`#f8fafc`) and chrome cascabel knob (`#ffffff`) seat at the rear $X \le 0$ inside the carriage cradle.
      - Ultra-Light Scientific Materials: Brilliant platinum barrel tube (`#f8fafc`, metalness `0.92`, roughness `0.12`) with dark graphite bore interior liner (`#334155`), sparkling champagne gold muzzle crown & reinforcement bands (`#fde047`, metalness `0.95`, roughness `0.14`), mirror chrome cascabel & trunnions (`#ffffff`), and light aluminum stanchion cheeks (`#cbd5e1`).
      - Protractor Elevation Quadrant: Crisp white dial (`#ffffff`) with laser-engraved $15^\circ$ interval ticks and glowing ruby angle pointer needle (`#ef4444`) tracking elevation angle.
    - **Single-Slab Zero-Z-Fighting Runway & Stratified Elevation Tiers (`DistanceRunway`, `LandingTarget`)**:
      - Zero Coplanar Overlap: Eliminates duplicate finish layer meshes; renders a single solid porcelain runway bed (`#f8fafc`, roughness `0.28`, metalness `0.18`) with satin aluminum curbs (`#cbd5e1`).
      - Hierarchical Depth Stacking: Runway deck ($Y = 0.280\text{ m}$), metric ticks ($Y = 0.282\text{ m}$ with `polygonOffset` factor `-1`), ideal vacuum landing ring ($Y = 0.285\text{ m}$ with `polygonOffset` factor `-2`), and active flight landing ring ($Y = 0.288\text{ m}$ with `polygonOffset` factor `-3`). Zero coplanar intersection across all camera zoom levels.
      - Spatial HTML Label Bands: Near curb ($Z = +0.38$) hosts metric graduations (`zIndexRange={[14, 5]}`), far curb ($Z = -0.38$) hosts landing distance badges (`zIndexRange={[25, 15]}`), apex hosts height marker (`zIndexRange={[40, 30]}`), and in-flight vector arrows host badges (`zIndexRange={[60, 45]}`).
    - **3D Label Visibility Toggle (`showLabels`)**:
      - Supports complete 1-click decluttering of all floating 3D labels (cannon elevation badge, force vector badges, apex altitude marker, runway metric ticks, landing target badges).
    - **60 FPS Zero-Latency Dynamic Force & Velocity Vectors (`updateVector`, `VectorMesh`)**:
      - Direct WebGL transform mutations on mesh refs inside `useFrame`, locked to ball coordinates $(ballX, ballY, 0)$ with zero React re-render overhead.
      - Dynamic Touchdown Hiding: Vectors automatically hide upon runway impact (`isFlying = running && t < flight.flightTime - 0.02`), preventing vector clustering or badge overlap over the landed ball and landing target.
      - Velocity Vector $\vec{v}$: Sky blue (`#38bdf8`, emissive `0.9`), tangential to instantaneous flight path.
      - Weight Force $\vec{W}$: Rose (`#fb7185`, emissive `0.9`), constant downward gravity ($m\cdot g$).
      - Drag Force $\vec{F}_{\text{drag}}$: Amber gold (`#fbbf24`, emissive `1.1`), quadratic atmospheric resistance opposing velocity ($F_d = -k |v| \vec{v}$).
      - Net Resultant Force $\vec{F}_{\text{net}}$: Emerald green (`#34d399`, emissive `1.0`), vector sum $\vec{W} + \vec{F}_{\text{drag}}$.
    - **Debounced Slider Interaction**:
      - Removed component remount `key` and decoupled `MuzzleBlast` from `angleDeg`. Parameter updates feature a 320ms settle debounce, enabling real-time 60 FPS slider trajectory morphing without stuttering or strobe flashes.

22. **3D Gravity Wells & Orbital Motion Design Tokens (`PhysicsCanvas.jsx`, `topics.js`)**:
    - **Spacetime Potential Sheet Wireframe**: Sky blue (`#38bdf8`, opacity `0.2`) on $14\text{ m} \times 14\text{ m}$ plane grid. Depth profiles as $-GM / \max(r, 0.9) + GM / R_{\text{half}}$ with smooth vertex normal shading.
    - **Banked Perimeter Retaining Lip & Containment Ring**:
      - Funnel Lip: Quadratic elevation curvature ($+0.35\text{ m}$ rise) starting at $r = 5.8\text{ m}$ to the perimeter ($r = 7.0\text{ m}$).
      - Luminous Containment Ring: Thin neon sky cyan double-sided ring (`#38bdf8`, opacity `0.45`, radius $6.68\text{ m}$–$6.82\text{ m}$) marking the outer boundary of the potential well.
    - **Symplectic Banked Rim Containment**:
      - Preserves tangential angular momentum while restoring radial velocity inward via $k_{\text{rim}} = 32.0$ restoring acceleration and radial momentum redirection.
      - Keeps high-speed satellites ($v \ge v_{\text{escape}}$) contained inside the potential well, transforming open escape trajectories into smooth perimeter rim banks.
    - **Apparatus & Celestial Bodies**:
      - Central Mass: Glowing gold sphere (`#fbbf24`, emissive intensity `1.8`) with atmospheric halo ring (`#fbbf24`, opacity `0.1`).
      - Orbiting Satellite: Machined glowing emerald beacon (`#34d399`, emissive intensity `1.4`) with non-wrapping smooth FIFO line trail (`#34d399`, opacity `0.7`).

23. **3D Light, Shadows & Straight Lines Optical Bench Design Tokens (`ShadowLabCanvas.jsx`, `lib/shadowOptics.js`)**:
    - **Scientific Optical Bench Apparatus**:
      - Bench Bed: Ruled metric optical bench in brushed aluminum (`#8c9cb3`, metalness `0.1`, roughness `0.65`).
      - Pedestal Posts: Matte slate column (`#39414f`, metalness `0.4`, roughness `0.6`) on weighted bevelled base (`#2c3340`), with dynamic anti-clipping elevation clearance $\Delta y = \max(H, H|\cos\theta| + R|\sin\theta|) + 0.4\text{ cm}$ and articulated center spindle.
    - **Detailed Light Sources (`LightSource`)**:
      - Pinpoint Torch: Dark gunmetal barrel (`#1e293b`, metalness `0.7`, roughness `0.45`) with triple ribbed knurled grip rings (`#0f172a`), stepped tailcap (`#334155`) with red click switch (`#ef4444`), stepped brass retaining collar (`#d4af37`, metalness `0.85`, roughness `0.25`), specular chrome parabolic reflector dish (`#f8fafc`, metalness `0.96`, roughness `0.08`), transparent convex optical glass lens disc (`#e0f2fe`, transmission `0.85`, opacity `0.35`, ior `1.5`), and radiant tungsten filament emitter (`#fffbe8`, emissive `#ffe9a8`, emissiveIntensity `3.4`).
      - Wide Troffer Lamp: Formed industrial sheet metal reflector hood (`#1e293b`, metalness `0.5`, roughness `0.6`) with polished aluminum inner trough liner (`#cbd5e1`, metalness `0.85`), twin angled tubular stanchion yoke struts (`#334155`, metalness `0.7`), molded ceramic bi-pin socket end caps (`#475569`) with brass terminal rings (`#d4af37`), frosted fluorescent diffuser tube (`#fef9c3`, emissive `#fef08a`, emissiveIntensity `2.5`), and glowing cathode core wire (`#ffffff`, emissive `#fffbeb`, emissiveIntensity `3.5`).
    - **3D Test Objects & Shelf Registry (8 Shapes)**:
      - Cylindrical Rod, Cube, Upright Cone, Sphere, Torus Ring, 4-Sided Square Pyramid, Letter T, Letter L.
      - Torus Ring: Annular torus mesh casting a donut shadow with a clear light aperture at $0^\circ$ and a solid rectangular bar at $90^\circ$ edge-on.
      - Square Pyramid: 4-sided pyramid transitioning from a triangular silhouette at $0^\circ$ to a square base silhouette at $90^\circ$.
      - Letter L: Correctly oriented standard upright "L" across 3D solid, 3D projection screen, and 2D HUD preview card.
    - **Projection Screen & Shadow Rendering Engine**:
      - Illumination: Inverse-square law $1/d^2$ throw factor with $\cos^3\theta$ angular falloff creating authentic radial vignetting on paper texture.
      - Measuring Grid: Ruled $10\text{ cm}$ grid lines (`rgba(96,110,132,0.30)`) with high-contrast optical axis crosshair (`rgba(96,110,132,0.55)`).
      - Measuring Guides: Gold dashed lines (`rgba(251,191,36,0.85)`) for full umbra boundary; cyan dashed lines (`rgba(56,189,248,0.80)`) for outer penumbra boundary.
      - Smooth Continuous Morphing: Continuous corner rounding $r = \min(w, h) \cdot \sin(\theta)$ eliminating harsh step transitions during cylinder and cone rotation.
