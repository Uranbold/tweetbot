import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { Region } from '@contract';
import { type, useTheme } from '@/theme';
import { CheckIcon } from '../ui';

export interface RegionPickerProps {
  regions: Region[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  searchPlaceholder: string;
  selectedLabel: string;
  /** Country code → display name. Unknown codes fall back to the code. */
  countryNames?: Record<string, string>;
}

const DEFAULT_COUNTRIES: Record<string, string> = { MN: 'Mongolia · Монгол', KR: 'Korea · 한국', JP: 'Japan', CN: 'China', RU: 'Russia' };

export interface RegionGroup {
  country: string;
  regions: Region[];
}

/** Liberal matching (Postel): name or id, case-insensitive, Latin/Cyrillic/Hangul all fine. */
export function groupByCountry(regions: Region[], query: string): RegionGroup[] {
  const q = query.trim().toLowerCase();
  const filtered = q ? regions.filter((r) => r.name.toLowerCase().includes(q) || r.id.toLowerCase().includes(q)) : regions;
  const map = new Map<string, Region[]>();
  for (const r of filtered) {
    const list = map.get(r.country) ?? [];
    list.push(r);
    map.set(r.country, list);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([country, list]) => ({ country, regions: [...list].sort((a, b) => a.name.localeCompare(b.name)) }));
}

/**
 * Region picker (§4.8): search at top, grouped by country with headers that stick while the
 * group scrolls (the whole Settings screen is the scroller, so headers are sticky via the parent),
 * 56 px checkbox rows, selected count in the header.
 */
export function RegionPicker({ regions, selectedIds, onToggle, searchPlaceholder, selectedLabel, countryNames = DEFAULT_COUNTRIES }: RegionPickerProps) {
  const t = useTheme();
  const [query, setQuery] = useState('');
  const groups = useMemo(() => groupByCountry(regions, query), [regions, query]);

  return (
    <View testID="region-picker">
      <View style={styles.headerRow}>
        <TextInput
          testID="region-search"
          value={query}
          onChangeText={setQuery}
          placeholder={searchPlaceholder}
          placeholderTextColor={t.colors.fg3}
          autoCorrect={false}
          autoCapitalize="none"
          clearButtonMode="while-editing"
          accessibilityLabel={searchPlaceholder}
          style={[type.body, styles.search, { backgroundColor: t.colors.surface2, color: t.colors.fg, borderRadius: t.radius.input }]}
        />
        <Text style={[type.label, { color: t.colors.fg2 }]} testID="selected-count">
          {selectedLabel}
        </Text>
      </View>
      {groups.map((g) => (
        <View key={g.country} style={styles.group}>
          <View style={[styles.groupHeader, { backgroundColor: t.colors.surface }]}>
            <Text style={[type.eyebrow, { color: t.colors.fg3 }]} accessibilityRole="header">
              {countryNames[g.country] ?? g.country}
            </Text>
          </View>
          {g.regions.map((r) => {
            const checked = selectedIds.includes(r.id);
            return (
              <Pressable
                key={r.id}
                testID={`region-${r.id}`}
                onPress={() => onToggle(r.id)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked }}
                accessibilityLabel={r.name}
                style={({ pressed }) => [styles.item, { borderBottomColor: t.colors.border, opacity: pressed ? 0.7 : 1 }]}
              >
                <View style={styles.itemText}>
                  <Text style={[checked ? type.bodyStrong : type.body, { color: t.colors.fg }]}>{r.name}</Text>
                  <Text style={[type.label, { color: t.colors.fg3 }]}>
                    {r.lat.toFixed(2)}, {r.lon.toFixed(2)}
                  </Text>
                </View>
                <View style={[styles.check, { borderColor: checked ? t.colors.accent : t.colors.border, backgroundColor: checked ? t.colors.accent : 'transparent' }]}>
                  {checked ? <CheckIcon color={t.colors.accentInk} size={16} /> : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
      {groups.length === 0 ? <Text style={[type.small, { color: t.colors.fg3, padding: 12 }]}>—</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: { gap: 6, marginBottom: 4 },
  search: { paddingHorizontal: 14, minHeight: 44, paddingVertical: 10 },
  group: { marginTop: 8 },
  groupHeader: { paddingVertical: 6 },
  item: { flexDirection: 'row', alignItems: 'center', minHeight: 56, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, gap: 12 },
  itemText: { flex: 1 },
  check: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});
