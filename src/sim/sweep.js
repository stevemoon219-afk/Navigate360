// Position error as a function of the phone's clock error, for both solvers, with the current
// satellites and pin. Drawn as the "error vs clock error" chart. Every point is a real solve.
import { simulate } from './simulate.js';

export function sweepClock(inputs, { minS = -1e-3, maxS = 1e-3, steps = 81 } = {}) {
  const pts = [];
  for (let k = 0; k < steps; k++) {
    const clockErrorS = minS + ((maxS - minS) * k) / (steps - 1);
    const r = simulate({ ...inputs, clockErrorS, surfaceMode: false });
    pts.push({
      clockErrorS,
      err3: r.fix3.status === 'ok' ? r.fix3.error.total : null,
      err4: r.fix4.status === 'ok' ? r.fix4.error.total : null,
    });
  }
  return pts;
}
