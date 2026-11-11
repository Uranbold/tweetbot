import { useState } from 'react';
import type { HourlyPoint } from '@contract';
import { Card } from '../common/Card';
import { Segmented } from '../common/Segmented';
import { ViewToggle } from '../common/ViewToggle';
import { HourlyChart, HourlyTable, type HourlyMetric } from '../charts/HourlyChart';

/** Hick's law: exactly 4 metrics. */
const METRICS: { value: HourlyMetric; label: string }[] = [
  { value: 'temperature', label: 'Temp' },
  { value: 'precipitation', label: 'Rain' },
  { value: 'humidity', label: 'Humidity' },
  { value: 'wind', label: 'Wind' },
];

export function HourlyCard({ hourly, today, highlightDate }: { hourly: HourlyPoint[]; today: string; highlightDate?: string | null }) {
  const [metric, setMetric] = useState<HourlyMetric>('temperature');
  const [table, setTable] = useState(false);
  return (
    <Card title="Hourly forecast" className="hourly-card" headerExtra={<span className="card__hint">Next {hourly.length} h</span>} toolbar={<ViewToggle table={table} onChange={setTable} />}>
      {table ? (
        <HourlyTable hourly={hourly} today={today} />
      ) : (
        <>
          <Segmented options={METRICS} value={metric} onChange={setMetric} label="Hourly metric" />
          <HourlyChart hourly={hourly} metric={metric} today={today} highlightDate={highlightDate} />
        </>
      )}
    </Card>
  );
}
