// Gauss–Newton least squares for 4 unknowns: position (x, y, z) and clock error b (metres).
// This is what a GPS receiver does (Navipedia: "Code Based Positioning (SPS)").
//
//   predicted range   ρ̂ᵢ = |sᵢ − r| + b
//   one row of G      [ −(sᵢ − r)ᵀ / |sᵢ − r| ,  1 ]   ← the "1" is the clock column
//   update            Δ = (GᵀG)⁻¹ Gᵀ (ρ − ρ̂),   x ← x + Δ
//
// Start from Earth's centre with clock 0 — the receiver needs no prior idea where it is.
import { sub, norm, transpose, matMul, matVec, solveLinear } from './linalg.js';

export function gaussNewton4(sats, rho, { x0 = [0, 0, 0, 0], maxIter = 10, tol = 1e-4 } = {}) {
  if (sats.length < 4) return { status: 'need4', have: sats.length };
  let x = [...x0];
  const iterations = [];
  let G = null, residuals = null, converged = false;
  for (let k = 0; k < maxIter; k++) {
    const r = x.slice(0, 3), b = x[3];
    G = []; residuals = [];
    sats.forEach((s, i) => {
      const d = sub(s, r);
      const range = norm(d);
      G.push([-d[0] / range, -d[1] / range, -d[2] / range, 1]);
      residuals.push(rho[i] - (range + b)); // measured minus predicted
    });
    const Gt = transpose(G);
    const delta = solveLinear(matMul(Gt, G), matVec(Gt, residuals));
    if (!delta) return { status: 'singular', iterations };
    x = x.map((v, i) => v + delta[i]);
    iterations.push({ position: x.slice(0, 3), clockM: x[3], step: norm(delta) });
    if (norm(delta) < tol) { converged = true; break; }
  }
  // final residuals at the solution: how well the answer fits each measurement
  const r = x.slice(0, 3);
  const finalResiduals = sats.map((s, i) => rho[i] - (norm(sub(s, r)) + x[3]));
  return { status: 'ok', position: r, clockM: x[3], iterations, residuals: finalResiduals, G, converged };
}
