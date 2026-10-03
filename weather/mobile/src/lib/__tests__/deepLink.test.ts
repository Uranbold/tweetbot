import { deepLinkFromNotificationData, parseDeepLink, regionDeepLink } from '../deepLink';

describe('parseDeepLink', () => {
  it('maps region deep links to router paths', () => {
    expect(parseDeepLink('skycast://region/mn-ulaanbaatar')).toBe('/region/mn-ulaanbaatar');
    expect(parseDeepLink('skycast://region/mn-ulaanbaatar/alerts')).toBe('/region/mn-ulaanbaatar?tab=alerts');
    expect(parseDeepLink('skycast://region/kr-seoul/weather')).toBe('/region/kr-seoul');
  });

  it('maps top-level targets', () => {
    expect(parseDeepLink('skycast://')).toBe('/');
    expect(parseDeepLink('skycast://alerts')).toBe('/alerts');
    expect(parseDeepLink('skycast://settings')).toBe('/settings');
    expect(parseDeepLink('skycast://ai?x=1')).toBe('/ai');
  });

  it('accepts universal / Expo Go URLs and plain paths', () => {
    expect(parseDeepLink('https://skycast.example/region/kr-seoul/alerts')).toBe('/region/kr-seoul?tab=alerts');
    expect(parseDeepLink('exp://192.168.0.2:8081/--/region/kr-seoul')).toBe('/region/kr-seoul');
    expect(parseDeepLink('/region/kr-seoul')).toBe('/region/kr-seoul');
  });

  it('rejects unknown schemes, hosts and unsafe ids', () => {
    expect(parseDeepLink('mailto:x@y')).toBeNull();
    expect(parseDeepLink('otherapp://region/x')).toBeNull();
    expect(parseDeepLink('skycast://region/')).toBeNull();
    expect(parseDeepLink('skycast://region/../etc')).toBeNull();
    expect(parseDeepLink('skycast://region/kr-seoul/unknown')).toBeNull();
    expect(parseDeepLink('skycast://nope')).toBeNull();
    expect(parseDeepLink(null)).toBeNull();
    expect(parseDeepLink('')).toBeNull();
  });

  it('round-trips the canonical link the backend emits', () => {
    expect(parseDeepLink(regionDeepLink('mn-khovd', true))).toBe('/region/mn-khovd?tab=alerts');
    expect(parseDeepLink(regionDeepLink('mn-khovd'))).toBe('/region/mn-khovd');
  });
});

describe('deepLinkFromNotificationData', () => {
  it('reads deepLink, then url, then link', () => {
    expect(deepLinkFromNotificationData({ deepLink: 'skycast://alerts' })).toBe('skycast://alerts');
    expect(deepLinkFromNotificationData({ url: 'skycast://settings' })).toBe('skycast://settings');
    expect(deepLinkFromNotificationData({ link: 'skycast://ai' })).toBe('skycast://ai');
    expect(deepLinkFromNotificationData({ deepLink: '' })).toBeNull();
    expect(deepLinkFromNotificationData(undefined)).toBeNull();
    expect(deepLinkFromNotificationData('string')).toBeNull();
  });
});
