import React from 'react';
import { Link, Stack } from 'expo-router';
import { Text } from 'react-native';
import { Screen } from '@/components/Screen';
import { Card, EmptyState } from '@/components/ui';
import { type, useTheme } from '@/theme';

export default function NotFoundScreen() {
  const theme = useTheme();
  return (
    <Screen>
      <Stack.Screen options={{ title: 'Not found' }} />
      <Card>
        <EmptyState title="This screen does not exist." />
        <Link href="/" style={{ alignSelf: 'center', minHeight: 44, paddingVertical: 10 }}>
          <Text style={[type.smallStrong, { color: theme.colors.accent }]}>Go to Today</Text>
        </Link>
      </Card>
    </Screen>
  );
}
