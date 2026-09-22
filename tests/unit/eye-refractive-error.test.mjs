// ─── Short sight and long sight ─────────────────────────────────────
// `refractiveErrorD` is the spectacle prescription in the usual convention:
// NEGATIVE for myopia (a diverging lens corrects it), POSITIVE for
// hypermetropia. Zero must reduce to exactly the emmetropic eye the rest of
// the module already modelled.
//
// The asymmetry is the whole lesson, and it is what these assert:
// the ciliary muscle can only ADD power. A long-sighted eye can therefore
// buy itself distance vision with effort, and a short-sighted one cannot buy
// anything at all — which is why myopia has a finite far point and
// hypermetropia does not.
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DEFECTS,
  EYE,
  accommodationDemandWith,
  correctionPower,
  defectFor,
  farPoint,
  nearPointFor,
  relaxedPowerWith,
  solveEye,
} from "../../lib/eyeOptics.js";

const LUX = 300;
const eye = (o) => solveEye({ lux: LUX, ...o });
const close = (a, b, tol = 1e-9) =>
  assert.ok(Math.abs(a - b) <= tol, `expected ${a} to be within ${tol} of ${b}`);

/** The prescriptions the slider can reach, at its step. */
const SWEEP = Array.from({ length: 49 }, (_, i) => -6 + i * 0.25);

describe("naming the defect", () => {
  it("calls a negative prescription short sight and a positive one long sight", () => {
    assert.equal(defectFor(-3), DEFECTS.myopia);
    assert.equal(defectFor(3), DEFECTS.hypermetropia);
    assert.equal(defectFor(0), DEFECTS.none);
    assert.equal(defectFor(0.1), DEFECTS.none, "a tenth of a dioptre is not a defect");
    assert.equal(defectFor(undefined), DEFECTS.none);
  });

  it("prescribes a diverging lens for short sight and a converging one for long", () => {
    assert.match(DEFECTS.myopia.lens, /diverging|concave/);
    assert.match(DEFECTS.hypermetropia.lens, /converging|convex/);
  });

  it("names what each defect blurs, and says why", () => {
    assert.match(DEFECTS.myopia.blurs, /distant/);
    assert.match(DEFECTS.hypermetropia.blurs, /near/);
    assert.match(DEFECTS.myopia.cause, /IN FRONT/);
    assert.match(DEFECTS.hypermetropia.cause, /BEHIND/);
  });

  it("names a defect for every prescription the slider reaches", () => {
    for (const d of SWEEP) {
      const defect = defectFor(d);
      assert.ok(defect && defect.label.length > 0, `no defect named for ${d} D`);
      assert.ok(Math.sign(defect.sign) === Math.sign(d) || defect.key === "none");
    }
  });
});

describe("zero error is exactly the eye the module already had", () => {
  it("leaves the relaxed power at 60 D", () => {
    close(relaxedPowerWith(0), EYE.relaxedPower);
    assert.equal(correctionPower(0, true), 0);
  });

  it("focuses a distant object sharply, with no accommodation", () => {
    const r = eye({ objectDistanceM: 1000 });
    close(r.accommodation, 0, 1e-3);
    assert.equal(r.inFocus, true);
    assert.equal(r.defect.key, "none");
  });

  it("keeps the near point at 10 cm and the far point at infinity", () => {
    close(nearPointFor(0), 1 / EYE.accommodationAmplitude, 1e-12);
    assert.equal(farPoint(0), Infinity);
  });
});

describe("a short-sighted eye", () => {
  const D = -3;

  it("has too MUCH power, not too little", () => {
    close(relaxedPowerWith(D), 63);
    assert.ok(relaxedPowerWith(D) > EYE.relaxedPower);
  });

  it("blurs a distant object, focusing in front of the retina", () => {
    const r = eye({ objectDistanceM: 1000, refractiveErrorD: D });
    assert.equal(r.inFocus, false);
    assert.ok(r.focusError < 0, `focus error ${r.focusError} should be negative (in front)`);
    assert.ok(r.blur > EYE.blurTolerance);
  });

  // The crux: relaxing is all a myopic eye has, and it has already done it.
  it("cannot fix distance by accommodating — the demand is negative", () => {
    const r = eye({ objectDistanceM: 1000, refractiveErrorD: D });
    assert.ok(r.demand < 0, `demand ${r.demand} should be negative`);
    assert.equal(r.accommodation, 0, "the ciliary muscle cannot supply negative power");
    assert.equal(r.beyondFarPoint, true);
  });

  it("has a finite far point at 1/|D| metres", () => {
    close(farPoint(D), 1 / 3, 1e-9);
    close(farPoint(-2), 0.5, 1e-9);
    // And sees sharply at it.
    const at = eye({ objectDistanceM: farPoint(D), refractiveErrorD: D });
    assert.equal(at.inFocus, true);
    assert.equal(at.beyondFarPoint, false);
  });

  it("sees near objects perfectly well", () => {
    const r = eye({ objectDistanceM: 0.3, refractiveErrorD: D });
    assert.equal(r.inFocus, true);
    assert.ok(r.accommodation >= 0);
  });

  it("has a CLOSER near point than a normal eye", () => {
    assert.ok(nearPointFor(D) < nearPointFor(0), "short sight pulls the near point in");
    close(nearPointFor(D), 1 / (EYE.accommodationAmplitude + 3), 1e-12);
  });
});

describe("a long-sighted eye", () => {
  const D = 3;

  it("has too LITTLE power", () => {
    close(relaxedPowerWith(D), 57);
    assert.ok(relaxedPowerWith(D) < EYE.relaxedPower);
  });

  // The reason long sight is missed for years: distance still works, at a cost.
  it("still sees distant objects — by accommodating for them", () => {
    const r = eye({ objectDistanceM: 1000, refractiveErrorD: D });
    assert.equal(r.inFocus, true);
    close(r.accommodation, 3, 1e-3);
    assert.ok(r.accommodation > 0, "it is spending amplitude just to reach infinity");
    assert.equal(r.farPoint, Infinity);
  });

  it("blurs near objects, focusing behind the retina", () => {
    const r = eye({ objectDistanceM: 0.1, refractiveErrorD: D });
    assert.equal(r.inFocus, false);
    assert.ok(r.focusError > 0, `focus error ${r.focusError} should be positive (behind)`);
    assert.equal(r.beyondNearPoint, true);
  });

  it("has a FURTHER near point than a normal eye", () => {
    assert.ok(nearPointFor(D) > nearPointFor(0), "long sight pushes the near point out");
    close(nearPointFor(D), 1 / (EYE.accommodationAmplitude - 3), 1e-12);
  });

  it("never has a finite far point", () => {
    for (const d of SWEEP.filter((x) => x >= 0)) assert.equal(farPoint(d), Infinity);
  });
});

describe("the correcting lens", () => {
  it("restores an emmetropic eye, for either defect", () => {
    for (const d of [-6, -3, -1, 1, 3, 6]) {
      for (const u of [0.15, 0.3, 1, 1000]) {
        const bare = eye({ objectDistanceM: u, refractiveErrorD: d });
        const worn = eye({ objectDistanceM: u, refractiveErrorD: d, corrected: true });
        const normal = eye({ objectDistanceM: u });
        close(worn.demand, normal.demand, 1e-12);
        close(worn.power, normal.power, 1e-9);
        assert.equal(worn.inFocus, normal.inFocus, `${d} D at ${u} m`);
        assert.equal(worn.corrected, true);
        assert.equal(bare.corrected, false);
      }
    }
  });

  it("supplies exactly the prescription", () => {
    assert.equal(correctionPower(-3, true), -3);
    assert.equal(correctionPower(3, true), 3);
    assert.equal(correctionPower(-3, false), 0);
    assert.equal(eye({ objectDistanceM: 1, refractiveErrorD: -3, corrected: true }).correctionD, -3);
  });

  it("pushes a myopic far point back to infinity", () => {
    assert.ok(Number.isFinite(farPoint(-3)));
    assert.equal(farPoint(-3, true), Infinity);
  });

  it("restores the 10 cm near point", () => {
    close(nearPointFor(3, true), nearPointFor(0), 1e-12);
    close(nearPointFor(-3, true), nearPointFor(0), 1e-12);
  });

  it("is not reported as worn on an eye that needs no lens", () => {
    const r = eye({ objectDistanceM: 1, refractiveErrorD: 0, corrected: true });
    assert.equal(r.corrected, false, "there is nothing to correct");
  });
});

describe("the model stays coherent across the whole slider", () => {
  it("returns finite, sane numbers everywhere", () => {
    for (const d of SWEEP) {
      for (const corrected of [false, true]) {
        for (const u of [0.1, 0.25, 1, 10, 1000]) {
          const r = eye({ objectDistanceM: u, refractiveErrorD: d, corrected });
          assert.ok(Number.isFinite(r.power), `power ${r.power} at ${d} D`);
          assert.ok(Number.isFinite(r.demand));
          assert.ok(Number.isFinite(r.blur));
          assert.ok(r.accommodation >= 0, "accommodation can never be negative");
          assert.ok(
            r.accommodation <= EYE.accommodationAmplitude + 1e-9,
            "accommodation can never exceed the amplitude",
          );
          assert.ok(r.nearPoint > 0);
          assert.ok(r.farPoint > 0);
          assert.ok(r.nearPoint <= r.farPoint + 1e-9, "the near point must not pass the far point");
        }
      }
    }
  });

  it("agrees with the standalone demand function", () => {
    for (const d of SWEEP) {
      for (const u of [0.2, 1, 100]) {
        const r = eye({ objectDistanceM: u, refractiveErrorD: d });
        close(r.demand, accommodationDemandWith(u, d, false), 1e-12);
      }
    }
  });

  it("makes a stronger prescription worse, monotonically", () => {
    let lastBlur = -1;
    for (let d = 0; d >= -6; d -= 0.25) {
      const r = eye({ objectDistanceM: 1000, refractiveErrorD: d });
      assert.ok(r.blur >= lastBlur - 1e-12, `blur fell going to ${d} D`);
      lastBlur = r.blur;
    }
  });

  it("flags exactly one limit at a time", () => {
    for (const d of SWEEP) {
      for (const u of [0.05, 0.1, 1, 1000]) {
        const r = eye({ objectDistanceM: u, refractiveErrorD: d });
        assert.ok(
          !(r.beyondNearPoint && r.beyondFarPoint),
          `${d} D at ${u} m is reported as both too close and too far`,
        );
      }
    }
  });
});
