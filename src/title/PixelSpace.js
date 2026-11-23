// Procedural pixel-art space scene for the menu screens.
// Everything is drawn into a small framebuffer (one array entry per "art pixel") that CSS scales
// up with `image-rendering: pixelated`. Nothing is a pre-made image except the Earth texture,
// which we sample per pixel to paint a rotating pixel Earth.

const P = 3; // CSS pixels per art pixel

// ---------- colour helpers (ImageData is RGBA bytes; Uint32 view is ABGR on little-endian) ----------
const rgb = (r, g, b) => (255 << 24) | (b << 16) | (g << 8) | r;
const hex = (h) => rgb(parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16));
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
const bayer = (x, y) => BAYER[(y & 3) * 4 + (x & 3)];

// ---------- deterministic noise ----------
function hash2(x, y, s = 0) {
  let h = (x * 374761393 + y * 668265263 + s * 982451653) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function valueNoise(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s), c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const fbm = (x, y, s) => valueNoise(x, y, s) * 0.5 + valueNoise(x * 2, y * 2, s + 1) * 0.25 + valueNoise(x * 4, y * 4, s + 2) * 0.125 + valueNoise(x * 8, y * 8, s + 3) * 0.0625;

function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- sprites ----------
const SHIP = [
  '....aa.......',
  '...abbc......',
  'ffabbbbbbbd..',
  'ffbbbbbbbbbbd',
  'ffabbbbbbbd..',
  '...abbc......',
  '....aa.......',
];
const SHIP_COLORS = { a: hex('#8a93a6'), b: hex('#e8ecf2'), c: hex('#ff6b4a'), d: hex('#9fd8ff') };
const GPS_SAT = [
  'pp.g.pp',
  'ppgggpp',
  'pp.g.pp',
];
const GPS_COLORS = { p: hex('#3d7bd9'), g: hex('#ffd24a') };

export function createPixelSpace(canvas, { earthUrl, reducedMotion = false } = {}) {
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, img, buf, bg; // bg = precomputed nebula/background
  let stars = [], sparkles = [], constellations = [], asteroids = [], ships = [], meteors = [];
  let earthTex = null, texW = 0, texH = 0;
  let raf = 0, last = 0, t = 0, frame = 0;
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  const rand = mulberry(42);

  // ---- load the Earth texture and shrink it (shrinking = chunkier pixel look + fast sampling) ----
  if (earthUrl) {
    const im = new Image();
    im.onload = () => {
      const c = document.createElement('canvas');
      c.width = texW = 256; c.height = texH = 128;
      const cx = c.getContext('2d');
      cx.drawImage(im, 0, 0, texW, texH);
      earthTex = new Uint32Array(cx.getImageData(0, 0, texW, texH).data.buffer);
      if (reducedMotion) draw();
    };
    im.src = earthUrl;
  }

  function put(x, y, c) {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    buf[y * W + x] = c;
  }
  function blend(x, y, r, g, b, a) {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = y * W + x, o = buf[i];
    const or = o & 255, og = (o >> 8) & 255, ob = (o >> 16) & 255;
    buf[i] = rgb(or + (r - or) * a, og + (g - og) * a, ob + (b - ob) * a);
  }
  function line(x0, y0, x1, y1, fn) {
    x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy, k = 0;
    for (;;) {
      fn(x0, y0, k++);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }
  function sprite(rows, colors, x, y, flip = false) {
    rows.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        const ch = flip ? row[row.length - 1 - i] : row[i];
        const c = colors[ch];
        if (c) put(x + i, y + j, c);
      }
    });
  }

  // ---------- sphere renderer: calls shade(lon, lat, light, x, y) for every pixel of the disc ----------
  const L = (() => { const v = [0.55, -0.5, 0.67]; const n = Math.hypot(...v); return v.map((a) => a / n); })();
  function sphere(cx, cy, r, rot, tilt, shade) {
    const r2 = r * r, ct = Math.cos(tilt), st = Math.sin(tilt);
    for (let y = Math.floor(-r); y <= r; y++) {
      for (let x = Math.floor(-r); x <= r; x++) {
        const d2 = x * x + y * y;
        if (d2 > r2) continue;
        const nx = x / r, ny = y / r, nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
        const light = nx * L[0] + ny * L[1] + nz * L[2];
        // undo the axial tilt, then read latitude/longitude on the sphere
        const ty = ny * ct - nx * st, tx = nx * ct + ny * st;
        const lat = Math.asin(-ty);
        const lon = Math.atan2(tx, nz) + rot;
        const c = shade(lon, lat, light, cx + x, cy + y, d2 / r2);
        if (c) put(cx + x, cy + y, c);
      }
    }
  }
  // light quantised into pixel-art bands, with dithering between bands
  const band = (light, x, y, levels = 4) => {
    const l = Math.max(0, light) * levels + bayer(x, y) - 0.5;
    return Math.max(0.18, Math.min(1, Math.round(l) / levels + 0.12));
  };
  const shadeRGB = (r, g, b, k) => rgb(Math.min(255, r * k), Math.min(255, g * k), Math.min(255, b * k));

  // ---------- scene construction (re-done on resize) ----------
  function build() {
    W = Math.ceil(canvas.clientWidth / P) || 1;
    H = Math.ceil(canvas.clientHeight / P) || 1;
    canvas.width = W; canvas.height = H;
    img = ctx.createImageData(W, H);
    buf = new Uint32Array(img.data.buffer);
    bg = new Uint32Array(W * H);

    // background: deep-space gradient + nebula clouds, colour-quantised with ordered dithering
    const neb = [[0.78, 0.55, 0.22, [190, 60, 200]], [0.86, 0.6, 0.16, [80, 70, 220]], [0.62, 0.42, 0.14, [120, 40, 160]], [0.18, 0.35, 0.18, [40, 60, 150]]];
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const gy = y / H;
        let r = 9 + 10 * gy, g = 11 + 8 * gy, b = 36 + 26 * gy;
        for (const [nx, ny, rad, col] of neb) {
          const dx = (x / W - nx) / (rad * 1.4), dy = (y / H - ny) / rad;
          const fall = Math.max(0, 1 - Math.hypot(dx, dy));
          const n = fbm(x / 38, y / 38, nx * 100);
          let k = fall * fall * (n * 1.6 - 0.25);
          k = Math.floor(Math.max(0, k) * 5 + bayer(x, y)) / 5; // quantise → pixel bands
          r += col[0] * k * 0.55; g += col[1] * k * 0.55; b += col[2] * k * 0.55;
        }
        // bright nebula core
        const cdx = (x / W - 0.75) * 3.2, cdy = (y / H - 0.58) * 5;
        const core = Math.max(0, 1 - Math.hypot(cdx, cdy)) * fbm(x / 20, y / 20, 9);
        const ck = Math.floor(core * 4 + bayer(x, y)) / 4;
        r += 255 * ck * 0.6; g += 120 * ck * 0.6; b += 230 * ck * 0.6;
        bg[y * W + x] = rgb(Math.min(255, r), Math.min(255, g), Math.min(255, b));
      }
    }

    stars = Array.from({ length: Math.floor((W * H) / 260) }, () => ({
      x: rand() * W, y: rand() * H, layer: rand() < 0.65 ? 0 : rand() < 0.75 ? 1 : 2,
      phase: rand() * 6.28, speed: 0.6 + rand() * 2.2,
      tint: rand() < 0.15 ? [255, 220, 170] : rand() < 0.3 ? [170, 200, 255] : [255, 255, 255],
    }));
    sparkles = Array.from({ length: 9 }, () => ({ x: rand() * W, y: rand() * H * 0.95, phase: rand() * 6.28, size: 2 + Math.floor(rand() * 3) }));

    // constellations: positions as fractions of the screen, joined by faint lines
    const groups = [
      [[0.055, 0.1], [0.075, 0.12], [0.11, 0.13], [0.135, 0.12], [0.14, 0.16], [0.13, 0.22], [0.11, 0.21]],
      [[0.04, 0.47], [0.075, 0.43], [0.11, 0.42], [0.105, 0.5], [0.08, 0.54], [0.03, 0.6], [0.02, 0.63]],
      [[0.33, 0.29], [0.355, 0.33], [0.385, 0.3], [0.37, 0.35], [0.4, 0.36]],
      [[0.8, 0.86], [0.83, 0.9], [0.86, 0.87]],
    ];
    constellations = groups.map((g) => g.map(([fx, fy]) => [fx * W, fy * H]));

    // asteroid belt in the lower right: each rock is a pre-generated lumpy, shaded blob
    asteroids = Array.from({ length: Math.max(18, Math.floor(W / 14)) }, (_, k) => {
      const r = 1.5 + Math.pow(rand(), 2) * 6.5;
      const seed = k * 17 + 3;
      const pix = [];
      const R = Math.ceil(r) + 1;
      for (let y = -R; y <= R; y++) for (let x = -R; x <= R; x++) {
        const ang = Math.atan2(y, x);
        const edge = r * (0.75 + 0.35 * valueNoise(Math.cos(ang) * 1.5 + 5, Math.sin(ang) * 1.5 + 5, seed));
        const d = Math.hypot(x, y);
        if (d > edge) continue;
        const lit = (x * 0.6 - y * 0.6) / (edge + 0.01) + 0.2 + (valueNoise(x * 0.8, y * 0.8, seed + 1) - 0.5) * 0.6;
        const rim = d > edge - 1;
        const level = rim ? 0 : lit > 0.45 ? 3 : lit > 0.05 ? 2 : 1;
        pix.push([x, y, level]);
      }
      return {
        x: W * (0.62 + rand() * 0.4), y: H * (0.55 + rand() * 0.45), r, pix,
        vx: -(0.6 + rand() * 1.5) * (r < 3 ? 1.6 : 1), vy: 0.25 + rand() * 0.5, bob: rand() * 6.28,
        tone: rand() < 0.5 ? [92, 84, 82] : [104, 92, 78],
      };
    });

    ships = Array.from({ length: 3 }, (_, k) => spawnShip(k, true));
    meteors = [];
  }

  function spawnShip(k, initial = false) {
    const dir = rand() < 0.5 ? 1 : -1;
    return {
      dir, x: initial ? rand() * W : dir > 0 ? -20 : W + 20,
      y: H * (0.2 + rand() * 0.7), vy: (rand() - 0.5) * 2.5,
      speed: 10 + rand() * 14, wait: initial ? 0 : 2 + rand() * 6, k,
    };
  }

  // ---------- per-frame drawing ----------
  function draw() {
    buf.set(bg);
    mouse.x += (mouse.tx - mouse.x) * 0.05;
    mouse.y += (mouse.ty - mouse.y) * 0.05;
    const par = (depth) => [mouse.x * depth, mouse.y * depth];

    // stars: three parallax layers drifting left, twinkling
    for (const s of stars) {
      const speed = [0.6, 1.4, 2.8][s.layer];
      const [px, py] = par([1, 2.5, 4][s.layer]);
      const x = ((s.x - t * speed + px) % W + W) % W, y = s.y + py;
      const tw = 0.55 + 0.45 * Math.sin(t * s.speed + s.phase);
      const a = [0.45, 0.75, 1][s.layer] * tw;
      blend(x, y, s.tint[0], s.tint[1], s.tint[2], a);
      if (s.layer === 2 && tw > 0.8) {
        blend(x + 1, y, s.tint[0], s.tint[1], s.tint[2], a * 0.4);
        blend(x - 1, y, s.tint[0], s.tint[1], s.tint[2], a * 0.4);
        blend(x, y + 1, s.tint[0], s.tint[1], s.tint[2], a * 0.4);
        blend(x, y - 1, s.tint[0], s.tint[1], s.tint[2], a * 0.4);
      }
    }
    // big "+" sparkles
    for (const s of sparkles) {
      const [px, py] = par(3);
      const k = 0.5 + 0.5 * Math.sin(t * 1.3 + s.phase);
      const arm = Math.round(s.size * (0.5 + k * 0.6));
      for (let i = -arm; i <= arm; i++) {
        const a = 1 - Math.abs(i) / (arm + 1);
        blend(s.x + i + px, s.y + py, 255, 255, 255, a * (0.4 + k * 0.6));
        blend(s.x + px, s.y + i + py, 255, 255, 255, a * (0.4 + k * 0.6));
      }
    }
    // constellations
    for (const g of constellations) {
      const [px, py] = par(2.5);
      for (let i = 0; i < g.length - 1; i++) {
        line(g[i][0] + px, g[i][1] + py, g[i + 1][0] + px, g[i + 1][1] + py, (x, y, k) => { if (k % 2 === 0) blend(x, y, 120, 160, 230, 0.55); });
      }
      g.forEach(([x, y], i) => {
        const tw = 0.6 + 0.4 * Math.sin(t * 2 + i);
        blend(x + px, y + py, 200, 225, 255, tw);
        blend(x + px + 1, y + py, 200, 225, 255, tw * 0.8);
        blend(x + px, y + py + 1, 200, 225, 255, tw * 0.8);
        blend(x + px + 1, y + py + 1, 200, 225, 255, tw * 0.6);
      });
    }
    // shooting stars
    if (!reducedMotion && rand() < 0.004) meteors.push({ x: rand() * W, y: rand() * H * 0.4, life: 0 });
    meteors = meteors.filter((m) => m.life < 1);
    for (const m of meteors) {
      m.life += 0.025;
      const hx = m.x + m.life * 90, hy = m.y + m.life * 40;
      for (let i = 0; i < 16; i++) blend(hx - i * 2, hy - i, 255, 245, 220, (1 - i / 16) * (1 - m.life));
    }

    drawPlanets(par);
    drawEarth(par);
    drawAsteroids(par);
    drawShips();
    ctx.putImageData(img, 0, 0);
  }

  function drawPlanets(par) {
    // small rust planet (upper left), slowly rotating craters
    {
      const [px, py] = par(5);
      sphere(W * 0.2 + px, H * 0.27 + py, H * 0.065, t * 0.15, 0.2, (lon, lat, l, x, y) => {
        const n = fbm(lon * 2.2 + 10, lat * 3, 5);
        const crater = valueNoise(lon * 5 + 3, lat * 6, 8) > 0.72;
        const k = band(l, x, y);
        return crater ? shadeRGB(140, 60, 35, k * 0.8) : n > 0.55 ? shadeRGB(210, 110, 60, k) : shadeRGB(185, 85, 45, k);
      });
    }
    // little blue-green planet near the title and a grey moon
    {
      const [px, py] = par(4);
      sphere(W * 0.955 + px, H * 0.1 + py, H * 0.035, t * 0.4, 0.3, (lon, lat, l, x, y) => {
        const land = fbm(lon * 1.6 + 2, lat * 2.2, 3) > 0.5;
        return land ? shadeRGB(80, 170, 70, band(l, x, y)) : shadeRGB(40, 110, 210, band(l, x, y));
      });
      sphere(W * 0.29 + px, H * 0.6 + py, H * 0.03, t * 0.2, 0, (lon, lat, l, x, y) =>
        shadeRGB(110, 110, 125, band(l, x, y) * (valueNoise(lon * 4, lat * 4, 2) > 0.65 ? 0.75 : 1)));
      sphere(W * 0.955 + px, H * 0.42 + py, H * 0.045, t * 0.3, 0.1, (lon, lat, l, x, y) =>
        shadeRGB(70, 120, 200, band(l, x, y) * (0.85 + 0.3 * fbm(lon * 2, lat * 5, 4))));
    }
    // ringed gas giant (upper right): back half of ring → planet → front half of ring
    {
      const [px, py] = par(7);
      const cx = W * 0.83 + px, cy = H * 0.33 + py, r = H * 0.17;
      const tilt = -0.32, ct = Math.cos(tilt), st = Math.sin(tilt), flat = 0.3;
      const ring = (front) => {
        const R = r * 2.25;
        for (let y = Math.floor(-R); y <= R; y++) for (let x = Math.floor(-R); x <= R; x++) {
          const u = x * ct + y * st, v = (-x * st + y * ct) / flat;
          if ((v > 0) !== front) continue;
          const rr = Math.hypot(u, v) / r;
          if (rr < 1.3 || rr > 2.15 || (rr > 1.72 && rr < 1.8)) continue;
          if (front === false && x * x + y * y < r * r) continue;
          const bandC = Math.floor(rr * 9) % 3;
          const cols = [[214, 190, 150], [180, 150, 110], [235, 215, 175]];
          const c = cols[bandC];
          const k = (0.65 + 0.35 * (u / R + 1) / 2) * (bayer(x, y) > 0.85 ? 0.85 : 1);
          put(cx + x, cy + y, shadeRGB(c[0], c[1], c[2], k));
        }
      };
      ring(false);
      sphere(cx, cy, r, t * 0.05, tilt, (lon, lat, l, x, y) => {
        const b = Math.sin(lat * 9 + fbm(lon * 1.5, lat * 4, 7) * 2.2);
        const storm = Math.hypot(((lon % 6.283) + 6.283) % 6.283 - 3.5, (lat + 0.35) * 2.5) < 0.35;
        const k = band(l, x, y, 5);
        if (storm) return shadeRGB(200, 120, 90, k);
        return b > 0.35 ? shadeRGB(220, 200, 165, k) : b > -0.3 ? shadeRGB(175, 160, 140, k) : shadeRGB(140, 150, 165, k);
      });
      ring(true);
    }
  }

  // GPS satellites orbit the pixel Earth and send timing pulses down to a blinking "phone"
  function drawEarth(par) {
    const [px, py] = par(10);
    const cx = W * 0.11 + px, cy = H * 0.86 + py, r = H * 0.27;
    const orbits = [
      { R: 1.55, inc: 1.2, rot: -0.5, speed: 0.22, phase: 0 },
      { R: 1.7, inc: 1.35, rot: 0.6, speed: -0.17, phase: 2 },
      { R: 1.45, inc: 1.05, rot: 1.5, speed: 0.19, phase: 4 },
      { R: 1.62, inc: 1.28, rot: 0.1, speed: 0.15, phase: 1 },
    ];
    const satPos = (o, θ) => {
      const x = Math.cos(θ) * o.R * r, y0 = Math.sin(θ) * o.R * r;
      const y = y0 * Math.cos(o.inc), z = y0 * Math.sin(o.inc);
      return [cx + x * Math.cos(o.rot) - y * Math.sin(o.rot), cy + x * Math.sin(o.rot) + y * Math.cos(o.rot), z];
    };
    const hidden = (x, y, z) => z < 0 && (x - cx) ** 2 + (y - cy) ** 2 < r * r;
    // dotted orbit paths behind the Earth
    for (const o of orbits) for (let k = 0; k < 220; k += 2) {
      const [x, y, z] = satPos(o, (k / 220) * 6.283);
      if (z < 0 && !hidden(x, y, z)) blend(x, y, 120, 170, 255, 0.35);
    }
    // the Earth itself: real texture, sampled per pixel, lit in pixel-art bands
    const rot = t * 0.12;
    sphere(cx, cy, r, rot, 0.41, (lon, lat, l, x, y, edge) => {
      let R = 30, G = 90, B = 200;
      if (earthTex) {
        const u = ((((lon / (2 * Math.PI)) + 0.5) % 1) + 1) % 1;
        const v = 0.5 - lat / Math.PI;
        const c = earthTex[Math.min(texH - 1, Math.floor(v * texH)) * texW + Math.floor(u * texW)];
        R = c & 255; G = (c >> 8) & 255; B = (c >> 16) & 255;
        // posterise colours for a chunky palette
        R = Math.round(R / 40) * 40 + 10; G = Math.round(G / 36) * 36 + 12; B = Math.round(B / 36) * 36 + 20;
      } else if (fbm(lon * 1.5 + 4, lat * 2, 1) > 0.52) { R = 70; G = 150; B = 60; }
      const k = band(l, x, y, 5) * 1.15;
      if (edge > 0.93 && l > -0.1) return shadeRGB(140, 200, 255, 0.9); // atmosphere rim
      return shadeRGB(R, G, B, k);
    });
    // a blinking phone on the surface (fixed spot facing us)
    const phx = cx + r * 0.42, phy = cy - r * 0.55;
    const blink = Math.sin(t * 6) > 0;
    put(phx, phy, blink ? hex('#39ff88') : hex('#1c8a4a'));
    put(phx, phy - 1, hex('#39ff88')); put(phx - 1, phy - 2, hex('#39ff88')); put(phx, phy - 2, hex('#b6ffd5')); put(phx + 1, phy - 2, hex('#39ff88'));
    // satellites + signal pulses
    orbits.forEach((o, i) => {
      const θ = o.phase + t * o.speed;
      const [x, y, z] = satPos(o, θ);
      if (hidden(x, y, z)) return;
      if (z >= 0) for (let k = 0; k < 220; k += 3) {
        const [ox, oy, oz] = satPos(o, (k / 220) * 6.283);
        if (oz >= 0) blend(ox, oy, 120, 170, 255, 0.3);
      }
      sprite(GPS_SAT, GPS_COLORS, x - 3, y - 1);
      // timing pulse travelling down to the phone (each satellite on its own beat)
      const beat = (t * 0.6 + i * 0.25) % 1;
      if (z >= 0 && beat < 0.6) {
        const f = beat / 0.6;
        const qx = x + (phx - x) * f, qy = y + (phy - y) * f;
        blend(qx, qy, 255, 240, 120, 1); blend(qx + 1, qy, 255, 240, 120, 0.6); blend(qx, qy + 1, 255, 240, 120, 0.6);
        line(x, y, phx, phy, (lx, ly, k) => { if (k % 4 === 0) blend(lx, ly, 255, 230, 120, 0.25); });
      }
    });
  }

  function drawAsteroids(par) {
    const [px, py] = par(8);
    for (const a of asteroids) {
      if (!reducedMotion) { a.x += a.vx * 0.033; a.y += a.vy * 0.033; }
      if (a.x < W * 0.5 - 10 || a.y > H + 10) { a.x = W + 10 + rand() * 30; a.y = H * (0.5 + rand() * 0.4); }
      const bob = Math.sin(t + a.bob) * 0.8;
      const [r0, g0, b0] = a.tone;
      for (const [x, y, lvl] of a.pix) {
        const k = [0.45, 0.7, 1, 1.35][lvl];
        put(a.x + x + px, a.y + y + py + bob, shadeRGB(r0, g0, b0, k));
      }
    }
  }

  function drawShips() {
    ships.forEach((s, i) => {
      if (s.wait > 0) { s.wait -= 0.033; return; }
      if (!reducedMotion) { s.x += s.dir * s.speed * 0.033; s.y += s.vy * 0.033; }
      sprite(SHIP, SHIP_COLORS, s.x, s.y, s.dir < 0);
      // flickering engine flame + fading exhaust trail
      const tailX = s.dir > 0 ? s.x - 1 : s.x + SHIP[0].length;
      const flick = (frame + i) % 4 < 2;
      for (let j = 2; j <= 4; j++) {
        put(tailX, s.y + j, flick ? hex('#ffd24a') : hex('#ff8a2a'));
        put(tailX - s.dir, s.y + j, flick ? hex('#ff8a2a') : hex('#ffd24a'));
      }
      for (let k = 2; k < 12; k++) blend(tailX - s.dir * k, s.y + 3 + Math.sin(frame * 0.5 + k) * 0.6, 255, 160, 80, 0.5 * (1 - k / 12));
      if (s.x < -40 || s.x > W + 40 || s.y < -20 || s.y > H + 20) ships[i] = spawnShip(i);
    });
  }

  function loop(now) {
    raf = requestAnimationFrame(loop);
    if (now - last < 33) return; // ~30 fps is plenty for pixel art
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    t += dt; frame++;
    draw();
  }

  function onResize() { build(); if (reducedMotion) draw(); }
  function onMouse(e) {
    mouse.tx = (e.clientX / window.innerWidth - 0.5) * 2;
    mouse.ty = (e.clientY / window.innerHeight - 0.5) * 2;
  }

  build();
  window.addEventListener('resize', onResize);
  window.addEventListener('pointermove', onMouse);
  if (reducedMotion) draw();
  else raf = requestAnimationFrame(loop);

  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', onResize);
    window.removeEventListener('pointermove', onMouse);
  };
}
