import { z } from 'zod';
import type { AlertType, ModelId } from '../types.js';
import { MODEL_IDS } from '../domain/models.js';
import { BadRequestError } from '../errors.js';

const NUMERIC = /^[-+]?(\d+(\.\d*)?|\.\d+)$/;

/** Query-string number in [min, max]; rejects "", "abc", "1e400", arrays. */
const numberParam = (name: string, min: number, max: number) =>
  z
    .string({ error: `${name} is required` })
    .trim()
    .regex(NUMERIC, `${name} must be a number`)
    .transform(Number)
    .pipe(z.number().min(min, `${name} must be between ${min} and ${max}`).max(max, `${name} must be between ${min} and ${max}`));

const intParam = (name: string, min: number, max: number) =>
  z
    .string()
    .trim()
    .regex(/^\d+$/, `${name} must be an integer`)
    .transform(Number)
    .pipe(z.number().int().min(min, `${name} must be between ${min} and ${max}`).max(max, `${name} must be between ${min} and ${max}`));

export const coordsQuery = z.object({
  lat: numberParam('lat', -90, 90),
  lon: numberParam('lon', -180, 180),
});

export const searchQuery = z.object({
  q: z
    .string({ error: 'q is required' })
    .trim()
    .min(1, 'q must be 1–100 characters')
    .max(100, 'q must be 1–100 characters'),
  limit: intParam('limit', 1, 20).optional().default(8),
});

export const compareQuery = coordsQuery.extend({
  models: z
    .string()
    .optional()
    .transform((s, ctx) => {
      if (s === undefined || s.trim() === '') return [...MODEL_IDS];
      const ids = [...new Set(s.split(',').map((x) => x.trim().toLowerCase()).filter(Boolean))];
      const bad = ids.filter((x) => !(MODEL_IDS as string[]).includes(x));
      if (bad.length || ids.length === 0) {
        ctx.addIssue({ code: 'custom', message: `unknown models: ${bad.join(', ')} (allowed: ${MODEL_IDS.join(', ')})` });
        return z.NEVER;
      }
      return ids as ModelId[];
    }),
});

export const nationQuery = z.object({
  region: z.enum(['mn', 'kr', 'world'], { error: 'region must be one of mn, kr, world' }).optional().default('mn'),
});

export const predictQuery = coordsQuery.extend({
  hours: intParam('hours', 1, 240).optional().default(72),
});

export const idParams = z.object({ id: z.string().trim().min(1).max(128) });

// ---------- Notifications ----------

export const ALERT_TYPES = ['heat-wave', 'cold-wave', 'heavy-rain', 'heavy-snow', 'strong-wind', 'dry', 'fine-dust', 'typhoon'] as const satisfies readonly AlertType[];
const hour = z.number().int().min(0).max(23);

const prefFields = {
  alertTypes: z.array(z.enum(ALERT_TYPES)).max(ALERT_TYPES.length).transform((xs) => [...new Set(xs)]),
  minSeverity: z.enum(['advisory', 'warning']),
  aiRiskThreshold: z.number().min(0).max(1),
  dailyBriefingHour: hour.nullable(),
  airGradeThreshold: z.enum(['good', 'moderate', 'bad', 'very-bad']).nullable(),
  quietHours: z.object({ start: hour, end: hour }).nullable(),
  locale: z.enum(['en', 'mn', 'ko']),
};

export const preferencesSchema = z.object({
  alertTypes: prefFields.alertTypes.default([...ALERT_TYPES]),
  minSeverity: prefFields.minSeverity.default('advisory'),
  aiRiskThreshold: prefFields.aiRiskThreshold.default(0.6),
  dailyBriefingHour: prefFields.dailyBriefingHour.default(null),
  airGradeThreshold: prefFields.airGradeThreshold.default('bad'),
  quietHours: prefFields.quietHours.default(null),
  locale: prefFields.locale.default('en'),
});

const deviceFields = {
  pushToken: z.string({ error: 'pushToken is required' }).trim().min(1, 'pushToken must not be empty').max(512),
  platform: z.enum(['ios', 'android', 'web'], { error: 'platform must be one of ios, android, web' }),
  regionIds: z.array(z.string().trim().min(1)).max(50).transform((xs) => [...new Set(xs)]),
  lastLocation: z.object({ lat: z.number().min(-90).max(90), lon: z.number().min(-180).max(180) }),
  followLocation: z.boolean(),
  appVersion: z.string().trim().max(64),
};

export const deviceRegistrationSchema = z
  .object({
    pushToken: deviceFields.pushToken,
    platform: deviceFields.platform,
    regionIds: deviceFields.regionIds.default([]),
    lastLocation: deviceFields.lastLocation.optional(),
    followLocation: deviceFields.followLocation.default(false),
    preferences: preferencesSchema.prefault({}),
    appVersion: deviceFields.appVersion.optional(),
  })
  .refine((d) => d.regionIds.length > 0 || (d.followLocation && d.lastLocation), {
    message: 'regionIds must not be empty unless followLocation is true and lastLocation is set',
    path: ['regionIds'],
  });

export const devicePatchSchema = z.object({
  pushToken: deviceFields.pushToken.optional(),
  platform: deviceFields.platform.optional(),
  regionIds: deviceFields.regionIds.optional(),
  lastLocation: deviceFields.lastLocation.optional(),
  followLocation: deviceFields.followLocation.optional(),
  appVersion: deviceFields.appVersion.optional(),
  preferences: z.object(prefFields).partial().optional(),
});

/** Parse or throw a 400 with a readable message ("lat: lat must be between -90 and 90"). */
export function parse<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const r = schema.safeParse(input ?? {});
  if (r.success) return r.data;
  const msg = r.error.issues
    .slice(0, 5)
    .map((i) => {
      const path = i.path.join('.');
      return path && !i.message.startsWith(path) ? `${path}: ${i.message}` : i.message;
    })
    .join('; ');
  throw new BadRequestError(msg || 'invalid request');
}
