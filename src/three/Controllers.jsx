import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { useStore } from '../state/store.js';
import { ORBIT_RENDER } from '../sim/constants.js';
import { renderToEcef, ecefToLatLon, latLonToEcef, ecefToRender, enuBasis } from '../sim/geo.js';

/**
 * Turns pointer movement into satellite / pin positions while something is being dragged.
 * Satellites slide on the orbit sphere (radius 26,560 km); the pin slides on Earth's surface.
 */
export function DragController() {
  const { camera, gl } = useThree();
  useEffect(() => {
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const earth = new THREE.Sphere(new THREE.Vector3(), 1);
    const shell = new THREE.Sphere(new THREE.Vector3(), ORBIT_RENDER);
    const hit = new THREE.Vector3(), hitE = new THREE.Vector3();

    const rayFrom = (e) => {
      const r = gl.domElement.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      return raycaster.ray;
    };

    // where the pointer ray meets the orbit sphere (null if that spot is hidden behind Earth)
    const shellPoint = (ray) => {
      if (ray.intersectSphere(shell, hit)) {
        const e2 = ray.intersectSphere(earth, hitE);
        if (e2 && e2.distanceTo(ray.origin) < hit.distanceTo(ray.origin)) return null;
      } else {
        // pointer is outside the sphere's outline: use the closest point on the outline
        ray.closestPointToPoint(new THREE.Vector3(), hit);
        hit.setLength(ORBIT_RENDER);
      }
      return renderToEcef(hit.toArray());
    };

    const onMove = (e) => {
      const st = useStore.getState();
      const drag = st.drag;
      if (!drag) return;
      if (drag.kind === 'dock') useStore.setState({ dockGhost: [e.clientX, e.clientY] });
      const ray = rayFrom(e);
      if (drag.kind === 'pin') {
        if (!ray.intersectSphere(earth, hit)) return;
        const { lat, lon } = ecefToLatLon(renderToEcef(hit.toArray()));
        st.setPin({ lat, lon });
        return;
      }
      const pos = shellPoint(ray);
      if (!pos) return;
      if (drag.kind === 'dock') {
        // a satellite pulled out of the sidebar is created once the pointer reaches the globe
        const el = document.elementFromPoint(e.clientX, e.clientY);
        if (!el || el.tagName !== 'CANVAS') return;
        const id = st.addSat(pos);
        useStore.setState({ drag: id == null ? null : { kind: 'sat', id, fromDock: true }, dockGhost: null });
        return;
      }
      st.moveSat(drag.id, pos);
    };

    const onUp = (e) => {
      const { drag, removeSat } = useStore.getState();
      if (!drag) return;
      const el = document.elementFromPoint(e.clientX, e.clientY);
      // dropping a new satellite back onto the sidebar cancels it
      if (drag.fromDock && el?.closest('.sidebar')) removeSat(drag.id);
      useStore.setState({ drag: null, dockGhost: null });
      document.body.style.cursor = '';
      const controls = useStore.getState()._controls;
      if (controls) controls.enabled = true;
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [camera, gl]);
  return null;
}

const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

/** Camera flights: intro fly-in, "space" overview, "close-up" of the phone, and dive to street map. */
export function CameraRig() {
  const { camera } = useThree();
  const controls = useThree((s) => s.controls);
  const anim = useRef(null);
  const reduced = useStore((s) => s.settings.reducedMotion);
  const req = useStore((s) => s.camRequest);
  const tmp = useMemo(() => ({ q: new THREE.Quaternion(), qi: new THREE.Quaternion(), v: new THREE.Vector3() }), []);

  useEffect(() => { useStore.setState({ _controls: controls }); }, [controls]);

  useEffect(() => {
    if (!req) return;
    const { pin } = useStore.getState();
    const pinDir = new THREE.Vector3(...ecefToRender(latLonToEcef(pin.lat, pin.lon))).normalize();
    const north = new THREE.Vector3(...ecefToRender(enuBasis(pin.lat, pin.lon).n)).normalize();
    const look = (tilt) => pinDir.clone().addScaledVector(north, -tilt).normalize();
    const plans = {
      intro: { dir: look(0.05), dist: 10.5 },
      space: { dir: look(0.05), dist: 10.5 },
      close: { dir: look(0.18), dist: 2.25 },
      pin: { dir: pinDir, dist: 1.13, then: () => useStore.setState({ view: 'ground' }) },
    };
    const plan = plans[req.kind];
    if (!plan) return;
    if (req.kind === 'intro') camera.position.copy(plan.dir.clone().multiplyScalar(48));
    const from = camera.position.clone();
    anim.current = {
      fromDir: from.clone().normalize(), fromDist: from.length(),
      toDir: plan.dir, toDist: plan.dist, t0: performance.now(),
      dur: reduced ? 1 : req.kind === 'intro' ? 2200 : 1300, then: plan.then,
    };
    if (controls) controls.enabled = false;
  }, [req]);

  useFrame(() => {
    const a = anim.current;
    if (a) {
      const f = Math.min(1, (performance.now() - a.t0) / a.dur);
      const e = easeInOut(f);
      tmp.q.setFromUnitVectors(a.fromDir, a.toDir);
      tmp.qi.identity().slerp(tmp.q, e);
      const dist = Math.exp(Math.log(a.fromDist) + (Math.log(a.toDist) - Math.log(a.fromDist)) * e);
      camera.position.copy(a.fromDir).applyQuaternion(tmp.qi).multiplyScalar(dist);
      camera.lookAt(0, 0, 0);
      if (f >= 1) {
        anim.current = null;
        if (controls) { controls.enabled = true; controls.update(); }
        a.then?.();
      }
      return;
    }
    // zooming in far enough on the globe switches to the street map
    if (useStore.getState().view === 'globe' && camera.position.length() < 1.16) {
      useStore.setState({ view: 'ground' });
    }
  });
  return null;
}

/** Back from the street map: pull the camera out so we don't immediately re-trigger it. */
export function useReturnToGlobe() {
  return () => useStore.setState({ view: 'globe', camRequest: { kind: 'close', at: performance.now() } });
}
