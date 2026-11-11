import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { AirGrade, AlertSeverity, AlertType, NotificationPreferences } from '@contract';
import { LOCALES, type Dictionary, type Locale } from '@/i18n';
import { GRADE_ORDER } from '@/lib/colors';
import { hourLabel } from '@/lib/format';
import { ALL_ALERT_TYPES } from '@/store/reducer';
import { type, useTheme } from '@/theme';
import { GradeFace } from '../GradeFace';
import { Card, Divider, SavedMark, SectionTitle } from '../ui';
import { OptionPills, PillGroup, Segmented, Stepper, ToggleRow } from './controls';

export interface PreferencesEditorProps {
  prefs: NotificationPreferences;
  onChange: (patch: Partial<NotificationPreferences>) => void;
  t: Dictionary;
  /** Autosave feedback for the "Saved ✓" marks. */
  saved: boolean;
  syncing: boolean;
}

/** Stepper range 40–90 % in 10 % steps (§4.9); 0 disables (contract). */
export const AI_THRESHOLD_MIN = 0.4;
export const AI_THRESHOLD_MAX = 0.9;
export const AI_THRESHOLD_STEP = 0.1;
export const AI_THRESHOLD_DEFAULT = 0.6;

export function stepAiThreshold(current: number, dir: 1 | -1): number {
  const next = Math.round((current + dir * AI_THRESHOLD_STEP) * 10) / 10;
  return Math.min(AI_THRESHOLD_MAX, Math.max(AI_THRESHOLD_MIN, next));
}

const wrapHour = (h: number) => ((h % 24) + 24) % 24;

/** Three sections — What / When / Language — each autosaving with a "Saved" check (§4.9). */
export function PreferencesEditor({ prefs, onChange, t, saved, syncing }: PreferencesEditorProps) {
  const theme = useTheme();
  const mark = <SavedMark visible={saved} label={t.saved} syncing={syncing} syncingLabel={t.syncing} />;

  const toggleAlertType = (type_: AlertType) => {
    const has = prefs.alertTypes.includes(type_);
    onChange({ alertTypes: has ? prefs.alertTypes.filter((x) => x !== type_) : [...prefs.alertTypes, type_] });
  };

  const alertTypeOptions = ALL_ALERT_TYPES.map((v) => ({ value: v, label: t.alertType[v] }));
  const severityOptions: { value: AlertSeverity; label: string }[] = [
    { value: 'advisory', label: t.severity.advisory },
    { value: 'warning', label: t.severity.warning },
  ];
  const airOptions: { value: AirGrade | 'off'; label: string; leading?: React.ReactNode }[] = [
    { value: 'off', label: t.prefAirOff },
    ...GRADE_ORDER.filter((g) => g !== 'good').map((g) => ({ value: g, label: t.grade[g], leading: <GradeFace grade={g} color={theme.colors.grade[g]} size={16} /> })),
  ];
  const localeOptions: { value: Locale; label: string }[] = LOCALES.map((l) => ({ value: l, label: l === 'en' ? 'English' : l === 'mn' ? 'Монгол' : '한국어' }));
  const aiOn = prefs.aiRiskThreshold > 0;

  return (
    <View testID="preferences-editor">
      {/* WHAT */}
      <Card testID="prefs-what">
        <SectionTitle right={mark}>{t.sectionWhat}</SectionTitle>
        <Label text={t.prefAlertTypes} />
        <PillGroup options={alertTypeOptions} selected={prefs.alertTypes} onToggle={toggleAlertType} />
        <Divider />
        <Label text={t.prefMinSeverity} />
        <Segmented options={severityOptions} value={prefs.minSeverity} onChange={(minSeverity) => onChange({ minSeverity })} testID="min-severity" label={t.prefMinSeverity} />
        <Divider />
        <ToggleRow
          label={t.aiRiskAlerts}
          hint={aiOn ? `${t.aiEstimate} ≥ ${Math.round(prefs.aiRiskThreshold * 100)} %` : t.prefAiThresholdOff}
          value={aiOn}
          onValueChange={(on) => onChange({ aiRiskThreshold: on ? AI_THRESHOLD_DEFAULT : 0 })}
          testID="ai-toggle"
        />
        {aiOn ? (
          <View style={styles.indent}>
            <Text style={[type.label, { color: theme.colors.fg3, marginBottom: 6 }]}>{t.prefAiThreshold}</Text>
            <Stepper
              testID="ai-threshold"
              accessibilityLabel={t.prefAiThreshold}
              value={`${Math.round(prefs.aiRiskThreshold * 100)} %`}
              onDecrement={() => onChange({ aiRiskThreshold: stepAiThreshold(prefs.aiRiskThreshold, -1) })}
              onIncrement={() => onChange({ aiRiskThreshold: stepAiThreshold(prefs.aiRiskThreshold, 1) })}
              disabledDown={prefs.aiRiskThreshold <= AI_THRESHOLD_MIN + 1e-6}
              disabledUp={prefs.aiRiskThreshold >= AI_THRESHOLD_MAX - 1e-6}
            />
          </View>
        ) : null}
        <Divider />
        <Label text={t.prefAirThreshold} />
        <OptionPills
          options={airOptions}
          value={prefs.airGradeThreshold ?? 'off'}
          onChange={(v) => onChange({ airGradeThreshold: v === 'off' ? null : v })}
          colorFor={(v) => (v === 'off' ? undefined : theme.colors.grade[v])}
        />
      </Card>

      {/* WHEN */}
      <Card testID="prefs-when">
        <SectionTitle right={mark}>{t.sectionWhen}</SectionTitle>
        <ToggleRow
          label={t.prefBriefing}
          hint={prefs.dailyBriefingHour === null ? t.prefBriefingOff : hourLabel(prefs.dailyBriefingHour)}
          value={prefs.dailyBriefingHour !== null}
          onValueChange={(on) => onChange({ dailyBriefingHour: on ? 7 : null })}
          testID="briefing-toggle"
        />
        {prefs.dailyBriefingHour !== null ? (
          <View style={styles.indent}>
            <Stepper
              testID="briefing-hour"
              accessibilityLabel={t.prefBriefing}
              value={hourLabel(prefs.dailyBriefingHour)}
              onDecrement={() => onChange({ dailyBriefingHour: wrapHour((prefs.dailyBriefingHour ?? 7) - 1) })}
              onIncrement={() => onChange({ dailyBriefingHour: wrapHour((prefs.dailyBriefingHour ?? 7) + 1) })}
            />
          </View>
        ) : null}
        <Divider />
        <ToggleRow
          label={t.prefQuietHours}
          hint={prefs.quietHours ? `${hourLabel(prefs.quietHours.start)} → ${hourLabel(prefs.quietHours.end)}` : t.prefQuietOff}
          value={prefs.quietHours !== null}
          onValueChange={(on) => onChange({ quietHours: on ? { start: 22, end: 7 } : null })}
          testID="quiet-toggle"
        />
        {prefs.quietHours ? (
          <View style={[styles.indent, styles.quietRow]}>
            <View style={styles.quietCol}>
              <Text style={[type.label, { color: theme.colors.fg3 }]}>{t.prefQuietFrom}</Text>
              <Stepper
                accessibilityLabel={`${t.prefQuietHours} ${t.prefQuietFrom}`}
                value={hourLabel(prefs.quietHours.start)}
                onDecrement={() => onChange({ quietHours: { start: wrapHour((prefs.quietHours?.start ?? 22) - 1), end: prefs.quietHours?.end ?? 7 } })}
                onIncrement={() => onChange({ quietHours: { start: wrapHour((prefs.quietHours?.start ?? 22) + 1), end: prefs.quietHours?.end ?? 7 } })}
              />
            </View>
            <View style={styles.quietCol}>
              <Text style={[type.label, { color: theme.colors.fg3 }]}>{t.prefQuietTo}</Text>
              <Stepper
                accessibilityLabel={`${t.prefQuietHours} ${t.prefQuietTo}`}
                value={hourLabel(prefs.quietHours.end)}
                onDecrement={() => onChange({ quietHours: { start: prefs.quietHours?.start ?? 22, end: wrapHour((prefs.quietHours?.end ?? 7) - 1) } })}
                onIncrement={() => onChange({ quietHours: { start: prefs.quietHours?.start ?? 22, end: wrapHour((prefs.quietHours?.end ?? 7) + 1) } })}
              />
            </View>
          </View>
        ) : null}
      </Card>

      {/* LANGUAGE */}
      <Card testID="prefs-language">
        <SectionTitle right={mark}>{t.sectionLanguage}</SectionTitle>
        <Segmented options={localeOptions} value={prefs.locale} onChange={(locale) => onChange({ locale })} testID="locale" label={t.prefLocale} />
      </Card>
    </View>
  );
}

function Label({ text }: { text: string }) {
  const theme = useTheme();
  return <Text style={[type.smallStrong, styles.label, { color: theme.colors.fg2 }]}>{text}</Text>;
}

const styles = StyleSheet.create({
  label: { marginBottom: 8 },
  indent: { paddingBottom: 8 },
  quietRow: { flexDirection: 'row', gap: 24, flexWrap: 'wrap' },
  quietCol: { gap: 6 },
});
