import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker, Polygon, CircleMarker, Polyline, useMap, useMapEvents } from 'react-leaflet';
import { useStore } from '../state/store.js';
import { enuToEcef, ecefToLatLon } from '../sim/geo.js';
import { monteCarloCloud } from '../sim/monteCarlo.js';
import { fmtDist } from './format.js';

const K95 = 2.4477; // 95% of a 2-D normal distribution lies inside 2.4477 σ
const icon = (cls, html = '') => L.divIcon({ className: '', html: `<div class="gm-icon ${cls}">${html}</div>`, iconSize: [0, 0] });
const PIN_ICON = icon('pin', '📱');
const FIX4_ICON = icon('fix4');
const FIX3_ICON = icon('fix3');

const toLatLng = (truth, enu) => { const { lat, lon } = ecefToLatLon(enuToEcef(truth, [enu[0], enu[1], 0])); return [lat, lon]; };

function ClickToMovePin() {
  const setPin = useStore((s) => s.setPin);
  useMapEvents({ click: (e) => setPin({ lat: e.latlng.lat, lon: e.latlng.lng }) });
  return null;
}

/** Keeps the map centred on the phone and zoomed so the 95% error ellipse is clearly visible. */
function AutoView({ center, r95 }) {
  const map = useMap();
  useEffect(() => {
    const mpp = 120; // aim: 95% radius ≈ 120 screen pixels
    const z = r95 > 0 ? Math.log2((156543.03 * Math.cos((center[0] * Math.PI) / 180) * mpp) / r95) : 17;
    map.setView(center, Math.max(3, Math.min(21, Math.round(z))), { animate: true });
  }, [Math.round(r95 * 10)]);
  return null;
}

/** When the 3-satellite fix is off-screen (usually hundreds of km away), point at it from the edge. */
function OffscreenArrow({ target, label }) {
  const map = useMap();
  const [, force] = useState(0);
  const ref = useRef();
  useMapEvents({ move: () => force((n) => n + 1), zoom: () => force((n) => n + 1) });
  useEffect(() => { if (ref.current) { L.DomEvent.disableClickPropagation(ref.current); L.DomEvent.disableScrollPropagation(ref.current); } });
  if (!target) return null;
  const size = map.getSize();
  const p = map.latLngToContainerPoint(target);
  if (p.x > 0 && p.y > 0 && p.x < size.x && p.y < size.y) return null;
  const cx = size.x / 2, cy = size.y / 2;
  const ang = Math.atan2(p.y - cy, p.x - cx);
  // keep the arrow inside the free area between the side panels and below the headline
  const rx = Math.max(80, cx - 520), ry = Math.max(60, cy - 130);
  const t = Math.min(Math.abs(rx / Math.cos(ang)), Math.abs(ry / Math.sin(ang)));
  return (
    <div ref={ref} className="gm-arrow" style={{ left: cx + Math.cos(ang) * t, top: cy + Math.sin(ang) * t }}
      onClick={() => map.flyToBounds(L.latLngBounds([map.getCenter(), target]).pad(0.3), { duration: 1.2 })}>
      <span style={{ transform: `rotate(${ang}rad)` }}>➜</span>
      <b>{label}</b><small>click to fly there</small>
    </div>
  );
}

/** Offline fallback: our own metre grid with the same markers (no map tiles needed). */
function GridFallback({ cloud, fix4enu, r95, units }) {
  const ext = Math.max(20, r95 * 1.6, ...cloud.map((p) => Math.hypot(p[0], p[1]) * 1.1), fix4enu ? Math.hypot(fix4enu[0], fix4enu[1]) * 1.3 : 0);
  const S = 400, k = S / 2 / ext;
  const step = 10 ** Math.floor(Math.log10(ext / 2));
  const lines = [];
  for (let v = -Math.floor(ext / step) * step; v <= ext; v += step) lines.push(v);
  return (
    <div className="gm-grid">
      <svg viewBox={`${-S / 2} ${-S / 2} ${S} ${S}`}>
        {lines.map((v) => <g key={v}><line x1={v * k} x2={v * k} y1={-S} y2={S} stroke="#1f2a55" /><line y1={-v * k} y2={-v * k} x1={-S} x2={S} stroke="#1f2a55" /></g>)}
        {cloud.map((p, i) => <circle key={i} cx={p[0] * k} cy={-p[1] * k} r="2" fill="#4da3ff" opacity="0.55" />)}
        <circle cx="0" cy="0" r="7" fill="#39ff88" />
        {fix4enu && <circle cx={fix4enu[0] * k} cy={-fix4enu[1] * k} r="8" fill="none" stroke="#4da3ff" strokeWidth="3" />}
        <text x={-S / 2 + 8} y={S / 2 - 10} fill="#9aa5cc" fontSize="12">grid: {fmtDist(step, units)} · N ↑</text>
      </svg>
      <p>Street-map tiles couldn’t load (offline?). Showing our own metre grid instead.</p>
    </div>
  );
}

export default function GroundMap({ sim }) {
  const s = useStore();
  const units = s.settings.units;
  const { truthEcef, fix3, fix4, inputs } = sim;
  const [tileErrors, setTileErrors] = useState(0);
  const [tileLoads, setTileLoads] = useState(0);
  const center = [s.pin.lat, s.pin.lon];

  const cloud = useMemo(() => (inputs.noiseSigmaM > 0 || inputs.ionoZenithM > 0 ? monteCarloCloud(inputs, { runs: 200 }) : []), [inputs]);
  const dop = fix4.status === 'ok' ? fix4.dop : null;
  const sigma = inputs.noiseSigmaM;
  const r95 = dop ? K95 * sigma * dop.ellipse.a : 0;
  const ellipse = useMemo(() => {
    if (!dop || sigma <= 0) return null;
    const { a, b, angle } = dop.ellipse;
    return Array.from({ length: 73 }, (_, i) => {
      const t = (i / 72) * 2 * Math.PI;
      const e = K95 * sigma * (a * Math.cos(t) * Math.cos(angle) - b * Math.sin(t) * Math.sin(angle));
      const n = K95 * sigma * (a * Math.cos(t) * Math.sin(angle) + b * Math.sin(t) * Math.cos(angle));
      return toLatLng(truthEcef, [e, n]);
    });
  }, [dop, sigma, truthEcef]);

  const fix4ll = fix4.status === 'ok' ? (() => { const { lat, lon } = ecefToLatLon(fix4.position); return [lat, lon]; })() : null;
  const fix3ll = fix3.status === 'ok' ? (() => { const { lat, lon } = ecefToLatLon(fix3.position); return [lat, lon]; })() : null;
  const offline = tileErrors >= 4 && tileLoads === 0;

  return (
    <div className="ground">
      <MapContainer center={center} zoom={17} maxZoom={22} zoomControl={false} className="ground-map" worldCopyJump>
        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maxNativeZoom={19} maxZoom={22}
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          eventHandlers={{ tileerror: () => setTileErrors((n) => n + 1), tileload: () => setTileLoads((n) => n + 1) }}
        />
        <AutoView center={center} r95={r95} />
        <ClickToMovePin />
        {cloud.map((p, i) => <CircleMarker key={i} center={toLatLng(truthEcef, p)} radius={3} pathOptions={{ color: '#1d5fb8', weight: 1, fillColor: '#4da3ff', fillOpacity: 0.6 }} />)}
        {ellipse && <Polygon positions={ellipse} pathOptions={{ color: '#4da3ff', weight: 2, dashArray: '6 5', fillOpacity: 0.06 }} />}
        {fix4ll && s.mode !== '3' && <Marker position={fix4ll} icon={FIX4_ICON} interactive={false} />}
        {fix4ll && s.mode !== '3' && <Polyline positions={[center, fix4ll]} pathOptions={{ color: '#4da3ff', weight: 2, dashArray: '4 4' }} />}
        {fix3ll && s.mode !== '4' && <Marker position={fix3ll} icon={FIX3_ICON} interactive={false} />}
        <Marker position={center} icon={PIN_ICON} draggable
          eventHandlers={{ dragend: (e) => { const ll = e.target.getLatLng(); s.setPin({ lat: ll.lat, lon: ll.lng }); } }} />
        {s.mode !== '4' && <OffscreenArrow target={fix3ll} label={fix3.status === 'ok' ? `3-sat fix: ${fmtDist(fix3.error.horizontal, units)} away` : ''} />}
      </MapContainer>

      {offline && <GridFallback cloud={cloud} fix4enu={fix4.status === 'ok' ? fix4.error.enu : null} r95={r95} units={units} />}

      <div className="gm-panel">
        <h3>Street level</h3>
        <ul className="gm-legend">
          <li><i className="lg pin" /> your phone (true position)</li>
          <li><i className="lg f4" /> 4-satellite fix: <b>{fix4.status === 'ok' ? fmtDist(fix4.error.horizontal, units) : '—'}</b> sideways, {fix4.status === 'ok' ? fmtDist(fix4.error.vertical, units) : '—'} height</li>
          <li><i className="lg f3" /> 3-satellite fix: <b>{fix3.status === 'ok' ? fmtDist(fix3.error.horizontal, units) : 'no fix'}</b> sideways</li>
          {cloud.length > 0 && <li><i className="lg cloud" /> 200 more fixes with fresh random noise</li>}
          {ellipse && <li><i className="lg ell" /> predicted 95% area from DOP: about {fmtDist(r95, units)} across its long half</li>}
        </ul>
        {dop && <p className="gm-dop">HDOP {dop.HDOP.toFixed(2)} · VDOP {dop.VDOP.toFixed(2)} · noise σ {fmtDist(sigma, units, 1)}</p>}
        {fix4.status !== 'ok' ? (
          <p className="explain"><b>Only {sim.visible.length} satellites in view.</b> Go back to space and drag a 4th satellite onto the globe to see the 4-satellite fix land on your phone.</p>
        ) : sigma === 0 ? (
          <div className="gm-noise">
            <p>No measurement noise, so the 4-satellite fix sits <i>exactly</i> on your phone. Real signals are noisy. Add some to see the scatter:</p>
            <button className="go-btn" onClick={() => s.set({ noiseSigmaM: 5 })}>Add 5 m of noise</button>
          </div>
        ) : (
          <p className="explain">The dots should fill the dashed ellipse: the DOP formula and the experiment agree. Try “Bunched” satellites in the sidebar and watch the ellipse stretch. Click the map to move your phone.</p>
        )}
      </div>
    </div>
  );
}
