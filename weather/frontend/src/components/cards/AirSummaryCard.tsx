import type { AirQualitySnapshot, ApiMeta } from '@contract';
import { Card } from '../common/Card';
import { GradeFace } from '../icons/GradeFace';
import { AIR_GRADE_ADVICE, gradeColor, gradeLabel } from '../../lib/air';

export function AirSummaryCard({ air, linkSearch }: { air: AirQualitySnapshot | null; linkSearch: string; meta?: ApiMeta }) {
  return (
    <Card title="Air quality" className="air-summary" action={{ to: `/air${linkSearch}`, label: 'Details' }}>
      {!air ? (
        <p className="muted">Air quality data is not available for this location.</p>
      ) : (
        <>
          <p className="air-summary__advice">{AIR_GRADE_ADVICE[air.overallGrade]}</p>
          <div className="air-summary__pair">
            {(
              [
                ['Fine dust', 'PM10', air.pm10, air.pm10Grade],
                ['Ultra-fine dust', 'PM2.5', air.pm25, air.pm25Grade],
              ] as const
            ).map(([name, code, value, grade]) => (
              <div key={code} className="air-tile" style={{ ['--grade' as string]: gradeColor(grade) }} data-grade={grade}>
                <GradeFace grade={grade} size={40} />
                <span className="air-tile__text">
                  <span className="air-tile__name">
                    {name} <span className="muted">{code}</span>
                  </span>
                  <span className="air-tile__grade">{gradeLabel(grade)}</span>
                  <span className="air-tile__value">{Math.round(value)} µg/m³</span>
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}
