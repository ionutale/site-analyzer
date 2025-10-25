import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { links } from '$lib/server/db';

export const GET: RequestHandler = async ({ url }) => {
  const siteId = url.searchParams.get('siteId');
  if (!siteId) return json({ error: 'Missing siteId' }, { status: 400 });

  const status = url.searchParams.get('status');
  const page = Math.max(1, Number(url.searchParams.get('page') || '1'));
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') || '20')));
  const q = url.searchParams.get('q')?.trim();

  const filter: Record<string, unknown> = { siteId };
  if (status) filter.status = status;
  if (q) filter.url = { $regex: q, $options: 'i' };

  const coll = await links();
  const total = await coll.countDocuments(filter);
  const items = await coll
    .find(filter, { projection: { _id: 1, url: 1, status: 1, attempts: 1, lastError: 1, updatedAt: 1 } })
    .sort({ updatedAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .toArray();

  return json({ page, limit, total, items: items.map((d) => ({ ...d, _id: String(d._id) })) });
};
