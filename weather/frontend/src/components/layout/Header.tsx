import { useState } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { fetchReverse } from '../../api/hooks';
import { useLocationState } from '../../hooks/useLocationState';
import { useSavedPlaces } from '../../hooks/useFavorites';
import { PRESETS, samePlace, toPlace } from '../../lib/places';
import { SearchBox } from './SearchBox';
import { LocateIcon, StarIcon } from '../icons/UiIcons';

const TABS = [
  { to: '/', label: 'Home', end: true },
  { to: '/compare', label: 'Compare' },
  { to: '/air', label: 'Air quality' },
  { to: '/map', label: 'Map' },
];

export function Header() {
  const { place, selectPlace, locationSearch } = useLocationState();
  const { favorites } = useSavedPlaces();
  const client = useQueryClient();
  const [geoStatus, setGeoStatus] = useState<'idle' | 'locating' | 'error'>('idle');
  const [geoMessage, setGeoMessage] = useState('');

  const locate = () => {
    if (!('geolocation' in navigator)) {
      setGeoStatus('error');
      setGeoMessage('Location is not supported by this browser.');
      return;
    }
    setGeoStatus('locating');
    setGeoMessage('Finding your location…');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        try {
          const res = await fetchReverse(client, lat, lon);
          selectPlace(toPlace(res.data));
          setGeoMessage(`Showing weather for ${res.data.name}`);
        } catch {
          selectPlace({ name: 'My location', lat: Math.round(lat * 100) / 100, lon: Math.round(lon * 100) / 100 });
          setGeoMessage('Showing weather for your coordinates');
        }
        setGeoStatus('idle');
      },
      (err) => {
        setGeoStatus('error');
        setGeoMessage(err.code === err.PERMISSION_DENIED ? 'Location permission was denied.' : 'Could not determine your location.');
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 10 * 60_000 },
    );
  };

  const quick = [...favorites.slice(0, 4), ...PRESETS].filter((p, i, arr) => arr.findIndex((q) => samePlace(q, p)) === i).slice(0, 6);
  const favSet = new Set(favorites.map((f) => `${f.lat.toFixed(2)},${f.lon.toFixed(2)}`));

  return (
    <header className="site-header">
      <div className="site-header__inner">
        <div className="site-header__top">
          <Link to={{ pathname: '/', search: locationSearch }} className="brand" aria-label="Skycast home">
            <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true">
              <rect width="32" height="32" rx="9" fill="var(--accent)" />
              <circle cx="13" cy="13" r="5" fill="#fff" />
              <path d="M10 24a5 5 0 0 1 1-9.9A6 6 0 0 1 22.6 16 4 4 0 0 1 22 24z" fill="#fff" stroke="var(--accent)" strokeWidth="1.5" />
            </svg>
            <span className="brand__name">Skycast</span>
          </Link>
          <div className="site-header__search">
            <SearchBox onSelect={(p) => selectPlace(p)} />
            <button
              type="button"
              className="icon-btn locate-btn"
              onClick={locate}
              aria-label="Use my location"
              title="Use my location"
              disabled={geoStatus === 'locating'}
            >
              <LocateIcon size={20} />
            </button>
          </div>
        </div>
        <nav className="tabs" aria-label="Main">
          {TABS.map((t) => (
            <NavLink key={t.to} to={{ pathname: t.to, search: locationSearch }} end={t.end} className={({ isActive }) => `tabs__link${isActive ? ' is-active' : ''}`}>
              {t.label}
            </NavLink>
          ))}
        </nav>
      </div>
      <div className="quickbar">
        <div className="quickbar__inner">
          <span className="quickbar__label">Quick pick</span>
          <ul className="quickbar__list">
            {quick.map((p) => {
              const current = samePlace(p, place);
              return (
                <li key={`${p.lat},${p.lon}`}>
                  <button type="button" className={`pill${current ? ' is-current' : ''}`} aria-current={current ? 'true' : undefined} onClick={() => selectPlace(p)}>
                    {favSet.has(`${p.lat.toFixed(2)},${p.lon.toFixed(2)}`) && <StarIcon size={12} filled />}
                    {p.name}
                  </button>
                </li>
              );
            })}
          </ul>
          <span className={`quickbar__status${geoStatus === 'error' ? ' is-error' : ''}`} role="status" aria-live="polite">
            {geoMessage}
          </span>
        </div>
      </div>
    </header>
  );
}
