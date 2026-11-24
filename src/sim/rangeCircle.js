// Where does the sphere "everything at distance ρ from satellite s" touch the Earth?
// Sphere ∩ Earth sphere = a small circle. Law of cosines gives its angular radius θ:
//   cos θ = (R² + d² − ρ²) / (2·R·d),   d = |s|
// With true distances, all circles cross exactly at the phone. With a wrong clock they miss.
import { R_EARTH } from './constants.js';
import { add, sub, scale, norm, normalize, cross } from './linalg.js';

export function earthCircle(sat, range, { R = R_EARTH, segments = 128 } = {}) {
  const d = norm(sat);
  const cosθ = (R * R + d * d - range * range) / (2 * R * d);
  if (Math.abs(cosθ) > 1) return null;
  const sinθ = Math.sqrt(1 - cosθ * cosθ);
  const u = normalize(sat);
  const helper = Math.abs(u[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
  const e1 = normalize(cross(u, helper));
  const e2 = cross(u, e1);
  const pts = [];
  for (let k = 0; k <= segments; k++) {
    const φ = (k / segments) * 2 * Math.PI;
    const dir = add(scale(u, cosθ), scale(add(scale(e1, Math.cos(φ)), scale(e2, Math.sin(φ))), sinθ));
    pts.push(scale(dir, R));
  }
  return pts;
}

// Two distance spheres meet along a circle in 3D space (not on the ground).
// With centres c1, c2 (separation d) and radii r1, r2, the circle's plane sits a distance
//   a = (d² + r1² − r2²) / (2d)
// from c1 along c1→c2, and its radius is h = √(r1² − a²).
// Three spheres: their pairwise circles all pass through the same two points (the 3-sat fix and its mirror).
export function sphereSphereCircle(c1, r1, c2, r2, { segments = 128 } = {}) {
  const v = sub(c2, c1);
  const d = norm(v);
  if (d === 0) return null;
  const a = (d * d + r1 * r1 - r2 * r2) / (2 * d);
  const h2 = r1 * r1 - a * a;
  if (h2 <= 0) return null; // spheres don't touch
  const h = Math.sqrt(h2);
  const u = scale(v, 1 / d);
  const centre = add(c1, scale(u, a));
  const helper = Math.abs(u[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
  const e1 = normalize(cross(u, helper));
  const e2 = cross(u, e1);
  const pts = [];
  for (let k = 0; k <= segments; k++) {
    const φ = (k / segments) * 2 * Math.PI;
    pts.push(add(centre, scale(add(scale(e1, Math.cos(φ)), scale(e2, Math.sin(φ))), h)));
  }
  return pts;
}
