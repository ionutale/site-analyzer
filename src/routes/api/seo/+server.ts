import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { pages } from '$lib/server/db';

export const GET: RequestHandler = async ({ url }) => {
  const siteId = url.searchParams.get('siteId');
  if (!siteId) return json({ error: 'Missing siteId' }, { status: 400 });
  const slowMs = Math.max(0, Number(url.searchParams.get('slowMs') || '3000'));

  const coll = await pages();

  const total = await coll.countDocuments({ siteId });
  const missingTitle = await coll.countDocuments({ siteId, $or: [{ title: { $exists: false } }, { title: null }, { title: '' }] });
  const missingMeta = await coll.countDocuments({ siteId, $or: [{ metaDescription: { $exists: false } }, { metaDescription: null }, { metaDescription: '' }] });
  const slow = await coll.countDocuments({ siteId, loadTimeMs: { $gt: slowMs } });
  const non200 = await coll.countDocuments({ siteId, statusCode: { $ne: 200 } });

  // samples
  const slowPages = await coll
    .find({ siteId, loadTimeMs: { $gt: slowMs } }, { projection: { _id: 1, url: 1, title: 1, loadTimeMs: 1 } })
    .sort({ loadTimeMs: -1 })
    .limit(20)
    .toArray();
  const missingTitlePages = await coll
    .find({ siteId, $or: [{ title: { $exists: false } }, { title: null }, { title: '' }] }, { projection: { _id: 1, url: 1 } })
    .limit(20)
    .toArray();
  const missingMetaPages = await coll
    .find({ siteId, $or: [{ metaDescription: { $exists: false } }, { metaDescription: null }, { metaDescription: '' }] }, { projection: { _id: 1, url: 1 } })
    .limit(20)
    .toArray();
  const non200Pages = await coll
    .find({ siteId, statusCode: { $ne: 200 } }, { projection: { _id: 1, url: 1, statusCode: 1 } })
    .sort({ statusCode: -1 })
    .limit(20)
    .toArray();

  return json({
    siteId,
    total,
    thresholds: { slowMs },
    issues: {
      missingTitle,
      missingMeta,
      slow,
      non200
    },
    samples: {
      slowPages: slowPages.map((d) => ({ ...d, _id: String(d._id) })),
      missingTitlePages: missingTitlePages.map((d) => ({ ...d, _id: String(d._id) })),
      missingMetaPages: missingMetaPages.map((d) => ({ ...d, _id: String(d._id) })),
      non200Pages: non200Pages.map((d) => ({ ...d, _id: String(d._id) }))
    }
  });
};
