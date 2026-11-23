// The full pipeline for one moment in time:
//   truth → measurements (universe) → [only satellite positions + pseudoranges] → solvers
// Everything shown on screen is derived from this function's output.
import { latLonToEcef, ecefToEnu } from './geo.js';
import { dist } from './linalg.js';
import { makeMeasurements } from './measurements.js';
import { gaussNewton4 } from './solver4.js';
import { trilaterate3 } from './solver3.js';
import { solve3Surface } from './solver3Surface.js';
import { computeDop } from './dop.js';

/** Which 3 satellites the 3-satellite solver uses: the user's picks if valid, else the first 3 in view. */
export function pickThree(visible, in3 = []) {
  const chosen = visible.filter((m) => in3.includes(m.id));
  if (chosen.length === 3) return chosen;
  return visible.slice(0, 3);
}

function errorReport(truth, position) {
  const [e, n, u] = ecefToEnu(truth, position);
  return { total: dist(truth, position), horizontal: Math.hypot(e, n), vertical: u, enu: [e, n, u] };
}

export function simulate(inputs) {
  const { pin, sats, in3 = [], surfaceMode = false } = inputs;
  const truthEcef = latLonToEcef(pin.lat, pin.lon, pin.altM || 0);
  const meas = makeMeasurements({ ...inputs, truthEcef });
  const visible = meas.filter((m) => m.visible);

  // ---- what the receiver is allowed to know: satellite positions + measured pseudoranges ----
  const three = pickThree(visible, in3);
  const fix3 = trilaterate3(three.map((m) => m.ecef), three.map((m) => m.pseudorange));
  if (fix3.status === 'ok') fix3.error = errorReport(truthEcef, fix3.position);

  const fix4 = gaussNewton4(visible.map((m) => m.ecef), visible.map((m) => m.pseudorange));
  if (fix4.status === 'ok') {
    fix4.error = errorReport(truthEcef, fix4.position);
    fix4.used = visible.map((m) => m.id);
    // DOP is computed at the receiver's own estimate (it never knows the truth)
    fix4.dop = computeDop(fix4.position, visible.map((m) => m.ecef));
    fix4.dopKnownClock = computeDop(fix4.position, visible.map((m) => m.ecef), { knownClock: true });
  }

  let fixSurface = null;
  if (surfaceMode && three.length === 3) {
    fixSurface = solve3Surface(three.map((m) => m.ecef), three.map((m) => m.pseudorange));
    if (fixSurface.status === 'ok') fixSurface.error = errorReport(truthEcef, fixSurface.position);
  }

  // per-satellite residuals from the 4-satellite fit (for the measurement table)
  const residualById = {};
  if (fix4.status === 'ok') fix4.used.forEach((id, i) => { residualById[id] = fix4.residuals[i]; });

  return {
    truthEcef, meas, visible,
    threeIds: three.map((m) => m.id),
    fix3, fix4, fixSurface, residualById,
  };
}
