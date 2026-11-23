// Number formatting helpers shared by the UI.
export function fmtDist(m, units = 'metric', digits) {
  if (m == null || !isFinite(m)) return '—';
  const a = Math.abs(m), sign = m < 0 ? '−' : '';
  if (units === 'imperial') {
    const mi = a / 1609.344, ft = a * 3.28084;
    if (mi >= 0.5) return `${sign}${mi.toLocaleString(undefined, { maximumFractionDigits: digits ?? (mi < 10 ? 2 : mi < 100 ? 1 : 0) })} mi`;
    if (ft >= 1) return `${sign}${ft.toFixed(digits ?? 1)} ft`;
    return `${sign}${(ft * 12).toFixed(2)} in`;
  }
  if (a >= 1000) return `${sign}${(a / 1000).toLocaleString(undefined, { maximumFractionDigits: digits ?? (a < 10_000 ? 2 : a < 100_000 ? 1 : 0) })} km`;
  if (a >= 1) return `${sign}${a.toFixed(digits ?? 2)} m`;
  if (a >= 0.01) return `${sign}${(a * 100).toFixed(1)} cm`;
  if (a >= 1e-5) return `${sign}${(a * 1000).toFixed(2)} mm`;
  return '< 0.01 mm';
}

export function fmtTime(s, precise = false) {
  const a = Math.abs(s), sign = s < 0 ? '−' : s > 0 ? '+' : '';
  if (a < 1e-13) return '0 s';
  if (a >= 9.995e-5) return `${sign}${(a * 1e3).toFixed(precise ? 6 : 3)} ms`;
  if (a >= 9.995e-8) return `${sign}${(a * 1e6).toFixed(precise ? 4 : 2)} µs`;
  return `${sign}${(a * 1e9).toFixed(precise ? 2 : 1)} ns`;
}

export const fmtLatLon = (lat, lon) =>
  `${Math.abs(lat).toFixed(4)}°${lat >= 0 ? 'N' : 'S'}  ${Math.abs(lon).toFixed(4)}°${lon >= 0 ? 'E' : 'W'}`;
