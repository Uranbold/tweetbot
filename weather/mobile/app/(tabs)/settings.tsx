import React, { useState } from 'react';
import { Linking, Platform, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useRegions, useSendTestNotification } from '@/api/hooks';
import { api, describeError } from '@/api/client';
import { Screen, ScreenHeader } from '@/components/Screen';
import { PreferencesEditor } from '@/components/settings/PreferencesEditor';
import { RegionPicker } from '@/components/settings/RegionPicker';
import { ToggleRow } from '@/components/settings/controls';
import { Button, Card, CheckIcon, Divider, SavedMark, SectionTitle, Skeleton } from '@/components/ui';
import { useGpsFollow } from '@/hooks/useActiveLocation';
import { useSavedFlag } from '@/hooks/useSavedFlag';
import { useT } from '@/i18n';
import { nearestRegion } from '@/lib/geo';
import { scheduleLocalTestAlert } from '@/notifications/local';
import { useNotifications } from '@/notifications/NotificationsProvider';
import { useDeviceStore } from '@/store/DeviceProvider';
import { tint, type, useTheme } from '@/theme';

export default function SettingsScreen() {
  const t = useT();
  const theme = useTheme();
  const router = useRouter();
  const { state, toggleRegion, setFollowLocation, updatePreferences, dispatch } = useDeviceStore();
  const { enableNotifications, placeholderToken } = useNotifications();
  const regionsQuery = useRegions();
  const regions = regionsQuery.data?.data ?? [];
  const { requestFix } = useGpsFollow();
  const { saved, syncing } = useSavedFlag(state.syncStatus, t.saved);
  const test = useSendTestNotification(state.deviceId);
  const [localScheduled, setLocalScheduled] = useState(false);

  const permissionOk = state.notificationPermission === 'granted';
  const steps = [
    { key: 'permission', label: t.setupPermission, done: permissionOk },
    { key: 'region', label: t.setupRegion, done: state.regionIds.length > 0 },
    { key: 'test', label: t.setupTest, done: !!state.testSentAt },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  const setupComplete = doneCount === steps.length;

  const nearest = state.followLocation && state.lastLocation ? nearestRegion(regions, state.lastLocation.lat, state.lastLocation.lon) : null;

  const openOsSettings = () => {
    void Linking.openSettings().catch(() => undefined);
  };

  const onFollowToggle = async (on: boolean) => {
    setFollowLocation(on);
    if (on) await requestFix();
  };

  const onTest = () =>
    test.mutate(undefined, { onSuccess: () => dispatch({ type: 'TEST_SENT', at: new Date().toISOString() }) });

  return (
    <Screen testID="settings-screen">
      <ScreenHeader eyebrow={t.tabs.settings} title={t.settings} right={<SavedMark visible={saved} label={t.saved} syncing={syncing} syncingLabel={t.syncing} />} />

      {/* Status row (§4.9) */}
      <Card testID="notif-status">
        <View style={styles.statusRow}>
          <View style={[styles.statusDot, { backgroundColor: permissionOk ? theme.colors.accent : theme.colors.severity.advisory }]} />
          <Text style={[type.bodyStrong, { color: permissionOk ? theme.colors.accent : theme.colors.severity.advisory, flex: 1 }]} testID="notif-status-text">
            {state.notificationPermission === 'unsupported' ? t.notifUnsupported : permissionOk ? t.notifOn : t.notifOff}
          </Text>
          {Platform.OS !== 'web' ? (
            state.notificationPermission === 'denied' ? (
              <Button label={t.openSettings} compact variant="secondary" onPress={openOsSettings} testID="open-settings" />
            ) : !permissionOk ? (
              <Button label={t.requestPermission} compact onPress={() => void enableNotifications()} testID="enable-notifications" />
            ) : (
              <Button label={t.openSettings} compact variant="ghost" onPress={openOsSettings} testID="open-settings" />
            )
          ) : null}
        </View>
        {placeholderToken && state.pushToken ? <Text style={[type.label, { color: theme.colors.fg3, marginTop: 8 }]}>Dev token · {state.pushToken}</Text> : null}
      </Card>

      {/* Setup progress strip (Zeigarnik / goal-gradient) — disappears when complete */}
      {!setupComplete ? (
        <Card testID="setup-strip" style={{ backgroundColor: theme.colors.accentTint, borderWidth: 0 }}>
          <SectionTitle eyebrow right={<Text style={[type.label, { color: theme.colors.fg2 }]}>{t.setupProgress(doneCount, steps.length)}</Text>}>
            {t.setupTitle}
          </SectionTitle>
          <View style={styles.steps}>
            {steps.map((s, i) => (
              <View key={s.key} style={styles.step} accessibilityLabel={`${s.label}${s.done ? ', done' : ''}`}>
                <View style={[styles.stepDot, { backgroundColor: s.done ? theme.colors.accent : theme.colors.surface, borderColor: s.done ? theme.colors.accent : theme.colors.fg3 }]}>
                  {s.done ? <CheckIcon color={theme.colors.accentInk} size={14} /> : <Text style={[type.label, { color: theme.colors.fg2 }]}>{i + 1}</Text>}
                </View>
                <Text style={[type.label, { color: s.done ? theme.colors.fg2 : theme.colors.fg, textAlign: 'center' }]} numberOfLines={2}>
                  {s.label}
                </Text>
              </View>
            ))}
          </View>
          {doneCount === 2 && !state.testSentAt ? (
            <Button label={test.isPending ? t.sending : t.sendTest} onPress={onTest} disabled={!state.deviceId || test.isPending} style={{ marginTop: 12 }} testID="setup-send-test" />
          ) : null}
          {test.isError ? <Text style={[type.label, { color: theme.colors.severity.warning, marginTop: 6 }]}>{describeError(test.error)}</Text> : null}
        </Card>
      ) : null}

      {/* Regions (§4.8): follow-location switch on top with nearest region */}
      <Card testID="regions-card">
        <SectionTitle right={<SavedMark visible={saved} label={t.saved} syncing={syncing} syncingLabel={t.syncing} />}>{t.regions}</SectionTitle>
        <ToggleRow label={t.followLocation} hint={nearest ? `${t.nearestRegion}: ${nearest.name}` : t.followLocationHint} value={state.followLocation} onValueChange={(v) => void onFollowToggle(v)} testID="follow-location" />
        <Divider spacing={4} />
        {regionsQuery.isPending ? (
          <>
            <Skeleton height={44} radius={10} />
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} height={48} style={{ marginTop: 8 }} />
            ))}
          </>
        ) : regionsQuery.isError ? (
          <Text style={[type.small, { color: theme.colors.fg2 }]}>{describeError(regionsQuery.error, t.errorGeneric)}</Text>
        ) : (
          <RegionPicker regions={regions} selectedIds={state.regionIds} onToggle={toggleRegion} searchPlaceholder={t.searchRegions} selectedLabel={t.selectedCount(state.regionIds.length)} />
        )}
      </Card>

      {/* Preferences: What / When / Language with autosave */}
      <PreferencesEditor prefs={state.preferences} onChange={updatePreferences} t={t} saved={saved} syncing={syncing} />

      {/* Device / developer */}
      <Card testID="dev-card">
        <SectionTitle eyebrow>{t.devTools}</SectionTitle>
        <Text style={[type.label, { color: theme.colors.fg2 }]}>
          {t.deviceId}: {state.deviceId ?? t.notRegistered}
          {state.syncStatus === 'error' ? ` · ${t.syncError}${state.syncError ? ` (${state.syncError})` : ''}` : ''}
        </Text>
        <Text style={[type.label, { color: theme.colors.fg3, marginTop: 2 }]}>
          API: {api.useFixtures ? 'fixtures' : api.baseUrl} · {state.platform}
        </Text>
        <View style={styles.devButtons}>
          <Button
            label={localScheduled ? t.localScheduled : t.scheduleLocal}
            variant="secondary"
            compact
            disabled={Platform.OS === 'web'}
            testID="schedule-local"
            onPress={() => {
              const region = regions.find((r) => r.id === state.regionIds[0]) ?? { id: 'mn-ulaanbaatar', name: 'Ulaanbaatar' };
              void scheduleLocalTestAlert(5, region).then((id) => setLocalScheduled(!!id));
            }}
          />
          <Button label={t.sendTest} variant="secondary" compact disabled={!state.deviceId || test.isPending} onPress={onTest} testID="dev-send-test" />
          <Button label={t.viewAlerts} variant="ghost" compact onPress={() => router.push('/alerts')} />
        </View>
        {test.isSuccess ? <Text style={[type.label, { color: theme.colors.accent, marginTop: 6 }]}>{t.testSent}</Text> : null}
        <View style={{ height: 1, backgroundColor: tint(theme.colors.fg, 0) }} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  steps: { flexDirection: 'row', gap: 8 },
  step: { flex: 1, alignItems: 'center', gap: 6 },
  stepDot: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  devButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
});
