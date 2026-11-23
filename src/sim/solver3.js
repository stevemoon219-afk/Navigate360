// "Trust my clock" mode: 3 satellites, 3 unknowns (x, y, z). The clock error is ASSUMED to be 0.
// Exact intersection of three spheres (classic trilateration). A sphere has radius = measured
// pseudorange around each satellite. Three spheres meet in 0, 1 or 2 points.
import { R_EARTH } from './constants.js';
import { add, sub, scale, dot, norm, normalize, cross } from './linalg.js';

export function trilaterate3(sats, rho) {
  if (sats.length < 3) return { status: 'need3', have: sats.length };
  const [P1, P2, P3] = sats;
  const [r1, r2, r3] = rho;
  // Build a local frame: ex points from sat 1 to sat 2, ey in the plane of the three sats.
  const d = norm(sub(P2, P1));
  const ex = scale(sub(P2, P1), 1 / d);
  const i = dot(ex, sub(P3, P1));
  const eyRaw = sub(sub(P3, P1), scale(ex, i));
  if (norm(eyRaw) < 1) return { status: 'degenerate' }; // satellites in a straight line
  const ey = normalize(eyRaw);
  const ez = cross(ex, ey);
  const j = dot(ey, sub(P3, P1));
  // Coordinates of the intersection in that frame
  const x = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
  const y = (r1 * r1 - r3 * r3 + i * i + j * j) / (2 * j) - (i / j) * x;
  const z2 = r1 * r1 - x * x - y * y;
  if (z2 < 0) return { status: 'noIntersection' }; // the three spheres never meet
  const z = Math.sqrt(z2);
  const base = add(P1, add(scale(ex, x), scale(ey, y)));
  const rootA = add(base, scale(ez, z));
  const rootB = sub(base, scale(ez, z)); // mirror image across the satellites' plane
  // Pick the root nearer Earth's surface; the other is the "ghost" (usually far out in space).
  const offA = Math.abs(norm(rootA) - R_EARTH), offB = Math.abs(norm(rootB) - R_EARTH);
  const [position, ghost] = offA <= offB ? [rootA, rootB] : [rootB, rootA];
  return { status: 'ok', position, ghost };
}
