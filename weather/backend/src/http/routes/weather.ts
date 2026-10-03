import type { FastifyInstance } from 'fastify';
import type { Container } from '../../container.js';
import { NotFoundError } from '../../errors.js';
import { envelope, sendCached } from '../reply.js';
import { compareQuery, coordsQuery, idParams, nationQuery, parse, predictQuery, searchQuery } from '../schemas.js';

export function weatherRoutes(app: FastifyInstance, c: Container): void {
  const s = c.services;

  app.get('/locations/search', async (req, reply) => {
    const q = parse(searchQuery, req.query);
    return sendCached(reply, await s.locations.search(q.q, q.limit));
  });

  app.get('/locations/reverse', async (req, reply) => {
    const q = parse(coordsQuery, req.query);
    return sendCached(reply, await s.locations.reverse(q));
  });

  app.get('/weather', async (req, reply) => {
    const q = parse(coordsQuery, req.query);
    return sendCached(reply, await s.weather.getToday(q));
  });

  app.get('/air', async (req, reply) => {
    const q = parse(coordsQuery, req.query);
    return sendCached(reply, await s.air.getReport(q));
  });

  app.get('/compare', async (req, reply) => {
    const q = parse(compareQuery, req.query);
    return sendCached(reply, await s.compare.getComparison({ lat: q.lat, lon: q.lon }, q.models));
  });

  app.get('/nation', async (req, reply) => {
    const q = parse(nationQuery, req.query);
    return sendCached(reply, await s.nation.getSnapshot(q.region));
  });

  app.get('/predict', async (req, reply) => {
    const q = parse(predictQuery, req.query);
    return sendCached(reply, await s.predict.get({ lat: q.lat, lon: q.lon }, q.hours));
  });

  app.get('/regions', async (_req, reply) => {
    reply.header('Cache-Control', 'public, max-age=86400');
    return envelope(s.regions.list());
  });

  app.get('/regions/:id/alerts', async (req, reply) => {
    const { id } = parse(idParams, req.params);
    const region = s.regions.get(id);
    if (!region) throw new NotFoundError(`region ${id} not found`);
    const cond = await s.regionAlerts.conditions(region);
    reply.header('Cache-Control', `public, max-age=${cond.maxAge}`);
    reply.header('X-Cache', cond.cache);
    return { data: { alerts: cond.alerts, risks: cond.risks, air: cond.air }, meta: cond.meta };
  });
}
