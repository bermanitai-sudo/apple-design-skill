// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { parse, sendNotification } = vi.hoisted(() => ({ parse: vi.fn(), sendNotification: vi.fn() }));
vi.mock('@anthropic-ai/sdk', async (orig) => {
  const real = (await orig()) as { default: Record<string, unknown> };
  class Fake {
    beta = { messages: { parse } };
  }
  Object.assign(Fake, real.default);
  return { default: Fake };
});
vi.mock('web-push', () => ({ default: { setVapidDetails: vi.fn(), sendNotification } }));

import analyze from '../api/analyze-food';
import tick from '../api/cron/tick';
import subscribe from '../api/push/subscribe';

function mockRes() {
  const res: { statusCode: number; body: unknown; headers: Record<string, string> } & Record<string, unknown> = {
    statusCode: 0,
    body: null,
    headers: {},
  };
  res.status = (c: number) => ((res.statusCode = c), res);
  res.json = (b: unknown) => ((res.body = b), res);
  res.setHeader = (k: string, v: string) => (res.headers[k] = v);
  return res as never as { statusCode: number; body: Record<string, unknown> };
}
const req = (o: Record<string, unknown>) => ({ method: 'POST', headers: {}, body: {}, ...o }) as never;
const IMG = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';

beforeEach(() => {
  vi.unstubAllEnvs();
  parse.mockReset();
  sendNotification.mockReset();
  vi.stubEnv('APP_ACCESS_CODE', 'secret');
  vi.stubEnv('ANTHROPIC_API_KEY', 'test');
});

describe('analyze-food', () => {
  it('refuses requests without the access code', async () => {
    const res = mockRes();
    await analyze(req({ body: { image: IMG } }), res as never);
    expect(res.statusCode).toBe(401);
    expect(parse).not.toHaveBeenCalled();
  });
  it('fails closed when no access code is configured', async () => {
    vi.stubEnv('APP_ACCESS_CODE', '');
    const res = mockRes();
    await analyze(req({ headers: { 'x-form-access': '' }, body: { image: IMG } }), res as never);
    expect(res.statusCode).toBe(503);
  });
  it('rejects non-images', async () => {
    const res = mockRes();
    await analyze(req({ headers: { 'x-form-access': 'secret' }, body: { image: 'data:text/html;base64,AAAA' } }), res as never);
    expect(res.statusCode).toBe(400);
  });
  it('returns the structured estimate', async () => {
    const out = {
      is_food: true,
      items: [{ name: 'Rice', grams: 200, calories: 260, protein: 5, confidence: 'medium', note: '' }],
      question: '',
    };
    parse.mockResolvedValue({ stop_reason: 'end_turn', parsed_output: out });
    const res = mockRes();
    await analyze(req({ headers: { 'x-form-access': 'secret' }, body: { image: IMG } }), res as never);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual(out);
    const args = parse.mock.calls[0][0];
    expect(args.model).toBe('claude-opus-5-5');
    expect(args.messages[0].content[0]).toMatchObject({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg' } });
  });
  it('reports a refusal instead of guessing', async () => {
    parse.mockResolvedValue({ stop_reason: 'refusal', parsed_output: null });
    const res = mockRes();
    await analyze(req({ headers: { 'x-form-access': 'secret' }, body: { image: IMG } }), res as never);
    expect(res.statusCode).toBe(422);
  });
});

describe('push scheduler', () => {
  const store = new Map<string, string>();
  const sets = new Map<string, Set<string>>();
  beforeEach(() => {
    store.clear();
    sets.clear();
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://redis.test');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 't');
    vi.stubEnv('VAPID_PUBLIC_KEY', 'pub');
    vi.stubEnv('VAPID_PRIVATE_KEY', 'priv');
    vi.stubEnv('CRON_SECRET', 'cron');
    vi.stubGlobal('fetch', async (_u: string, init: { body: string }) => {
      const [cmd, key, ...rest] = JSON.parse(init.body) as string[];
      let result: unknown = null;
      if (cmd === 'SET') {
        if (rest.includes('NX') && store.has(key)) result = null;
        else store.set(key, rest[0]), (result = 'OK');
      } else if (cmd === 'GET') result = store.get(key) ?? null;
      else if (cmd === 'DEL') store.delete(key);
      else if (cmd === 'SADD') (sets.get(key) ?? sets.set(key, new Set()).get(key)!).add(rest[0]);
      else if (cmd === 'SREM') sets.get(key)?.delete(rest[0]);
      else if (cmd === 'SMEMBERS') result = [...(sets.get(key) ?? [])];
      return new Response(JSON.stringify({ result }));
    });
  });

  it('stores a schedule and sends a due alarm exactly once', async () => {
    const id = '0f8fad5b-d9cb-469f-a165-70867728950e';
    const res = mockRes();
    await subscribe(
      req({
        headers: { 'x-form-access': 'secret' },
        body: {
          deviceId: id,
          subscription: { endpoint: 'https://push.example/abc', keys: { p256dh: 'k', auth: 'a' } },
          timeZone: 'UTC',
          alarms: [{ id: 1, label: 'Wake', time: '07:00', days: [], enabled: true }],
          reminders: [],
        },
      }),
      res as never,
    );
    expect(res.statusCode).toBe(200);

    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-10T07:01:10Z'));
    const unauth = mockRes();
    await tick(req({ method: 'GET', headers: {} }), unauth as never);
    expect(unauth.statusCode).toBe(401);

    for (let i = 0; i < 2; i++) await tick(req({ method: 'GET', headers: { authorization: 'Bearer cron' } }), mockRes() as never);
    vi.useRealTimers();
    expect(sendNotification).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(sendNotification.mock.calls[0][1]);
    expect(payload.title).toBe('Wake');
    expect(payload.url).toContain('alarmKey=alarm%3A1%3A2026-11-10T07%3A00');
  });
});
