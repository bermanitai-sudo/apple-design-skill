import type { VercelRequest, VercelResponse } from '@vercel/node';
import webpush from 'web-push';
import { dueAlarms } from '../../src/lib/alarmMath.js';
import { safeEqual } from '../_lib/http.js';
import { redis, storeConfigured } from '../_lib/store.js';
import { DEVICE_SET, deviceKey, sentKey, type Device } from '../_lib/devices.js';

const LOOKBACK_MIN = 4;

/** Runs every minute (Vercel Cron on Pro, or any external scheduler) and sends whatever is due. */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const secret = process.env.CRON_SECRET;
  const auth = String(req.headers.authorization ?? '');
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) return res.status(401).json({ error: 'Unauthorised' });
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !storeConfigured()) return res.status(503).json({ error: 'Push not configured' });
  webpush.setVapidDetails(VAPID_SUBJECT || 'mailto:owner@example.com', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

  const now = new Date();
  const ids = await redis<string[]>('SMEMBERS', DEVICE_SET);
  let sent = 0;

  for (const id of ids) {
    const raw = await redis<string | null>('GET', deviceKey(id));
    if (!raw) {
      await redis('SREM', DEVICE_SET, id);
      continue;
    }
    const device = JSON.parse(raw) as Device;
    const due: { key: string; title: string; body: string; url: string; tag: string }[] = [];

    for (const { alarm, key } of dueAlarms(device.alarms, device.timeZone, now, LOOKBACK_MIN)) {
      const at = now.getTime();
      due.push({
        key,
        title: alarm.label || 'Alarm',
        body: 'Tap to dismiss and start your timer.',
        url: `/?alarm=${alarm.id}&alarmKey=${encodeURIComponent(key)}&at=${at}`,
        tag: `alarm-${alarm.id}`,
      });
    }
    for (const r of device.reminders) {
      const late = now.getTime() - r.at;
      if (late >= 0 && late < LOOKBACK_MIN * 60_000) due.push({ key: r.key, title: r.title, body: r.body, url: r.url, tag: r.key });
    }

    for (const d of due) {
      // SET NX makes every alarm and reminder fire at most once, even when ticks overlap.
      const fresh = await redis<string | null>('SET', sentKey(id, d.key), '1', 'NX', 'EX', 3600);
      if (fresh !== 'OK') continue;
      try {
        await webpush.sendNotification(device.subscription, JSON.stringify({ title: d.title, body: d.body, url: d.url, tag: d.tag }), {
          TTL: 300,
          urgency: 'high',
        });
        sent++;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await redis('DEL', deviceKey(id));
          await redis('SREM', DEVICE_SET, id);
          break;
        }
        console.error('push failed', status);
      }
    }
  }
  return res.status(200).json({ ok: true, devices: ids.length, sent });
}
