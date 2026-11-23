import React, { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html, Billboard } from '@react-three/drei';
import { useStore } from '../state/store.js';
import { ecefToRender } from '../sim/geo.js';

/** One draggable GPS satellite: gold body, blue solar panels, antenna pointing at Earth. */
function Satellite({ sat, meas, occ, used3, labels }) {
  const group = useRef();
  const controls = useThree((s) => s.controls);
  const visible = meas?.visible;
  const pos = ecefToRender(sat.ecef);
  const dragging = useStore((s) => s.drag?.id === sat.id);

  useFrame(() => { group.current?.lookAt(0, 0, 0); });

  const onDown = (e) => {
    e.stopPropagation();
    if (controls) controls.enabled = false;
    useStore.setState({ drag: { kind: 'sat', id: sat.id } });
  };
  const dim = !visible;
  return (
    <group position={pos}>
      <group ref={group} onPointerDown={onDown}
        onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = 'grab'; }}
        onPointerOut={() => { document.body.style.cursor = ''; }}>
        {/* invisible, larger grab target */}
        <mesh visible={false}><sphereGeometry args={[0.2, 8, 8]} /></mesh>
        <mesh><boxGeometry args={[0.07, 0.07, 0.09]} /><meshStandardMaterial color={dim ? '#555' : '#ffcc44'} metalness={0.6} roughness={0.35} emissive={dragging ? '#664400' : '#000'} /></mesh>
        <mesh position={[0.12, 0, 0]}><boxGeometry args={[0.15, 0.006, 0.07]} /><meshStandardMaterial color={dim ? '#333' : '#2f6fd6'} metalness={0.3} roughness={0.4} emissive={dim ? '#000' : '#0a2a66'} /></mesh>
        <mesh position={[-0.12, 0, 0]}><boxGeometry args={[0.15, 0.006, 0.07]} /><meshStandardMaterial color={dim ? '#333' : '#2f6fd6'} metalness={0.3} roughness={0.4} emissive={dim ? '#000' : '#0a2a66'} /></mesh>
        <mesh position={[0, 0, 0.07]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.012, 0.03, 0.05, 8]} /><meshStandardMaterial color="#ddd" /></mesh>
      </group>
      <Billboard>
        <mesh><ringGeometry args={[0.2, 0.225, 40]} /><meshBasicMaterial color={dim ? '#666' : sat.color} transparent opacity={dragging ? 1 : 0.85} /></mesh>
      </Billboard>
      {labels && (
        <Html center position={[0, 0.32, 0]} occlude={occ || false} zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
          <div className={`sat-label ${dim ? 'off' : ''}`} style={{ borderColor: sat.color }}>
            PRN {String(sat.prn).padStart(2, '0')}{used3 ? ' ③' : ''}
            <small>{visible ? `${meas.el.toFixed(0)}° up · ${meas.travelTimeMs.toFixed(1)} ms` : 'below horizon'}</small>
          </div>
        </Html>
      )}
    </group>
  );
}

export default function Satellites({ sim, occ }) {
  const sats = useStore((s) => s.sats);
  const labels = useStore((s) => s.settings.labels);
  const mode = useStore((s) => s.mode);
  return sats.map((sat) => (
    <Satellite key={sat.id} sat={sat} meas={sim.meas.find((m) => m.id === sat.id)} occ={occ}
      used3={mode !== '4' && sim.threeIds.includes(sat.id)} labels={labels} />
  ));
}
