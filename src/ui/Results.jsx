import React, { useMemo } from 'react';
import { useStore } from '../state/store.js';
import { C } from '../sim/constants.js';
import { sweepClock } from '../sim/sweep.js';
import { fmtDist, fmtTime } from './format.js';

function heightText(e, units) {
  if (Math.abs(e.vertical) < 1) return '';
  return e.vertical < 0 ? `${fmtDist(-e.vertical, units)} underground` : `${fmtDist(e.vertical, units)} in the air`;
}

/** The payoff: what the phone gets with 3 satellites vs 4+, computed live. */
export function ComparisonCards({ sim }) {
  const units = useStore((s) => s.settings.units);
  const mode = useStore((s) => s.mode);
  const clockErrorS = useStore((s) => s.clockErrorS);
  const surfaceMode = useStore((s) => s.surfaceMode);
  const { fix3, fix4, fixSurface, visible } = sim;

  return (
    <div className="cards" data-coach="cards">
      <article className={`card c3 ${mode === '4' ? 'faded' : ''}`}>
        <header><b>3 SATELLITES</b><span>trusts its own clock</span></header>
        {fix3.status === 'ok' && (
          <>
            <div className="err">{fmtDist(fix3.error.total, units)}<small> off</small></div>
            <div className="sub">sideways {fmtDist(fix3.error.horizontal, units)}{heightText(fix3.error, units) && ` · ${heightText(fix3.error, units)}`}</div>
            <div className="clock">clock used: 0 (assumed perfect)</div>
          </>
        )}
        {fix3.status === 'noIntersection' && <div className="err bad">NO FIX<small> the 3 spheres don’t meet</small></div>}
        {(fix3.status === 'need3' || fix3.status === 'degenerate') && <div className="err bad">NO FIX<small> {fix3.status === 'need3' ? `only ${visible.length} satellite(s) in view` : 'satellites in a straight line'}</small></div>}
        {surfaceMode && fixSurface?.status === 'ok' && (
          <div className="surface">+ “I’m on the ground”: <b>{fmtDist(fixSurface.error.total, units)}</b> off · clock {fmtTime(fixSurface.clockM / C)}</div>
        )}
      </article>

      <article className={`card c4 ${mode === '3' ? 'faded' : ''}`}>
        <header><b>4+ SATELLITES</b><span>solves for its clock too</span></header>
        {fix4.status === 'ok' ? (
          <>
            <div className="err">{fmtDist(fix4.error.total, units)}<small> off</small></div>
            <div className="sub">using {fix4.used.length} satellites · {fix4.iterations.length} solver steps from Earth’s centre</div>
            <div className="clock">clock found: <b>{fmtTime(fix4.clockM / C, true)}</b> <span>(true {fmtTime(clockErrorS, true)})</span></div>
          </>
        ) : (
          <div className="err bad need4">NEED A 4TH<small> drag one from the sidebar onto the globe ({visible.length} in view)</small></div>
        )}
      </article>
    </div>
  );
}

const Y_MIN = -2, Y_MAX = 7; // log10 metres: 1 cm … 10,000 km
const yTicks = [[-2, '1 cm'], [0, '1 m'], [3, '1 km'], [6, '1000 km']];

/** Position error vs phone clock error for both solvers. Every point is a real solve. */
export function ErrorSweepChart({ sim }) {
  const { pin, sats, in3, noiseSigmaM, seed, commonDelayM, ionoZenithM, elevMaskDeg } = sim.inputs;
  const clockErrorS = sim.inputs.clockErrorS;
  const pts = useMemo(
    () => sweepClock({ pin, sats, in3, noiseSigmaM, seed, commonDelayM, ionoZenithM, elevMaskDeg }, { minS: -2e-3, maxS: 2e-3, steps: 81 }),
    [pin, sats, in3, noiseSigmaM, seed, commonDelayM, ionoZenithM, elevMaskDeg],
  );
  const W = 300, H = 150, L = 46, R = 8, T = 10, B = 22;
  const x = (s) => L + ((s + 2e-3) / 4e-3) * (W - L - R);
  const y = (m) => {
    const v = Math.max(Y_MIN, Math.min(Y_MAX, Math.log10(Math.max(m, 1e-9))));
    return T + (1 - (v - Y_MIN) / (Y_MAX - Y_MIN)) * (H - T - B);
  };
  const path = (key) => {
    let d = '', pen = false;
    for (const p of pts) {
      if (p[key] == null) { pen = false; continue; }
      d += `${pen ? 'L' : 'M'}${x(p.clockErrorS).toFixed(1)},${y(p[key]).toFixed(1)}`;
      pen = true;
    }
    return d;
  };
  const cur3 = sim.fix3.status === 'ok' ? sim.fix3.error.total : null;
  const cur4 = sim.fix4.status === 'ok' ? sim.fix4.error.total : null;
  const noFix = pts.filter((p) => p.err3 == null);
  return (
    <figure className="chart">
      <figcaption>Position error vs phone clock error <small>(each point = a real solve with your satellites)</small></figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Chart of position error against clock error for 3 and 4 satellites">
        {noFix.map((p, i) => (
          <rect key={i} x={x(p.clockErrorS) - 2} y={T} width={4} height={H - T - B} fill="rgba(255,90,90,0.12)" />
        ))}
        {yTicks.map(([v, l]) => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={y(10 ** v)} y2={y(10 ** v)} stroke="#2a3366" strokeDasharray="2 3" />
            <text x={L - 4} y={y(10 ** v) + 3} textAnchor="end" className="tick">{l}</text>
          </g>
        ))}
        {[-2, -1, 0, 1, 2].map((v) => (
          <text key={v} x={x(v * 1e-3)} y={H - 6} textAnchor="middle" className="tick">{v === 0 ? '0' : `${v > 0 ? '+' : ''}${v} ms`}</text>
        ))}
        <line x1={x(clockErrorS)} x2={x(clockErrorS)} y1={T} y2={H - B} stroke="#fff" strokeOpacity="0.5" />
        <path d={path('err3')} fill="none" stroke="#ff9f1c" strokeWidth="2.2" />
        <path d={path('err4')} fill="none" stroke="#4da3ff" strokeWidth="2.2" />
        {cur3 != null && <circle cx={x(clockErrorS)} cy={y(cur3)} r="4" fill="#ff9f1c" stroke="#000" />}
        {cur4 != null && <circle cx={x(clockErrorS)} cy={y(cur4)} r="4" fill="#4da3ff" stroke="#000" />}
      </svg>
      <div className="legend"><span className="l3">■ 3 satellites</span><span className="l4">■ 4+ satellites</span>{noFix.length > 0 && <span className="lnf">■ 3-sat: no fix</span>}</div>
    </figure>
  );
}

/** Per-satellite numbers, like the receiver would compute them. */
export function MeasurementTable({ sim }) {
  const units = useStore((s) => s.settings.units);
  const sats = useStore((s) => s.sats);
  return (
    <div className="table-wrap">
      <table className="meas">
        <caption>Receiver measurement table: what your phone works out from each signal</caption>
        <thead>
          <tr>
            <th>Satellite</th><th>Elevation</th><th title="Known only to the simulator, not to the phone">True distance*</th>
            <th>Travel time</th><th>Measured (pseudorange)</th><th>Extra from clock</th><th>Residual (4-sat fit)</th><th>Used</th>
          </tr>
        </thead>
        <tbody>
          {sim.meas.map((m) => {
            const sat = sats.find((s) => s.id === m.id);
            const r = sim.residualById[m.id];
            return (
              <tr key={m.id} className={m.visible ? '' : 'off'}>
                <td><i className="dot" style={{ background: sat?.color }} /> PRN {String(m.prn).padStart(2, '0')}</td>
                <td>{m.el.toFixed(1)}°</td>
                <td>{(m.trueRange / 1000).toLocaleString(undefined, { maximumFractionDigits: 3 })} km</td>
                <td>{m.travelTimeMs.toFixed(4)} ms</td>
                <td>{(m.pseudorange / 1000).toLocaleString(undefined, { maximumFractionDigits: 3 })} km</td>
                <td>{fmtDist(m.errors.clock, units)}</td>
                <td>{r == null ? '—' : fmtDist(r, units)}</td>
                <td>{!m.visible ? '✗ below mask' : `${sim.threeIds.includes(m.id) ? '③ ' : ''}${r != null ? '④' : ''}`}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="foot">* The phone never knows the true distance: it only sees the measured pseudorange = true distance + clock error × speed of light (+ noise). Residual = how badly the final answer fits that measurement. A wrong answer can still fit well!</p>
    </div>
  );
}
