import React, { lazy, Suspense } from 'react';
import { useStore } from '../state/store.js';
import { useT } from '../i18n/strings.js';
import { useSimulation } from '../hooks/useSimulation.js';
import GlobeScene from '../three/GlobeScene.jsx';
import Sidebar from '../ui/Sidebar.jsx';
import CoachMarks from '../ui/CoachMarks.jsx';
import { ComparisonCards, ErrorSweepChart, MeasurementTable } from '../ui/Results.jsx';
import { useReturnToGlobe } from '../three/Controllers.jsx';

const GroundMap = lazy(() => import('../ui/GroundMap.jsx'));

function DockGhost() {
  const pos = useStore((s) => s.dockGhost);
  if (!pos) return null;
  return (
    <div className="dock-ghost" style={{ left: pos[0], top: pos[1] }}>
      <svg viewBox="0 0 16 16" shapeRendering="crispEdges"><rect x="0" y="5" width="5" height="6" fill="#3d7bd9" /><rect x="11" y="5" width="5" height="6" fill="#3d7bd9" /><rect x="5" y="7" width="6" height="2" fill="#9fb4d9" /><rect x="6" y="4" width="4" height="8" fill="#ffd24a" /></svg>
    </div>
  );
}

function ViewToolbar() {
  const view = useStore((s) => s.view);
  const requestCam = useStore((s) => s.requestCam);
  const back = useReturnToGlobe();
  if (view === 'ground') return <div className="view-bar"><button className="go-btn" onClick={back}>🌍 Back to space</button></div>;
  return (
    <div className="view-bar">
      <button onClick={() => requestCam('space')} title="See all the satellites">🛰 Space view</button>
      <button onClick={() => requestCam('close')} title="Zoom in on your phone">🔎 Close-up</button>
      <button onClick={() => requestCam('pin')} title="Dive down to a street map around your phone">🗺 Street level</button>
    </div>
  );
}

export default function SimScreen() {
  const t = useT();
  const sim = useSimulation();
  const view = useStore((s) => s.view);
  const sidebarOpen = useStore((s) => s.sidebarOpen);
  const drawer = useStore((s) => s.drawer);
  const set = useStore((s) => s.set);
  return (
    <div className={`sim-root ${sidebarOpen ? 'sb-open' : 'sb-closed'}`}>
      <GlobeScene sim={sim} hidden={view !== 'globe'} />
      {view === 'ground' && <Suspense fallback={null}><GroundMap sim={sim} /></Suspense>}

      <header className="headline"><span>{t('headline')}</span></header>

      <Sidebar sim={sim} />
      {!sidebarOpen && (
        <button className="sb-fab" onClick={() => set({ sidebarOpen: true })} title="Show controls" aria-label="Show controls">
          <svg viewBox="0 0 16 16" shapeRendering="crispEdges"><rect x="0" y="5" width="5" height="6" fill="#3d7bd9" /><rect x="11" y="5" width="5" height="6" fill="#3d7bd9" /><rect x="5" y="7" width="6" height="2" fill="#9fb4d9" /><rect x="6" y="4" width="4" height="8" fill="#ffd24a" /></svg>
        </button>
      )}

      <aside className="results">
        <ComparisonCards sim={sim} />
        <ErrorSweepChart sim={sim} />
        <button className="mini wide" onClick={() => set({ drawer: !drawer })}>{drawer ? '▾ Hide' : '▴ Show'} measurement table</button>
      </aside>

      {drawer && <section className="drawer"><MeasurementTable sim={sim} /></section>}
      <ViewToolbar />
      <CoachMarks sim={sim} />
      <DockGhost />
      {view === 'globe' && <div className="zoom-hint">Scroll / pinch to zoom · drag to rotate · zoom all the way in for the street map</div>}
    </div>
  );
}
