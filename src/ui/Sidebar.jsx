import React, { useState } from 'react';
import { useStore, MAX_SATS } from '../state/store.js';
import { C } from '../sim/constants.js';
import { fmtDist, fmtTime, fmtLatLon } from './format.js';
import DeepPanel from './DeepPanel.jsx';

const PLACES = [
  ['Seoul', 37.5665, 126.978], ['London', 51.5072, -0.1276], ['New York', 40.7128, -74.006],
  ['Sydney', -33.8688, 151.2093], ['Nairobi', -1.2921, 36.8219], ['Reykjavík', 64.1466, -21.9426],
  ['Quito (equator)', -0.1807, -78.4678], ['North Pole', 89.9, 0],
];

function Section({ title, icon, children, defaultOpen = true, coach }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={`sb-section ${open ? 'open' : ''}`} data-coach={coach}>
      <button className="sb-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span>{icon} {title}</span><span className="chev">{open ? '▾' : '▸'}</span>
      </button>
      {open && <div className="sb-body">{children}</div>}
    </section>
  );
}

function Toggle({ label, k }) {
  const on = useStore((s) => s.show[k]);
  const toggle = useStore((s) => s.toggleShow);
  return (
    <label className="check">
      <input type="checkbox" checked={on} onChange={() => toggle(k)} /> {label}
    </label>
  );
}

/** Drag this tile onto the globe to launch another satellite. */
function SatelliteDock() {
  const count = useStore((s) => s.sats.length);
  const full = count >= MAX_SATS;
  const onDown = (e) => {
    if (full) return;
    e.preventDefault();
    const c = useStore.getState()._controls;
    if (c) c.enabled = false;
    useStore.setState({ drag: { kind: 'dock' }, dockGhost: [e.clientX, e.clientY] });
  };
  return (
    <div className={`dock ${full ? 'full' : ''}`} onPointerDown={onDown} data-coach="dock" role="button" tabIndex={0}
      aria-label="Drag a new satellite onto the globe">
      <svg viewBox="0 0 16 16" shapeRendering="crispEdges" aria-hidden="true">
        <rect x="0" y="5" width="5" height="6" fill="#3d7bd9" /><rect x="11" y="5" width="5" height="6" fill="#3d7bd9" />
        <rect x="5" y="7" width="6" height="2" fill="#9fb4d9" /><rect x="6" y="4" width="4" height="8" fill="#ffd24a" />
      </svg>
      <div>
        <b>{full ? 'Sky is full' : 'Drag me onto the globe →'}</b>
        <small>{count}/{MAX_SATS} satellites · drop back here to cancel</small>
      </div>
    </div>
  );
}

export default function Sidebar({ sim }) {
  const s = useStore();
  const units = s.settings.units;
  const bM = s.clockErrorS * C;
  const visibleCount = sim.visible.length;

  return (
    <aside className={`sidebar ${s.sidebarOpen ? '' : 'closed'}`} aria-label="Controls">
      <div className="sb-top">
        <button className="logo" onClick={() => s.setScreen('title')} title="Back to the main menu">◂ NAVIGATE360</button>
        <button className="collapse" onClick={() => s.set({ sidebarOpen: false })} title="Hide panel">◀</button>
      </div>

      <Section title="Mission" icon="🎯">
        <ol className="mission">
          <li className={s.coach.step > 0 ? 'done' : ''}>Move your phone (the green pin)</li>
          <li className={s.coach.step > 1 ? 'done' : ''}>See 3 satellites miss</li>
          <li className={s.coach.step > 2 ? 'done' : ''}>Add a 4th satellite</li>
          <li className={s.coach.step > 3 ? 'done' : ''}>Change the clock error</li>
        </ol>
        <button className="mini" onClick={s.restartTour}>↺ Restart guided tour</button>
      </Section>

      <Section title="Your phone" icon="📍" coach="pin">
        <div className="readout">{fmtLatLon(s.pin.lat, s.pin.lon)}</div>
        <div className="row">
          <button className={`mini ${s.dropPinArmed ? 'armed' : ''}`} onClick={() => s.set({ dropPinArmed: !s.dropPinArmed })}>
            {s.dropPinArmed ? 'Click the globe…' : '📍 Drop pin'}
          </button>
          <select className="mini" value="" onChange={(e) => { const p = PLACES[e.target.value]; if (p) { s.setPin({ lat: p[1], lon: p[2] }); s.requestCam('space'); } }}>
            <option value="">Jump to…</option>
            {PLACES.map((p, i) => <option key={p[0]} value={i}>{p[0]}</option>)}
          </select>
        </div>
        <p className="hint">Drag the pin, double-click the globe, or use “Drop pin”.</p>
      </Section>

      <Section title={`Satellites (${visibleCount} in view)`} icon="🛰" coach="sats">
        <SatelliteDock />
        <ul className="sat-list">
          {s.sats.map((sat) => {
            const m = sim.meas.find((x) => x.id === sat.id);
            const in3 = sim.threeIds.includes(sat.id);
            return (
              <li key={sat.id} className={m?.visible ? '' : 'off'}>
                <i className="dot" style={{ background: sat.color }} />
                <span className="prn">PRN {String(sat.prn).padStart(2, '0')}</span>
                <span className="el">{m?.visible ? `${m.el.toFixed(0)}° up` : 'below horizon'}</span>
                <label className="use3" title="Use this satellite in the 3-satellite solver">
                  <input type="checkbox" checked={in3} disabled={!m?.visible} onChange={() => s.toggleIn3(sat.id)} />③
                </label>
                <button className="x" onClick={() => s.removeSat(sat.id)} title="Remove satellite">✕</button>
              </li>
            );
          })}
        </ul>
        <div className="row wrap">
          <button className="mini" onClick={() => s.applyPreset('spread', 6)} title="Satellites spread across the sky: good geometry">Spread out</button>
          <button className="mini" onClick={() => s.applyPreset('bunched', 6)} title="Satellites bunched together: bad geometry">Bunched</button>
          <button className="mini" onClick={() => s.applyPreset('line', 6)} title="Satellites in a line">In a line</button>
          <button className="mini" onClick={s.resetSky}>Reset</button>
        </div>
      </Section>

      <Section title="Phone clock error" icon="⏱" coach="clock">
        <div className="big-readout">{fmtTime(s.clockErrorS)} <span>{s.clockErrorS >= 0 ? 'fast' : 'slow'}</span></div>
        <input type="range" min={-2} max={2} step={0.001} value={s.clockErrorS * 1000}
          onChange={(e) => s.setClock(Number(e.target.value) / 1000)} aria-label="Phone clock error in milliseconds" />
        <div className="scale"><span>−2 ms</span><span>0</span><span>+2 ms</span></div>
        <p className="explain">
          Radio waves travel {fmtDist(C * 1e-6, units, 0)} per microsecond, so every measured distance is
          <b> {fmtDist(Math.abs(bM), units)} too {bM >= 0 ? 'long' : 'short'}</b>, by the same amount for every satellite.
        </p>
        <div className="row wrap">
          <button className="mini" onClick={() => s.setClock(0)}>Perfect clock</button>
          <button className="mini" onClick={() => s.setClock(1e-6)}>1 µs</button>
          <button className="mini" onClick={() => s.setClock(1e-5)}>10 µs</button>
          <button className="mini" onClick={() => s.setClock(1e-3)}>1 ms</button>
        </div>
      </Section>

      <Section title="Compare" icon="⚖">
        <div className="seg">
          {[['3', '3 satellites'], ['compare', 'Both'], ['4', '4+ satellites']].map(([k, l]) => (
            <button key={k} className={s.mode === k ? 'on' : ''} onClick={() => s.set({ mode: k })}>{l}</button>
          ))}
        </div>
        <p className="hint">③ = the satellites the 3-satellite solver uses (tick to choose).</p>
      </Section>

      <Section title="Show on globe" icon="👁" defaultOpen={false}>
        <Toggle label="Distance circles on the ground" k="circles" />
        <Toggle label="Circles after removing the solved clock error" k="corrected" />
        <Toggle label="Signal paths & pulses (slowed ~20×)" k="rays" />
        <Toggle label="3-sat mirror solution (ghost)" k="ghost" />
      </Section>

      <Section title="Measurement noise" icon="🎲" defaultOpen={false}>
        <div className="big-readout">σ = {fmtDist(s.noiseSigmaM, units, 1)}</div>
        <input type="range" min={0} max={30} step={0.5} value={s.noiseSigmaM} onChange={(e) => s.set({ noiseSigmaM: Number(e.target.value) })} />
        <p className="explain">Random error added to each distance (different for every satellite). The 4th satellite can’t remove this: it only removes errors that are the same for all satellites.</p>
        <button className="mini" onClick={() => s.set({ seed: s.seed + 1 })}>🎲 New random draw (seed {s.seed})</button>
      </Section>

      <Section title="Go deeper" icon="🔬" defaultOpen={false}>
        <DeepPanel sim={sim} />
      </Section>
    </aside>
  );
}
