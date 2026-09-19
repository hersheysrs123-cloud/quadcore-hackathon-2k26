import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  EYE,
  axialLength,
  nearPoint,
  requiredPower,
  accommodationDemand,
  appliedAccommodation,
  totalPower,
  lensPower,
  lensRelaxedPower,
  lensPowerForTotal,
  lensSeparation,
  equivalentPower,
  lensRadiusOfCurvature,
  lensThickness,
  imageDistance,
  focusError,
  blurCircleDiameter,
  depthOfFocus,
  isInFocus,
  luminanceFromLux,
  pupilDiameterFromLuminance,
  pupilDiameterFromLux,
  retinalIlluminanceTd,
  ciliaryState,
  irisState,
  curvatureIndex,
  solveEye,
  EYE_GEOMETRY,
  traceRayHeights,
} from "../../lib/eyeOptics.js";

const mm = (m) => m * 1000;
const close = (a, b, tol) => Math.abs(a - b) <= tol;

describe("reduced-eye geometry", () => {
  it("puts the retina at n ÷ P, the classic 22.2 mm", () => {
    assert.ok(close(mm(axialLength()), 22.2, 0.05), `${mm(axialLength()).toFixed(2)} mm`);
  });

  it("needs exactly the relaxed power for an object at infinity", () => {
    assert.ok(close(requiredPower(Infinity), EYE.relaxedPower, 1e-9));
  });

  it("focuses infinity onto the retina with the lens relaxed", () => {
    assert.ok(close(imageDistance(EYE.relaxedPower, Infinity), axialLength(), 1e-12));
  });

  it("combines cornea and lens by Gullstrand, not by adding them", () => {
    // Separated elements lose power: 43 + 20.27 is 63.3, but the eye is 60 D.
    assert.ok(close(equivalentPower(EYE.corneaPower, lensRelaxedPower()), EYE.relaxedPower, 1e-9));
    assert.ok(
      EYE.corneaPower + lensRelaxedPower() > EYE.relaxedPower,
      "the naive sum must exceed the equivalent power",
    );
  });

  it("puts the relaxed lens at the ~20 D biometry actually measures", () => {
    const P = lensRelaxedPower();
    assert.ok(P > 19 && P < 22.5, `${P.toFixed(2)} D`);
  });

  it("derives the lens position rather than guessing it", () => {
    // Forced by the 24 mm globe, the 60 D eye and the 43 D cornea — and it
    // lands on Gullstrand's 6.3 mm, which is the check that the whole
    // schematic is internally consistent.
    assert.ok(close(mm(lensSeparation()), 6.3, 0.15), `${mm(lensSeparation()).toFixed(3)} mm`);
  });

  it("puts the relaxed eye's back focus exactly on the retina", () => {
    // Back focal distance from the lens plane must reach the retina, which
    // sits globeLength behind the corneal vertex.
    const f = EYE.n / EYE.relaxedPower;
    // Back focal distance from the second element: f'(1 − d·P₁/n).
    const bfd = f * (1 - (lensSeparation() * EYE.corneaPower) / EYE.n);
    assert.ok(
      close(lensSeparation() + bfd, EYE.globeLength, 1e-12),
      `${mm(lensSeparation() + bfd).toFixed(4)} vs ${mm(EYE.globeLength)} mm`,
    );
  });

  it("puts the near point where the accommodation amplitude runs out", () => {
    assert.ok(close(nearPoint(), 0.1, 1e-9));
    assert.ok(close(accommodationDemand(nearPoint()), EYE.accommodationAmplitude, 1e-9));
  });
});

describe("accommodation demand", () => {
  it("is 1/u dioptres", () => {
    for (const [u, d] of [[10, 0.1], [1, 1], [0.5, 2], [0.25, 4], [0.1, 10]]) {
      assert.ok(close(accommodationDemand(u), d, 1e-9), `u=${u}`);
    }
  });

  it("rises as the object comes closer", () => {
    let previous = -Infinity;
    for (const u of [10, 5, 2, 1, 0.5, 0.25, 0.1]) {
      const d = accommodationDemand(u);
      assert.ok(d > previous, `demand must increase as u falls (u=${u})`);
      previous = d;
    }
  });

  it("caps what the eye can actually supply at the amplitude", () => {
    // 5 cm is inside the near point — no amount of effort brings it into focus.
    assert.equal(appliedAccommodation(0.05, { auto: true }), EYE.accommodationAmplitude);
    assert.ok(solveEye({ objectDistanceM: 0.05, lux: 500 }).beyondNearPoint);
    assert.ok(!solveEye({ objectDistanceM: 0.1, lux: 500 }).beyondNearPoint);
  });

  it("supplies nothing in manual mode unless asked", () => {
    assert.equal(appliedAccommodation(0.25, { auto: false, manual: 0 }), 0);
    assert.equal(appliedAccommodation(0.25, { auto: false, manual: 4 }), 4);
  });
});

describe("crystalline lens shape", () => {
  it("lands the relaxed radius between the real anterior and posterior faces", () => {
    // The model idealises both faces to one radius; the real lens is 10 mm at
    // the front and 6 mm at the back, so the equivalent sits between them.
    const R = mm(lensRadiusOfCurvature(0));
    assert.ok(R > 6 && R < 10.5, `${R.toFixed(2)} mm should sit between the two real faces`);
  });

  it("rounds up to a ~5–6 mm radius at full accommodation", () => {
    const R = mm(lensRadiusOfCurvature(EYE.accommodationAmplitude));
    assert.ok(close(R, 5.5, 0.7), `${R.toFixed(2)} mm`);
  });

  it("gets rounder — smaller radius — as accommodation rises", () => {
    let previous = Infinity;
    for (let a = 0; a <= EYE.accommodationAmplitude; a += 1) {
      const R = lensRadiusOfCurvature(a);
      assert.ok(R < previous, `radius must shrink (a=${a})`);
      previous = R;
    }
  });

  it("thickens from about 3.5 mm to about 4.4 mm, as the anatomy does", () => {
    const relaxed = mm(lensThickness(0));
    const full = mm(lensThickness(EYE.accommodationAmplitude));
    assert.ok(close(relaxed, 3.6, 0.35), `relaxed ${relaxed.toFixed(2)} mm`);
    assert.ok(close(full, 4.6, 0.5), `accommodated ${full.toFixed(2)} mm`);
    assert.ok(full > relaxed, "the lens must get thicker, not thinner");
  });

  it("puts every dioptre of accommodation into the lens, never the cornea", () => {
    for (const a of [0, 3, 7, 10]) {
      // The cornea never changes, and the lens power that results must
      // reproduce the eye's total through Gullstrand.
      assert.ok(close(equivalentPower(EYE.corneaPower, lensPower(a)), totalPower(a), 1e-9));
      assert.ok(lensPower(a) >= lensRelaxedPower() - 1e-9);
    }
  });

  it("needs more than a dioptre at the lens to gain one at the eye", () => {
    const perDioptre = lensPower(1) - lensPower(0);
    assert.ok(perDioptre > 1.1, `${perDioptre.toFixed(3)} D of lens per 1 D of eye`);
  });

  it("reports a curvature index running 0 → 1 across the range", () => {
    assert.ok(close(curvatureIndex(0), 0, 1e-9));
    assert.ok(close(curvatureIndex(EYE.accommodationAmplitude), 1, 1e-9));
    assert.ok(curvatureIndex(5) > 0 && curvatureIndex(5) < 1);
  });
});

describe("where the image lands", () => {
  it("lands exactly on the retina when accommodation meets demand", () => {
    for (const u of [10, 2, 1, 0.5, 0.25, 0.1]) {
      const r = solveEye({ objectDistanceM: u, lux: 500, auto: true });
      assert.ok(close(mm(r.focusError), 0, 1e-6), `u=${u} err=${mm(r.focusError)}`);
      assert.ok(r.inFocus, `u=${u} should be sharp when auto-accommodating`);
    }
  });

  it("falls BEHIND the retina for a near object with a relaxed lens", () => {
    const r = solveEye({ objectDistanceM: 0.25, lux: 500, auto: false, manualAccommodation: 0 });
    assert.ok(r.focusError > 0, "under-accommodating must push the focus backwards");
    assert.ok(!r.inFocus);
    assert.ok(close(mm(r.focusError), 1.59, 0.15), `${mm(r.focusError).toFixed(2)} mm`);
  });

  it("falls IN FRONT of the retina when over-accommodating on a distant object", () => {
    const r = solveEye({ objectDistanceM: 6, lux: 500, auto: false, manualAccommodation: 8 });
    assert.ok(r.focusError < 0, "over-accommodating must pull the focus forwards");
    assert.ok(!r.inFocus);
  });

  it("blurs more the further the focus error grows", () => {
    let previous = -1;
    for (const a of [4, 3, 2, 1, 0]) {
      const r = solveEye({ objectDistanceM: 0.25, lux: 500, auto: false, manualAccommodation: a });
      assert.ok(r.blur > previous, `blur must grow as accommodation falls short (a=${a})`);
      previous = r.blur;
    }
  });

  it("gives zero blur exactly at focus", () => {
    assert.ok(close(blurCircleDiameter(requiredPower(0.5), 0.5, 0.003), 0, 1e-12));
  });
});

describe("depth of focus", () => {
  it("is around the textbook half-dioptre for a 3 mm pupil", () => {
    const d = depthOfFocus(0.003);
    assert.ok(d > 0.45 && d < 0.7, `${d.toFixed(3)} D`);
  });

  it("widens as the pupil constricts — the pinhole effect", () => {
    assert.ok(depthOfFocus(0.002) > depthOfFocus(0.006));
    // Inversely proportional: a third of the diameter, three times the depth.
    assert.ok(close(depthOfFocus(0.002) / depthOfFocus(0.006), 3, 0.02));
  });

  it("lets a constricted pupil tolerate an error a dilated one cannot", () => {
    const power = requiredPower(1);
    // 0.6 D of error: forgiven by a 2 mm pupil, not by a 7 mm one.
    assert.ok(isInFocus(power + 0.6, 1, 0.002), "small pupil should still read as sharp");
    assert.ok(!isInFocus(power + 0.6, 1, 0.007), "wide pupil should not");
  });
});

describe("pupil reflex", () => {
  it("converts lux to luminance through a diffuse surface", () => {
    assert.ok(close(luminanceFromLux(1000), (1000 * 0.18) / Math.PI, 1e-9));
    assert.equal(luminanceFromLux(0), 0);
  });

  it("stays inside the 1.5–8 mm physiological range at every intensity", () => {
    for (const lux of [1e-4, 1e-3, 0.1, 1, 100, 1e4, 1e5, 1e6]) {
      const d = mm(pupilDiameterFromLux(lux));
      assert.ok(d >= 1.5 && d <= 8, `${lux} lux gave ${d.toFixed(2)} mm`);
    }
  });

  it("constricts monotonically as light increases", () => {
    let previous = Infinity;
    for (const lux of [1e-3, 0.1, 1, 10, 100, 1000, 1e4, 1e5]) {
      const d = pupilDiameterFromLux(lux);
      assert.ok(d <= previous, `pupil must not widen as light rises (${lux} lux)`);
      previous = d;
    }
  });

  it("is about 2 mm in direct sun and about 7 mm under starlight", () => {
    assert.ok(close(mm(pupilDiameterFromLux(1e5)), 2.0, 0.4), `sun ${mm(pupilDiameterFromLux(1e5)).toFixed(2)} mm`);
    assert.ok(close(mm(pupilDiameterFromLux(1e-3)), 7.4, 0.6), `starlight ${mm(pupilDiameterFromLux(1e-3)).toFixed(2)} mm`);
  });

  it("saturates at both ends rather than running away", () => {
    const tol = 1e-5; // 0.01 mm — tanh approaches its limits, it does not reach them
    assert.ok(close(pupilDiameterFromLuminance(1e-12), pupilDiameterFromLuminance(1e-14), tol));
    assert.ok(close(pupilDiameterFromLuminance(1e9), pupilDiameterFromLuminance(1e11), tol));
  });

  it("shows the reflex is only a coarse trim on retinal illuminance", () => {
    // Nine decades of light, but the pupil can only move area by ~16×.
    const dim = pupilDiameterFromLux(1e-3);
    const bright = pupilDiameterFromLux(1e5);
    const areaRatio = (dim / bright) ** 2;
    assert.ok(areaRatio > 5 && areaRatio < 30, `area ratio ${areaRatio.toFixed(1)}×`);
    // Trolands must still rise steeply with light: the pupil cannot hold them flat.
    assert.ok(
      retinalIlluminanceTd(luminanceFromLux(1e5), bright) >
        1e6 * retinalIlluminanceTd(luminanceFromLux(1e-3), dim),
      "retinal illuminance must still climb by orders of magnitude",
    );
  });
});

describe("muscle states", () => {
  it("calls ordinary reading distance contracted, and a metre away relaxed", () => {
    assert.equal(ciliaryState(accommodationDemand(0.25)).muscle, "contracted");
    assert.equal(ciliaryState(accommodationDemand(0.2)).muscle, "contracted");
    assert.equal(ciliaryState(accommodationDemand(0.5)).muscle, "partly contracted");
    assert.equal(ciliaryState(accommodationDemand(6)).muscle, "relaxed");
  });

  it("has the ciliary muscle CONTRACT and the zonules SLACKEN for near work", () => {
    const near = ciliaryState(EYE.accommodationAmplitude);
    assert.equal(near.muscle, "contracted");
    assert.equal(near.zonules, "slack");
    assert.equal(near.lens, "thick and spherical");
  });

  it("has the ciliary muscle RELAX and the zonules pull TAUT for distance", () => {
    const far = ciliaryState(0);
    assert.equal(far.muscle, "relaxed");
    assert.equal(far.zonules, "taut");
    assert.equal(far.lens, "thin and flat");
  });

  it("draws the ciliary ring inward as it contracts", () => {
    assert.ok(ciliaryState(EYE.accommodationAmplitude).ciliaryRingRadius < ciliaryState(0).ciliaryRingRadius);
  });

  it("works the iris muscles as antagonists", () => {
    const bright = irisState(pupilDiameterFromLux(1e5));
    assert.equal(bright.sphincter, "contracted");
    assert.equal(bright.dilator, "relaxed");
    assert.equal(bright.response, "constricted");

    const dim = irisState(pupilDiameterFromLux(1e-3));
    assert.equal(dim.sphincter, "relaxed");
    assert.equal(dim.dilator, "contracted");
    assert.equal(dim.response, "dilated");
  });
});

describe("solveEye contract", () => {
  it("returns finite, sane values across the whole control surface", () => {
    for (const u of [0.1, 0.25, 0.5, 1, 3, 10]) {
      for (const lux of [1e-3, 1, 500, 1e5]) {
        for (const auto of [true, false]) {
          const r = solveEye({ objectDistanceM: u, lux, auto, manualAccommodation: 2 });
          // `farPoint` is legitimately Infinity for any eye that is not
          // short-sighted -- that IS the answer, not a missing one. Everything
          // else has to be a real number.
          const UNBOUNDED = new Set(["farPoint"]);
          for (const [k, v] of Object.entries(r)) {
            if (typeof v !== "number" || UNBOUNDED.has(k)) continue;
            assert.ok(Number.isFinite(v), `${k} not finite at u=${u} lux=${lux}`);
          }
          assert.ok(r.farPoint > 0, `far point ${r.farPoint} at u=${u}`);
          assert.ok(r.pupil > 0 && r.lensRadius > 0 && r.lensThickness > 0);
          assert.ok(r.accommodation >= 0 && r.accommodation <= EYE.accommodationAmplitude);
        }
      }
    }
  });

  it("keeps the 3D model, the pills and the blur preview consistent", () => {
    const r = solveEye({ objectDistanceM: 0.2, lux: 300, auto: true });
    // Auto-accommodating means demand is met, so every derived flag must agree.
    assert.ok(close(r.accommodation, r.demand, 1e-9));
    assert.ok(close(r.power, requiredPower(0.2), 1e-9));
    assert.ok(r.inFocus);
    assert.ok(r.blur < 1e-12);
    assert.equal(r.ciliary.muscle, "contracted");
    assert.equal(r.ciliary.zonules, "slack");
  });
});

describe("scene geometry — the drawn rays must agree with the readout", () => {
  const trace = (h, u, auto = true, manual = 0) => {
    const solved = solveEye({ objectDistanceM: u, lux: 500, auto, manualAccommodation: manual });
    return { solved, ray: traceRayHeights(h, u, solved.imageDistance) };
  };

  it("places the lens where the optics demand, not where it looked right", () => {
    assert.ok(close(EYE_GEOMETRY.lensPlane, EYE_GEOMETRY.corneaVertex + mm(lensSeparation()), 1e-9));
    assert.ok(close(EYE_GEOMETRY.retina - EYE_GEOMETRY.corneaVertex, mm(EYE.globeLength), 1e-9));
  });

  it("crosses the axis exactly on the retina whenever the eye is in focus", () => {
    for (const u of [0.1, 0.25, 0.5, 1, 3, 10]) {
      const { ray } = trace(0.0012, u);
      assert.ok(close(mm(ray.yFocus), EYE_GEOMETRY.retina, 1e-6), `u=${u}m crossed at ${mm(ray.yFocus).toFixed(4)} mm`);
      // And the ray therefore arrives at the fovea, not beside it.
      assert.ok(Math.abs(mm(ray.hR)) < 1e-6, `u=${u}m landed ${mm(ray.hR).toFixed(5)} mm off axis`);
    }
  });

  it("misses the retina by exactly the focus error the panel prints", () => {
    for (const [u, manual] of [[0.25, 0], [0.2, 1], [6, 8], [0.5, 0]]) {
      const { solved, ray } = trace(0.0012, u, false, manual);
      const drawnError = ray.yFocus - EYE_GEOMETRY.retina / 1000;
      assert.ok(close(drawnError, solved.focusError, 1e-9), `u=${u} A=${manual}`);
      assert.equal(Math.sign(drawnError), Math.sign(solved.focusError));
    }
  });

  it("spreads the rays into exactly the blur circle the panel reports", () => {
    const u = 0.25;
    const { solved, ray: edge } = trace(solveEye({ objectDistanceM: u, lux: 500 }).pupil / 2, u, false, 0);
    // Marginal ray height at the retina is the blur circle's radius.
    assert.ok(close(Math.abs(edge.hR) * 2, solved.blur, 1e-9), `${mm(Math.abs(edge.hR) * 2).toFixed(4)} vs ${mm(solved.blur).toFixed(4)} mm`);
  });

  it("has the cornea bend the ray more than the lens does", () => {
    // The ray converges from the cornea toward the pupil; that convergence is
    // the cornea's work, and it must dominate.
    const { ray } = trace(0.0012, 6);
    assert.ok(ray.hC > 0.0012, "the cornea must already be converging the ray by the pupil");
    assert.ok(ray.hL < ray.hC, "and it keeps converging on the way to the lens");
  });

  it("keeps every traced height finite across the control surface", () => {
    for (const u of [0.1, 0.5, 2, 10]) {
      for (const manual of [0, 3, 10]) {
        const { ray } = trace(0.0015, u, false, manual);
        for (const k of ["hC", "hL", "hR"]) {
          assert.ok(Number.isFinite(ray[k]), `${k} not finite at u=${u} A=${manual}`);
        }
      }
    }
  });
});
