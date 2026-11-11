import { aiRiskBody, alertBody, alertTitle, BODY_MAX, briefingTitle, buildLocalTestAlert, channelFor, TITLE_MAX } from '../content';
import { BRIEFING_CHANNEL_ID, WEATHER_ALERTS_CHANNEL_ID } from '../channels';

describe('notification content templates (UX §4.10)', () => {
  it('builds a warning title with glyph, hazard, severity and region within 40 chars', () => {
    const title = alertTitle('cold-wave', 'warning', 'Khovd');
    expect(title).toBe('⚠ Cold-wave warning · Khovd');
    expect(title.length).toBeLessThanOrEqual(TITLE_MAX);
    expect(alertTitle('heavy-rain', 'advisory', 'A very long region name that overflows the limit').length).toBeLessThanOrEqual(TITLE_MAX);
  });

  it('body states the threshold, window and advice within 110 chars', () => {
    const body = alertBody({ type: 'cold-wave', description: 'Min −18 °C expected', start: '2026-10-03T06:00', end: '2026-10-03T09:00' });
    expect(body).toBe('Min −18 °C expected (10/3 06:00–09:00). Dress in layers; limit time outside.');
    expect(body.length).toBeLessThanOrEqual(BODY_MAX);
  });

  it('AI risk copy is probabilistic and labelled', () => {
    const body = aiRiskBody({ hazard: 'strong-wind', severity: 'advisory', probability: 0.72, expectedStart: '2026-10-03T12:00' });
    expect(body).toMatch(/^72% chance of a strong-wind advisory 10\/3 \(AI estimate\)/);
    expect(body).not.toMatch(/\bwill\b/);
  });

  it('routes briefings to their own channel so warnings stay loud', () => {
    expect(channelFor('daily-briefing')).toBe(BRIEFING_CHANNEL_ID);
    expect(channelFor('alert')).toBe(WEATHER_ALERTS_CHANNEL_ID);
    expect(channelFor('test')).toBe(WEATHER_ALERTS_CHANNEL_ID);
    expect(briefingTitle('Seoul', 14, 21)).toBe('Seoul today: 21° / 14°');
  });

  it('local test alert always carries a deep link to the region alerts', () => {
    const c = buildLocalTestAlert({ id: 'mn-khovd', name: 'Khovd' });
    expect(c.data.deepLink).toBe('skycast://region/mn-khovd/alerts');
    expect(c.data.kind).toBe('test');
    expect(c.channelId).toBe(WEATHER_ALERTS_CHANNEL_ID);
  });
});
