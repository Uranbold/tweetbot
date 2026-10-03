import React from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { tint, type, useTheme } from '@/theme';
import { CheckIcon } from '../ui';

/** 56 px settings row (Fitts: ≥ 44 px target). */
export function SettingRow({ label, hint, right, onPress, testID }: { label: string; hint?: string; right?: React.ReactNode; onPress?: () => void; testID?: string }) {
  const t = useTheme();
  return (
    <Pressable testID={testID} onPress={onPress} disabled={!onPress} style={styles.row} accessibilityRole={onPress ? 'button' : undefined}>
      <View style={styles.rowText}>
        <Text style={[type.bodyStrong, { color: t.colors.fg }]}>{label}</Text>
        {hint ? (
          <Text style={[type.small, { color: t.colors.fg2, marginTop: 2 }]} numberOfLines={2}>
            {hint}
          </Text>
        ) : null}
      </View>
      {right}
    </Pressable>
  );
}

export function ToggleRow({ label, hint, value, onValueChange, testID }: { label: string; hint?: string; value: boolean; onValueChange: (v: boolean) => void; testID?: string }) {
  const t = useTheme();
  return (
    <SettingRow
      label={label}
      hint={hint}
      right={
        <Switch
          testID={testID}
          value={value}
          onValueChange={onValueChange}
          accessibilityLabel={label}
          trackColor={{ true: t.colors.accent, false: t.colors.border }}
          thumbColor={t.colors.surface}
          ios_backgroundColor={t.colors.border}
        />
      }
    />
  );
}

export function Segmented<T extends string>({ options, value, onChange, testID, label }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; testID?: string; label?: string }) {
  const t = useTheme();
  return (
    <View testID={testID} accessibilityRole="radiogroup" accessibilityLabel={label} style={[styles.segment, { backgroundColor: t.colors.surface2, borderRadius: t.radius.button }]}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="radio"
            accessibilityState={{ checked: active, selected: active }}
            accessibilityLabel={o.label}
            style={[styles.segmentItem, active && { backgroundColor: t.colors.surface, borderRadius: t.radius.button - 2 }]}
          >
            <Text style={[type.smallStrong, { color: active ? t.colors.fg : t.colors.fg2 }]} numberOfLines={1}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** −/+ stepper with 44 px targets and tabular value. */
export function Stepper({ value, label, onDecrement, onIncrement, disabledDown, disabledUp, testID, accessibilityLabel }: { value: string; label?: string; onDecrement: () => void; onIncrement: () => void; disabledDown?: boolean; disabledUp?: boolean; testID?: string; accessibilityLabel?: string }) {
  const t = useTheme();
  return (
    <View testID={testID} style={styles.stepper} accessibilityRole="adjustable" accessibilityLabel={accessibilityLabel} accessibilityValue={{ text: value }}>
      <StepButton label="−" onPress={onDecrement} disabled={disabledDown} testID={testID ? `${testID}-dec` : undefined} a11y="decrease" />
      <View style={styles.stepperValue}>
        <Text style={[type.bodyStrong, type.num, { color: t.colors.fg }]}>{value}</Text>
        {label ? <Text style={[type.label, { color: t.colors.fg3 }]}>{label}</Text> : null}
      </View>
      <StepButton label="+" onPress={onIncrement} disabled={disabledUp} testID={testID ? `${testID}-inc` : undefined} a11y="increase" />
    </View>
  );
}

function StepButton({ label, onPress, disabled, testID, a11y }: { label: string; onPress: () => void; disabled?: boolean; testID?: string; a11y: string }) {
  const t = useTheme();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [styles.stepButton, { backgroundColor: t.colors.surface2, borderRadius: t.radius.button, opacity: disabled ? 0.4 : pressed ? 0.8 : 1 }]}
    >
      <Text style={[type.title, { color: t.colors.fg, lineHeight: 26 }]}>{label}</Text>
    </Pressable>
  );
}

/** Multi-select pill group with check glyphs (state is shape, not only colour). */
export function PillGroup<T extends string>({ options, selected, onToggle }: { options: { value: T; label: string }[]; selected: T[]; onToggle: (v: T) => void }) {
  const t = useTheme();
  return (
    <View style={styles.pills}>
      {options.map((o) => {
        const active = selected.includes(o.value);
        return (
          <Pressable
            key={o.value}
            onPress={() => onToggle(o.value)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: active }}
            accessibilityLabel={o.label}
            style={[styles.pill, { borderRadius: t.radius.chip, backgroundColor: active ? t.colors.accentTint : t.colors.surface2 }]}
          >
            {active ? <CheckIcon color={t.colors.accent} size={14} /> : null}
            <Text style={[type.smallStrong, { color: active ? t.colors.fg : t.colors.fg2 }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Single-select option row group (air grade threshold). */
export function OptionPills<T extends string>({ options, value, onChange, colorFor }: { options: { value: T; label: string; leading?: React.ReactNode }[]; value: T; onChange: (v: T) => void; colorFor?: (v: T) => string | undefined }) {
  const t = useTheme();
  return (
    <View style={styles.pills} accessibilityRole="radiogroup">
      {options.map((o) => {
        const active = o.value === value;
        const c = colorFor?.(o.value);
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="radio"
            accessibilityState={{ checked: active }}
            accessibilityLabel={o.label}
            style={[
              styles.pill,
              { borderRadius: t.radius.chip, backgroundColor: active ? (c ? tint(c, t.dark ? 0.24 : 0.14) : t.colors.accentTint) : t.colors.surface2 },
              active && { borderWidth: 1.5, borderColor: c ?? t.colors.accent },
            ]}
          >
            {o.leading}
            <Text style={[type.smallStrong, { color: active ? t.colors.fg : t.colors.fg2 }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 56, paddingVertical: 8, gap: 12 },
  rowText: { flex: 1 },
  segment: { flexDirection: 'row', padding: 3, minHeight: 44 },
  segmentItem: { flex: 1, minHeight: 38, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepperValue: { minWidth: 64, alignItems: 'center' },
  stepButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, minHeight: 40, paddingVertical: 8 },
});
