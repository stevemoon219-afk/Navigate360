// Run the 4-satellite solver many times with fresh random noise (fixed seeds, so the result is
// repeatable) and collect where the fixes land, in East/North/Up metres around the true position.
// The cloud's shape should match the DOP ellipse — formula and experiment agree.
import { simulate } from './simulate.js';

export function monteCarloCloud(inputs, { runs = 200 } = {}) {
  const pts = [];
  for (let k = 0; k < runs; k++) {
    const r = simulate({ ...inputs, seed: (inputs.seed || 1) * 7777 + k + 1, surfaceMode: false });
    if (r.fix4.status === 'ok') pts.push(r.fix4.error.enu);
  }
  return pts;
}
