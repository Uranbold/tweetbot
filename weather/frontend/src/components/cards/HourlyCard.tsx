import { useState } from 'react';
import type { HourlyPoint } from '@contract';
import { Card } from '../common/Card';
import { Segmented } from '../common/Segmented';
import { HourlyChart, type HourlyMetric } from '../charts/HourlyChart';

const TABS: { value: HourlyMetric; label: string }[] = [
  { value: 'temperature', label: 'Temperature' },
  { value: 'precipitation', label: 'Precipitation' },
  { value: 'humidity', label: 'Humidity' },
  { value: 'wind', label: 'Wind' },
];

export function HourlyCard({ hourly, today }: { hourly: HourlyPoint[]; today: string }) {
  const [metric, setMetric] = useState<HourlyMetric>('temperature');
  return (
    <Card title="Hourly forecast" className="hourly-card" headerExtra={<span className="card__hint">Next {hourly.length} hours</span>}>
      <Segmented options={TABS} value={metric} onChange={setMetric} label="Hourly metric" panelId="hourly-panel" idPrefix="hourly-tab" />
      <div
        id="hourly-panel"
        role="tabpanel"
        aria-labelledby={`hourly-tab-${metric}`}
        className="scroll-x hourly-scroll"
        tabIndex={0}
      >
        <HourlyChart hourly={hourly} metric={metric} today={today} />
      </div>
    </Card>
  );
}
