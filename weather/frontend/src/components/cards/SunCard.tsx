import { Card } from '../common/Card';
import { SunArc } from '../charts/SunArc';
import { formatClock, formatDuration } from '../../lib/format';

export function SunCard({ now, sunrise, sunset }: { now: string; sunrise: string; sunset: string }) {
  return (
    <Card title="Sunrise & sunset" className="sun-card">
      <SunArc now={now} sunrise={sunrise} sunset={sunset} />
      <dl className="sun-card__facts">
        <div>
          <dt>Sunrise</dt>
          <dd>{formatClock(sunrise)}</dd>
        </div>
        <div>
          <dt>Daylight</dt>
          <dd>{formatDuration(sunrise, sunset)}</dd>
        </div>
        <div>
          <dt>Sunset</dt>
          <dd>{formatClock(sunset)}</dd>
        </div>
      </dl>
    </Card>
  );
}
