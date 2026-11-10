import type { VercelRequest, VercelResponse } from '@vercel/node';
import { storeConfigured } from '../_lib/store.js';

/** Tells the app whether background alarms can be enabled. The VAPID public key is public by design. */
export default function handler(_req: VercelRequest, res: VercelResponse) {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const enabled = !!publicKey && !!process.env.VAPID_PRIVATE_KEY && storeConfigured() && !!process.env.CRON_SECRET;
  res.status(200).json(enabled ? { enabled, publicKey } : { enabled: false });
}
