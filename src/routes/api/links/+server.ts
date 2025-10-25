import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { links } from '$lib/server/db';

interface LinkListItem {
  _id: string;
  url: string;
  status: string;
  attempts: number;
  lastError?: string;
  updatedAt: Date;
  pageId?: string | null;
}

export const GET: RequestHandler = async ({ url }) => {
  const siteId = url.searchParams.get('siteId');
  if (!siteId) return json({ error: 'Missing siteId' }, { status: 400 });

  const status = url.searchParams.get('status');
  const page = Math.max(1, Number(url.searchParams.get('page') || '1'));
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') || '20')));
  const q = url.searchParams.get('q')?.trim();
  const sortByRaw = url.searchParams.get('sortBy') || 'updatedAt';
  const sortDirRaw = (url.searchParams.get('sortDir') || 'desc').toLowerCase();
  const allowedSort: Record<string, 1 | -1> = { url: 1, status: 1, attempts: 1, updatedAt: -1 };
  const sortField = Object.prototype.hasOwnProperty.call(allowedSort, sortByRaw) ? sortByRaw : 'updatedAt';
  const sortDir: 1 | -1 = sortDirRaw === 'asc' ? 1 : -1;

  const filter: Record<string, unknown> = { siteId };
  if (status) filter.status = status;
  if (q) filter.url = { $regex: q, $options: 'i' };

  const coll = await links();
  const total = await coll.countDocuments(filter);

  // Use aggregation to join with pages collection to include pageId when available
  const pipeline = [
    { $match: filter },
    { $sort: { [sortField]: sortDir } },
    { $skip: (page - 1) * limit },
    { $limit: limit },
    {
      $lookup: {
        from: 'pages',
        let: { siteId: '$siteId', url: '$url' },
        pipeline: [
          { $match: { $expr: { $and: [{ $eq: ['$siteId', '$$siteId'] }, { $eq: ['$url', '$$url'] }] } } },
          { $project: { _id: 1 } }
        ],
        as: 'pageMatch'
      }
    },
    {
      $addFields: {
        pageId: {
          $cond: [
            { $gt: [{ $size: '$pageMatch' }, 0] },
            { $toString: { $first: '$pageMatch._id' } },
            null
          ]
        }
      }
    },
    {
      $project: {
        _id: 1,
        url: 1,
        status: 1,
        attempts: 1,
        lastError: 1,
        updatedAt: 1,
        pageId: 1
      }
    }
  ];

  type RawItem = Omit<LinkListItem, '_id'> & { _id: unknown };
  const itemsRaw = await coll.aggregate<RawItem>(pipeline).toArray();
  const items: LinkListItem[] = itemsRaw.map((d) => ({ ...d, _id: String(d._id) }));

  return json({ page, limit, total, items });
};
