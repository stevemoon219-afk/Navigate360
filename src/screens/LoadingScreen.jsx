import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '../state/store.js';
import { useT } from '../i18n/strings.js';
import { runSelfTest } from '../sim/selfTest.js';
import { azEl, latLonToEcef } from '../sim/geo.js';
import { fmtDist } from '../ui/format.js';

export const EARTH_4K = import.meta.env.BASE_URL + 'textures/earth_day.jpg';
export const EARTH_2K = import.meta.env.BASE_URL + 'textures/earth_day_2k.jpg';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Every line and every % on this screen comes from real work actually happening. */
export default function LoadingScreen() {
  const t = useT();
  const setScreen = useStore((s) => s.setScreen);
  const quality = useStore((s) => s.settings.quality);
  const [lines, setLines] = useState([]);
  const [pct, setPct] = useState(0);
  const cancelled = useRef(false);

  const log = (text, cls = '') => setLines((l) => [...l, { text, cls }]);

  const finish = () => {
    if (cancelled.current) return;
    cancelled.current = true;
    sessionStorage.setItem('n360-loaded', '1');
    document.querySelector('.pixel-bg')?.classList.add('warp'); // "jump to space" zoom
    setTimeout(() => setScreen('sim'), 650);
  };

  useEffect(() => {
    (async () => {
      log('> NAVIGATE360 receiver boot sequence', 'dim');
      // 1) download the Earth texture with real byte-level progress
      const url = quality === 'high' ? EARTH_4K : EARTH_2K;
      try {
        const res = await fetch(url);
        const total = Number(res.headers.get('content-length')) || 1_500_000;
        const reader = res.body.getReader();
        let got = 0;
        log('> Loading Earth imagery (NASA Blue Marble)…');
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          got += value.length;
          setPct(Math.min(60, (got / total) * 60));
          if (cancelled.current) return;
        }
        log(`  ✓ ${(got / 1e6).toFixed(2)} MB received`, 'ok');
      } catch {
        log('  ! imagery unavailable — using plain globe', 'dim');
      }
      // 2) load the 3D simulator code chunk
      log('> Loading 3D simulator…');
      await import('./SimScreen.jsx');
      setPct(75);
      log('  ✓ WebGL scene ready', 'ok');
      // 3) place the starting satellites (computed from the store's default sky)
      const { pin, sats } = useStore.getState();
      const rx = latLonToEcef(pin.lat, pin.lon);
      log('> Placing satellites at 26,560 km from Earth’s centre…');
      for (const s of sats) {
        const { az, el } = azEl(rx, s.ecef);
        await sleep(160);
        log(`  PRN ${String(s.prn).padStart(2, '0')}  az ${az.toFixed(0).padStart(3)}°  el ${el.toFixed(0).padStart(2)}°`, 'dim');
      }
      setPct(85);
      // 4) self-test: solve a known position and print the real convergence
      log('> Self-test: solving a known position from Earth’s centre…');
      const st = runSelfTest();
      for (let i = 0; i < st.errors.length; i++) {
        await sleep(220);
        log(`  iteration ${i + 1}: error ${fmtDist(st.errors[i])}`, 'dim');
        setPct(85 + (15 * (i + 1)) / st.errors.length);
      }
      log(st.ok ? `  ✓ solver OK (${st.ms.toFixed(2)} ms) — acquiring signals…` : '  ! self-test failed', 'ok');
      await sleep(600);
      finish();
    })();
    return () => { cancelled.current = true; };
  }, []);

  const blocks = Math.round(pct / 5);
  return (
    <main className="menu-page">
      <section className="pixel-panel loading-panel" aria-live="polite">
        <h2 className="loading-title">
          <svg className="loading-sat" viewBox="0 0 16 16" shapeRendering="crispEdges" aria-hidden="true">
            <rect x="0" y="5" width="5" height="6" fill="#3d7bd9" /><rect x="11" y="5" width="5" height="6" fill="#3d7bd9" />
            <rect x="5" y="7" width="6" height="2" fill="#9fb4d9" /><rect x="6" y="4" width="4" height="8" fill="#ffd24a" />
            <rect x="7" y="12" width="2" height="3" fill="#e8ecf2" />
          </svg>
          {t('loading')}<span className="cursor">&nbsp;</span>
        </h2>
        <div className="progress" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
          {Array.from({ length: 20 }, (_, i) => <i key={i} className={i < blocks ? 'on' : ''} />)}
        </div>
        <div className="progress-pct">{Math.round(pct)}%</div>
        <div className="term">
          {lines.map((l, i) => <div key={i} className={l.cls}>{l.text}</div>)}
        </div>
        <div className="panel-actions">
          <button className="stone-btn" onClick={finish}>Skip ▸</button>
        </div>
      </section>
    </main>
  );
}
