import React, { useEffect, useRef } from 'react';
import { useStore } from '../state/store.js';
import { useT } from '../i18n/strings.js';

// The 2-minute guided path. Each step waits for the visitor to DO something.
const STEPS = [
  { key: 'coach1', target: 'pin', cam: 'space', next: true },
  { key: 'coach2', target: 'cards', cam: 'close', next: true },
  { key: 'coach3', target: 'dock', cam: 'space', next: false },
  { key: 'coach4', target: 'clock', cam: 'close', next: false },
  { key: 'coachDone', target: null, cam: null, next: false },
];

export default function CoachMarks({ sim }) {
  const t = useT();
  const coach = useStore((s) => s.coach);
  const setCoach = useStore((s) => s.setCoach);
  const pinMoved = useStore((s) => s.pinMoved);
  const clockTouched = useStore((s) => s.clockTouched);
  const entered = useRef(-1);
  const step = STEPS[coach.step];

  // on entering a step: move the camera, highlight the right control
  useEffect(() => {
    if (!coach.active || entered.current === coach.step) return;
    entered.current = coach.step;
    const st = useStore.getState();
    if (step.cam) setTimeout(() => st.requestCam(step.cam), coach.step === 0 ? 2300 : 0);
    if (coach.step === 2) st.set({ sidebarOpen: true });
    if (coach.step === 3) st.set({ clockTouched: false, show: { ...st.show, corrected: true } });
    if (coach.step === 0) st.set({ pinMoved: false });
  }, [coach.step, coach.active]);

  useEffect(() => {
    document.querySelectorAll('.coach-glow').forEach((el) => el.classList.remove('coach-glow'));
    if (coach.active && step?.target) document.querySelectorAll(`[data-coach="${step.target}"]`).forEach((el) => el.classList.add('coach-glow'));
  });

  // auto-advance when the visitor does the thing
  useEffect(() => {
    if (!coach.active) return;
    if (coach.step === 0 && pinMoved) setCoach({ step: 1 });
    if (coach.step === 2 && sim.fix4.status === 'ok') setCoach({ step: 3 });
    if (coach.step === 3 && clockTouched) {
      const id = setTimeout(() => setCoach({ step: 4 }), 2500);
      return () => clearTimeout(id);
    }
  }, [pinMoved, clockTouched, sim.fix4.status, coach.step, coach.active]);

  if (!coach.active) {
    return null;
  }
  return (
    <div className="coach" role="dialog" aria-live="polite" aria-label="Guided tour">
      <div className="coach-step">STEP {Math.min(coach.step + 1, 4)} / 4</div>
      <p>{t(step.key)}</p>
      <div className="coach-actions">
        <div className="dots">{STEPS.slice(0, 4).map((_, i) => <i key={i} className={i <= coach.step ? 'on' : ''} />)}</div>
        <button className="ghost-btn" onClick={() => setCoach({ active: false })}>{t('skip')}</button>
        {coach.step > 0 && coach.step < 4 && <button className="ghost-btn" onClick={() => setCoach({ step: coach.step - 1 })}>{t('back')}</button>}
        {step.next && <button className="go-btn" onClick={() => setCoach({ step: coach.step + 1 })}>{t('next')} ▸</button>}
        {coach.step === 4 && <button className="go-btn" onClick={() => setCoach({ active: false })}>{t('done')}</button>}
      </div>
    </div>
  );
}
