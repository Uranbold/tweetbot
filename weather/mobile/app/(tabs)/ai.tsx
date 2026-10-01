import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { usePredict } from '@/api/hooks';
import { describeError } from '@/api/client';
import { ModelInfoCard } from '@/components/ModelInfoCard';
import { RiskCard } from '@/components/RiskCard';
import { Screen, ScreenHeader } from '@/components/Screen';
import { TempBandChart } from '@/components/TempBandChart';
import { Card, Chip, DataBadges, Divider, ErrorState, SectionTitle, Skeleton } from '@/components/ui';
import { useActiveLocation } from '@/hooks/useActiveLocation';
import { useLocale, useT } from '@/i18n';
import { formatClock, roundTemp } from '@/lib/format';
import { type, useTheme } from '@/theme';

const MAX_RISKS = 3;

export default function AiScreen() {
  const t = useT();
  const locale = useLocale();
  const theme = useTheme();
  const loc = useActiveLocation();
  const q = usePredict({ lat: loc.lat, lon: loc.lon });
  const [showAllRisks, setShowAllRisks] = useState(false);

  return (
    <Screen testID="ai-screen" refreshing={q.isRefetching} onRefresh={() => void q.refetch()}>
      <ScreenHeader eyebrow={t.tabs.ai} title={loc.label} right={q.data ? <DataBadges demo={q.data.meta.mock} stale={q.data.meta.stale} demoLabel={t.demoData} staleLabel={t.stale} /> : undefined} />
      {q.data ? (
        (() => {
          const p = q.data.data;
          const risks = showAllRisks ? p.risks : p.risks.slice(0, MAX_RISKS);
          const fallback = p.model.algorithm === 'climatology-fallback';
          return (
            <>
              {/* The answer first */}
              <Card testID="ai-summary">
                <SectionTitle eyebrow right={fallback ? <Chip label={t.climatologyFallback} color={theme.colors.severity.advisory} small /> : undefined}>
                  {t.aiSummary}
                </SectionTitle>
                <Text style={[type.heading, { color: theme.colors.fg }]}>{p.summary}</Text>
                <Text style={[type.label, { color: theme.colors.fg3, marginTop: 8 }]}>
                  {t.aiEstimate} · {p.horizonHours} h · {p.model.name}
                </Text>
              </Card>

              {/* Risk rows */}
              <Card testID="ai-risks">
                <SectionTitle>{t.aiRisks}</SectionTitle>
                {p.risks.length === 0 ? (
                  <Text style={[type.small, { color: theme.colors.fg2 }]}>{t.noAlerts}</Text>
                ) : (
                  risks.map((r, i) => (
                    <View key={r.hazard}>
                      {i > 0 ? <Divider spacing={4} /> : null}
                      <RiskCard risk={r} t={t} />
                    </View>
                  ))
                )}
                {p.risks.length > MAX_RISKS ? (
                  <Pressable onPress={() => setShowAllRisks((s) => !s)} accessibilityRole="button" style={styles.more}>
                    <Text style={[type.smallStrong, { color: theme.colors.accent }]}>{showAllRisks ? t.showLess : `+${p.risks.length - MAX_RISKS} more`}</Text>
                  </Pressable>
                ) : null}
              </Card>

              {/* Chart */}
              <Card testID="ai-chart">
                <SectionTitle>{t.aiChart}</SectionTitle>
                <TempBandChart hourly={p.hourly} locale={locale} labels={{ ai: t.aiTemp, nwp: t.nwpTemp, band: t.band }} />
                <View style={styles.dailyRow}>
                  {p.daily.slice(0, 3).map((d) => (
                    <View key={d.date} style={[styles.dailyCell, { backgroundColor: theme.colors.surface2, borderRadius: theme.radius.button }]}>
                      <Text style={[type.label, { color: theme.colors.fg3 }]}>{d.date.slice(5).replace('-', '/')}</Text>
                      <Text style={[type.bodyStrong, type.num, { color: theme.colors.fg }]}>
                        {roundTemp(d.temperatureMax)} <Text style={{ color: theme.colors.fg2 }}>/ {roundTemp(d.temperatureMin)}</Text>
                      </Text>
                      <Text style={[type.label, type.num, { color: theme.colors.fg2 }]}>
                        {t.band} {roundTemp(d.temperatureMinP10)}…{roundTemp(d.temperatureMaxP90)}
                      </Text>
                    </View>
                  ))}
                </View>
                <Text style={[type.label, { color: theme.colors.fg3, marginTop: 8 }]}>
                  {t.updatedAt(formatClock(p.generatedAt.replace('Z', '')))} UTC
                </Text>
              </Card>

              <ModelInfoCard model={p.model} t={t} />
            </>
          );
        })()
      ) : q.isError ? (
        <Card>
          <Text style={[type.bodyStrong, { color: theme.colors.fg }]}>{t.aiUnavailable}</Text>
          <ErrorState message={describeError(q.error, t.errorGeneric)} retryLabel={t.retry} onRetry={() => void q.refetch()} />
        </Card>
      ) : (
        <>
          <Card>
            <Skeleton height={14} width="30%" />
            <Skeleton height={48} style={{ marginTop: 10 }} />
          </Card>
          <Card>
            <Skeleton height={20} width="40%" />
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} height={44} style={{ marginTop: 12 }} />
            ))}
          </Card>
          <Card>
            <Skeleton height={180} radius={12} />
          </Card>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  more: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  dailyRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  dailyCell: { flex: 1, padding: 10, gap: 2 },
});
