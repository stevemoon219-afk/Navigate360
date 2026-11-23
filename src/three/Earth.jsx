import React, { forwardRef } from 'react';
import * as THREE from 'three';
import { useTexture } from '@react-three/drei';
import { useStore } from '../state/store.js';
import { renderToEcef, ecefToLatLon } from '../sim/geo.js';

const EARTH_4K = import.meta.env.BASE_URL + 'textures/earth_day.jpg';
const EARTH_2K = import.meta.env.BASE_URL + 'textures/earth_day_2k.jpg';

// Soft blue glow around the planet (fresnel-style shader on the inside of a slightly bigger sphere)
const atmosphereMaterial = new THREE.ShaderMaterial({
  vertexShader: `varying vec3 vNormal; void main(){ vNormal = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `varying vec3 vNormal; void main(){ float i = pow(0.68 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 3.0); gl_FragColor = vec4(0.35, 0.65, 1.0, 1.0) * i; }`,
  blending: THREE.AdditiveBlending, side: THREE.BackSide, transparent: true, depthWrite: false,
});

/** Textured Earth (radius 1 = 6,371 km). Double-click, or click after "Drop pin", moves the phone. */
const Earth = forwardRef(function Earth({ xray = false }, ref) {
  const quality = useStore((s) => s.settings.quality);
  const map = useTexture(quality === 'high' ? EARTH_4K : EARTH_2K);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;

  const placePin = (e) => {
    const p = e.point.clone().normalize();
    const { lat, lon } = ecefToLatLon(renderToEcef([p.x, p.y, p.z]));
    useStore.getState().setPin({ lat, lon });
  };
  return (
    <group>
      <mesh
        ref={ref}
        onClick={(e) => {
          if (e.delta > 5) return; // it was a drag-to-rotate, not a click
          if (useStore.getState().dropPinArmed) { e.stopPropagation(); placePin(e); useStore.setState({ dropPinArmed: false }); }
        }}
        onDoubleClick={(e) => { e.stopPropagation(); placePin(e); }}
      >
        <sphereGeometry args={[1, 128, 96]} />
        <meshPhongMaterial map={map} shininess={6} specular="#223355" transparent={xray} opacity={xray ? 0.45 : 1} depthWrite={!xray} />
      </mesh>
      <mesh scale={1.16} material={atmosphereMaterial}>
        <sphereGeometry args={[1, 64, 48]} />
      </mesh>
    </group>
  );
});
export default Earth;
