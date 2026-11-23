// 3 satellites + the assumption "I'm on Earth's surface" (|r| = R_EARTH + assumed height).
// That extra equation replaces the missing 4th satellite, so the clock CAN be solved —
// this is roughly how receivers make a "2D fix" with only 3 satellites. If the phone is
// really higher (a plane, a mountain), the wrong assumption turns into position error.
import { R_EARTH } from './constants.js';
import { add, sub, norm, normalize, scale, transpose, matMul, matVec, solveLinear } from './linalg.js';

export function solve3Surface(sats, rho, { assumedHeight = 0, maxIter = 15, tol = 1e-4 } = {}) {
  if (sats.length < 3) return { status: 'need3' };
  // Earth's centre can't be the start here (the height equation has no slope there), so start on
  // the ground directly beneath the average satellite direction — the receiver can see them, so
  // it must be roughly under them.
  const mean = sats.reduce((a, s) => add(a, normalize(s)), [0, 0, 0]);
  let x = [...scale(normalize(mean), R_EARTH), 0];
  const R = R_EARTH + assumedHeight;
  for (let k = 0; k < maxIter; k++) {
    const r = x.slice(0, 3), b = x[3];
    const G = [], res = [];
    sats.forEach((s, i) => {
      const d = sub(s, r), range = norm(d);
      G.push([-d[0] / range, -d[1] / range, -d[2] / range, 1]);
      res.push(rho[i] - (range + b));
    });
    const rn = norm(r);
    G.push([r[0] / rn, r[1] / rn, r[2] / rn, 0]); // the "height" pseudo-measurement
    res.push(R - rn);
    const Gt = transpose(G);
    const delta = solveLinear(matMul(Gt, G), matVec(Gt, res));
    if (!delta) return { status: 'singular' };
    x = x.map((v, i) => v + delta[i]);
    if (norm(delta) < tol) break;
  }
  return { status: 'ok', position: x.slice(0, 3), clockM: x[3] };
}
