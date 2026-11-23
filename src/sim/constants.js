// Physical constants and model parameters (all SI units: metres, seconds).
// Simplification: Earth is a perfect sphere (real GPS uses the WGS84 ellipsoid).

export const C = 299_792_458;          // speed of light, m/s
export const R_EARTH = 6_371_000;      // mean Earth radius, m (spherical model)
export const R_ORBIT = 26_560_000;     // GPS orbit radius from Earth's centre, m (≈20,200 km altitude)
export const ORBIT_RENDER = R_ORBIT / R_EARTH; // orbit radius in render units (Earth radius = 1)
export const DEG = Math.PI / 180;
