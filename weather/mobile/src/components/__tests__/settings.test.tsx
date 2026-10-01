import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { regionsFixture } from '@/__fixtures__/regions';
import { en } from '@/i18n/dictionaries';
import { DEFAULT_PREFERENCES } from '@/store/reducer';
import { PreferencesEditor, stepAiThreshold } from '../settings/PreferencesEditor';
import { groupByCountry, RegionPicker } from '../settings/RegionPicker';

describe('RegionPicker', () => {
  it('groups by country, sorted, and filters liberally', async () => {
    const groups = groupByCountry(regionsFixture, '');
    expect(groups.map((g) => g.country)).toEqual(['KR', 'MN']);
    expect(groupByCountry(regionsFixture, 'SEO').flatMap((g) => g.regions.map((r) => r.id))).toEqual(['kr-seoul']);
    expect(groupByCountry(regionsFixture, 'mn-')).toHaveLength(1);
  });

  it('toggles a region and shows the selected count', async () => {
    const onToggle = jest.fn();
    await render(<RegionPicker regions={regionsFixture} selectedIds={['kr-seoul']} onToggle={onToggle} searchPlaceholder="Search" selectedLabel={en.selectedCount(1)} />);
    expect(screen.getByTestId('selected-count')).toHaveTextContent('1 selected');
    expect(screen.getByTestId('region-kr-seoul')).toHaveAccessibilityState({ checked: true });
    await fireEvent.press(screen.getByTestId('region-mn-khovd'));
    expect(onToggle).toHaveBeenCalledWith('mn-khovd');
    await fireEvent.changeText(screen.getByTestId('region-search'), 'khov');
    expect(screen.queryByTestId('region-kr-seoul')).toBeNull();
    expect(screen.getByTestId('region-mn-khovd')).toBeTruthy();
  });
});

describe('PreferencesEditor', () => {
  it('steps the AI threshold in 10 % increments between 40 and 90 %', async () => {
    expect(stepAiThreshold(0.6, 1)).toBe(0.7);
    expect(stepAiThreshold(0.9, 1)).toBe(0.9);
    expect(stepAiThreshold(0.4, -1)).toBe(0.4);
    expect(stepAiThreshold(0.45, -1)).toBe(0.4);
  });

  it('emits partial patches for each control', async () => {
    const onChange = jest.fn();
    await render(<PreferencesEditor prefs={DEFAULT_PREFERENCES} onChange={onChange} t={en} saved={false} syncing={false} />);
    await fireEvent.press(screen.getByTestId('ai-threshold-inc'));
    expect(onChange).toHaveBeenLastCalledWith({ aiRiskThreshold: 0.7 });
    await fireEvent(screen.getByTestId('briefing-toggle'), 'valueChange', true);
    expect(onChange).toHaveBeenLastCalledWith({ dailyBriefingHour: 7 });
    await fireEvent(screen.getByTestId('quiet-toggle'), 'valueChange', true);
    expect(onChange).toHaveBeenLastCalledWith({ quietHours: { start: 22, end: 7 } });
    await fireEvent.press(screen.getByLabelText(en.severity.warning));
    expect(onChange).toHaveBeenLastCalledWith({ minSeverity: 'warning' });
    await fireEvent.press(screen.getByLabelText(en.alertType.typhoon));
    expect(onChange).toHaveBeenLastCalledWith({ alertTypes: DEFAULT_PREFERENCES.alertTypes.filter((x) => x !== 'typhoon') });
    await fireEvent.press(screen.getByLabelText('한국어'));
    expect(onChange).toHaveBeenLastCalledWith({ locale: 'ko' });
    await fireEvent(screen.getByTestId('ai-toggle'), 'valueChange', false);
    expect(onChange).toHaveBeenLastCalledWith({ aiRiskThreshold: 0 });
  });

  it('shows the Saved mark on every section after autosave', async () => {
    await render(<PreferencesEditor prefs={DEFAULT_PREFERENCES} onChange={jest.fn()} t={en} saved syncing={false} />);
    expect(screen.getAllByTestId('saved-mark')).toHaveLength(3);
  });
});
