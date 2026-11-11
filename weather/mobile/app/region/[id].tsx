import React, { useEffect, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { describeError } from '@/api/client';
import { useRegionAlerts, useRegions, useWeather } from '@/api/hooks';
import { AlertBanner } from '@/components/AlertBanner';
import { GradeChip } from '@/components/GradeChip';
import { RiskCard } from '@/components/RiskCard';
import { Screen } from '@/components/Screen';
import { TodayContent } from '@/components/today/TodayContent';
import { Segmented } from '@/components/settings/controls';
import { Button, Card, EmptyState, ErrorState, SectionTitle, Skeleton } from '@/components/ui';
import { useLocale, useT } from '@/i18n';
import { formatPeriod } from '@/lib/format';
import { useDeviceStore } from '@/store/DeviceProvider';
import { type, useTheme } from '@/theme';

type Tab = 'weather' | 'alerts';

/** Deep-link target: skycast://region/:id and skycast://region/:id/alerts (→ ?tab=alerts). */
export default function RegionDetailScreen() {
  const params = useLocalSearchParams<{ id: string; tab?: string }>();
  const id = typeof params.id === 'string' ? params.id : '';
  const router = useRouter();
  const t = useT();
  const locale = useLocale();
  const theme = useTheme();
  const { state, toggleRegion } = useDeviceStore();
  const tab: Tab = params.tab === 'alerts' ? 'alerts' : 'weather';

  const regionsQuery = useRegions();
  const region = useMemo(() => regionsQuery.data?.data.find((r) => r.id === id) ?? null, [regionsQuery.data, id]);
  const alerts = useRegionAlerts(region ? region.id : null);
  const weather = useWeather(region ? { lat: region.lat, lon: region.lon } : null);
  const subscribed = state.regionIds.includes(id);

  const setTab = (next: Tab) => router.setParams({ tab: next === 'alerts' ? 'alerts' : undefined });

  useEffect(() => {
    // Region alerts are the "end" of the notification flow (peak–end): land directly on them.
  }, [tab]);

  if (regionsQuery.isPending) {
    return (
      <Screen>
        <Stack.Screen options={{ title: '' }} />
        <Skeleton height={28} width="50%" style={{ marginTop: 12 }} />
        <Skeleton height={120} style={{ marginTop: 16 }} radius={16} />
      </Screen>
    );
  }
  if (!region) {
    return (
      <Screen>
        <Stack.Screen options={{ title: t.regionNotFound }} />
        <Card>
          <EmptyState title={t.regionNotFound} hint={id} />
          <Button label={t.tabs.today} variant="secondary" onPress={() => router.replace('/')} />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen testID="region-screen">
      <Stack.Screen
        options={{
          title: region.name,
          headerRight: () => (
            <Button label={subscribed ? t.unsubscribe : t.subscribe} compact variant={subscribed ? 'secondary' : 'primary'} onPress={() => toggleRegion(region.id)} testID="subscribe-toggle" />
          ),
        }}
      />
      <View style={{ marginTop: 8, marginBottom: 12 }}>
        <Segmented<Tab> options={[{ value: 'weather', label: t.viewWeather }, { value: 'alerts', label: t.viewAlerts }]} value={tab} onChange={setTab} testID="region-tab" />
      </View>

      {tab === 'alerts' ? (
        <Card testID="region-alerts">
          <SectionTitle>{t.activeAlerts}</SectionTitle>
          {alerts.isPending ? (
            <Skeleton height={56} />
          ) : alerts.isError ? (
            <ErrorState message={describeError(alerts.error, t.errorGeneric)} retryLabel={t.retry} onRetry={() => void alerts.refetch()} />
          ) : alerts.data ? (
            <>
              {alerts.data.data.alerts.length === 0 ? <Text style={[type.small, { color: theme.colors.fg2 }]}>{t.noAlerts}</Text> : null}
              {alerts.data.data.alerts.map((a) => (
                <AlertBanner key={`${a.type}-${a.start}`} severity={a.severity} severityLabel={t.severity[a.severity]} title={a.title} description={a.description} period={formatPeriod(a.start, a.end)} />
              ))}
              {alerts.data.data.risks.length > 0 ? (
                <>
                  <Text style={[type.eyebrow, { color: theme.colors.fg3, marginTop: 12 }]}>{t.aiRisks}</Text>
                  {alerts.data.data.risks.map((r) => (
                    <RiskCard key={r.hazard} risk={r} t={t} />
                  ))}
                </>
              ) : null}
              {alerts.data.data.air ? (
                <View style={styles.chipRow}>
                  <GradeChip pollutant={t.pm10} grade={alerts.data.data.air.pm10Grade} gradeLabel={t.grade[alerts.data.data.air.pm10Grade]} value={alerts.data.data.air.pm10} />
                  <GradeChip pollutant={t.pm25} grade={alerts.data.data.air.pm25Grade} gradeLabel={t.grade[alerts.data.data.air.pm25Grade]} value={alerts.data.data.air.pm25} />
                </View>
              ) : null}
            </>
          ) : null}
        </Card>
      ) : weather.data ? (
        <TodayContent weather={weather.data.data} meta={weather.data.meta} t={t} locale={locale} placeLabel={region.name} />
      ) : weather.isError ? (
        <ErrorState message={describeError(weather.error, t.errorGeneric)} retryLabel={t.retry} onRetry={() => void weather.refetch()} />
      ) : (
        <Card>
          <Skeleton height={68} width="40%" radius={12} />
          <Skeleton height={16} width="60%" style={{ marginTop: 12 }} />
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
});
