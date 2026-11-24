import React from 'react';
import { useStore } from '../state/store.js';

const TABS = [
  ['idea', 'The idea'], ['maths', 'The maths'], ['simplified', 'What’s simplified'], ['sources', 'Sources'], ['credits', 'Credits & AI use'],
];

function Idea() {
  return (
    <>
      <p><b>Your phone needs a 4th satellite because it doesn’t know the exact time.</b></p>
      <p>Each GPS satellite broadcasts the time it sent its signal. Your phone notes when the signal arrives. Travel time × speed of light = distance.
        Three distances would pin down a point in 3-D space (three spheres meet at a point), <i>if</i> your phone’s clock were perfect.</p>
      <p>It isn’t. A phone has a cheap quartz clock, not an atomic one. Light travels <b>300 metres in one microsecond</b>, so a clock that is off by just 1 µs makes every
        distance 300 m too long, by the <i>same</i> amount for every satellite.</p>
      <p>So the phone treats its clock error as a 4th unknown, next to x, y and z. Four unknowns need four equations: four satellites.
        As a bonus, your phone ends up knowing the time to within a few billionths of a second.</p>
      <div className="note">Try it: press START, follow the 4 steps, then slide the clock error. The orange 3-satellite answer runs away. The blue 4-satellite answer doesn’t move.</div>
    </>
  );
}

function Maths() {
  return (
    <>
      <h3>1. What the phone measures</h3>
      <span className="eq">ρᵢ = |sᵢ − r| + b + noise          (b = c × clock error)</span>
      <p>ρᵢ is the <i>pseudorange</i> to satellite i: the true distance from satellite position sᵢ to your position r, plus the clock error b (in metres). b is the same for every satellite.</p>
      <h3>2. Why three isn’t enough</h3>
      <p>With 3 satellites the phone must assume b = 0. It intersects three spheres of radius ρᵢ exactly (our <code>solver3.js</code>). Every sphere is too big by b, so the
        intersection lands in the wrong place, mostly too low: with a 1 ms clock error, hundreds of km underground. The algebra always gives two answers (a mirror pair). We keep the one nearer Earth.</p>
      <h3>3. How four satellites solve it: Gauss–Newton</h3>
      <span className="eq">guess x = (x, y, z, b) = (0, 0, 0, 0)       ← Earth’s centre{'\n'}repeat:  row i of G = [ −(sᵢ − r)ᵀ/|sᵢ − r| , 1 ]{'\n'}         Δ = (GᵀG)⁻¹ Gᵀ (ρ − ρ̂)     x ← x + Δ</span>
      <p>The distance formula is curved (a square root), so the receiver replaces it with its tangent at the current guess, solves the resulting 4×4 linear system, and repeats.
        The column of 1s is the clock. Because satellites are ~20,000 km away, the tangent is an excellent approximation and the error roughly squares each step:
        1,350 km → 48 km → 64 m → 0.1 mm in Steve’s test case (our unit tests reproduce these exact numbers). With more than 4 satellites the same formula is a least-squares fit.</p>
      <h3>4. Geometry: DOP</h3>
      <span className="eq">Q = (GᵀG)⁻¹    HDOP = √(q_EE + q_NN)    VDOP = √q_UU    σ_position ≈ DOP × σ_range</span>
      <p>Dilution of precision depends only on satellite directions. Bunched satellites give large DOP. Height is usually worst because all satellites are above you, so the “up” column of G
        looks like the clock column of 1s. Lowering yourself and having a slow clock change the distances in almost the same way.</p>
      <h3>5. Range spheres in 3D</h3>
      <span className="eq">|r − sᵢ| = ρᵢ    (one sphere per satellite)</span>
      <p>Each measured distance ρᵢ puts you somewhere on a sphere of radius ρᵢ around satellite i, so trilateration is done with spheres in 3D space, not flat circles.
        Two spheres cross along a circle in space; the 3D rings on the globe are these crossings. A third sphere cuts that ring in two points (your position and its mirror, far out in space).
        With true distances all rings meet at your phone. With a wrong clock every sphere is 300 km/ms too big and they miss.</p>
      <span className="eq">cos θ = (R² + d² − ρ²) / (2·R·d)</span>
      <p>Where a sphere touches the (spherical) Earth is a circle of angular radius θ on the ground, from the law of cosines (d = satellite’s distance from Earth’s centre).</p>
    </>
  );
}

function Simplified() {
  return (
    <ul>
      <li><b>Spherical Earth</b> (radius 6,371 km). Real GPS uses the WGS84 ellipsoid, and heights above sea level also need a geoid model.</li>
      <li><b>Satellites don’t move</b> while you look. Real ones circle Earth twice a day at ~3.9 km/s, and their positions come from broadcast orbit data (ephemeris).</li>
      <li><b>No Earth rotation during signal travel (Sagnac), no relativity</b> in the solver. Satellite clocks are assumed perfect. In reality GPS corrects ~38 µs/day of relativistic drift.</li>
      <li><b>Atmosphere</b> is off by default. The optional ionosphere slider uses a simple slant factor, not a full Klobuchar model.</li>
      <li><b>Measurements are simulated</b> from the pin you place: not live satellite data, and not what any particular phone does internally (phones add filtering and assistance data).</li>
      <li><b>The phone’s clock error</b> is a slider. We default to 1 ms (300 km) so the effect is visible from space. Even 1 µs (300 m) would ruin a 3-satellite fix.</li>
      <li>Signal pulses are slowed about 20× so you can see them. Real travel time is ~65–85 ms.</li>
    </ul>
  );
}

function Sources() {
  return (
    <ul>
      <li>ESA Navipedia: <a href="https://gssc.esa.int/navipedia/index.php/Code_Based_Positioning_(SPS)" target="_blank" rel="noreferrer">Code Based Positioning (SPS)</a>, <a href="https://gssc.esa.int/navipedia/index.php/Positioning_Error" target="_blank" rel="noreferrer">Positioning Error (DOP)</a>, <a href="https://gssc.esa.int/navipedia/index.php/An_intuitive_approach_to_the_GNSS_positioning" target="_blank" rel="noreferrer">An intuitive approach to GNSS positioning</a>, <a href="https://gssc.esa.int/navipedia/index.php/Klobuchar_Ionospheric_Model" target="_blank" rel="noreferrer">Klobuchar Ionospheric Model</a>.</li>
      <li>Penn State GEOG 862: <a href="https://www.e-education.psu.edu/geog862/" target="_blank" rel="noreferrer">GPS and GNSS for Geospatial Professionals</a> (DOP, ionosphere).</li>
      <li>GPS.gov: <a href="https://www.gps.gov/systems/gps/performance/accuracy/" target="_blank" rel="noreferrer">GPS Accuracy</a>.</li>
      <li>N. Ashby (2003), <i>Relativity in the Global Positioning System</i>, Living Reviews in Relativity.</li>
      <li>S. Bancroft (1985), <i>An Algebraic Solution of the GPS Equations</i>, IEEE Trans. AES 21(1).</li>
      <li>Team research notes (Steve Moon et al., Nov 2026) and <code>test_vectors.json</code>, against which our solver is unit-tested.</li>
    </ul>
  );
}

function Credits() {
  return (
    <>
      <h3>Our code</h3>
      <p>All the GPS maths (measurement model, 3- and 4-satellite solvers, DOP, range circles, Monte Carlo, error sweep) is our own plain JavaScript in <code>src/sim/</code>, with unit tests.
        The pixel-art menu background is also drawn by our own code, pixel by pixel.</p>
      <h3>Components we didn’t write, and why</h3>
      <ul>
        <li><b>React</b>: UI components and state-driven re-rendering.</li>
        <li><b>three.js, @react-three/fiber, @react-three/drei</b>: WebGL drawing of the globe, satellites and lines. They only draw; they compute nothing about GPS.</li>
        <li><b>Leaflet + react-leaflet</b>: the street-level map. Tiles © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors.</li>
        <li><b>zustand</b>: a tiny shared store so the 3-D scene and the panels see the same numbers.</li>
        <li><b>Fonts</b>: Press Start 2P, Silkscreen, VT323 (SIL Open Font License).</li>
        <li><b>Earth image</b>: NASA Blue Marble (public domain), via the three-globe example assets.</li>
      </ul>
      <h3>AI use</h3>
      <p>We used AI coding assistants (Claude Code) to help write and review code. Every module is small and commented, and the team can explain each one.
        The positioning results are computed by our own code, never by an AI service.</p>
    </>
  );
}

export default function InfoScreen() {
  const tab = useStore((s) => s.infoTab);
  const setTab = useStore((s) => s.setInfoTab);
  const setScreen = useStore((s) => s.setScreen);
  const Body = { idea: Idea, maths: Maths, simplified: Simplified, sources: Sources, credits: Credits }[tab] || Idea;
  return (
    <main className="menu-page">
      <section className="pixel-panel info-body">
        <h2>HOW IT WORKS</h2>
        <div className="tabs">{TABS.map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</div>
        <Body />
        <div className="panel-actions">
          <button className="stone-btn" onClick={() => setScreen('title')}>◂ Back</button>
          <button className="go-btn" onClick={() => setScreen(sessionStorage.getItem('n360-loaded') ? 'sim' : 'loading')}>Try it ▸</button>
        </div>
      </section>
    </main>
  );
}
