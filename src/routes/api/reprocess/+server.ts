import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { links } from '$lib/server/db';

export const POST: RequestHandler = async ({ request }) => {
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
