// Global app state (zustand). The 3D canvas and the HTML panels both read from here.
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { latLonToEcef, satFromAzEl } from '../sim/geo.js';

export const SAT_COLORS = ['#ff5d73', '#ffd93d', '#2ee6c8', '#ff7eb6', '#b5e853', '#7fdbff', '#f0f0f0', '#ffb3a7'];
export const MAX_SATS = 8;
export const DEFAULT_PIN = { lat: 37.5665, lon: 126.978, altM: 0 }; // Seoul

/** Default sky: 3 satellites placed above the pin (azimuth, elevation in degrees). */
export function defaultSats(pin = DEFAULT_PIN) {
  const t = latLonToEcef(pin.lat, pin.lon, 0);
  return [[20, 62], [140, 48], [250, 56]].map(([az, el], i) => ({
    id: i + 1, prn: [7, 13, 21][i], ecef: satFromAzEl(t, az, el), color: SAT_COLORS[i],
  }));
}

export const PRESETS = {
  spread: [[0, 75], [60, 25], [180, 30], [300, 25], [120, 50], [240, 55]],
  bunched: [[40, 60], [55, 55], [45, 45], [65, 65], [50, 70], [35, 52]],
  line: [[0, 20], [0, 40], [0, 60], [0, 80], [180, 70], [180, 45]],
};

const initialCoach = { step: 0, active: true };

export const useStore = create(
  persist(
    (set, get) => ({
      // ----- navigation -----
      screen: 'title', // 'title' | 'loading' | 'sim' | 'settings' | 'info'
      setScreen: (screen) => set({ screen }),
      infoTab: 'idea',
      setInfoTab: (infoTab) => set({ infoTab }),

      // ----- settings (persisted) -----
      settings: { quality: 'high', reducedMotion: false, units: 'metric', elevMaskDeg: 10, labels: true, lang: 'en' },
      setSetting: (k, v) => set((s) => ({ settings: { ...s.settings, [k]: v } })),

      // ----- the experiment -----
      pin: DEFAULT_PIN,
      setPin: (pin) => set((s) => ({ pin: { ...s.pin, ...pin }, pinMoved: true })),
      pinMoved: false,
      sats: defaultSats(),
      nextId: 4,
      addSat: (ecef) => {
        const { sats, nextId } = get();
        if (sats.length >= MAX_SATS) return null;
        const used = new Set(sats.map((x) => x.color));
        const color = SAT_COLORS.find((c) => !used.has(c)) || SAT_COLORS[0];
        const prnUsed = new Set(sats.map((x) => x.prn));
        let prn = 2; while (prnUsed.has(prn)) prn += 3;
        set({ sats: [...sats, { id: nextId, prn: prn % 32 || 32, ecef, color }], nextId: nextId + 1 });
        return nextId;
      },
      moveSat: (id, ecef) => set((s) => ({ sats: s.sats.map((x) => (x.id === id ? { ...x, ecef } : x)) })),
      removeSat: (id) => set((s) => ({ sats: s.sats.filter((x) => x.id !== id), in3: s.in3.filter((i) => i !== id) })),
      applyPreset: (name, count) => {
        const { pin } = get();
        const t = latLonToEcef(pin.lat, pin.lon, 0);
        const list = PRESETS[name].slice(0, Math.max(4, Math.min(count, PRESETS[name].length)));
        set({
          sats: list.map(([az, el], i) => ({ id: i + 1, prn: [7, 13, 21, 2, 5, 29][i], ecef: satFromAzEl(t, az, el), color: SAT_COLORS[i] })),
          nextId: list.length + 1, in3: [],
        });
      },
      resetSky: () => set((s) => ({ sats: defaultSats(s.pin), nextId: 4, in3: [] })),
      in3: [], // ids picked for the 3-satellite solver ([] = first three in view)
      toggleIn3: (id) => set((s) => {
        if (s.in3.includes(id)) return { in3: s.in3.filter((i) => i !== id) };
        return { in3: [...s.in3, id].slice(-3) };
      }),

      clockErrorS: 0.001, // 1 ms → every distance 300 km too long
      setClock: (clockErrorS) => set({ clockErrorS, clockTouched: true }),
      clockTouched: false,
      noiseSigmaM: 0,
      seed: 1,
      commonDelayM: 0,
      ionoZenithM: 0,
      surfaceMode: false,
      set: (patch) => set(patch),

      mode: 'compare', // 'compare' | '3' | '4'
      show: { circles: true, corrected: false, rays: true, ghost: false, iterations: false },
      toggleShow: (k) => set((s) => ({ show: { ...s.show, [k]: !s.show[k] } })),
      stepperK: 0,

      // ----- view -----
      view: 'globe', // 'globe' | 'ground'
      camRequest: null, // { kind: 'space' | 'close' | 'pin' | 'intro', at: timestamp }
      requestCam: (kind) => set({ camRequest: { kind, at: performance.now() } }),
      sidebarOpen: true,
      drawer: false,
      drag: null, // { kind: 'sat' | 'pin' | 'dock', id }
      dropPinArmed: false,

      coach: initialCoach,
      setCoach: (patch) => set((s) => ({ coach: { ...s.coach, ...patch } })),
      restartTour: () => set({ coach: { step: 0, active: true }, sats: defaultSats(get().pin), nextId: 4, clockErrorS: 0.001, pinMoved: false, clockTouched: false, view: 'globe' }),
    }),
    { name: 'navigate360-settings', partialize: (s) => ({ settings: s.settings }) },
  ),
);
