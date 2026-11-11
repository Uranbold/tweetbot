import React from 'react';
import { render, screen } from '@testing-library/react-native';
import type { AirGrade } from '@contract';
import { GradeChip } from '../GradeChip';
import { darkTheme, lightTheme } from '@/theme';
import { en, ko, mn } from '@/i18n/dictionaries';

const grades: AirGrade[] = ['good', 'moderate', 'bad', 'very-bad'];

describe('GradeChip', () => {
  it('uses the 4-tier token colours (blue / green / orange / red) in both themes', async () => {
    expect(lightTheme.colors.grade).toEqual({ good: '#2a78d6', moderate: '#1a9e4b', bad: '#e0860a', 'very-bad': '#c7322e' });
    expect(darkTheme.colors.grade).toEqual({ good: '#4a90e8', moderate: '#3fb760', bad: '#e89a2a', 'very-bad': '#e05a52' });
  });

  it.each(grades)('renders the %s label text and a face glyph (never colour alone)', async (grade) => {
    await render(<GradeChip pollutant="PM10" grade={grade} gradeLabel={en.grade[grade]} value={48} />);
    expect(screen.getByTestId(`grade-chip-${grade}`)).toBeTruthy();
    expect(screen.getByTestId(`grade-face-${grade}`)).toBeTruthy();
    expect(screen.getByText(en.grade[grade])).toBeTruthy();
    expect(screen.getByText(/PM10/)).toBeTruthy();
    expect(screen.getByText(/48/)).toBeTruthy();
  });

  it('exposes an accessibility label with pollutant, grade and value', async () => {
    await render(<GradeChip pollutant="PM2.5" grade="bad" gradeLabel="Bad" value={41.4} />);
    expect(screen.getByLabelText('PM2.5 Bad, 41 micrograms')).toBeTruthy();
  });

  it('renders Mongolian and Korean labels', async () => {
    await render(<GradeChip pollutant="PM10" grade="very-bad" gradeLabel={mn.grade['very-bad']} />);
    expect(screen.getByText('Маш муу')).toBeTruthy();
    await screen.unmount();
    await render(<GradeChip pollutant="PM10" grade="good" gradeLabel={ko.grade.good} />);
    expect(screen.getByText('좋음')).toBeTruthy();
  });
});
