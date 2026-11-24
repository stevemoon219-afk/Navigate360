# NAVIGATE360: why your phone needs a 4th satellite

**Live demo:** `https://<your-user>.github.io/<repo-name>/` (no sign-in, runs in any current browser)

> **The one idea:** your phone needs a 4th satellite because it doesn't know the exact time.
> Three distances would pin you down if your phone's clock were perfect. But light travels 300 m per
> microsecond, so a tiny clock error makes *every* distance wrong by the same amount. The phone
> therefore solves for its clock as a 4th unknown (x, y, z, clock), and four unknowns need four satellites.

## What you do (the 2-minute path)
1. Press **START**. A guided tour (4 steps) runs on top of a 3D globe in space.
2. The **green pin** is your phone. Drag it anywhere.
3. Three satellites measure distances, but your phone's clock is 1 ms off (300 km). Their 3D distance spheres
   **don't meet** at one point, and the orange 3-satellite fix lands hundreds of km away, mostly *underground*.
4. **Drag a 4th satellite** from the sidebar onto the globe. The blue 4-satellite fix snaps onto your phone and reports
   the clock error it solved for.
5. **Slide the clock error.** Orange runs away; blue doesn't move. The chart shows this for every clock error.

Further depth for explorers: street-level map with a Monte Carlo noise cloud and the DOP error ellipse,
satellite geometry presets (spread / bunched / in a line), the Gauss–Newton iterations drawn from Earth's centre,
"3 satellites + I'm on the ground", shared delays vs ionosphere delays, and a per-satellite measurement table.

## How it works (all in `src/sim/`, our own plain JavaScript)
| File | What it computes |
|---|---|
| `measurements.js` | The "universe": the **only** module that knows the true position. Produces pseudoranges ρᵢ = \|sᵢ − r\| + c·δt (+ noise, delays) |
| `solver4.js` | Gauss–Newton least squares for (x, y, z, clock) from Earth's centre, like a real receiver |
| `solver3.js` | Exact 3-sphere intersection assuming a perfect clock (two mirror roots) |
| `solver3Surface.js` | 3 satellites + "height = 0" pseudo-measurement (a "2D fix") |
| `dop.js` | Q = (GᵀG)⁻¹ in East/North/Up → GDOP/PDOP/HDOP/VDOP/TDOP and the error ellipse |
| `rangeCircle.js` | Where each distance sphere touches the Earth (law of cosines), and the 3D circle where two distance spheres cross |
| `sweep.js`, `monteCarlo.js` | Error vs clock error chart; 200 noisy fixes for the street-level cloud |

The solvers never see the true position: they receive only satellite positions and measured pseudoranges.

**Tests:** `npx vitest run` checks the solver and DOP against the team's independent Python results
(`src/sim/__tests__/test_vectors.json`): the Gauss–Newton error sequence 1,350,334 m → 47,889 m → 64.07 m → 0.000116 m
and the DOP values for the 4-, 6- and 8-satellite skies all match. GitHub Actions runs these tests before every deploy.

## Simplifications (also shown in the app)
Spherical Earth (not WGS84), satellites frozen in place, no Sagnac/relativity in the solver, perfect satellite clocks,
simulated measurements (not live data), signal pulses slowed ~20× for visibility.

## Components we didn't write, and why
- **React**: UI. **three.js + @react-three/fiber + drei**: draw the globe (they compute nothing about GPS).
- **Leaflet + react-leaflet**: street map; tiles © OpenStreetMap contributors.
- **zustand**: one small shared store for the 3D scene and panels.
- Fonts: Press Start 2P, Silkscreen, VT323 (OFL). Earth image: NASA Blue Marble (public domain).
- The animated pixel-art menu background (`src/title/PixelSpace.js`) is our own procedural code.

AI coding assistants were used to help write code; the team reviewed and can explain every module.

## Run locally
```bash
npm install
npm run dev        # http://localhost:5173
npx vitest run     # maths tests
npm run build      # static site in dist/
```

## Deploy (GitHub Pages)
1. Push this folder to a **public** GitHub repo on branch `main`.
2. Repo **Settings → Pages → Source: GitHub Actions**.
3. Every `git push` runs the tests, builds, and publishes to `https://<user>.github.io/<repo>/`.
   (`vite.config.js` uses relative paths, so any repo name works.)
