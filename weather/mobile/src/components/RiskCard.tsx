import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { HazardRisk } from '@contract';
import type { Dictionary } from '@/i18n';
import { formatClock, formatProbability, formatShortDate } from '@/lib/format';
import { tint, type, useTheme } from '@/theme';
import { SeverityGlyph } from './AlertBanner';

/**
 * AI risk row (§4.6): hazard glyph + name, 8 px probability bar in the severity colour (track 12 %),
 * percentage printed and labelled "AI estimate · NN %" (§6), expected start.
 */
export function RiskCard({ risk, t, compact }: { risk: HazardRisk; t: Dictionary; compact?: boolean }) {
  const theme = useTheme();
  const color = theme.colors.severity[risk.severity];
  const pct = formatProbability(risk.probability);
  return (
    <View
      testID={`risk-card-${risk.hazard}`}
      accessibilityLabel={`${t.alertType[risk.hazard]} ${t.severity[risk.severity]}, ${t.aiEstimate} ${pct}`}
      style={[styles.card, compact && styles.compact]}
    >
      <View style={styles.head}>
        <SeverityGlyph severity={risk.severity} color={color} ink={theme.colors.surface} size={16} />
        <Text style={[type.bodyStrong, styles.title, { color: theme.colors.fg }]}>
          {t.alertType[risk.hazard]} <Text style={[type.small, { color: theme.colors.fg2 }]}>{t.severity[risk.severity].toLowerCase()}</Text>
        </Text>
        <Text style={[type.label, { color: theme.colors.fg3 }]}>{t.aiEstimate} · </Text>
        <Text style={[type.bodyStrong, type.num, { color: theme.colors.fg }]}>{pct}</Text>
      </View>
      <View style={[styles.track, { backgroundColor: tint(color, 0.12) }]} accessibilityElementsHidden>
        <View testID="risk-bar" style={[styles.fill, { width: `${Math.round(risk.probability * 100)}%`, backgroundColor: color }]} />
      </View>
      {!compact ? (
        <>
          <Text style={[type.small, { color: theme.colors.fg2, marginTop: 8 }]}>{risk.rationale}</Text>
          {risk.expectedStart ? (
            <Text style={[type.label, { color: theme.colors.fg3, marginTop: 4 }]}>
              {t.expectedStart} {formatShortDate(risk.expectedStart)} {formatClock(risk.expectedStart)}
            </Text>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { paddingVertical: 10 },
  compact: { paddingVertical: 6 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  title: { flex: 1 },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
});
