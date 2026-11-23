import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import { useStore } from '../state/store.js';
import { ORBIT_RENDER } from '../sim/constants.js';
import Earth from './Earth.jsx';
import Satellites from './Satellites.jsx';
import Pin from './Pin.jsx';
import { RangeCircles, SignalRays, FixMarkers, IterationPath } from './Overlays.jsx';
import { DragController, CameraRig } from './Controllers.jsx';

/** A light that rides along with the camera, so the side of Earth you look at is always lit. */
function CameraLight() {
  const light = useRef();
  const { camera } = useThree();
  useFrame(() => {
    light.current.position.copy(camera.position).add(new THREE.Vector3(2, 3, 0).applyQuaternion(camera.quaternion));
  });
  return <directionalLight ref={light} intensity={2.2} />;
}

/** The globe "pops out" when the simulator opens (spring overshoot). */
function PopIn({ children }) {
  const g = useRef();
  const t0 = useRef(performance.now());
  const reduced = useStore((s) => s.settings.reducedMotion);
  useFrame(() => {
    const f = reduced ? 1 : Math.min(1, (performance.now() - t0.current) / 1100);
    const c1 = 1.70158, c3 = c1 + 1;
    const e = f === 0 ? 0.001 : 1 + c3 * Math.pow(f - 1, 3) + c1 * Math.pow(f - 1, 2); // easeOutBack
    g.current.scale.setScalar(Math.max(0.001, e));
  });
  return <group ref={g}>{children}</group>;
}

function OrbitShell() {
  const dragging = useStore((s) => s.drag && s.drag.kind === 'sat');
  return (
    <mesh visible={!!dragging}>
      <sphereGeometry args={[ORBIT_RENDER, 48, 32]} />
      <meshBasicMaterial color="#7fb2ff" wireframe transparent opacity={0.07} depthWrite={false} />
    </mesh>
  );
}

export default function GlobeScene({ sim, hidden }) {
  // Labels hide behind the Earth (drei Html 'occlude'); only enable once the Earth mesh exists.
  const earthRef = useMemo(() => ({ current: null }), []);
  const [earthReady, setEarthReady] = useState(false);
  const occ = earthReady ? [earthRef] : null;
  const setEarth = useCallback((m) => { earthRef.current = m; setEarthReady(!!m); }, [earthRef]);
  const quality = useStore((s) => s.settings.quality);
  const reduced = useStore((s) => s.settings.reducedMotion);
  const xray = useStore((s) => s.show.iterations);
  const drag = useStore((s) => s.drag);
  useEffect(() => { useStore.getState().requestCam('intro'); }, []);
  return (
    <div className="globe-wrap" style={{ visibility: hidden ? 'hidden' : 'visible' }}>
      <Canvas
        camera={{ fov: 45, near: 0.005, far: 3000, position: [0, 0, 48] }}
        dpr={[1, quality === 'high' ? 2 : 1]}
        frameloop={hidden ? 'never' : 'always'}
        gl={{ antialias: true }}
        onPointerMissed={() => useStore.setState({ dropPinArmed: false })}
      >
        <color attach="background" args={['#03040c']} />
        <Stars radius={400} depth={120} count={quality === 'high' ? 7000 : 2500} factor={6} saturation={0.3} fade speed={reduced ? 0 : 0.5} />
        <ambientLight intensity={0.55} />
        <CameraLight />
        <PopIn>
          <Suspense fallback={<mesh><sphereGeometry args={[1, 48, 32]} /><meshPhongMaterial color="#1d4f9a" /></mesh>}>
            <Earth ref={setEarth} xray={xray} />
          </Suspense>
          <OrbitShell />
          <RangeCircles sim={sim} />
          <SignalRays sim={sim} />
          <Satellites sim={sim} occ={occ} />
          <Pin occ={occ} />
          <FixMarkers sim={sim} occ={occ} />
          <IterationPath sim={sim} />
        </PopIn>
        <OrbitControls makeDefault enablePan={false} enabled={!drag} minDistance={1.12} maxDistance={40}
          rotateSpeed={0.45} zoomSpeed={0.9} enableDamping dampingFactor={0.08} />
        <CameraRig />
        <DragController />
      </Canvas>
    </div>
  );
}
