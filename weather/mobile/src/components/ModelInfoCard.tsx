import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { ModelInfo } from '@contract';
import type { Dictionary } from '@/i18n';
import { useTheme } from '@/theme';
import { Card, Chip, SectionTitle } from './ui';

/** "skycast-gbr-v1 · MAE 1.2° vs 1.9° raw · trained on N samples · features…" */
export function ModelInfoCard({ model, t }: { model: ModelInfo; t: Dictionary }) {
  const theme = useTheme();
  const mae = model.metrics.temperatureMae;
  const maeNwp = model.metrics.temperatureMaeNwp;
  const improvement = mae !== undefined && maeNwp !== undefined && maeNwp > 0 ? Math.round((1 - mae / maeNwp) * 100) : null;
  const fallback = model.trainingSamples === 0 || model.algorithm === 'climatology-fallback';
  return (
    <Card testID="model-info">
      <SectionTitle>{t.aiModel}</SectionTitle>
      <Text style={[styles.name, { color: theme.colors.text }]}>
        {model.name} <Text style={{ color: theme.colors.textFaint, fontWeight: '400' }}>v{model.version}</Text>
      </Text>
      <Text style={[styles.line, { color: theme.colors.textMuted }]}>
        {model.algorithm}
        {mae !== undefined ? ` · ${t.mae} ${mae.toFixed(1)}°` : ''}
        {maeNwp !== undefined ? ` vs ${maeNwp.toFixed(1)}° ${t.raw}` : ''}
        {improvement !== null && improvement > 0 ? ` (−${improvement}%)` : ''}
      </Text>
      <Text style={[styles.line, { color: theme.colors.textMuted }]}>
        {t.trainedOn} {model.trainingSamples.toLocaleString()} {t.samples}
        {model.metrics.precipitationBrier !== undefined ? ` · Brier ${model.metrics.precipitationBrier.toFixed(2)}` : ''}
      </Text>
      {fallback ? <Text style={[styles.fallback, { color: theme.colors.warning }]}>{t.climatologyFallback}</Text> : null}
      {model.features.length > 0 ? (
        <View style={styles.features}>
          {model.features.map((f) => (
            <Chip key={f} label={f} color={theme.colors.textMuted} bg={theme.colors.cardAlt} small />
          ))}
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  name: { fontSize: 16, fontWeight: '800' },
  line: { fontSize: 13, marginTop: 4 },
  fallback: { fontSize: 12, marginTop: 6, fontWeight: '600' },
  features: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
});
