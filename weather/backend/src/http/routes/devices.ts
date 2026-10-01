import type { FastifyInstance } from 'fastify';
import type { Container } from '../../container.js';
import type { DeviceRegistration } from '../../types.js';
import type { DevicePatch } from '../../notifications/repositories.js';
import { envelope, noStore } from '../reply.js';
import { devicePatchSchema, deviceRegistrationSchema, idParams, parse } from '../schemas.js';

export function deviceRoutes(app: FastifyInstance, c: Container): void {
  const devices = c.services.devices;

  app.post('/devices', async (req, reply) => {
    noStore(reply);
    const body = parse(deviceRegistrationSchema, req.body) as DeviceRegistration;
    const { device, created } = await devices.register(body);
    return reply.status(created ? 201 : 200).send(envelope(device));
  });

  app.get('/devices/:id', async (req, reply) => {
    noStore(reply);
    const { id } = parse(idParams, req.params);
    return envelope(await devices.get(id));
  });

  app.patch('/devices/:id', async (req, reply) => {
    noStore(reply);
    const { id } = parse(idParams, req.params);
    const patch = parse(devicePatchSchema, req.body) as DevicePatch;
    return envelope(await devices.patch(id, patch));
  });

  app.delete('/devices/:id', async (req, reply) => {
    noStore(reply);
    const { id } = parse(idParams, req.params);
    await devices.delete(id);
    return reply.status(204).send();
  });

  app.get('/devices/:id/notifications', async (req, reply) => {
    noStore(reply);
    const { id } = parse(idParams, req.params);
    return envelope(await devices.notifications(id));
  });

  app.post('/devices/:id/test-notification', async (req, reply) => {
    noStore(reply);
    const { id } = parse(idParams, req.params);
    return envelope(await devices.sendTest(id), c.notifications.push.name === 'expo' ? 'expo-push' : 'log-push');
  });
}
