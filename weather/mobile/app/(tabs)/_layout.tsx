import React from 'react';
import { Tabs } from 'expo-router';
import { TabIcon } from '@/components/TabIcon';
import { useT } from '@/i18n';
import { FONT, useTheme } from '@/theme';

/** Bottom tabs in serial-position order: Today first, Settings last (UX §2). */
export default function TabsLayout() {
  const t = useT();
  const theme = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.accent,
        tabBarInactiveTintColor: theme.colors.fg3,
        tabBarStyle: { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border, height: 64, paddingTop: 6 },
        tabBarLabelStyle: { fontFamily: FONT.semibold, fontSize: 12 },
        tabBarItemStyle: { minHeight: 44 },
        sceneStyle: { backgroundColor: theme.colors.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t.tabs.today, tabBarIcon: ({ color }) => <TabIcon name="today" color={String(color)} /> }} />
      <Tabs.Screen name="ai" options={{ title: t.tabs.ai, tabBarIcon: ({ color }) => <TabIcon name="ai" color={String(color)} /> }} />
      <Tabs.Screen name="alerts" options={{ title: t.tabs.alerts, tabBarIcon: ({ color }) => <TabIcon name="alerts" color={String(color)} /> }} />
      <Tabs.Screen name="settings" options={{ title: t.tabs.settings, tabBarIcon: ({ color }) => <TabIcon name="settings" color={String(color)} /> }} />
    </Tabs>
  );
}
