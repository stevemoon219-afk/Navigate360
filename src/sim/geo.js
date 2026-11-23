// Coordinate conversions.
// ECEF = Earth-Centred, Earth-Fixed: origin at Earth's centre, Z through the North Pole,
// X through latitude 0 / longitude 0. ENU = local East-North-Up axes at a point on Earth.
import { R_EARTH, R_ORBIT, DEG } from './constants.js';
import { add, scale, sub, dot, norm } from './linalg.js';

export function latLonToEcef(latDeg, lonDeg, h = 0) {
  const φ = latDeg * DEG, λ = lonDeg * DEG, r = R_EARTH + h;
  return [r * Math.cos(φ) * Math.cos(λ), r * Math.cos(φ) * Math.sin(λ), r * Math.sin(φ)];
}

/** Spherical-Earth inverse: returns {lat, lon, h} (h = height above the sphere, metres). */
export function ecefToLatLon(p) {
  const r = norm(p);
  return { lat: Math.asin(p[2] / r) / DEG, lon: Math.atan2(p[1], p[0]) / DEG, h: r - R_EARTH };
}

/** Unit vectors East, North, Up at a given latitude/longitude, expressed in ECEF. */
export function enuBasis(latDeg, lonDeg) {
  const φ = latDeg * DEG, λ = lonDeg * DEG;
  return {
    e: [-Math.sin(λ), Math.cos(λ), 0],
    n: [-Math.sin(φ) * Math.cos(λ), -Math.sin(φ) * Math.sin(λ), Math.cos(φ)],
    u: [Math.cos(φ) * Math.cos(λ), Math.cos(φ) * Math.sin(λ), Math.sin(φ)],
  };
}

/** Express point p relative to reference point ref in local East/North/Up metres. */
export function ecefToEnu(ref, p) {
  const { lat, lon } = ecefToLatLon(ref);
  const { e, n, u } = enuBasis(lat, lon);
  const d = sub(p, ref);
  return [dot(e, d), dot(n, d), dot(u, d)];
}

/** Inverse of ecefToEnu. */
export function enuToEcef(ref, enu) {
  const { lat, lon } = ecefToLatLon(ref);
  const { e, n, u } = enuBasis(lat, lon);
  return add(ref, add(add(scale(e, enu[0]), scale(n, enu[1])), scale(u, enu[2])));
}

/** Azimuth (clockwise from north) and elevation of a satellite seen from a receiver, degrees. */
export function azEl(receiver, sat) {
  const [e, n, u] = ecefToEnu(receiver, sat);
  return { az: ((Math.atan2(e, n) / DEG) + 360) % 360, el: Math.atan2(u, Math.hypot(e, n)) / DEG };
}

/**
 * Place a satellite on the GPS orbit sphere so that, seen from the receiver, it sits at
 * the given azimuth/elevation. Solves |receiver + t·d| = R_ORBIT for the distance t.
 */
export function satFromAzEl(receiver, azDeg, elDeg, orbitR = R_ORBIT) {
  const { lat, lon } = ecefToLatLon(receiver);
  const { e, n, u } = enuBasis(lat, lon);
  const az = azDeg * DEG, el = elDeg * DEG;
  const d = add(add(scale(e, Math.cos(el) * Math.sin(az)), scale(n, Math.cos(el) * Math.cos(az))), scale(u, Math.sin(el)));
  const b = dot(receiver, d);
  const t = -b + Math.sqrt(b * b - dot(receiver, receiver) + orbitR * orbitR);
  return add(receiver, scale(d, t));
}

// ---- Render frame ----------------------------------------------------------------
// Three.js uses Y-up. Our Earth texture on THREE.SphereGeometry puts longitude 0 on +x,
// longitude 90°E on −z and the North Pole on +y. So render = (X, Z, −Y) / R_EARTH.
// This is the ONLY place that mapping is defined — always use these two functions.
export const ecefToRender = (p) => [p[0] / R_EARTH, p[2] / R_EARTH, -p[1] / R_EARTH];
export const renderToEcef = (v) => [v[0] * R_EARTH, -v[2] * R_EARTH, v[1] * R_EARTH];

/** Great-circle surface distance between two ECEF points projected onto the sphere, metres. */
export function surfaceDistance(a, b) {
  const c = dot(a, b) / (norm(a) * norm(b));
  return R_EARTH * Math.acos(Math.min(1, Math.max(-1, c)));
}
