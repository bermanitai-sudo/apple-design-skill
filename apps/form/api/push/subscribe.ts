import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { methodOnly, requireAccess } from '../_lib/http.js';
import { redis, storeConfigured } from '../_lib/store.js';
import { DEVICE_SET, deviceKey, type Device } from '../_lib/devices.js';

const Time = z.string().regex(/^\d{2}:\d{2}$/);
const Body = z.union([
  z.object({ deviceId: z.string().uuid(), remove: z.literal(true) }),
  z.object({
    deviceId: z.string().uuid(),
    subscription: z.object({ endpoint: z.string().url(), keys: z.object({ p256dh: z.string(), auth: z.string() }) }),
    timeZone: z.string().max(64),
    alarms: z
      .array(
        z.object({
          id: z.number().int(),
          label: z.string().max(80),
          time: Time,
          days: z.array(z.number().int().min(0).max(6)).max(7),
          enabled: z.boolean(),
        }),
      )
      .max(50),
    reminders: z
      .array(
        z.object({
          key: z.string().max(120),
          at: z.number(),
          title: z.string().max(120),
          body: z.string().max(200),
          url: z.string().max(200),
        }),
      )
      .max(200),
  }),
]);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!methodOnly(req, res, 'POST') || !requireAccess(req, res)) return;
  if (!storeConfigured()) return res.status(503).json({ error: 'Background alarms are not configured on the server.' });
  const parsed = Body.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid schedule.' });
  const b = parsed.data;
  try {
    Intl.DateTimeFormat('en-US', { timeZone: 'timeZone' in b ? b.timeZone : 'UTC' });
  } catch {
    return res.status(400).json({ error: 'Unknown time zone.' });
  }
  if ('remove' in b) {
    await redis('DEL', deviceKey(b.deviceId));
    await redis('SREM', DEVICE_SET, b.deviceId);
    return res.status(200).json({ ok: true });
  }
  const device: Device = {
    subscription: b.subscription,
    timeZone: b.timeZone,
    alarms: b.alarms,
    reminders: b.reminders,
    updatedAt: Date.now(),
  };
  await redis('SET', deviceKey(b.deviceId), JSON.stringify(device));
  await redis('SADD', DEVICE_SET, b.deviceId);
  return res.status(200).json({ ok: true });
}
