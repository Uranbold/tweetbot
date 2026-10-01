import { useEffect, useMemo } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MapContainer, Marker, TileLayer, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { CitySnapshot } from '@contract';
import { useNation } from '../api/hooks';
import { useSavedPlaces } from '../hooks/useFavorites';
import { Card } from '../components/common/Card';
import { Segmented } from '../components/common/Segmented';
import { ErrorState } from '../components/common/ErrorState';
import { GradeBadge } from '../components/common/GradeBadge';
import { WeatherIcon } from '../components/icons/WeatherIcon';
import { AIR_GRADE_COLORS, gradeLabel } from '../lib/air';
import { formatTemp } from '../lib/format';
import { placeSearch, toPlace } from '../lib/places';
import { REGIONS, REGION_VIEW, isRegion, type RegionId } from '../lib/regions';

type Layer = 'temp' | 'air';

function markerIcon(c: CitySnapshot, layer: Layer): L.DivIcon {
  const air = layer === 'air';
  const html = renderToStaticMarkup(
    air ? (
      <div className="map-marker map-marker--air" style={{ background: c.pm10Grade ? AIR_GRADE_COLORS[c.pm10Grade] : 'var(--surface-2)' }}>
        <span className="map-marker__name">{c.location.name}</span>
        <span className="map-marker__value">{gradeLabel(c.pm10Grade)}</span>
      </div>
    ) : (
      <div className="map-marker">
        <WeatherIcon condition={c.condition} size={26} label="" />
        <span className="map-marker__value">{formatTemp(c.temperature)}</span>
        <span className="map-marker__name">{c.location.name}</span>
      </div>
    ),
  );
  return L.divIcon({ html, className: 'map-marker-wrap', iconSize: undefined, iconAnchor: [0, 0] });
}

function FitToCities({ cities, region }: { cities: CitySnapshot[]; region: RegionId }) {
  const map = useMap();
  useEffect(() => {
    if (cities.length < 2) {
      map.setView(REGION_VIEW[region].center, REGION_VIEW[region].zoom);
      return;
    }
    const bounds = L.latLngBounds(cities.map((c) => [c.location.lat, c.location.lon] as [number, number]));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 8 });
  }, [cities, region, map]);
  return null;
}

export default function MapPage() {
  const [sp, setSp] = useSearchParams();
  const navigate = useNavigate();
  const { addRecent } = useSavedPlaces();
  const region: RegionId = isRegion(sp.get('region')) ? (sp.get('region') as RegionId) : 'mn';
  const layer: Layer = sp.get('layer') === 'air' ? 'air' : 'temp';
  const q = useNation(region);
  const cities = useMemo(() => q.data?.data.cities ?? [], [q.data]);
  const hasAir = cities.some((c) => c.pm10Grade);

  useEffect(() => {
    document.title = `Weather map · ${q.data?.data.regionLabel ?? ''} · Skycast`;
  }, [q.data]);

  const setParam = (key: string, value: string | null) =>
    setSp(
      (prev) => {
        const p = new URLSearchParams(prev);
        if (value == null) p.delete(key);
        else p.set(key, value);
        return p;
      },
      { replace: true },
    );

  const open = (c: CitySnapshot) => {
    const p = toPlace(c.location);
    addRecent(p);
    navigate({ pathname: '/', search: placeSearch(p) });
  };

  const icons = useMemo(() => new Map(cities.map((c) => [c.location.id, markerIcon(c, layer)])), [cities, layer]);

  return (
    <div className="page-map">
      <section className="card map-card" aria-labelledby="map-title">
        <header className="map-card__head">
          <h1 id="map-title" className="current__place">
            Weather map
          </h1>
          <div className="map-card__controls">
            <Segmented options={REGIONS} value={region} onChange={(r) => setParam('region', r === 'mn' ? null : r)} label="Region" />
            <Segmented
              options={[
                { value: 'temp', label: 'Temperature' },
                ...(hasAir || layer === 'air' ? [{ value: 'air' as const, label: 'Fine dust' }] : []),
              ]}
              value={layer}
              onChange={(l) => setParam('layer', l === 'temp' ? null : l)}
              label="Map layer"
            />
          </div>
        </header>
        <div className="map-wrap">
          <MapContainer center={REGION_VIEW[region].center} zoom={REGION_VIEW[region].zoom} scrollWheelZoom className="map" worldCopyJump>
            <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {cities.map((c) => (
              <Marker
                key={c.location.id}
                position={[c.location.lat, c.location.lon]}
                icon={icons.get(c.location.id)}
                keyboard
                title={`${c.location.name}: ${formatTemp(c.temperature)}, ${c.condition.label}`}
                alt={c.location.name}
                eventHandlers={{ click: () => open(c) }}
              >
                <Tooltip direction="top" offset={[0, -6]}>
                  {c.location.name} · {c.condition.label} · {formatTemp(c.temperatureMin)}/{formatTemp(c.temperatureMax)}
                  {c.pm10Grade ? ` · Dust ${gradeLabel(c.pm10Grade)}` : ''}
                </Tooltip>
              </Marker>
            ))}
            <FitToCities cities={cities} region={region} />
          </MapContainer>
          {q.isPending && <div className="map-overlay" role="status">Loading cities…</div>}
        </div>
        {q.isError && <ErrorState compact error={q.error} onRetry={() => q.refetch()} title="Could not load cities" />}
      </section>

      {cities.length > 0 && (
        <Card title={`${q.data?.data.regionLabel ?? ''} cities`} className="map-list-card">
          <div className="scroll-x" tabIndex={0} role="region" aria-label="City list">
            <table className="city-table">
              <thead>
                <tr>
                  <th scope="col">City</th>
                  <th scope="col">Now</th>
                  <th scope="col">Low / High</th>
                  <th scope="col">Precip.</th>
                  <th scope="col">Fine dust</th>
                </tr>
              </thead>
              <tbody>
                {cities.map((c) => (
                  <tr key={c.location.id}>
                    <th scope="row">
                      <button type="button" className="link-btn" onClick={() => open(c)}>
                        {c.location.name}
                      </button>
                    </th>
                    <td>
                      <span className="city-table__now">
                        <WeatherIcon condition={c.condition} size={24} />
                        {formatTemp(c.temperature)}
                      </span>
                    </td>
                    <td>
                      <span className="t-min">{formatTemp(c.temperatureMin)}</span> / <span className="t-max">{formatTemp(c.temperatureMax)}</span>
                    </td>
                    <td>{c.precipitationProbability}%</td>
                    <td>{c.pm10Grade ? <GradeBadge grade={c.pm10Grade} size="sm" /> : <span className="muted">–</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
