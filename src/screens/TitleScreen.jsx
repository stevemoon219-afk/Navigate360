import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '../state/store.js';
import { useT } from '../i18n/strings.js';

// Facts are computed from the same constants the simulator uses.
import { C, R_ORBIT, R_EARTH } from '../sim/constants.js';
const FACTS = [
  `1 microsecond of clock error = ${(C * 1e-6).toFixed(0)} m of distance`,
  `GPS satellites fly ${((R_ORBIT - R_EARTH) / 1000).toLocaleString()} km above you`,
  `A GPS signal takes about ${(((R_ORBIT - R_EARTH) / C) * 1000).toFixed(0)} ms to reach you from overhead`,
  `Orbit speed: ${(Math.sqrt(3.986004418e14 / R_ORBIT) / 1000).toFixed(2)} km every second`,
  'Three satellites tell you where. The fourth tells you when.',
];

export default function TitleScreen() {
  const t = useT();
  const setScreen = useStore((s) => s.setScreen);
  const setInfoTab = useStore((s) => s.setInfoTab);
  const lang = useStore((s) => s.settings.lang);
  const setSetting = useStore((s) => s.setSetting);
  const [focus, setFocus] = useState(0);
  const [fact, setFact] = useState(0);
  const refs = useRef([]);

  const items = [
    { key: 'start', cls: 'btn-start', go: () => setScreen(sessionStorage.getItem('n360-loaded') ? 'sim' : 'loading') },
    { key: 'settings', cls: 'btn-settings', go: () => setScreen('settings') },
    { key: 'detail', cls: 'btn-detail', go: () => { setInfoTab('idea'); setScreen('info'); } },
  ];

  useEffect(() => {
    const id = setInterval(() => setFact((f) => (f + 1) % FACTS.length), 3800);
    const onKey = (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); setFocus((f) => (f + 1) % items.length); }
      if (e.key === 'ArrowUp') { e.preventDefault(); setFocus((f) => (f + items.length - 1) % items.length); }
    };
    window.addEventListener('keydown', onKey);
    return () => { clearInterval(id); window.removeEventListener('keydown', onKey); };
  }, []);
  useEffect(() => { refs.current[focus]?.focus({ preventScroll: true }); }, [focus]);

  return (
    <main className="title-screen">
      <header className="title-wrap">
        <h1 className="game-title" data-text="NAVIGATE360">NAVIGATE360</h1>
        <p className="title-sub">{t('subtitle')}</p>
        <p className="fact-ticker" key={fact}>★ {FACTS[fact]} ★</p>
      </header>

      <nav className="menu-panel" aria-label="Main menu">
        {items.map((it, i) => (
          <button
            key={it.key}
            ref={(el) => (refs.current[i] = el)}
            className={`menu-btn ${it.cls} ${focus === i ? 'focused' : ''}`}
            onMouseEnter={() => setFocus(i)}
            onFocus={() => setFocus(i)}
            onClick={it.go}
          >
            <span>{t(it.key)}</span>
          </button>
        ))}
      </nav>

      <footer className="title-footer">
        <span className="version">GPS v1.0.4 | © 2026 Navigate360 team · simulation, not live satellite data</span>
        <div className="corner-btns">
          <button className="stone-btn" onClick={() => setSetting('lang', lang === 'en' ? 'ko' : 'en')}>
            {t('language')}: {lang === 'en' ? 'EN' : '한국어'}
          </button>
          <button className="stone-btn" onClick={() => { setInfoTab('credits'); setScreen('info'); }}>{t('credits')}</button>
        </div>
      </footer>
    </main>
  );
}
