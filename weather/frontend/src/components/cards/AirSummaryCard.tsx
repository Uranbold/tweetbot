import type { AirQualitySnapshot } from '@contract';
import { Card } from '../common/Card';
import { AIR_GRADE_ADVICE, gradeColor, gradeLabel } from '../../lib/air';

export function AirSummaryCard({ air, linkSearch }: { air: AirQualitySnapshot | null; linkSearch: string }) {
  return (
    <Card title="Air quality" className="air-summary" action={{ to: `/air${linkSearch}`, label: 'Details' }}>
      {!air ? (
        <p className="muted">Air quality data is not available for this location.</p>
      ) : (
        <>
          <div className="air-summary__pair">
            {(
              [
                ['Fine dust', 'PM10', air.pm10, air.pm10Grade],
                ['Ultra-fine dust', 'PM2.5', air.pm25, air.pm25Grade],
              ] as const
            ).map(([name, code, value, grade]) => (
              <div key={code} className="air-dial" style={{ ['--grade' as string]: gradeColor(grade) }} data-grade={grade}>
                <span className="air-dial__ring">
                  <span className="air-dial__grade">{gradeLabel(grade)}</span>
                </span>
                <span className="air-dial__name">{name}</span>
                <span className="air-dial__value">
                  {code} {Math.round(value)} µg/m³
                </span>
              </div>
            ))}
          </div>
          <p className="air-summary__advice">{AIR_GRADE_ADVICE[air.overallGrade]}</p>
        </>
      )}
    </Card>
  );
}
