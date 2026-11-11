import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { ModelInfo } from '@contract';
import type { Dictionary } from '@/i18n';
import { type, useTheme } from '@/theme';
import { Card, Chip, SectionTitle } from './ui';

/** "skycast-gbr-v1 · MAE 1.2° vs 1.9° raw · trained on N samples · features…" (§4.6 explainability). */
export function ModelInfoCard({ model, t }: { model: ModelInfo; t: Dictionary }) {
  const theme = useTheme();
  const mae = model.metrics.temperatureMae;
  const maeNwp = model.metrics.temperatureMaeNwp;
  const improvement = mae !== undefined && maeNwp !== undefined && maeNwp > 0 ? Math.round((1 - mae / maeNwp) * 100) : null;
  const fallback = model.trainingSamples === 0 || model.algorithm === 'climatology-fallback';
  return (
    <Card testID="model-info">
      <SectionTitle eyebrow>{t.aiModel}</SectionTitle>
      <Text style={[type.bodyStrong, { color: theme.colors.fg }]}>
        {model.name} <Text style={[type.small, { color: theme.colors.fg3 }]}>v{model.version}</Text>
      </Text>
      <Text style={[type.small, type.num, { color: theme.colors.fg2, marginTop: 4 }]}>
        {model.algorithm}
        {mae !== undefined ? ` · ${t.mae} ${mae.toFixed(1)}°` : ''}
        {maeNwp !== undefined ? ` vs ${maeNwp.toFixed(1)}° ${t.raw}` : ''}
        {improvement !== null && improvement > 0 ? ` (−${improvement} %)` : ''}
      </Text>
      <Text style={[type.small, type.num, { color: theme.colors.fg2, marginTop: 2 }]}>
        {t.trainedOn} {model.trainingSamples.toLocaleString()} {t.samples}
        {model.metrics.precipitationBrier !== undefined ? ` · Brier ${model.metrics.precipitationBrier.toFixed(2)}` : ''}
      </Text>
      {fallback ? <Chip label={t.climatologyFallback} color={theme.colors.severity.advisory} small /> : null}
      {model.features.length > 0 ? (
        <View style={styles.features}>
          {model.features.map((f) => (
            <Chip key={f} label={f} small />
          ))}
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  features: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
});
