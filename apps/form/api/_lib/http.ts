import type { VercelRequest, VercelResponse } from '@vercel/node';
import { timingSafeEqual } from 'node:crypto';

export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Refuses requests that do not carry the private access code. Fails closed when the code is unset. */
export function requireAccess(req: VercelRequest, res: VercelResponse): boolean {
  const code = process.env.APP_ACCESS_CODE;
  if (!code) {
    res.status(503).json({ error: 'Server is missing APP_ACCESS_CODE. Set it in your hosting environment variables.' });
    return false;
  }
  const sent = String(req.headers['x-form-access'] ?? '');
  if (!safeEqual(sent, code)) {
    res.status(401).json({ error: 'Access code missing or wrong.' });
    return false;
  }
  return true;
}

export function methodOnly(req: VercelRequest, res: VercelResponse, method: string): boolean {
  if (req.method !== method) {
    res.setHeader('Allow', method);
    res.status(405).json({ error: `Use ${method}.` });
    return false;
  }
  return true;
}
