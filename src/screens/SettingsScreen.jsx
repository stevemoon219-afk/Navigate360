import React from 'react';
import { useStore } from '../state/store.js';

function Seg({ k, options }) {
  const v = useStore((s) => s.settings[k]);
  const setSetting = useStore((s) => s.setSetting);
  return (
    <div className="seg">
      {options.map(([val, label]) => (
        <button key={String(val)} className={v === val ? 'on' : ''} onClick={() => setSetting(k, val)}>{label}</button>
      ))}
    </div>
  );
}

export default function SettingsScreen() {
  const setScreen = useStore((s) => s.setScreen);
  const restartTour = useStore((s) => s.restartTour);
  return (
    <main className="menu-page">
      <section className="pixel-panel">
        <h2>SETTINGS</h2>
        <div className="setting-row"><label>Graphics<small>Low = smaller Earth image, fewer stars, for older laptops and phones.</small></label><Seg k="quality" options={[['high', 'High'], ['low', 'Low']]} /></div>
        <div className="setting-row"><label>Motion<small>Turns off spinning backgrounds, pulses and camera flights.</small></label><Seg k="reducedMotion" options={[[false, 'Full'], [true, 'Reduced']]} /></div>
        <div className="setting-row"><label>Units</label><Seg k="units" options={[['metric', 'Metric (m, km)'], ['imperial', 'Imperial (ft, mi)']]} /></div>
        <div className="setting-row"><label>Sky mask<small>Satellites lower than this angle are ignored.</small></label><Seg k="elevMaskDeg" options={[[5, '5°'], [10, '10°'], [15, '15°'], [30, '30°']]} /></div>
        <div className="setting-row"><label>Labels on globe</label><Seg k="labels" options={[[true, 'On'], [false, 'Off']]} /></div>
        <div className="setting-row"><label>Language</label><Seg k="lang" options={[['en', 'English'], ['ko', '한국어']]} /></div>
        <div className="setting-row"><label>Guided tour</label><div><button className="stone-btn" onClick={() => { restartTour(); }}>Restart tour next time I press Start</button></div></div>
        <div className="panel-actions"><button className="stone-btn" onClick={() => setScreen('title')}>◂ Back</button></div>
      </section>
    </main>
  );
}
