import { useEffect, useState, type ReactNode } from 'react';
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
import { WeeklyCard } from '../components/cards/WeeklyCard';
import { AirSummaryCard } from '../components/cards/AirSummaryCard';
import { SunCard } from '../components/cards/SunCard';
import { NationCard } from '../components/cards/NationCard';
import { AiForecastCard } from '../components/cards/AiForecastCard';
import { CurrentSkeleton, TitledSkeleton } from '../components/common/Skeleton';
import { ErrorState } from '../components/common/ErrorState';

export const DESKTOP_QUERY = '(min-width: 1024px)';

/** Wraps cards so they fade in 40 ms apart (UX §3.8). */
const stagger = (nodes: ReactNode[]) =>
  nodes.filter(Boolean).map((n, i) => (
    <div key={i} className="stagger" style={{ ['--i' as string]: i }}>
      {n}
    </div>
  ));

function TwoColumn({ desktop, main, side, mobile }: { desktop: boolean; main: ReactNode[]; side: ReactNode[]; mobile: ReactNode[] }) {
  if (desktop) {
    return (
      <div className="layout-2col">
        <div className="col col--main">{stagger(main)}</div>
        <aside className="col col--side" aria-label="Air, sun and nationwide weather">
          {stagger(side)}
        </aside>
      </div>
    );
  }
  return <div className="col">{stagger(mobile)}</div>;
}

export default function HomePage() {
  const { place, locationSearch } = useLocationState();
  const { isFavorite, toggleFavorite } = useSavedPlaces();
  const desktop = useMediaQuery(DESKTOP_QUERY);
  const [sp, setSp] = useSearchParams();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
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
  const loadedName = q.data && !q.isPlaceholderData ? q.data.data.location.name : null;

  useEffect(() => {
    if (q.data) document.title = `${q.data.data.location.name} ${formatTemp(q.data.data.current.temperature)} · Skycast`;
    else document.title = 'Skycast Weather';
  }, [q.data]);

  const nation = <NationCard key="nation" region={region} onRegionChange={setRegion} />;
  const announcer = (
    <p className="visually-hidden" aria-live="polite">
      {q.isPlaceholderData ? `Loading weather for ${place.name}` : loadedName ? `Loaded weather for ${loadedName}` : ''}
    </p>
  );

  if (q.isPending) {
    const cur = <CurrentSkeleton key="cur" />;
    const hourly = <TitledSkeleton key="h" title="Hourly forecast" height={300} />;
    const weekly = <TitledSkeleton key="w" title="10-day forecast" height={420} rows={7} />;
    const air = <TitledSkeleton key="a" title="Air quality" height={220} />;
    const sun = <TitledSkeleton key="s" title="Sunrise & sunset" height={240} />;
    return (
      <div aria-busy="true">
        {announcer}
        <TwoColumn desktop={desktop} main={[cur, hourly, weekly]} side={[air, sun]} mobile={[cur, hourly, air, weekly]} />
      </div>
    );
  }
  if (q.isError && !q.data) {
    return (
      <div className="col">
        {announcer}
        <ErrorState error={q.error} onRetry={() => q.refetch()} title="Couldn’t load the forecast" />
        {nation}
      </div>
    );
  }

  const w = q.data.data;
  const today = datePart(w.current.time);
  const fav = isFavorite(w.location);
  const hasWarning = w.alerts.some((a) => a.severity === 'warning');
  const cards = {
    current: (
      <CurrentSummaryCard
        key="current"
        weather={w}
        meta={q.data.meta}
        loud={!hasWarning}
        isFavorite={fav}
        onToggleFavorite={() => toggleFavorite({ ...toPlace(w.location), lat: place.lat, lon: place.lon })}
      />
    ),
    alerts: w.alerts.length ? <AlertsBanner key="alerts" alerts={w.alerts} /> : null,
    hourly: <HourlyCard key="hourly" hourly={w.hourly} today={today} highlightDate={selectedDate} />,
    ai: <AiForecastCard key="ai" lat={place.lat} lon={place.lon} today={today} />,
    life: <LifeIndicesCard key="life" indices={w.lifeIndices} clothing={w.clothing} min={w.today.temperatureMin} max={w.today.temperatureMax} />,
    weekly: (
      <WeeklyCard
        key="weekly"
        daily={w.daily}
        today={today}
        currentTemp={w.current.temperature}
        selectedDate={selectedDate}
        onSelectDate={(d) => setSelectedDate((cur) => (cur === d ? null : d))}
      />
    ),
    air: <AirSummaryCard key="air" air={w.air} linkSearch={locationSearch} />,
    sun: <SunCard key="sun" now={w.current.time} sunrise={w.today.sunrise} sunset={w.today.sunset} />,
    nation,
  };

  return (
    <div className={q.isPlaceholderData || q.isFetching ? 'is-refreshing' : undefined} aria-busy={q.isPlaceholderData || undefined}>
      {announcer}
      {q.isError && <ErrorState compact error={q.error} onRetry={() => q.refetch()} title={`Couldn’t update ${place.name}. Showing ${w.location.name}.`} />}
      <TwoColumn
        desktop={desktop}
        main={[cards.current, cards.alerts, cards.hourly, cards.weekly, cards.ai, cards.life]}
        side={[cards.air, cards.sun, cards.nation]}
        mobile={[cards.current, cards.alerts, cards.hourly, cards.weekly, cards.air, cards.ai, cards.life, cards.sun, cards.nation]}
      />
    </div>
  );
}
