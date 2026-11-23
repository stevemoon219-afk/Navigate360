import React, { Suspense, lazy } from 'react';
import { useStore } from './state/store.js';
import PixelBackground from './title/PixelBackground.jsx';
import TitleScreen from './screens/TitleScreen.jsx';
import LoadingScreen from './screens/LoadingScreen.jsx';
import SettingsScreen from './screens/SettingsScreen.jsx';
import InfoScreen from './screens/InfoScreen.jsx';

// The 3D simulator is loaded as a separate chunk so the title screen appears instantly.
const SimScreen = lazy(() => import('./screens/SimScreen.jsx'));

export default function App() {
  const screen = useStore((s) => s.screen);
  const menuScreens = ['title', 'loading', 'settings', 'info'];
  return (
    <>
      {menuScreens.includes(screen) && <PixelBackground dim={screen !== 'title'} />}
      {screen === 'title' && <TitleScreen />}
      {screen === 'loading' && <LoadingScreen />}
      {screen === 'settings' && <SettingsScreen />}
      {screen === 'info' && <InfoScreen />}
      {screen === 'sim' && (
        <Suspense fallback={<div className="sim-fallback">Starting simulator…</div>}>
          <SimScreen />
        </Suspense>
      )}
    </>
  );
}
