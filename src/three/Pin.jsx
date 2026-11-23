import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { useStore } from '../state/store.js';
import { latLonToEcef, ecefToRender } from '../sim/geo.js';

const UP = new THREE.Vector3(0, 1, 0);

/** Keeps an object the same size on screen at any zoom level. */
export function useScreenScale(ref, base = 0.022, max = 0.25) {
  const camera = useThree((s) => s.camera);
  const tmp = useMemo(() => new THREE.Vector3(), []);
  useFrame(() => {
    if (!ref.current) return;
    ref.current.getWorldPosition(tmp);
    ref.current.scale.setScalar(Math.min(max, camera.position.distanceTo(tmp) * base));
  });
}

/** The phone's TRUE location: a green pin standing on the surface. Drag it to move the phone. */
export default function Pin({ occ }) {
  const pin = useStore((s) => s.pin);
  const controls = useThree((s) => s.controls);
  const scaled = useRef();
  const ring = useRef();
  const reduced = useStore((s) => s.settings.reducedMotion);
  const labels = useStore((s) => s.settings.labels);
  const { pos, quat } = useMemo(() => {
    const p = new THREE.Vector3(...ecefToRender(latLonToEcef(pin.lat, pin.lon, 0)));
    return { pos: p, quat: new THREE.Quaternion().setFromUnitVectors(UP, p.clone().normalize()) };
  }, [pin.lat, pin.lon]);
  useScreenScale(scaled, 0.03, 0.3);
  useFrame(({ clock }) => {
    if (!ring.current) return;
    const k = reduced ? 0.5 : (clock.elapsedTime * 0.8) % 1;
    ring.current.scale.setScalar(0.3 + k * 1.6);
    ring.current.material.opacity = 0.9 * (1 - k);
  });
  const onDown = (e) => {
    e.stopPropagation();
    if (controls) controls.enabled = false;
    useStore.setState({ drag: { kind: 'pin' } });
  };
  return (
    <group position={pos} quaternion={quat}>
      <group ref={scaled}>
        <group onPointerDown={onDown}
          onPointerOver={() => (document.body.style.cursor = 'grab')} onPointerOut={() => (document.body.style.cursor = '')}>
          <mesh position={[0, 0.45, 0]} rotation={[Math.PI, 0, 0]}><coneGeometry args={[0.22, 0.9, 16]} /><meshStandardMaterial color="#1fd66f" emissive="#0c6a35" /></mesh>
          <mesh position={[0, 1.0, 0]}><sphereGeometry args={[0.32, 20, 16]} /><meshStandardMaterial color="#39ff88" emissive="#159a50" /></mesh>
          <mesh position={[0, 0.8, 0]} visible={false}><sphereGeometry args={[0.8, 8, 8]} /></mesh>
        </group>
        <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <ringGeometry args={[0.45, 0.6, 40]} /><meshBasicMaterial color="#39ff88" transparent side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      </group>
      {labels && (
        <Html center position={[0, 0.06, 0]} occlude={occ || false} zIndexRange={[6, 0]} style={{ pointerEvents: 'none' }}>
          <div className="pin-label">📱 your phone (true position)</div>
        </Html>
      )}
    </group>
  );
}
