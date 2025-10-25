import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { pages } from '$lib/server/db';

export const GET: RequestHandler = async ({ url }) => {
  const siteId = url.searchParams.get('siteId');
  if (!siteId) return json({ error: 'Missing siteId' }, { status: 400 });

  const page = Math.max(1, Number(url.searchParams.get('page') || '1'));
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') || '20')));
  const q = url.searchParams.get('q')?.trim();
  const sortByRaw = url.searchParams.get('sortBy') || 'fetchedAt';
  const sortDirRaw = (url.searchParams.get('sortDir') || 'desc').toLowerCase();
  const allowedSort: Record<string, 1 | -1> = { url: 1, title: 1, statusCode: 1, fetchedAt: -1 };
  const sortField = Object.prototype.hasOwnProperty.call(allowedSort, sortByRaw) ? sortByRaw : 'fetchedAt';
  const sortDir: 1 | -1 = sortDirRaw === 'asc' ? 1 : -1;

  const filter: Record<string, unknown> = { siteId };
  if (q) filter['$or'] = [
    { url: { $regex: q, $options: 'i' } },
    { title: { $regex: q, $options: 'i' } }
  ];

  const coll = await pages();
  const total = await coll.countDocuments(filter);
  const items = await coll
    .find(filter, { projection: { _id: 1, url: 1, title: 1, statusCode: 1, fetchedAt: 1, contentType: 1 } })
    .sort({ [sortField]: sortDir })
    .skip((page - 1) * limit)
    .limit(limit)
    .toArray();

  return json({
    page,
    limit,
    total,
    items: items.map((d) => ({ ...d, _id: String(d._id) }))
  });
};
