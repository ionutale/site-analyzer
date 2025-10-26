import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import crypto from 'node:crypto';
import { links } from '$lib/server/db';
import { rateLimitCheck } from '$lib/server/rate-limit';

export const POST: RequestHandler = async (event) => {
  const { request } = event;
  const rl = rateLimitCheck(event, 'refetch-site');
  if (!rl.allowed) {
    return json(
      { error: 'rate_limited' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) } }
    );
  }
  const body = await request.json().catch(() => ({}));
  const siteId = String(body?.siteId || '').trim();
  if (!siteId) return json({ error: 'Missing siteId' }, { status: 400 });

  const ingestId = crypto.randomUUID();
  const coll = await links();
  const now = new Date();
  const res = await coll.updateMany(
    { siteId },
    {
      $set: { status: 'pending', updatedAt: now, ingestId, attempts: 0 },
      $unset: { leasedAt: '', lastError: '' }
    }
  );

  return json({ ok: true, siteId, ingestId, matched: res.matchedCount, modified: res.modifiedCount });
};
