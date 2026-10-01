import React, { useEffect, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { ApiMeta, TodayWeather } from '@contract';
import type { Dictionary, Locale } from '@/i18n';
import { announce, useCountUp, useReducedMotion } from '@/hooks/useMotion';
import { formatClock, roundTemp, signedTemp } from '@/lib/format';
import { tint, type, useTheme } from '@/theme';
import { AlertBanner } from '../AlertBanner';
import { DailyList } from '../DailyList';
import { GradeChip } from '../GradeChip';
import { HourlyStrip } from '../HourlyStrip';
import { WeatherIcon } from '../WeatherIcon';
import { Card, Chip, DataBadges, KeyValue, SectionTitle } from '../ui';

export interface TodayContentProps {
  weather: TodayWeather;
  meta: ApiMeta;
  t: Dictionary;
  locale: Locale;
  /** Header label (region name / GPS place). */
  placeLabel: string;
}

const MAX_BANNERS = 2;
const MAX_INDICES = 8;

/** Today tab body (§4.1–4.4): answer first (hero), evidence after (hourly, weekly, indices). */
export function TodayContent({ weather, meta, t, locale, placeLabel }: TodayContentProps) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const temp = useCountUp(weather.current.temperature, undefined, reduced);
  const todayDate = weather.current.time.slice(0, 10);

  useEffect(() => {
    announce(t.loadedWeather(placeLabel));
  }, [placeLabel, t]);

  const banners = weather.alerts.slice(0, MAX_BANNERS);
  const moreAlerts = weather.alerts.length - banners.length;
  const indices = useMemo(() => weather.lifeIndices.slice(0, MAX_INDICES), [weather.lifeIndices]);
  const diff = weather.comparison.temperatureDiff;

  return (
    <View testID="today-content">
      {/* Alert banners outrank everything (Von Restorff) */}
      {banners.map((a) => (
        <AlertBanner
          key={`${a.type}-${a.start}`}
          severity={a.severity}
          severityLabel={t.severity[a.severity]}
          title={a.title}
          description={a.description}
          period={`${formatClock(a.start)}${a.end ? ` – ${a.end.slice(5, 10).replace('-', '/')} ${formatClock(a.end)}` : ''}`}
        />
      ))}
      {moreAlerts > 0 ? <Text style={[type.label, { color: theme.colors.fg2, marginBottom: 8 }]}>+{moreAlerts} more</Text> : null}

      {/* Hero */}
      <Card testID="hero-card">
        <View style={styles.heroTop}>
          <View style={styles.heroLeft}>
            <Text style={[type.hero, { color: theme.colors.fg }]} accessibilityLabel={`${roundTemp(weather.current.temperature)} ${weather.current.condition.label}`} testID="hero-temp">
              {Math.round(temp)}
              <Text style={{ color: theme.colors.fg2 }}>°</Text>
            </Text>
          </View>
          <View style={styles.heroRight}>
            <WeatherIcon condition={weather.current.condition.key} isDay={weather.current.condition.isDay} size={64} label={weather.current.condition.label} />
            <Text style={[type.bodyStrong, { color: theme.colors.fg, textAlign: 'right' }]}>{weather.current.condition.label}</Text>
            <Text style={[type.small, type.num, { color: theme.colors.fg2 }]}>
              {roundTemp(weather.today.temperatureMax)} / {roundTemp(weather.today.temperatureMin)}
            </Text>
          </View>
        </View>
        <Text style={[type.small, { color: theme.colors.fg2, marginTop: 4 }]} testID="yesterday-diff">
          {diff > 0 ? '↑' : diff < 0 ? '↓' : '→'} {t.warmerThanYesterday(diff)}
        </Text>
        <View style={styles.kvRow}>
          <KeyValue label={t.feelsLike} value={roundTemp(weather.current.feelsLike)} />
          <KeyValue label={t.humidity} value={`${Math.round(weather.current.humidity)}%`} />
          <KeyValue label={t.wind} value={`${weather.current.windDirectionLabel} ${weather.current.windSpeed.toFixed(1)} m/s`} />
          <KeyValue label={t.uv} value={`${Math.round(weather.current.uvIndex)}`} />
        </View>
        <View style={styles.chipRow}>
          {weather.air ? (
            <>
              <GradeChip pollutant={t.pm10} grade={weather.air.pm10Grade} gradeLabel={t.grade[weather.air.pm10Grade]} value={weather.air.pm10} />
              <GradeChip pollutant={t.pm25} grade={weather.air.pm25Grade} gradeLabel={t.grade[weather.air.pm25Grade]} value={weather.air.pm25} />
            </>
          ) : null}
          <Chip label={`${t.sunrise} ${formatClock(weather.today.sunrise)}`} color={theme.colors.warm} small />
          <Chip label={`${t.sunset} ${formatClock(weather.today.sunset)}`} color={theme.colors.fg3} small />
        </View>
        <Text style={[type.heading, { color: theme.colors.fg, marginTop: 12 }]}>{weather.today.headline}</Text>
        <View style={styles.metaRow}>
          <Text style={[type.label, { color: theme.colors.fg3 }]}>
            {t.updatedAt(formatClock(weather.current.time))}
          </Text>
          <DataBadges demo={meta.mock} stale={meta.stale} demoLabel={t.demoData} staleLabel={t.stale} />
        </View>
      </Card>

      {/* Clothing — the "peak" (peak–end rule) */}
      <Card testID="clothing-card" style={{ backgroundColor: theme.colors.accentTint, borderWidth: 0 }}>
        <SectionTitle eyebrow>{t.clothing}</SectionTitle>
        <Text style={[type.heading, { color: theme.colors.fg }]}>{weather.clothing.summary}</Text>
        <View style={[styles.chipRow, { marginTop: 8 }]}>
          {weather.clothing.items.map((item) => (
            <Chip key={item} label={item} color={theme.colors.accent} small />
          ))}
        </View>
      </Card>

      {/* Hourly */}
      <Card testID="hourly-card">
        <SectionTitle>{t.hourly}</SectionTitle>
        <HourlyStrip hours={weather.hourly} locale={locale} nowLabel={t.now} todayDate={todayDate} labels={{ today: t.today, tomorrow: t.tomorrow }} />
      </Card>

      {/* Weekly */}
      <Card testID="daily-card">
        <SectionTitle>{t.daily}</SectionTitle>
        <DailyList days={weather.daily} todayDate={todayDate} locale={locale} t={t} currentTemp={weather.current.temperature} />
      </Card>

      {/* Life indices */}
      {indices.length > 0 ? (
        <Card testID="indices-card">
          <SectionTitle>{t.lifeIndices}</SectionTitle>
          <View style={styles.indexGrid}>
            {indices.map((ix) => (
              <View key={ix.key} style={[styles.indexCell, { backgroundColor: theme.colors.surface2, borderRadius: theme.radius.button }]} accessibilityLabel={`${ix.label} ${ix.level}: ${ix.advice}`}>
                <View style={styles.indexHead}>
                  <View style={[styles.levelDot, { backgroundColor: theme.colors.indexLevel[ix.level] }]} />
                  <Text style={[type.label, { color: theme.colors.fg3 }]} numberOfLines={1}>
                    {ix.label}
                  </Text>
                </View>
                <Text style={[type.smallStrong, { color: theme.colors.fg }]}>
                  {ix.level.replace('-', ' ')}
                  {ix.value !== undefined ? <Text style={[type.num, { color: theme.colors.fg2 }]}> · {ix.value}</Text> : null}
                </Text>
                <Text style={[type.label, { color: theme.colors.fg2 }]} numberOfLines={2}>
                  {ix.advice}
                </Text>
              </View>
            ))}
          </View>
        </Card>
      ) : null}

      <Text style={[type.label, { color: theme.colors.fg3, textAlign: 'center', marginTop: 4 }]}>
        {weather.location.name}
        {weather.location.admin1 && weather.location.admin1 !== weather.location.name ? `, ${weather.location.admin1}` : ''} · {weather.location.timezone} · {signedTemp(diff)} vs yesterday
      </Text>
      <View style={{ height: 0, backgroundColor: tint(theme.colors.fg, 0) }} />
    </View>
  );
}

const styles = StyleSheet.create({
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  heroLeft: { flex: 1 },
  heroRight: { alignItems: 'flex-end', gap: 2 },
  kvRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 16 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, gap: 8 },
  indexGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  indexCell: { width: '48%', flexGrow: 1, padding: 10, gap: 2 },
  indexHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  levelDot: { width: 8, height: 8, borderRadius: 4 },
});
