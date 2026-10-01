import { z } from 'zod';

export const PROVIDER_MODES = ['live', 'mock', 'auto'] as const;
export type ProviderMode = (typeof PROVIDER_MODES)[number];

const int = (def: number, min = 0, max = Number.MAX_SAFE_INTEGER) =>
  z.coerce.number().int().min(min).max(max).default(def);

const bool = (def: boolean) =>
  z
    .enum(['true', 'false', '1', '0', 'yes', 'no'])
    .default(def ? 'true' : 'false')
    .transform((v) => v === 'true' || v === '1' || v === 'yes');

const schema = z.object({
  NODE_ENV: z.string().default('development'),
  PORT: int(8787, 0, 65535),
  HOST: z.string().default('0.0.0.0'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  PROVIDER_MODE: z.enum(PROVIDER_MODES).default('auto'),
  UPSTREAM_TIMEOUT_MS: int(6000, 100, 120_000),
  /** After a fallback-worthy upstream failure, skip the live provider for this long (auto mode). */
  UPSTREAM_COOLDOWN_MS: int(60_000, 0),
  CACHE_TTL_WEATHER: int(600, 1),
  CACHE_TTL_AIR: int(1800, 1),
  CACHE_TTL_COMPARE: int(3600, 1),
  CACHE_TTL_NATION: int(900, 1),
  CACHE_TTL_GEOCODE: int(86_400, 1),
  CACHE_TTL_PREDICT: int(1800, 1),
  /** TTL for responses produced by the mock fallback in auto mode, so live data returns quickly. */
  CACHE_TTL_MOCK_FALLBACK: int(120, 1),
  /** How long an expired entry is retained for stale-while-error (BR-08: 6 h). */
  CACHE_STALE_TTL: int(21_600, 0),
  CACHE_MAX_ENTRIES: int(5000, 1),
  /** Comma-separated allow-list, or "*" for any origin. */
  CORS_ORIGIN: z.string().default('*'),
  RATE_LIMIT_MAX: int(120, 1),
  RATE_LIMIT_WINDOW_MS: int(60_000, 1000),
  TRUST_PROXY: bool(false),
  AI_SERVICE_URL: z.string().url().default('http://localhost:8790'),
  /** The AI service trains a model on the first request per location (~3.5–5 s), so it gets its own timeout. */
  AI_TIMEOUT_MS: int(12_000, 100, 120_000),
  PUSH_MODE: z.enum(['log', 'expo']).default('log'),
  EXPO_ACCESS_TOKEN: z.string().optional(),
  DISPATCH_ENABLED: bool(true),
  DISPATCH_INTERVAL_MS: int(600_000, 1000),
});

export type Config = z.infer<typeof schema>;

export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  // Treat empty strings as unset so `FOO=` falls back to the default.
  const cleaned = Object.fromEntries(Object.entries(env).filter(([, v]) => v !== undefined && v !== ''));
  const parsed = schema.safeParse(cleaned);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid configuration: ${issues}`);
  }
  return parsed.data;
}

export function corsOrigins(config: Pick<Config, 'CORS_ORIGIN'>): true | string[] {
  const raw = config.CORS_ORIGIN.trim();
  if (raw === '*') return true;
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}
