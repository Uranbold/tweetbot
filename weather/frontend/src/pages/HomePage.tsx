import { useEffect, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useWeather } from '../api/hooks';
import { useLocationState } from '../hooks/useLocationState';
import { useSavedPlaces } from '../hooks/useFavorites';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { toPlace } from '../lib/places';
import { datePart, formatTemp } from '../lib/format';
import { isRegion, type RegionId } from '../lib/regions';
import { CurrentSummaryCard } from '../components/cards/CurrentSummaryCard';
import { AlertsBanner } from '../components/cards/AlertsBanner';
import { HourlyCard } from '../components/cards/HourlyCard';
import { LifeIndicesCard } from '../components/cards/LifeIndicesCard';
import { ClothingCard } from '../components/cards/ClothingCard';
import { WeeklyCard } from '../components/cards/WeeklyCard';
import { AirSummaryCard } from '../components/cards/AirSummaryCard';
import { SunCard } from '../components/cards/SunCard';
import { NationCard } from '../components/cards/NationCard';
import { AiForecastCard } from '../components/cards/AiForecastCard';
import { SkeletonCard } from '../components/common/Skeleton';
import { ErrorState } from '../components/common/ErrorState';

export const DESKTOP_QUERY = '(min-width: 1024px)';

function TwoColumn({ desktop, main, side, mobile }: { desktop: boolean; main: ReactNode[]; side: ReactNode[]; mobile: ReactNode[] }) {
  if (desktop) {
    return (
      <div className="layout-2col">
        <div className="col col--main">{main}</div>
        <div className="col col--side">{side}</div>
      </div>
    );
  }
  return <div className="col">{mobile}</div>;
}

export default function HomePage() {
  const { place, locationSearch } = useLocationState();
  const { isFavorite, toggleFavorite } = useSavedPlaces();
  const desktop = useMediaQuery(DESKTOP_QUERY);
  const [sp, setSp] = useSearchParams();
  const region: RegionId = isRegion(sp.get('region')) ? (sp.get('region') as RegionId) : 'mn';
  const setRegion = (r: RegionId) =>
    setSp(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (r === 'mn') next.delete('region');
        else next.set('region', r);
        return next;
      },
      { replace: true },
    );
  const q = useWeather(place.lat, place.lon);

  useEffect(() => {
    if (q.data) document.title = `${q.data.data.location.name} ${formatTemp(q.data.data.current.temperature)} · Skycast`;
    else document.title = 'Skycast Weather';
  }, [q.data]);

  const nation = <NationCard key="nation" region={region} onRegionChange={setRegion} />;

  if (q.isPending) {
    return (
      <div aria-busy="true">
        <TwoColumn
          desktop={desktop}
          main={[<SkeletonCard key="a" lines={5} height={300} label="Loading current weather" />, <SkeletonCard key="b" lines={2} height={220} />, <SkeletonCard key="c" lines={6} height={420} />]}
          side={[<SkeletonCard key="d" lines={2} height={200} />, <SkeletonCard key="e" lines={5} height={320} />]}
          mobile={[<SkeletonCard key="a" lines={5} height={300} label="Loading current weather" />, <SkeletonCard key="b" lines={2} height={220} />, <SkeletonCard key="c" lines={6} height={420} />]}
        />
      </div>
    );
  }
  if (q.isError) {
    return (
      <div className="col">
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
        {nation}
      </div>
    );
  }

  const w = q.data.data;
  const today = datePart(w.current.time);
  const fav = isFavorite(w.location);
  const cards = {
    current: (
      <CurrentSummaryCard key="current" weather={w} meta={q.data.meta} isFavorite={fav} onToggleFavorite={() => toggleFavorite({ ...toPlace(w.location), lat: place.lat, lon: place.lon })} />
    ),
    alerts: <AlertsBanner key="alerts" alerts={w.alerts} />,
    hourly: <HourlyCard key="hourly" hourly={w.hourly} today={today} />,
    ai: <AiForecastCard key="ai" lat={place.lat} lon={place.lon} today={today} />,
    life: <LifeIndicesCard key="life" indices={w.lifeIndices} />,
    clothing: <ClothingCard key="clothing" clothing={w.clothing} min={w.today.temperatureMin} max={w.today.temperatureMax} />,
    weekly: <WeeklyCard key="weekly" daily={w.daily} today={today} />,
    air: <AirSummaryCard key="air" air={w.air} linkSearch={locationSearch} />,
    sun: <SunCard key="sun" now={w.current.time} sunrise={w.today.sunrise} sunset={w.today.sunset} />,
    nation,
  };

  return (
    <div className={q.isFetching ? 'is-refreshing' : undefined}>
      <TwoColumn
        desktop={desktop}
        main={[cards.current, cards.alerts, cards.hourly, cards.ai, cards.weekly, cards.nation]}
        side={[cards.air, cards.life, cards.clothing, cards.sun]}
        mobile={[cards.current, cards.alerts, cards.hourly, cards.ai, cards.life, cards.clothing, cards.weekly, cards.air, cards.sun, cards.nation]}
      />
    </div>
  );
}
