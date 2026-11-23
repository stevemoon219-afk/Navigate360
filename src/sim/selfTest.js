// A known problem with a known answer, solved during the loading screen to prove the solver
// works in this browser. Satellites: Steve's 4-satellite test case (receiver 37.5°N 127°E,
// clock error 0.5 ms). Expected: ~4 iterations to sub-millimetre error.
import { latLonToEcef, satFromAzEl } from './geo.js';
import { dist } from './linalg.js';
import { C } from './constants.js';
import { gaussNewton4 } from './solver4.js';

export function runSelfTest() {
  const truth = latLonToEcef(37.5, 127.0, 0);
  const b = 0.0005 * C;
  const sats = [[20, 55], [110, 35], [200, 60], [290, 25]].map(([az, el]) => satFromAzEl(truth, az, el));
  const rho = sats.map((s) => dist(s, truth) + b);
  const t0 = performance.now();
  const sol = gaussNewton4(sats, rho);
  const ms = performance.now() - t0;
  const errors = sol.iterations.map((it) => dist(it.position, truth));
  return { ok: sol.status === 'ok' && errors[errors.length - 1] < 1e-3, errors, ms, clockM: sol.clockM, trueClockM: b };
}
