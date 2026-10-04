"use client";

import { forwardRef, useMemo } from "react";
import { Billboard, Line } from "@react-three/drei";

// ─── Electron shells, shared ────────────────────────────────────────
// The pieces every shell diagram is made of, lifted out of the Bohr atom so
// the bonding scenes draw electrons the same way it does:
//
//   ShellRing      a shell's circle, in the x–z plane (the Bohr atom's
//                  orbits, tilted by their parent group) or the x–y plane
//                  (a flat dot-and-cross diagram facing the camera), or
//                  billboarded so it always faces the viewer (a shell drawn
//                  around an atom in a 3D molecule)
//   ElectronMark   one electron: a glowing dot, or a cross. Dot-and-cross
//                  diagrams draw one atom's electrons as dots and the
//                  other's as crosses so you can see whose electron went
//                  where; the cross is billboarded so it reads as ✕ from
//                  any angle
//   Kernel         a small nucleus-and-inner-electrons sphere with its symbol,
//                  for diagrams that draw only the shells around it
//
// Positions are animated by the scenes through the ref ElectronMark
// forwards, so no React state changes while electrons move.
// ─────────────────────────────────────────────────────────────────────

/** A closed circle of `radius` in the given plane. */
export function ringPoints(radius, plane = "xz", segments = 128) {
  const pts = [];
  for (let i = 0; i <= segments; i += 1) {
    const a = (i / segments) * Math.PI * 2;
    const c = Math.cos(a) * radius;
    const s = Math.sin(a) * radius;
    pts.push(plane === "xy" ? [c, s, 0] : [c, 0, s]);
  }
  return pts;
}

/** One shell's ring. `billboard` keeps it facing the camera. */
export const ShellRing = forwardRef(function ShellRing(
  { radius, colour, opacity = 0.85, lineWidth = 2.2, plane = "xz", billboard = false, dashed = false, onClick },
  ref,
) {
  const points = useMemo(() => ringPoints(radius, billboard ? "xy" : plane), [radius, plane, billboard]);
  const line = (
    <Line
      ref={ref}
      points={points}
      color={colour}
      lineWidth={lineWidth}
      transparent
      opacity={opacity}
      dashed={dashed}
      dashSize={0.12}
      gapSize={0.08}
      onClick={onClick}
    />
  );
  return billboard ? <Billboard>{line}</Billboard> : line;
});

/**
 * One electron, as a dot or a cross. The ref is the outer group, so a
 * scene moves it with `ref.current.position` and hides it with scale 0.
 */
export const ElectronMark = forwardRef(function ElectronMark(
  { kind = "dot", colour, size = 0.15, emissiveIntensity = 1.2, opacity = 1, position, onClick },
  ref,
) {
  return (
    <group ref={ref} position={position}>
      {kind === "cross" ? (
        <Billboard>
          {[1, -1].map((s) => (
            <mesh key={s} rotation={[0, 0, (s * Math.PI) / 4]} onClick={onClick}>
              <boxGeometry args={[size * 2.1, size * 0.48, size * 0.48]} />
              <meshStandardMaterial
                color={colour}
                emissive={colour}
                emissiveIntensity={emissiveIntensity}
                transparent={opacity < 1}
                opacity={opacity}
                toneMapped={false}
              />
            </mesh>
          ))}
        </Billboard>
      ) : (
        <mesh onClick={onClick}>
          <sphereGeometry args={[size, 18, 18]} />
          <meshStandardMaterial
            color={colour}
            emissive={colour}
            emissiveIntensity={emissiveIntensity}
            transparent={opacity < 1}
            opacity={opacity}
            toneMapped={false}
          />
        </mesh>
      )}
    </group>
  );
});

/**
 * The nucleus of a shell diagram: a small sphere in the element's colour.
 * Labelling is left to the scene, which knows whether labels are on.
 */
export function Kernel({ position = [0, 0, 0], colour, radius = 0.26, halo = true }) {
  return (
    <group position={position}>
      <mesh>
        <sphereGeometry args={[radius, 28, 28]} />
        <meshStandardMaterial color={colour} emissive={colour} emissiveIntensity={0.55} roughness={0.35} metalness={0.1} />
      </mesh>
      {halo && (
        <mesh>
          <sphereGeometry args={[radius * 1.9, 24, 24]} />
          <meshBasicMaterial color={colour} transparent opacity={0.08} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}
