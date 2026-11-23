import React, { useState } from 'react';
import { useStore } from '../state/store.js';
import { fmtDist, fmtTime } from './format.js';
import { C } from '../sim/constants.js';

const n2 = (x) => (x == null || !isFinite(x) ? '—' : x.toFixed(2));

/** Extra experiments for people who want to dig in after the main idea has landed. */
export default function DeepPanel({ sim }) {
  const s = useStore();
  const units = s.settings.units;
  const [knownClock, setKnownClock] = useState(false);
  const f4 = sim.fix4;
  const dop = f4.status === 'ok' ? (knownClock ? f4.dopKnownClock : f4.dop) : null;
  const its = f4.status === 'ok' ? f4.iterations : [];

  return (
    <div className="deep">
      {/* ---- 1. Geometry ---- */}
      <h4>1 · Geometry: dilution of precision (DOP)</h4>
      {dop ? (
        <>
          <table className="dop">
            <tbody>
              <tr><td>HDOP</td><td>{n2(dop.HDOP)}</td><td>VDOP</td><td>{n2(dop.VDOP)}</td></tr>
              <tr><td>PDOP</td><td>{n2(dop.PDOP)}</td><td>{knownClock ? '' : 'TDOP'}</td><td>{knownClock ? '' : n2(dop.TDOP)}</td></tr>
            </tbody>
          </table>
          <label className="check"><input type="checkbox" checked={knownClock} onChange={(e) => setKnownClock(e.target.checked)} /> Pretend the phone knows the exact time</label>
          <p className="explain">
            Position error ≈ DOP × distance error. DOP comes only from where the satellites are: try “Bunched” vs “Spread out”.
            Height (VDOP) is usually worst. Every satellite is above you, so “I’m lower” and “my clock is slow” look almost
            the same to the solver. Tick the box and see VDOP drop.
          </p>
        </>
      ) : <p className="explain">Needs 4+ satellites in view.</p>}

      {/* ---- 2. Watch the solver ---- */}
      <h4>2 · Watch the solver think</h4>
      {its.length ? (
        <>
          <div className="row wrap">
            <button className="mini" onClick={() => { s.set({ show: { ...s.show, iterations: true }, stepperK: Math.min(its.length, s.stepperK + 1) }); }}>Step ▸</button>
            <button className="mini" onClick={() => s.set({ show: { ...s.show, iterations: true }, stepperK: 0 })}>From Earth’s centre ↺</button>
            <button className="mini" onClick={() => s.set({ show: { ...s.show, iterations: false }, stepperK: 0 })}>Hide</button>
          </div>
          <ol className="iters">
            {its.map((it, i) => (
              <li key={i} className={i < s.stepperK ? 'shown' : ''}>
                guess #{i + 1}: {fmtDist(Math.hypot(...sim.truthEcef.map((v, j) => v - it.position[j])), units)} from the truth
              </li>
            ))}
          </ol>
          <p className="explain">
            The receiver starts at Earth’s centre with no idea where it is. Each step straightens the curved distance equations
            (their tangent), solves 4 small linear equations for x, y, z and clock, then repeats. The error roughly squares each step,
            so 4 steps reach sub-millimetre. The Earth turns see-through so you can follow the path.
          </p>
        </>
      ) : <p className="explain">Needs 4+ satellites in view.</p>}

      {/* ---- 3. Three satellites + an assumption ---- */}
      <h4>3 · Can 3 satellites ever work?</h4>
      <label className="check"><input type="checkbox" checked={s.surfaceMode} onChange={(e) => s.set({ surfaceMode: e.target.checked })} /> Let the 3-satellite phone assume “I’m on the ground”</label>
      {s.surfaceMode && (
        <>
          <div className="big-readout small">Phone altitude: {fmtDist(s.pin.altM || 0, units, 0)}</div>
          <input type="range" min={0} max={12000} step={100} value={s.pin.altM || 0} onChange={(e) => s.setPin({ altM: Number(e.target.value) })} />
          <p className="explain">
            Knowing your height is a 4th equation, so the clock becomes solvable (purple marker). Receivers really do this for a
            “2D fix”. But raise the phone into an aeroplane and the wrong assumption turns into position error:
            {sim.fixSurface?.status === 'ok' ? <b> now {fmtDist(sim.fixSurface.error.total, units)} off.</b> : ' (needs 3 satellites in view)'}
          </p>
        </>
      )}

      {/* ---- 4. Errors the 4th satellite can and can't fix ---- */}
      <h4>4 · Which errors does the 4th satellite remove?</h4>
      <div className="big-readout small">Delay added to every satellite: {fmtDist(s.commonDelayM, units, 0)}</div>
      <input type="range" min={0} max={500} step={5} value={s.commonDelayM} onChange={(e) => s.set({ commonDelayM: Number(e.target.value) })} />
      <p className="explain">
        A delay that is the same for every satellite looks exactly like a clock error, so the 4-satellite solver absorbs it into the
        clock: estimated {f4.status === 'ok' ? fmtTime(f4.clockM / C) : '—'}, position error {f4.status === 'ok' ? fmtDist(f4.error.total, units) : '—'}.
      </p>
      <div className="big-readout small">Ionosphere delay straight up: {fmtDist(s.ionoZenithM, units, 1)}</div>
      <input type="range" min={0} max={15} step={0.5} value={s.ionoZenithM} onChange={(e) => s.set({ ionoZenithM: Number(e.target.value) })} />
      <p className="explain">
        The charged upper atmosphere delays signals more for low satellites (longer slant path, Klobuchar slant factor), so this
        delay is <i>different</i> per satellite and can’t all be absorbed. It mostly shows up as height error:
        {f4.status === 'ok' ? ` sideways ${fmtDist(f4.error.horizontal, units)}, height ${fmtDist(f4.error.vertical, units)}.` : ''} Typical daytime values are 2–10 m.
      </p>

      <h4>5 · Sky mask</h4>
      <div className="seg">
        {[5, 10, 15, 30].map((m) => (
          <button key={m} className={s.settings.elevMaskDeg === m ? 'on' : ''} onClick={() => s.setSetting('elevMaskDeg', m)}>{m}°</button>
        ))}
      </div>
      <p className="explain">Satellites lower than this are ignored (low signals are noisy, or blocked by buildings and hills).</p>
    </div>
  );
}
