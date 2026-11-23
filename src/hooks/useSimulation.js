import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '../state/store.js';
import { simulate } from '../sim/simulate.js';

/** Everything the simulation depends on, picked from the store (stable while unchanged). */
export function useSimInputs() {
  return useStore(useShallow((s) => ({
    pin: s.pin, sats: s.sats, in3: s.in3, clockErrorS: s.clockErrorS, noiseSigmaM: s.noiseSigmaM,
    seed: s.seed, commonDelayM: s.commonDelayM, ionoZenithM: s.ionoZenithM, surfaceMode: s.surfaceMode,
    elevMaskDeg: s.settings.elevMaskDeg,
  })));
}

/** Recomputes measurements + all fixes whenever an input changes (cheap: a few small matrix solves). */
export function useSimulation() {
  const inputs = useSimInputs();
  return useMemo(() => ({ inputs, ...simulate(inputs) }), [inputs]);
}
