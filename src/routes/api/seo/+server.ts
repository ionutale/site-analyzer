import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { pages } from '$lib/server/db';

export const GET: RequestHandler = async ({ url }) => {
	const siteId = url.searchParams.get('siteId');
	if (!siteId) return json({ error: 'Missing siteId' }, { status: 400 });
	const slowMs = Math.max(0, Number(url.searchParams.get('slowMs') || '3000'));
	const minTitleLen = Math.max(0, Number(url.searchParams.get('minTitleLen') || '10'));
	const maxTitleLen = Math.max(minTitleLen, Number(url.searchParams.get('maxTitleLen') || '60'));

	const coll = await pages();

	const total = await coll.countDocuments({ siteId });
	const missingTitle = await coll.countDocuments({
		siteId,
		$or: [{ title: { $exists: false } }, { title: null }, { title: '' }]
	});
	const missingMeta = await coll.countDocuments({
		siteId,
		$or: [
			{ metaDescription: { $exists: false } },
			{ metaDescription: null },
			{ metaDescription: '' }
		]
	});
	const slow = await coll.countDocuments({ siteId, loadTimeMs: { $gt: slowMs } });
	const non200 = await coll.countDocuments({ siteId, statusCode: { $ne: 200 } });
	const missingCanonical = await coll.countDocuments({
		siteId,
		$or: [{ canonicalUrl: { $exists: false } }, { canonicalUrl: null }, { canonicalUrl: '' }]
	});
	const titleTooShort = await coll.countDocuments({
		siteId,
		titleLength: { $gt: 0, $lt: minTitleLen }
	});
	const titleTooLong = await coll.countDocuments({ siteId, titleLength: { $gt: maxTitleLen } });

	// samples
	const slowPages = await coll
		.find(
			{ siteId, loadTimeMs: { $gt: slowMs } },
			{ projection: { _id: 1, url: 1, title: 1, loadTimeMs: 1 } }
		)
		.sort({ loadTimeMs: -1 })
		.limit(20)
		.toArray();
	const missingTitlePages = await coll
		.find(
			{ siteId, $or: [{ title: { $exists: false } }, { title: null }, { title: '' }] },
			{ projection: { _id: 1, url: 1 } }
		)
		.limit(20)
		.toArray();
	const missingMetaPages = await coll
		.find(
			{
				siteId,
				$or: [
					{ metaDescription: { $exists: false } },
					{ metaDescription: null },
					{ metaDescription: '' }
				]
			},
			{ projection: { _id: 1, url: 1 } }
		)
		.limit(20)
		.toArray();
	const non200Pages = await coll
		.find({ siteId, statusCode: { $ne: 200 } }, { projection: { _id: 1, url: 1, statusCode: 1 } })
		.sort({ statusCode: -1 })
		.limit(20)
		.toArray();
	const missingCanonicalPages = await coll
		.find(
			{
				siteId,
				$or: [{ canonicalUrl: { $exists: false } }, { canonicalUrl: null }, { canonicalUrl: '' }]
			},
			{ projection: { _id: 1, url: 1 } }
		)
		.limit(20)
		.toArray();
	const shortTitlePages = await coll
		.find(
			{ siteId, titleLength: { $gt: 0, $lt: minTitleLen } },
			{ projection: { _id: 1, url: 1, title: 1, titleLength: 1 } }
		)
		.sort({ titleLength: 1 })
		.limit(20)
		.toArray();
	const longTitlePages = await coll
		.find(
			{ siteId, titleLength: { $gt: maxTitleLen } },
			{ projection: { _id: 1, url: 1, title: 1, titleLength: 1 } }
		)
		.sort({ titleLength: -1 })
		.limit(20)
		.toArray();

	// duplicate content by contentHash (based on normalized textContent)
	const dupContentAgg = await coll
		.aggregate<{
			_id: string;
			count: number;
			urls: string[];
		}>([
			{ $match: { siteId, contentHash: { $exists: true, $nin: [null, ''] } } },
			{ $group: { _id: '$contentHash', count: { $sum: 1 }, urls: { $addToSet: '$url' } } },
			{ $match: { count: { $gt: 1 } } },
			{ $sort: { count: -1 } },
			{ $limit: 20 }
		])
		.toArray();

	// duplicate titles
	const dupTitleAgg = await coll
		.aggregate<{
			_id: string;
			count: number;
			urls: string[];
			title: string;
		}>([
			{ $match: { siteId, title: { $exists: true, $nin: [null, ''] } } },
			{
				$group: {
					_id: { $toLower: { $trim: { input: '$title' } } },
					count: { $sum: 1 },
					urls: { $addToSet: '$url' },
					title: { $first: '$title' }
				}
			},
			{ $match: { count: { $gt: 1 } } },
			{ $sort: { count: -1 } },
			{ $limit: 20 }
		])
		.toArray();

	// duplicate meta descriptions
	const dupMetaAgg = await coll
		.aggregate<{
			_id: string;
			count: number;
			urls: string[];
			metaDescription: string;
		}>([
			{ $match: { siteId, metaDescription: { $exists: true, $nin: [null, ''] } } },
			{
				$group: {
					_id: { $toLower: { $trim: { input: '$metaDescription' } } },
					count: { $sum: 1 },
					urls: { $addToSet: '$url' },
					metaDescription: { $first: '$metaDescription' }
				}
			},
			{ $match: { count: { $gt: 1 } } },
			{ $sort: { count: -1 } },
			{ $limit: 20 }
		])
		.toArray();

	return json({
		siteId,
		total,
		thresholds: { slowMs, minTitleLen, maxTitleLen },
		issues: {
			missingTitle,
			missingMeta,
			slow,
			non200,
			missingCanonical,
			titleTooShort,
			titleTooLong,
			duplicateTitles: dupTitleAgg.reduce((acc, d) => acc + (d.count - 1), 0),
			duplicateMeta: dupMetaAgg.reduce((acc, d) => acc + (d.count - 1), 0),
			duplicateContent: dupContentAgg.reduce((acc, d) => acc + (d.count - 1), 0)
		},
		samples: {
			slowPages: slowPages.map((d) => ({ ...d, _id: String(d._id) })),
			missingTitlePages: missingTitlePages.map((d) => ({ ...d, _id: String(d._id) })),
			missingMetaPages: missingMetaPages.map((d) => ({ ...d, _id: String(d._id) })),
			non200Pages: non200Pages.map((d) => ({ ...d, _id: String(d._id) })),
			missingCanonicalPages: missingCanonicalPages.map((d) => ({ ...d, _id: String(d._id) })),
			shortTitlePages: shortTitlePages.map((d) => ({ ...d, _id: String(d._id) })),
			longTitlePages: longTitlePages.map((d) => ({ ...d, _id: String(d._id) })),
			duplicateTitles: dupTitleAgg.map((d) => ({
				key: d._id,
				count: d.count,
				urls: d.urls.slice(0, 5),
				title: d.title
			})),
			duplicateMeta: dupMetaAgg.map((d) => ({
				key: d._id,
				count: d.count,
				urls: d.urls.slice(0, 5),
				metaDescription: d.metaDescription
			})),
			duplicateContent: dupContentAgg.map((d) => ({
				key: d._id,
				count: d.count,
				urls: d.urls.slice(0, 5)
			}))
		}
	});
};
