// THE ONLY MODULE THAT KNOWS WHERE THE PHONE REALLY IS.
// It plays the role of "the universe": given the true position and the phone's clock error,
// it produces what the phone would measure. The solvers never see `truthEcef`.
import { C } from './constants.js';
import { dist } from './linalg.js';
import { azEl } from './geo.js';
import { mulberry32, gaussian } from './rng.js';

/** Klobuchar obliquity (slant) factor: a low satellite's signal crosses more ionosphere. */
export function slantFactor(elDeg) {
  const E = Math.max(elDeg, 0) / 180; // elevation in semicircles
  return 1 + 16 * Math.pow(0.53 - E, 3);
}

/**
 * Pseudorange model:  ρᵢ = |sᵢ − r| + b + (shared delay) + (ionosphere) + noise
 *   |sᵢ − r|  true geometric distance from satellite i to the phone
 *   b         phone clock error × speed of light (the same for every satellite!)
 */
export function makeMeasurements({
  truthEcef, sats, clockErrorS = 0, noiseSigmaM = 0, seed = 1,
  elevMaskDeg = 10, commonDelayM = 0, ionoZenithM = 0,
}) {
  const b = clockErrorS * C;
  return sats.map((sat) => {
    const trueRange = dist(sat.ecef, truthEcef);
    const { az, el } = azEl(truthEcef, sat.ecef);
    // each satellite gets its own repeatable noise stream, so dragging one satellite
    // does not reshuffle the noise on the others
    const rand = mulberry32((seed * 1_000_003 + sat.id * 7_919) >>> 0);
    const noise = noiseSigmaM * gaussian(rand);
    const iono = ionoZenithM * slantFactor(el);
    const pseudorange = trueRange + b + commonDelayM + iono + noise;
    return {
      id: sat.id, prn: sat.prn, ecef: sat.ecef,
      trueRange, travelTimeMs: (trueRange / C) * 1000,
      pseudorange, az, el, visible: el > elevMaskDeg,
      errors: { clock: b, common: commonDelayM, iono, noise },
    };
  });
}
