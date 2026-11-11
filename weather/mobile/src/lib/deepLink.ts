/**
 * Maps notification deep links to expo-router paths.
 *
 *   skycast://region/mn-ulaanbaatar          → /region/mn-ulaanbaatar
 *   skycast://region/mn-ulaanbaatar/alerts   → /region/mn-ulaanbaatar?tab=alerts
 *   skycast://alerts                          → /alerts
 *   skycast://settings                        → /settings
 *   skycast://                                → /
 *   https://skycast.example/region/kr-seoul   → /region/kr-seoul   (universal links)
 */
export type RouterPath = string;

const SAFE_ID = /^[a-z0-9][a-z0-9._-]{0,63}$/i;

export function parseDeepLink(url: string | null | undefined): RouterPath | null {
  if (!url) return null;
  let rest: string;
  const schemeMatch = /^([a-z][a-z0-9+.-]*):\/\/(.*)$/i.exec(url.trim());
  if (schemeMatch) {
    const scheme = (schemeMatch[1] ?? '').toLowerCase();
    rest = schemeMatch[2] ?? '';
    if (scheme === 'http' || scheme === 'https' || scheme === 'exp' || scheme === 'exps') {
      // Drop host for universal links / Expo Go URLs ("exp://host:port/--/region/x").
      const slash = rest.indexOf('/');
      rest = slash === -1 ? '' : rest.slice(slash + 1);
      rest = rest.replace(/^--\//, '');
    } else if (scheme !== 'skycast') {
      return null;
    }
  } else if (url.startsWith('/')) {
    rest = url.slice(1);
  } else {
    return null;
  }

  // Strip query/hash, split segments.
  const [pathPart] = rest.split(/[?#]/);
  const segments = (pathPart ?? '')
    .split('/')
    .map((s) => decodeURIComponent(s))
    .filter(Boolean);

  if (segments.length === 0) return '/';
  const [head, id, sub] = segments;

  switch (head) {
    case 'region': {
      if (!id || !SAFE_ID.test(id)) return null;
      if (sub === 'alerts') return `/region/${encodeURIComponent(id)}?tab=alerts`;
      if (sub && sub !== 'weather') return null;
      return `/region/${encodeURIComponent(id)}`;
    }
    case 'alerts':
      return '/alerts';
    case 'ai':
      return '/ai';
    case 'settings':
      return '/settings';
    case 'today':
    case 'index':
      return '/';
    default:
      return null;
  }
}

/** Build the canonical deep link for a region (what the backend emits). */
export function regionDeepLink(regionId: string, alerts = false): string {
  return `skycast://region/${encodeURIComponent(regionId)}${alerts ? '/alerts' : ''}`;
}

/** Extract a deepLink from a notification payload: data.deepLink first, then data.url. */
export function deepLinkFromNotificationData(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  const candidate = d.deepLink ?? d.url ?? d.link;
  return typeof candidate === 'string' && candidate.length > 0 ? candidate : null;
}
