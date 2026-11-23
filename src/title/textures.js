// Generates small pixel-noise textures at startup and exposes them as CSS variables
// (--panel-tex for the brown menu panel, --stone-tex for the grey corner buttons).
function noiseTexture(size, palette, seed) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  let s = seed;
  const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    ctx.fillStyle = palette[Math.floor(rnd() * palette.length)];
    ctx.fillRect(x, y, 1, 1);
  }
  return c.toDataURL();
}
const root = document.documentElement.style;
root.setProperty('--panel-tex', `url(${noiseTexture(16, ['#5a3d22', '#4e341c', '#644529', '#3f2a16', '#563a20', '#6b4a2c', '#47301a'], 7)})`);
root.setProperty('--stone-tex', `url(${noiseTexture(16, ['#8a8a8a', '#7d7d7d', '#959595', '#727272', '#868686'], 3)})`);
