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

  // Use aggregation to join with pages collection to include pageId when available
  const pipeline = [
    { $match: filter },
    { $sort: { updatedAt: -1 } },
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

  const items = await coll.aggregate(pipeline).toArray();

  return json({
    page,
    limit,
    total,
    items: items.map((d: any) => ({ ...d, _id: String(d._id) }))
  });
};
