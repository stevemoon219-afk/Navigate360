// Range circles, signal rays, fix markers and the solver's iteration path.
import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { Line, Html } from '@react-three/drei';
import { useStore } from '../state/store.js';
import { ecefToRender, latLonToEcef, ecefToLatLon } from '../sim/geo.js';
import { earthCircle } from '../sim/rangeCircle.js';
import { normalize, scale, add } from '../sim/linalg.js';
import { R_EARTH } from '../sim/constants.js';
import { fmtDist } from '../ui/format.js';
import { useScreenScale } from './Pin.jsx';

const lift = (p, k = 1.003) => ecefToRender(p).map((v) => v * k);

/** Where each pseudorange sphere touches Earth's surface. */
export function RangeCircles({ sim }) {
  const show = useStore((s) => s.show);
  const mode = useStore((s) => s.mode);
  const sats = useStore((s) => s.sats);
  const color = (id) => sats.find((s) => s.id === id)?.color || '#fff';
  const ids = mode === '3' ? sim.threeIds : sim.visible.map((m) => m.id);
  const circles = useMemo(() => sim.visible.filter((m) => ids.includes(m.id)).map((m) => ({
    id: m.id,
    pts: earthCircle(m.ecef, m.pseudorange, { segments: 180 })?.map((p) => lift(p)),
    corrected: sim.fix4.status === 'ok' ? earthCircle(m.ecef, m.pseudorange - sim.fix4.clockM, { segments: 180 })?.map((p) => lift(p, 1.004)) : null,
  })), [sim, ids.join(',')]);
  return (
    <group>
      {show.circles && circles.map((c) => c.pts && <Line key={c.id} points={c.pts} color={color(c.id)} lineWidth={2.6} />)}
      {show.corrected && mode !== '3' && circles.map((c) => c.corrected && (
        <Line key={'c' + c.id} points={c.corrected} color="#ffffff" lineWidth={1.4} dashed dashSize={0.02} gapSize={0.012} transparent opacity={0.85} />
      ))}
    </group>
  );
}

/** Lines from each satellite in view to the phone, with pulses travelling down them. */
export function SignalRays({ sim }) {
  const show = useStore((s) => s.show);
  const pin = useStore((s) => s.pin);
  const sats = useStore((s) => s.sats);
  const reduced = useStore((s) => s.settings.reducedMotion);
  const pulses = useRef([]);
  const camera = useThree((st) => st.camera);
  const target = useMemo(() => lift(latLonToEcef(pin.lat, pin.lon, 0), 1.001), [pin]);
  const rays = sim.visible.map((m) => ({ id: m.id, from: ecefToRender(m.ecef), color: sats.find((s) => s.id === m.id)?.color || '#fff' }));
  useFrame(({ clock }) => {
    rays.forEach((r, i) => {
      const mesh = pulses.current[i];
      if (!mesh) return;
      // Real travel time is ~70 ms; one pulse takes 1.4 s here (slowed ~20× so you can see it)
      const f = reduced ? 0.5 : (clock.elapsedTime / 1.4 + i * 0.23) % 1;
      mesh.position.set(r.from[0] + (target[0] - r.from[0]) * f, r.from[1] + (target[1] - r.from[1]) * f, r.from[2] + (target[2] - r.from[2]) * f);
      mesh.scale.setScalar(Math.min(0.03, camera.position.distanceTo(mesh.position) * 0.006)); // constant size on screen
    });
  });
  if (!show.rays) return null;
  return (
    <group>
      {rays.map((r, i) => (
        <group key={r.id}>
          <Line points={[r.from, target]} color={r.color} lineWidth={1.2} transparent opacity={0.45} dashed dashSize={0.06} gapSize={0.04} />
          <mesh ref={(el) => (pulses.current[i] = el)}><sphereGeometry args={[1, 10, 8]} /><meshBasicMaterial color={r.color} /></mesh>
        </group>
      ))}
    </group>
  );
}

/** A marker standing on the surface below a computed fix, plus an x-ray dot where the fix really is. */
function FixMarker({ position, color, shape, label, occ, labelClass }) {
  const scaled = useRef();
  useScreenScale(scaled, 0.02, 0.25);
  const { lat, lon, h } = ecefToLatLon(position);
  const surface = ecefToRender(latLonToEcef(lat, lon, 0));
  const actual = ecefToRender(position);
  const quat = useMemo(() => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...surface).normalize()), [surface.join()]);
  const offGround = Math.abs(h) > 2000;
  return (
    <group>
      <group position={surface} quaternion={quat}>
        <group ref={scaled}>
          {shape === 'diamond' && <mesh position={[0, 0.7, 0]}><octahedronGeometry args={[0.45]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} /></mesh>}
          {shape === 'ring' && <mesh position={[0, 0.05, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.7, 0.13, 10, 40]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.6} /></mesh>}
          {shape === 'square' && <mesh position={[0, 0.5, 0]}><boxGeometry args={[0.6, 0.6, 0.6]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} /></mesh>}
        </group>
      </group>
      {offGround && (
        <>
          <Line points={[surface, actual]} color={color} lineWidth={1.5} dashed dashSize={0.01} gapSize={0.008} depthTest={false} transparent opacity={0.9} />
          <mesh position={actual} renderOrder={10}><sphereGeometry args={[0.012, 10, 8]} /><meshBasicMaterial color={color} depthTest={false} transparent /></mesh>
        </>
      )}
      {label && (
        <Html center position={surface.map((v) => v * 1.0)} occlude={occ || false} zIndexRange={[7, 0]} style={{ pointerEvents: 'none' }}>
          <div className={`fix-label ${labelClass}`}>{label}</div>
        </Html>
      )}
    </group>
  );
}

/** Great-circle arc from the phone to a fix, just above the surface. */
function Arc({ a, b, color }) {
  const pts = useMemo(() => {
    const out = [];
    const ua = normalize(a), ub = normalize(b);
    for (let i = 0; i <= 48; i++) {
      const f = i / 48;
      out.push(ecefToRender(scale(normalize(add(scale(ua, 1 - f), scale(ub, f))), R_EARTH * 1.004)));
    }
    return out;
  }, [a.join(), b.join()]);
  return <Line points={pts} color={color} lineWidth={2} dashed dashSize={0.015} gapSize={0.01} />;
}

export function FixMarkers({ sim, occ }) {
  const mode = useStore((s) => s.mode);
  const show = useStore((s) => s.show);
  const units = useStore((s) => s.settings.units);
  const { fix3, fix4, fixSurface, truthEcef } = sim;
  const height = (e) => (Math.abs(e.vertical) < 2000 ? '' : e.vertical < 0 ? ` · ${fmtDist(-e.vertical, units, 0)} underground!` : ` · ${fmtDist(e.vertical, units, 0)} up in the air`);
  return (
    <group>
      {mode !== '4' && fix3.status === 'ok' && (
        <>
          <FixMarker position={fix3.position} color="#ff9f1c" shape="diamond" occ={occ} labelClass="f3"
            label={`3-sat fix: ${fmtDist(fix3.error.total, units)} off${height(fix3.error)}`} />
          {fix3.error.horizontal > 5000 && <Arc a={truthEcef} b={fix3.position} color="#ff9f1c" />}
          {show.ghost && (
            <group>
              <mesh position={ecefToRender(fix3.ghost)}><sphereGeometry args={[0.06, 16, 12]} /><meshBasicMaterial color="#ff9f1c" transparent opacity={0.5} wireframe /></mesh>
              <Html center position={ecefToRender(fix3.ghost)} zIndexRange={[7, 0]} style={{ pointerEvents: 'none' }}>
                <div className="fix-label f3 ghost">mirror solution — also fits all 3 spheres!</div>
              </Html>
            </group>
          )}
        </>
      )}
      {mode !== '3' && fix4.status === 'ok' && (
        <FixMarker position={fix4.position} color="#4da3ff" shape="ring" occ={occ} labelClass="f4"
          label={`4-sat fix: ${fmtDist(fix4.error.total, units)} off`} />
      )}
      {fixSurface?.status === 'ok' && mode !== '4' && (
        <FixMarker position={fixSurface.position} color="#c77dff" shape="square" occ={occ} labelClass="fs"
          label={`3 sats + “on the ground”: ${fmtDist(fixSurface.error.total, units)} off`} />
      )}
    </group>
  );
}

/** X-ray view of Gauss–Newton: the guesses hop from Earth's centre to the answer. */
export function IterationPath({ sim }) {
  const show = useStore((s) => s.show);
  const k = useStore((s) => s.stepperK);
  if (!show.iterations || sim.fix4.status !== 'ok') return null;
  const its = sim.fix4.iterations.slice(0, k);
  const pts = [[0, 0, 0], ...its.map((it) => ecefToRender(it.position))];
  return (
    <group renderOrder={20}>
      {pts.length > 1 && <Line points={pts} color="#ffe27a" lineWidth={2} depthTest={false} transparent />}
      {pts.map((p, i) => (
        <group key={i} position={p}>
          <mesh renderOrder={21}><sphereGeometry args={[0.018, 10, 8]} /><meshBasicMaterial color={i === 0 ? '#ffffff' : '#ffe27a'} depthTest={false} transparent /></mesh>
          <Html center zIndexRange={[8, 0]} style={{ pointerEvents: 'none' }}>
            <div className="iter-label">{i === 0 ? 'start: Earth’s centre' : `#${i}`}</div>
          </Html>
        </group>
      ))}
    </group>
  );
}
