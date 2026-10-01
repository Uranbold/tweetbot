import { Link } from 'react-router-dom';
import { useNation } from '../../api/hooks';
import { Card } from '../common/Card';
import { Segmented } from '../common/Segmented';
import { Skeleton } from '../common/Skeleton';
import { ErrorState } from '../common/ErrorState';
import { WeatherIcon } from '../icons/WeatherIcon';
import { formatTemp } from '../../lib/format';
import { placeSearch, toPlace } from '../../lib/places';
import { REGIONS, type RegionId } from '../../lib/regions';
import { useSavedPlaces } from '../../hooks/useFavorites';

/** 전국날씨 — snapshot grid of cities for a region. */
export function NationCard({ region, onRegionChange }: { region: RegionId; onRegionChange: (r: RegionId) => void }) {
  const q = useNation(region);
  const { addRecent } = useSavedPlaces();
  return (
    <Card
      title="Nationwide weather"
      className="nation-card"
      action={{ to: `/map?region=${region}`, label: 'Map' }}
    >
      <Segmented options={REGIONS} value={region} onChange={onRegionChange} label="Region" />
      {q.isPending ? (
        <ul className="nation-grid" aria-busy="true">
          {Array.from({ length: 8 }, (_, i) => (
            <li key={i} className="nation-city">
              <Skeleton height={46} />
            </li>
          ))}
        </ul>
      ) : q.isError ? (
        <ErrorState compact error={q.error} onRetry={() => q.refetch()} title="Could not load cities" />
      ) : (
        <ul className="nation-grid">
          {q.data.data.cities.map((c) => (
            <li key={c.location.id}>
              <Link className="nation-city" to={{ pathname: '/', search: placeSearch(toPlace(c.location)) }} onClick={() => addRecent(toPlace(c.location))}>
                <span className="nation-city__name">{c.location.name}</span>
                <WeatherIcon condition={c.condition} size={32} />
                <span className="nation-city__temp">{formatTemp(c.temperature)}</span>
                <span className="nation-city__range">
                  <span className="t-min">{formatTemp(c.temperatureMin)}</span>/<span className="t-max">{formatTemp(c.temperatureMax)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
