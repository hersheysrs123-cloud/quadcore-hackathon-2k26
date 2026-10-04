"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import * as THREE from "three";
import { Bond, PALETTE, SceneCanvas, SceneLabel, clamp, lerp } from "@/components/visualizations/scene-kit";
import { BOND_COLOUR } from "@/lib/lattices";
import { ElectronMark, Kernel, ShellRing } from "@/components/visualizations/electron-shells";
import { BONDING_COLOURS, diagramShellRadius, ionicFormation } from "@/lib/bonding";
import { SHELL_NAMES } from "@/lib/atomicStructure";

// ─── Ion formation ──────────────────────────────────────────────────
// The lattice topic's prequel: where the ions in an ionic lattice come from.
//
// The atoms stand in a row as flat dot-and-cross diagrams — the metal's
// electrons dots, the non-metal's crosses, so you can always see whose
// electron is whose. One press plays it through:
//
//   1  each outer electron of the metal glows
//   2  one by one they fly, along a dashed arc, into the gap waiting for
//      them on the non-metal's outer shell (`lib/bonding.js` keeps that gap
//      facing the atom the electron comes from)
//   3  the metal's emptied outer shell fades away: what is left is a full
//      shell, and the ions get their brackets and charges
//   4  the ions pull together — the attraction IS the bond
//   5  sodium chloride and magnesium oxide then grow the rock-salt lattice
//      out of that ion pair; the others show why their formula has the
//      ratio it does, with the charges adding to zero
//
// Every position is written per frame; the stage index is the only state.
// ─────────────────────────────────────────────────────────────────────

const FORM_SECONDS = 14;
/** Stage boundaries, as fractions of the run. */
const T = { intro: 0.08, transfer: 0.46, fade: 0.56, attract: 0.7, lattice: 0.76 };
const ELECTRON = 0.11;
/** How the lattice's balls are sized: a share of the cation–anion distance, split in the real radius ratio. */
const BALL_SHARE = 0.46;
/** Ionic radii, pm (Shannon, six-coordinate). */
const ION_RADIUS_PM = { Na: 102, Mg: 72, Cl: 181, O: 140 };

const smooth = (t) => {
  const c = clamp(t, 0, 1);
  return c * c * (3 - 2 * c);
};
const span = (p, a, b) => smooth((p - a) / (b - a));

/** A point on the quadratic Bézier a → c → b. */
function bezier(out, a, c, b, t) {
  const u = 1 - t;
  out.set(u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1], u * u * a[2] + 2 * u * t * c[2] + t * t * b[2]);
  return out;
}

/** Square brackets around an ion of ring radius r, as two polylines. */
function bracketPoints(r) {
  const h = r + 0.22;
  const x = r + 0.3;
  const serif = 0.22;
  return [
    [[-x + serif, h, 0], [-x, h, 0], [-x, -h, 0], [-x + serif, -h, 0]],
    [[x - serif, h, 0], [x, h, 0], [x, -h, 0], [x - serif, -h, 0]],
  ];
}

/** Frames the row of atoms, then (for a rock-salt run) the lattice. */
function FitCamera({ halfWidth, halfHeight }) {
  const camera = useThree((s) => s.camera);
  const aspect = useThree((s) => s.size.width / Math.max(s.size.height, 1));
  const goal = useRef(null);
  useEffect(() => {
    const tanHalf = Math.tan((camera.fov / 2) * (Math.PI / 180));
    goal.current = Math.max(halfHeight / tanHalf, halfWidth / (tanHalf * aspect)) * 1.08;
  }, [camera, halfWidth, halfHeight, aspect]);
  useFrame((_, delta) => {
    if (goal.current === null) return;
    // A floor on the step, so a starved frame clock cannot leave the camera parked mid-ease.
    const next = lerp(camera.position.length(), goal.current, Math.min(1, Math.max(delta, 1 / 60) * 2.5));
    camera.position.setLength(next);
    if (Math.abs(next - goal.current) < 0.01) goal.current = null;
  });
  return null;
}

/** The run: the diagram, the transfers, and (for rock salt) the lattice it grows into. */
function Formation({ info, token, speed, Label, onStage }) {
  const progress = useRef(-1);
  const seen = useRef(token);
  const [stage, setStage] = useState(-1);
  const stageRef = useRef(-1);
  const content = useRef(null);
  const atomRefs = useRef([]);
  const ringRefs = useRef([]);
  const electronRefs = useRef([]);
  const pathRefs = useRef([]);
  const bracketRefs = useRef([]);
  const diagram = useRef(null);
  const ballRefs = useRef([]);
  const rodRefs = useRef([]);
  const pairHalo = useRef(null);
  const scratch = useMemo(() => new THREE.Vector3(), []);
  const rockSalt = info.compound.rockSalt;
  const end = rockSalt ? 1 : T.lattice + 0.02;

  const report = (next) => {
    if (next === stageRef.current) return;
    stageRef.current = next;
    setStage(next);
    onStage?.(next);
  };

  // A press starts a run; the token seen at mount does not.
  useEffect(() => {
    if (token === seen.current) return;
    seen.current = token;
    progress.current = 0;
    report(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);
  // A new compound starts again from the atoms.
  useEffect(() => {
    progress.current = -1;
    report(-1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [info]);

  // The arcs the transferred electrons fly along: up and towards the camera,
  // alternating above and below when several leave one atom.
  const flights = useMemo(() => {
    const n = info.transfers.length;
    const window = T.transfer - T.intro;
    const duration = Math.min(0.16, window * 0.6);
    const stagger = n > 1 ? (window - duration) / (n - 1) : 0;
    return info.electrons
      .map((e, i) => ({ e, i }))
      .filter(({ e }) => e.step !== null)
      .map(({ e, i }) => {
        const a = [...e.start, 0];
        const b = [...e.arrival, 0];
        const lift = (e.step % 2 === 0 ? 1 : -1) * (1.1 + 0.25 * Math.floor(e.step / 2));
        const c = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + lift, 1.2];
        const pts = [];
        const v = new THREE.Vector3();
        for (let k = 0; k <= 40; k += 1) pts.push(bezier(v, a, c, b, k / 40).toArray());
        const t0 = T.intro + e.step * stagger;
        return { index: i, a, b, c, pts, t0, t1: t0 + duration };
      });
  }, [info]);

  // Rock salt grown around the ion pair: the pair sits on two neighbouring
  // sites, and every other site joins in order of distance from them.
  const lattice = useMemo(() => {
    if (!rockSalt) return null;
    const cat = info.atoms.find((a) => a.metal);
    const an = info.atoms.find((a) => !a.metal);
    const d = Math.abs(an.ionX - cat.ionX);
    const dir = Math.sign(an.ionX - cat.ionX);
    const total = ION_RADIUS_PM[cat.symbol] + ION_RADIUS_PM[an.symbol];
    const rCat = (ION_RADIUS_PM[cat.symbol] / total) * d * BALL_SHARE;
    const rAn = (ION_RADIUS_PM[an.symbol] / total) * d * BALL_SHARE;
    const sites = [];
    for (let i = -1; i <= 2; i += 1) {
      for (let j = -1; j <= 1; j += 1) {
        for (let k = -1; k <= 1; k += 1) {
          const cation = (i + j + k) % 2 === 0;
          const position = [cat.ionX + dir * i * d, j * d, k * d];
          const dist = Math.hypot(i - 0.5, j, k);
          sites.push({ position, cation, dist, pair: j === 0 && k === 0 && (i === 0 || i === 1) });
        }
      }
    }
    const maxDist = Math.max(...sites.map((s) => s.dist));
    // Each site joined to its six nearest neighbours, as the lattice view draws NaCl.
    const rods = [];
    sites.forEach((a, i) =>
      sites.forEach((b, j) => {
        if (j <= i) return;
        const gap = Math.hypot(a.position[0] - b.position[0], a.position[1] - b.position[1], a.position[2] - b.position[2]);
        if (Math.abs(gap - d) < 1e-6) rods.push({ i, j });
      }),
    );
    return { sites, rods, rCat, rAn, maxDist, centre: [(cat.ionX + an.ionX) / 2, 0, 0], catColour: BONDING_COLOURS[cat.symbol], anColour: BONDING_COLOURS[an.symbol] };
  }, [info, rockSalt]);

  useFrame((_, delta) => {
    let p = progress.current;
    if (p >= 0 && p < end) {
      p = Math.min(end, p + (delta * Math.max(speed, 0)) / FORM_SECONDS);
      progress.current = p;
    }
    const q = Math.max(p, 0);
    const attract = span(q, T.fade, T.attract);
    const fade = span(q, T.transfer, T.fade);

    // Atoms slide from where they stood to where the ions settle.
    info.atoms.forEach((a, i) => {
      const x = lerp(a.x, a.ionX, attract);
      atomRefs.current[i]?.position.set(x, 0, 0);
      // The metal's emptied outer ring fades; the ion's new outer ring brightens.
      a.shells.forEach((_, s) => {
        const ring = ringRefs.current[`${i}-${s}`];
        if (!ring?.material) return;
        const emptied = a.metal && s === a.shells.length - 1;
        ring.material.opacity = emptied ? 0.85 * (1 - fade) : 0.85;
      });
      const br = bracketRefs.current[i];
      if (br) br.forEach((l) => l?.material && (l.material.opacity = span(q, T.fade, T.fade + 0.06)));
    });

    // Electrons: the stay-at-homes ride with their atom; the travellers fly.
    const glow = 1 + 0.35 * Math.sin(q * FORM_SECONDS * 9);
    info.electrons.forEach((e, i) => {
      const ref = electronRefs.current[i];
      if (!ref) return;
      if (e.step === null) {
        ref.position.set(lerp(e.start[0], e.end[0], attract), lerp(e.start[1], e.end[1], attract), 0);
        ref.scale.setScalar(1);
        return;
      }
      const f = flights.find((fl) => fl.index === i);
      if (q < f.t0) {
        ref.position.set(e.start[0], e.start[1], 0);
        ref.scale.setScalar(q > 0 && q < T.transfer ? glow : 1);
      } else if (q < f.t1) {
        bezier(scratch, f.a, f.c, f.b, smooth((q - f.t0) / (f.t1 - f.t0)));
        ref.position.copy(scratch);
        ref.scale.setScalar(1.25);
      } else {
        ref.position.set(lerp(e.arrival[0], e.end[0], attract), lerp(e.arrival[1], e.end[1], attract), 0);
        ref.scale.setScalar(1);
      }
    });
    flights.forEach((f, k) => {
      const line = pathRefs.current[k];
      if (!line?.material) return;
      line.material.opacity = q >= f.t0 ? 0.7 * (1 - span(q, T.fade, T.attract)) : 0;
    });

    // Rock salt: the diagram gives way to balls, the lattice grows round
    // them and the whole thing turns so it reads as three-dimensional.
    if (lattice) {
      const grow = span(q, T.lattice, 0.97);
      if (diagram.current) {
        const s = 1 - span(q, T.attract + 0.01, T.lattice + 0.04);
        diagram.current.visible = s > 0.01;
        diagram.current.scale.setScalar(Math.max(s, 0.01));
        diagram.current.position.set(lattice.centre[0] * (1 - s), 0, 0);
      }
      const grown = lattice.sites.map((site, k) => {
        const start = site.pair ? T.attract + 0.01 : T.lattice + (site.dist / lattice.maxDist) * 0.16;
        const s = span(q, start, start + 0.06);
        const ball = ballRefs.current[k];
        if (ball) {
          ball.scale.setScalar(Math.max(s, 0.001));
          ball.visible = s > 0.005;
        }
        return s;
      });
      lattice.rods.forEach((rod, k) => {
        const g = rodRefs.current[k];
        if (g) g.visible = grown[rod.i] > 0.95 && grown[rod.j] > 0.95;
      });
      if (pairHalo.current) pairHalo.current.visible = grown.some((s, k) => lattice.sites[k].pair && s > 0.5);
      if (content.current) {
        content.current.rotation.y = lerp(0, -0.62, grow);
        content.current.rotation.x = lerp(0, 0.34, grow);
      }
    }

    report(p < 0 ? -1 : q < T.intro ? 0 : q < T.transfer ? 1 : q < T.fade ? 2 : q < T.attract ? 3 : 4);
  });

  const metal = info.atoms.find((a) => a.metal);
  const before = stage < 2;
  // HTML labels ignore the 3D group's visibility, so they go when the lattice takes over.
  const atomLabels = !(rockSalt && stage >= 4);

  return (
    <group ref={content}>
      <group ref={diagram}>
        {info.atoms.map((a, i) => (
          <group
            key={`atom-${i}`}
            ref={(el) => {
              atomRefs.current[i] = el;
            }}
            position={[a.x, 0, 0]}
          >
            <Kernel colour={BONDING_COLOURS[a.symbol]} radius={0.24} />
            {a.shells.map((_, s) => (
              <ShellRing
                key={s}
                ref={(el) => {
                  ringRefs.current[`${i}-${s}`] = el;
                }}
                plane="xy"
                radius={diagramShellRadius(s)}
                colour={BONDING_COLOURS[a.symbol]}
                lineWidth={1.8}
                opacity={0.85}
              />
            ))}
            {bracketPoints(a.ionRadius).map((pts, k) => (
              <Line
                key={k}
                ref={(el) => {
                  if (!bracketRefs.current[i]) bracketRefs.current[i] = [];
                  bracketRefs.current[i][k] = el;
                }}
                points={pts}
                color={PALETTE.bone}
                lineWidth={2}
                transparent
                opacity={0}
              />
            ))}
            {atomLabels && stage >= 2 && (
              <Label position={[a.ionRadius + 0.55, a.ionRadius + 0.42, 0]} tone={a.metal ? "text-amber-300" : "text-emerald-300"}>
                <span className="text-[15px] font-bold">{a.charge > 0 ? `${a.charge === 1 ? "" : a.charge}+` : `${-a.charge === 1 ? "" : -a.charge}−`}</span>
              </Label>
            )}
            {atomLabels && (
              <Label position={[0, -(before ? a.radius : a.ionRadius) - 0.55, 0]} tone="text-ink-200">
                {before ? `${a.symbol} · ${a.shells.join(",")}` : `${a.ionSymbol} · ${a.ionShells.join(",")}`}
              </Label>
            )}
          </group>
        ))}

        {info.electrons.map((e, i) => (
          <ElectronMark
            key={`e-${i}`}
            ref={(el) => {
              electronRefs.current[i] = el;
            }}
            position={[e.start[0], e.start[1], 0]}
            kind={info.atoms[e.owner].metal ? "dot" : "cross"}
            colour={BONDING_COLOURS[info.atoms[e.owner].symbol]}
            size={ELECTRON}
            emissiveIntensity={e.step !== null ? 2 : 1.1}
          />
        ))}

        {flights.map((f, k) => (
          <Line
            key={`path-${k}`}
            ref={(el) => {
              pathRefs.current[k] = el;
            }}
            points={f.pts}
            color={BONDING_COLOURS[metal.symbol]}
            lineWidth={1.6}
            dashed
            dashSize={0.16}
            gapSize={0.12}
            transparent
            opacity={0}
          />
        ))}
      </group>

      {lattice &&
        lattice.rods.map((rod, k) => (
          <group
            key={`rod-${k}`}
            ref={(el) => {
              rodRefs.current[k] = el;
            }}
            visible={false}
          >
            <Bond from={lattice.sites[rod.i].position} to={lattice.sites[rod.j].position} radius={0.05} color={BOND_COLOUR} />
          </group>
        ))}
      {lattice && (
        <mesh ref={pairHalo} position={lattice.centre} scale={[1.9, 1, 1]} visible={false}>
          <sphereGeometry args={[lattice.rAn * 1.25, 32, 32]} />
          <meshBasicMaterial color={PALETTE.bone} transparent opacity={0.1} depthWrite={false} />
        </mesh>
      )}
      {lattice &&
        lattice.sites.map((site, k) => (
          <mesh
            key={`ball-${k}`}
            ref={(el) => {
              ballRefs.current[k] = el;
            }}
            position={site.position}
            visible={false}
          >
            <sphereGeometry args={[site.cation ? lattice.rCat : lattice.rAn, 28, 28]} />
            <meshStandardMaterial
              color={site.cation ? lattice.catColour : lattice.anColour}
              emissive={site.cation ? lattice.catColour : lattice.anColour}
              emissiveIntensity={site.pair ? 0.6 : 0.3}
              roughness={0.35}
              metalness={0.1}
            />
          </mesh>
        ))}
    </group>
  );
}

const NoLabel = () => null;

/** What the caption under the scene says at each stage. */
function captionFor(info, stage) {
  const metals = info.atoms.filter((a) => a.metal);
  const nonMetals = info.atoms.filter((a) => !a.metal);
  const M = metals[0];
  const X = nonMetals[0];
  const each = metals.length > 1 ? "Each " : "";
  const what = M.give === 1 ? "its outer electron" : `its ${M.give} outer electrons`;
  const toWhom = nonMetals.length > 1 ? `the ${X.symbol} atoms beside it` : X.symbol;
  const balance = `${metals.length} × (${M.charge > 0 ? "+" : ""}${M.charge}) + ${nonMetals.length} × (${X.charge}) = 0 — so the formula is ${info.compound.formula}`;
  switch (stage) {
    case -1:
      return `${info.compound.name}: press “Transfer the electrons” · ● ${M.symbol}'s electrons, ✕ ${X.symbol}'s`;
    case 0:
      return `${M.symbol} ${M.shells.join(",")} has ${M.give} outer electron${M.give === 1 ? "" : "s"}; ${X.symbol} ${X.shells.join(",")} is ${X.need} short of an octet`;
    case 1:
      return `${each}${M.symbol} gives ${what} to ${toWhom} — a complete transfer, not a share`;
    case 2:
      return `${M.symbol}'s emptied ${SHELL_NAMES[M.shells.length - 1]} shell is gone: ${M.ionSymbol} is ${M.ionShells.join(",")} and ${X.ionSymbol} is ${X.ionShells.join(",")} — both full`;
    case 3:
      return "Opposite charges attract. That electrostatic attraction is the ionic bond";
    default:
      return info.compound.rockSalt
        ? `…acting in every direction: a giant ionic lattice, each ${M.ionSymbol} surrounded by six ${X.ionSymbol}`
        : balance;
  }
}

export function IonicFormationScene({ params = {} }) {
  const { compound = "NaCl", formIons = 0, speed = 1, showLabels = true } = params || {};
  const info = useMemo(() => ionicFormation(compound), [compound]);
  const [stage, setStage] = useState(-1);
  const Label = showLabels ? SceneLabel : NoLabel;
  const halfRow = Math.max(...info.atoms.map((a) => Math.abs(a.x) + a.radius)) + 0.6;
  const latticeView = info.compound.rockSalt && stage >= 4;
  // The lattice is four sites long and three deep, turned and tilted towards
  // the camera, so its outline is wider and taller than the row it grew from.
  const d = Math.abs(info.atoms[1].ionX - info.atoms[0].ionX);
  const halfWidth = latticeView ? 2.4 * d + 1.6 : halfRow;
  // Labels are fixed-size HTML, so a long row (camera further back) needs more
  // world-space between the atoms' labels and the caption.
  const rowHalfHeight = Math.max(...info.atoms.map((a) => a.radius)) + 2.4 + 0.12 * halfRow;
  const halfHeight = latticeView ? 1.65 * d + 1.6 : rowHalfHeight;

  return (
    <SceneCanvas camera={{ position: [0, 0.6, 14], fov: 40 }} controls={{ minDistance: 4, maxDistance: 40 }}>
      <FitCamera halfWidth={halfWidth} halfHeight={halfHeight} />
      <Formation info={info} token={formIons} speed={speed} Label={Label} onStage={setStage} />
      <Label position={[0, halfHeight - 0.9, 0]} accent>
        {stage >= 3 ? info.equation : `${info.compound.name} · ${info.compound.formula}`}
      </Label>
      <Label position={[0, -halfHeight + 0.9, 0]} tone={stage === 1 ? "text-amber-300" : stage >= 3 ? "text-emerald-300" : "text-ink-300"}>
        {stage >= 0 ? `${stage + 1}/5 · ${captionFor(info, stage)}` : captionFor(info, -1)}
      </Label>
    </SceneCanvas>
  );
}
