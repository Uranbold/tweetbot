import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { NotificationHistoryEntry, Region } from '@contract';
import { describeError } from '@/api/client';
import { useNotificationHistory, useRegionAlerts, useRegions, useSendTestNotification } from '@/api/hooks';
import { AlertBanner, SeverityGlyph } from '@/components/AlertBanner';
import { GradeChip } from '@/components/GradeChip';
import { RiskCard } from '@/components/RiskCard';
import { Screen, ScreenHeader } from '@/components/Screen';
import { Button, Card, Chip, Divider, EmptyState, SectionTitle, Skeleton } from '@/components/ui';
import { useT, type Dictionary } from '@/i18n';
import { formatClock, formatRelative } from '@/lib/format';
import { useNotifications } from '@/notifications/NotificationsProvider';
import { useDeviceStore } from '@/store/DeviceProvider';
import { type, useTheme } from '@/theme';

export default function AlertsScreen() {
  const t = useT();
  const theme = useTheme();
  const router = useRouter();
  const { state, dispatch } = useDeviceStore();
  const regionsQuery = useRegions();
  const history = useNotificationHistory(state.deviceId);
  const test = useSendTestNotification(state.deviceId);
  const subscribed = (regionsQuery.data?.data ?? []).filter((r) => state.regionIds.includes(r.id));

  const onTest = () => {
    test.mutate(undefined, {
      onSuccess: () => dispatch({ type: 'TEST_SENT', at: new Date().toISOString() }),
    });
  };

  return (
    <Screen
      testID="alerts-screen"
      refreshing={history.isRefetching}
      onRefresh={() => {
        void history.refetch();
      }}
    >
      <ScreenHeader eyebrow={t.alerts} title={t.activeAlerts} />

      {state.regionIds.length === 0 ? (
        <Card>
          <EmptyState title={t.noRegions} hint={t.noRegionsHint} />
          <Button label={t.tabs.settings} variant="secondary" onPress={() => router.push('/settings')} />
        </Card>
      ) : regionsQuery.isPending ? (
        <Card>
          <Skeleton height={20} width="40%" />
          <Skeleton height={56} style={{ marginTop: 12 }} />
        </Card>
      ) : (
        subscribed.map((r) => <RegionAlertsCard key={r.id} region={r} t={t} onOpen={() => router.push(`/region/${r.id}?tab=alerts`)} />)
      )}

      <Card testID="history-card">
        <SectionTitle right={<Button label={test.isPending ? t.sending : t.sendTest} compact variant="secondary" onPress={onTest} disabled={!state.deviceId || test.isPending} testID="send-test" />}>
          {t.history}
        </SectionTitle>
        {test.isSuccess ? <Text style={[type.label, { color: theme.colors.accent, marginBottom: 8 }]}>{t.testSent}</Text> : null}
        {test.isError ? <Text style={[type.label, { color: theme.colors.severity.warning, marginBottom: 8 }]}>{describeError(test.error)}</Text> : null}
        {!state.deviceId ? (
          <Text style={[type.small, { color: theme.colors.fg2 }]}>{t.notRegistered}</Text>
        ) : history.isPending ? (
          [0, 1, 2].map((i) => <Skeleton key={i} height={52} style={{ marginTop: 8 }} />)
        ) : history.isError ? (
          <Text style={[type.small, { color: theme.colors.fg2 }]}>{describeError(history.error, t.errorGeneric)}</Text>
        ) : history.data && history.data.data.length > 0 ? (
          history.data.data.map((n, i) => (
            <View key={n.id}>
              {i > 0 ? <Divider spacing={2} /> : null}
              <HistoryRow entry={n} t={t} onPress={() => router.push(toRouterPath(n.deepLink) as never)} />
            </View>
          ))
        ) : (
          <Text style={[type.small, { color: theme.colors.fg2 }]}>{t.noHistory}</Text>
        )}
      </Card>
    </Screen>
  );
}

function toRouterPath(deepLink: string): string {
  // Lazy import avoided for test simplicity: a tiny inline parse mirroring lib/deepLink.
  const m = /region\/([^/?#]+)(\/alerts)?/.exec(deepLink);
  if (!m) return '/alerts';
  return `/region/${m[1]}${m[2] ? '?tab=alerts' : ''}`;
}

/** One subscribed region: active alerts, AI risks (compact), air grade. */
export function RegionAlertsCard({ region, t, onOpen }: { region: Region; t: Dictionary; onOpen: () => void }) {
  const theme = useTheme();
  const q = useRegionAlerts(region.id);
  const d = q.data?.data;
  return (
    <Card testID={`region-alerts-${region.id}`}>
      <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel={`${region.name}, ${t.viewAlerts}`} style={styles.regionHead}>
        <Text style={[type.heading, { color: theme.colors.fg }]}>{region.name}</Text>
        <Text style={[type.smallStrong, { color: theme.colors.accent }]}>{t.viewAlerts} ›</Text>
      </Pressable>
      {q.isPending ? (
        <Skeleton height={56} />
      ) : q.isError ? (
        <Text style={[type.small, { color: theme.colors.fg2 }]}>{describeError(q.error, t.errorGeneric)}</Text>
      ) : d ? (
        <>
          {d.alerts.length === 0 ? (
            <View style={styles.okRow}>
              <View style={[styles.okDot, { backgroundColor: theme.colors.accent }]} />
              <Text style={[type.small, { color: theme.colors.fg2 }]}>{t.noAlerts}</Text>
            </View>
          ) : (
            d.alerts.map((a) => (
              <AlertBanner
                key={`${a.type}-${a.start}`}
                severity={a.severity}
                severityLabel={t.severity[a.severity]}
                title={a.title}
                description={a.description}
                period={`${a.start.slice(5, 10).replace('-', '/')} ${formatClock(a.start)}${a.end ? ` – ${formatClock(a.end)}` : ''}`}
              />
            ))
          )}
          {d.risks.length > 0 ? (
            <>
              <Text style={[type.eyebrow, { color: theme.colors.fg3, marginTop: 8 }]}>{t.aiRiskShort}</Text>
              {d.risks.slice(0, 3).map((r) => (
                <RiskCard key={r.hazard} risk={r} t={t} compact />
              ))}
            </>
          ) : null}
          {d.air ? (
            <View style={styles.chipRow}>
              <GradeChip pollutant={t.pm10} grade={d.air.pm10Grade} gradeLabel={t.grade[d.air.pm10Grade]} value={d.air.pm10} />
              <GradeChip pollutant={t.pm25} grade={d.air.pm25Grade} gradeLabel={t.grade[d.air.pm25Grade]} value={d.air.pm25} />
            </View>
          ) : null}
        </>
      ) : null}
    </Card>
  );
}

function HistoryRow({ entry, t, onPress }: { entry: NotificationHistoryEntry; t: Dictionary; onPress: () => void }) {
  const theme = useTheme();
  const sevColor = entry.severity ? theme.colors.severity[entry.severity] : theme.colors.fg3;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${entry.title}. ${entry.body}`} style={styles.histRow} testID={`history-${entry.id}`}>
      <View style={styles.histGlyph}>{entry.severity ? <SeverityGlyph severity={entry.severity} color={sevColor} ink={theme.colors.surface} size={18} /> : <View style={[styles.okDot, { backgroundColor: theme.colors.fg3 }]} />}</View>
      <View style={{ flex: 1 }}>
        <Text style={[type.bodyStrong, { color: theme.colors.fg }]} numberOfLines={2}>
          {entry.title}
        </Text>
        <Text style={[type.small, { color: theme.colors.fg2 }]} numberOfLines={2}>
          {entry.body}
        </Text>
        <View style={styles.histMeta}>
          <Chip label={t.kind[entry.kind]} small />
          <Text style={[type.label, { color: theme.colors.fg3 }]}>
            {entry.regionId} · {formatRelative(entry.sentAt)}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  regionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44, marginBottom: 4 },
  okRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 32 },
  okDot: { width: 8, height: 8, borderRadius: 4 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  histRow: { flexDirection: 'row', gap: 10, paddingVertical: 10, minHeight: 56 },
  histGlyph: { width: 22, paddingTop: 3, alignItems: 'center' },
  histMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' },
});
