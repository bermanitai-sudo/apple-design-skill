/** Minimal Upstash Redis REST client: the alarm schedule is the only thing stored server-side. */
const url = () => process.env.UPSTASH_REDIS_REST_URL;
const token = () => process.env.UPSTASH_REDIS_REST_TOKEN;

export const storeConfigured = () => !!url() && !!token();

export async function redis<T = unknown>(...cmd: (string | number)[]): Promise<T> {
  const res = await fetch(url()!, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token()}`, 'content-type': 'application/json' },
    body: JSON.stringify(cmd),
  });
  const json = (await res.json()) as { result?: T; error?: string };
  if (!res.ok || json.error) throw new Error(`Store error: ${json.error ?? res.status}`);
  return json.result as T;
}
