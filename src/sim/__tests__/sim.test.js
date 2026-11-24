import { describe, it, expect } from 'vitest';
import tv from './test_vectors.json';
import { C, R_EARTH } from '../constants.js';
import { dist, norm } from '../linalg.js';
import { latLonToEcef, ecefToLatLon, satFromAzEl, azEl, ecefToRender, renderToEcef, ecefToEnu, enuToEcef } from '../geo.js';
import { gaussNewton4 } from '../solver4.js';
import { trilaterate3 } from '../solver3.js';
import { solve3Surface } from '../solver3Surface.js';
import { computeDop } from '../dop.js';
import { earthCircle, sphereSphereCircle } from '../rangeCircle.js';
import { simulate } from '../simulate.js';
import { sweepClock } from '../sweep.js';
import { runSelfTest } from '../selfTest.js';

const truth = tv.receiver_ecef;

describe("Steve's test vectors (test_vectors.json)", () => {
  it('receiver ECEF matches', () => {
    expect(dist(latLonToEcef(37.5, 127.0, 0), truth)).toBeLessThan(1e-6);
  });

  for (const [name, c] of Object.entries(tv.cases)) {
    it(`${name}: satellites from az/el match`, () => {
      c.azel_deg.forEach(([az, el], i) => {
        expect(dist(satFromAzEl(truth, az, el), c.sats_ecef[i])).toBeLessThan(1e-3);
      });
    });

    it(`${name}: Gauss-Newton error per iteration matches`, () => {
      const sol = gaussNewton4(c.sats_ecef, c.pseudoranges, { tol: 0, maxIter: 10 });
      const expected = c.gauss_newton_position_error_by_iteration;
      for (let k = 0; k < 4; k++) {
        const err = dist(sol.iterations[k].position, truth);
        // relative agreement for big errors, absolute for tiny ones
        expect(Math.abs(err - expected[k])).toBeLessThan(Math.max(1e-6 * expected[k], 1e-5));
      }
      expect(Math.abs(sol.clockM - tv.constants.clock_error_m)).toBeLessThan(1e-4);
    });

    it(`${name}: DOP matches`, () => {
      const d = computeDop(truth, c.sats_ecef);
      for (const k of ['GDOP', 'PDOP', 'TDOP', 'HDOP', 'VDOP']) expect(d[k]).toBeCloseTo(c.dop[k], 6);
    });
  }
});

describe('geometry helpers', () => {
  it('lat/lon round trip', () => {
    const p = latLonToEcef(-33.9, 151.2, 1234);
    const q = ecefToLatLon(p);
    expect(q.lat).toBeCloseTo(-33.9, 9); expect(q.lon).toBeCloseTo(151.2, 9); expect(q.h).toBeCloseTo(1234, 6);
  });
  it('render mapping: lon 0 → +x, lon 90E → −z, north → +y, and inverts', () => {
    expect(ecefToRender(latLonToEcef(0, 0))[0]).toBeCloseTo(1, 9);
    expect(ecefToRender(latLonToEcef(0, 90))[2]).toBeCloseTo(-1, 9);
    expect(ecefToRender(latLonToEcef(90, 0))[1]).toBeCloseTo(1, 9);
    const p = latLonToEcef(37, 127);
    expect(dist(renderToEcef(ecefToRender(p)), p)).toBeLessThan(1e-6);
  });
  it('ENU round trip and az/el of a placed satellite', () => {
    const s = satFromAzEl(truth, 123, 45);
    const ae = azEl(truth, s);
    expect(ae.az).toBeCloseTo(123, 9); expect(ae.el).toBeCloseTo(45, 9);
    expect(dist(enuToEcef(truth, ecefToEnu(truth, s)), s)).toBeLessThan(1e-6);
  });
});

describe('solvers', () => {
  const sats = [[20, 55], [110, 35], [200, 60], [290, 25]].map(([a, e]) => satFromAzEl(truth, a, e));
  const ranges = sats.map((s) => dist(s, truth));

  it('3 satellites + perfect clock recovers the truth', () => {
    const r = trilaterate3(sats.slice(0, 3), ranges.slice(0, 3));
    expect(r.status).toBe('ok');
    expect(dist(r.position, truth)).toBeLessThan(1e-3);
    expect(norm(r.ghost)).toBeGreaterThan(R_EARTH * 1.2); // mirror root is out in space
  });

  it('3 satellites + 0.5 ms clock error lands far away', () => {
    const b = 0.0005 * C;
    const r = trilaterate3(sats.slice(0, 3), ranges.slice(0, 3).map((x) => x + b));
    expect(r.status).toBe('ok');
    expect(dist(r.position, truth)).toBeGreaterThan(10_000);
  });

  it('4 satellites + 0.5 ms clock error recovers truth and clock', () => {
    const b = 0.0005 * C;
    const r = gaussNewton4(sats, ranges.map((x) => x + b));
    expect(dist(r.position, truth)).toBeLessThan(1e-3);
    expect(Math.abs(r.clockM - b)).toBeLessThan(1e-3);
  });

  it('3 satellites + surface assumption solves the clock when the phone is on the ground', () => {
    const b = 0.0005 * C;
    const r = solve3Surface(sats.slice(0, 3), ranges.slice(0, 3).map((x) => x + b));
    expect(r.status).toBe('ok');
    expect(dist(r.position, truth)).toBeLessThan(1e-2);
  });

  it('fewer than 4 satellites → need4', () => {
    expect(gaussNewton4(sats.slice(0, 3), ranges.slice(0, 3)).status).toBe('need4');
  });

  it('range circles pass through the phone when the clock is perfect', () => {
    sats.forEach((s, i) => {
      const pts = earthCircle(s, ranges[i], { segments: 2000 });
      const closest = Math.min(...pts.map((p) => dist(p, truth)));
      expect(closest).toBeLessThan(R_EARTH * 2 * Math.PI / 2000); // within one segment
    });
  });

  it('every pair of 3D distance spheres meets in a circle through the phone', () => {
    for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) {
      const pts = sphereSphereCircle(sats[i], ranges[i], sats[j], ranges[j], { segments: 4000 });
      pts.forEach((p) => {
        expect(Math.abs(dist(p, sats[i]) - ranges[i])).toBeLessThan(1e-3);
        expect(Math.abs(dist(p, sats[j]) - ranges[j])).toBeLessThan(1e-3);
      });
      const closest = Math.min(...pts.map((p) => dist(p, truth)));
      expect(closest).toBeLessThan(2 * Math.PI * R_EARTH * 4 / 4000);
    }
  });

  it('known-clock DOP has smaller VDOP (the clock is tangled with height)', () => {
    const c8 = tv.cases['8 sats'].sats_ecef;
    expect(computeDop(truth, c8, { knownClock: true }).VDOP).toBeLessThan(computeDop(truth, c8).VDOP);
  });
});

describe('pipeline', () => {
  const pin = { lat: 37.5, lon: 127.0, altM: 0 };
  const sats = [[20, 55], [110, 35], [200, 60], [290, 25]].map(([a, e], i) => ({ id: i + 1, prn: i + 1, ecef: satFromAzEl(truth, a, e) }));
  it('simulate: 3-sat fix is off, 4-sat fix is exact (no noise)', () => {
    const r = simulate({ pin, sats, clockErrorS: 0.0005 });
    expect(r.fix3.error.total).toBeGreaterThan(10_000);
    expect(r.fix4.error.total).toBeLessThan(1e-3);
  });
  it('a delay shared by every satellite is absorbed into the clock, not the position', () => {
    const r = simulate({ pin, sats, clockErrorS: 0, commonDelayM: 50 });
    expect(r.fix4.error.total).toBeLessThan(1e-3);
    expect(r.fix4.clockM).toBeCloseTo(50, 3);
  });
  it('sweep: 4-sat error flat, 3-sat error zero only at zero clock error', () => {
    const pts = sweepClock({ pin, sats }, { steps: 21 });
    pts.forEach((p) => expect(p.err4).toBeLessThan(1e-3));
    const mid = pts[10];
    expect(Math.abs(mid.clockErrorS)).toBeLessThan(1e-12);
    expect(mid.err3).toBeLessThan(1e-3);
  });
  it('self test passes', () => {
    expect(runSelfTest().ok).toBe(true);
  });
});
