import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { links } from '$lib/server/db';
import { rateLimitCheck } from '$lib/server/rate-limit';

export const POST: RequestHandler = async (event) => {
  const { request } = event;
  const rl = rateLimitCheck(event, 'reprocess');
  if (!rl.allowed) {
    return json(
      { error: 'rate_limited' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) } }
    );
  }

  if (process.env.NODE_ENV === 'production') return json({ error: 'Not allowed' }, { status: 403 });
  const token = env.DEV_API_TOKEN;
  if (token) {
    const reqToken = request.headers.get('x-dev-token');
    if (reqToken !== token) return json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await request.json().catch(() => ({}));
    const siteId = String(body?.siteId || '').trim();
    const url = String(body?.url || '').trim();
    if (!siteId || !url) return json({ error: 'Missing siteId or url' }, { status: 400 });

    const coll = await links();
    const now = new Date();
    const res = await coll.updateOne(
      { siteId, url },
      {
        $set: { status: 'pending', updatedAt: now },
        $unset: { leasedAt: '' },
        $setOnInsert: { createdAt: now, attempts: 0 }
      },
      { upsert: true }
    );

    return json({ ok: true, upserted: !!res.upsertedId, matchedCount: res.matchedCount });
  } catch {
    return json({ error: 'Failed to reprocess' }, { status: 500 });
  }
};
