import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { HazardRisk } from '@contract';
import type { Dictionary } from '@/i18n';
import { probabilityColor, SEVERITY_COLORS } from '@/lib/colors';
import { formatClock, formatProbability, formatShortDate } from '@/lib/format';
import { useTheme } from '@/theme';

export function RiskCard({ risk, t, compact }: { risk: HazardRisk; t: Dictionary; compact?: boolean }) {
  const theme = useTheme();
  const color = probabilityColor(risk.probability, risk.severity);
  const sev = SEVERITY_COLORS[risk.severity];
  return (
    <View
      testID={`risk-card-${risk.hazard}`}
      style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }, compact && styles.compact]}
    >
      <View style={styles.head}>
        <Text style={[styles.title, { color: theme.colors.text }]}>{t.alertType[risk.hazard]}</Text>
        <View style={[styles.sev, { backgroundColor: sev.border }]}>
          <Text style={styles.sevText}>{t.severity[risk.severity]}</Text>
        </View>
        <Text style={[styles.prob, { color }]}>{formatProbability(risk.probability)}</Text>
      </View>
      <View style={[styles.track, { backgroundColor: theme.colors.track }]}>
        <View testID="risk-bar" style={[styles.fill, { width: `${Math.round(risk.probability * 100)}%`, backgroundColor: color }]} />
      </View>
      {!compact ? (
        <>
          <Text style={[styles.rationale, { color: theme.colors.textMuted }]}>{risk.rationale}</Text>
          {risk.expectedStart ? (
            <Text style={[styles.start, { color: theme.colors.textFaint }]}>
              {t.expectedStart} {formatShortDate(risk.expectedStart)} {formatClock(risk.expectedStart)}
            </Text>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, padding: 14, marginBottom: 10 },
  compact: { padding: 10, marginBottom: 6 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  title: { flex: 1, fontSize: 15, fontWeight: '700' },
  sev: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  sevText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  prob: { fontSize: 16, fontWeight: '800', minWidth: 44, textAlign: 'right' },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
  rationale: { marginTop: 10, fontSize: 13, lineHeight: 18 },
  start: { marginTop: 4, fontSize: 12 },
});
