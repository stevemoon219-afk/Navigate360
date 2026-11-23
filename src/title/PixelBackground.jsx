import React, { useEffect, useRef } from 'react';
import { createPixelSpace } from './PixelSpace.js';
import { useStore } from '../state/store.js';

export const EARTH_2K = import.meta.env.BASE_URL + 'textures/earth_day_2k.jpg';

/** Full-screen animated pixel-art space scene used behind all menu screens. */
export default function PixelBackground({ dim = false }) {
  const ref = useRef(null);
  const reducedMotion = useStore((s) => s.settings.reducedMotion);
  useEffect(() => createPixelSpace(ref.current, { earthUrl: EARTH_2K, reducedMotion }), [reducedMotion]);
  return (
    <div className={`pixel-bg ${dim ? 'dim' : ''}`} aria-hidden="true">
      <canvas ref={ref} />
    </div>
  );
}
