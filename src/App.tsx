import { useEffect, useState } from 'react';
import { Home } from './screens/Home';
import { TripScreen } from './screens/TripScreen';
import { Settings } from './screens/Settings';
import { NewTrip } from './screens/NewTrip';

// Screens are picked from the address after the #, so the back button and reloads keep their place.
const read = () => location.hash.replace(/^#\/?/, '').split('/');
export const go = (path: string) => { location.hash = '#/' + path; };

export function App() {
  const [route, setRoute] = useState(read());
  useEffect(() => { const f = () => setRoute(read()); addEventListener('hashchange', f); return () => removeEventListener('hashchange', f); }, []);
  const [a, b] = route;
  if (a === 'trip' && b) return <TripScreen id={b} />;
  if (a === 'settings') return <Settings />;
  if (a === 'new') return <NewTrip />;
  return <Home />;
}
