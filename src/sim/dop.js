// Dilution of precision: how much the satellite GEOMETRY multiplies range errors into
// position errors (Navipedia: "Positioning Error"). Depends only on satellite directions.
//   Q = (GᵀG)⁻¹ with rows [ −e, −n, −u, 1 ] (unit line-of-sight in local East/North/Up)
//   σ_position ≈ DOP × σ_range
import { sub, normalize, dot, transpose, matMul, inverse } from './linalg.js';
import { ecefToLatLon, enuBasis } from './geo.js';

export function computeDop(receiver, sats, { knownClock = false } = {}) {
  const need = knownClock ? 3 : 4;
  if (sats.length < need) return null;
  const { lat, lon } = ecefToLatLon(receiver);
  const { e, n, u } = enuBasis(lat, lon);
  const G = sats.map((s) => {
    const los = normalize(sub(s, receiver));
    const row = [-dot(los, e), -dot(los, n), -dot(los, u)];
    return knownClock ? row : [...row, 1];
  });
  const Q = inverse(matMul(transpose(G), G));
  if (!Q) return null;
  const qE = Q[0][0], qN = Q[1][1], qU = Q[2][2], qEN = Q[0][1];
  const qT = knownClock ? 0 : Q[3][3];
  // Horizontal error ellipse (1σ per unit range error): eigen-decomposition of the 2×2 E/N block
  const tr = qE + qN, det = qE * qN - qEN * qEN;
  const disc = Math.sqrt(Math.max(0, (tr * tr) / 4 - det));
  const l1 = tr / 2 + disc, l2 = Math.max(0, tr / 2 - disc);
  const angle = 0.5 * Math.atan2(2 * qEN, qE - qN); // radians from East toward North
  return {
    GDOP: Math.sqrt(qE + qN + qU + qT), PDOP: Math.sqrt(qE + qN + qU),
    HDOP: Math.sqrt(qE + qN), VDOP: Math.sqrt(qU), TDOP: Math.sqrt(qT),
    sigmaE: Math.sqrt(qE), sigmaN: Math.sqrt(qN), sigmaU: Math.sqrt(qU),
    ellipse: { a: Math.sqrt(l1), b: Math.sqrt(l2), angle },
  };
}
