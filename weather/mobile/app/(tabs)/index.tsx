import React from 'react';
import { View } from 'react-native';
import { useWeather } from '@/api/hooks';
import { describeError } from '@/api/client';
import { Screen, ScreenHeader } from '@/components/Screen';
import { TodayContent } from '@/components/today/TodayContent';
import { Card, ErrorState, Skeleton } from '@/components/ui';
import { useActiveLocation, useGpsFollow } from '@/hooks/useActiveLocation';
import { useLocale, useT } from '@/i18n';

export default function TodayScreen() {
  const t = useT();
  const locale = useLocale();
  const loc = useActiveLocation();
  useGpsFollow();
  const q = useWeather({ lat: loc.lat, lon: loc.lon });

  return (
    <Screen testID="today-screen" refreshing={q.isRefetching} onRefresh={() => void q.refetch()}>
      <ScreenHeader eyebrow={t.weather} title={loc.label} />
      {q.data ? (
        <TodayContent weather={q.data.data} meta={q.data.meta} t={t} locale={locale} placeLabel={loc.label} />
      ) : q.isError ? (
        <ErrorState message={describeError(q.error, t.errorGeneric)} retryLabel={t.retry} onRetry={() => void q.refetch()} />
      ) : (
        <TodaySkeleton />
      )}
    </Screen>
  );
}

/** Same geometry as the hero + hourly + weekly cards (Doherty). */
function TodaySkeleton() {
  return (
    <View testID="today-skeleton">
      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Skeleton height={68} width="40%" radius={12} />
          <Skeleton height={64} width={64} radius={32} />
        </View>
        <Skeleton height={16} width="60%" style={{ marginTop: 12 }} />
        <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} height={40} width="22%" />
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
          <Skeleton height={32} width="35%" radius={999} />
          <Skeleton height={32} width="35%" radius={999} />
        </View>
      </Card>
      <Card>
        <Skeleton height={20} width="30%" />
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 12 }}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} height={110} width={50} radius={10} />
          ))}
        </View>
      </Card>
      <Card>
        <Skeleton height={20} width="40%" />
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <Skeleton key={i} height={40} style={{ marginTop: 10 }} />
        ))}
      </Card>
    </View>
  );
}
