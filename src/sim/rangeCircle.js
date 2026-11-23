// Where does the sphere "everything at distance ρ from satellite s" touch the Earth?
// Sphere ∩ Earth sphere = a small circle. Law of cosines gives its angular radius θ:
//   cos θ = (R² + d² − ρ²) / (2·R·d),   d = |s|
// With true distances, all circles cross exactly at the phone. With a wrong clock they miss.
import { R_EARTH } from './constants.js';
import { add, scale, norm, normalize, cross } from './linalg.js';

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
