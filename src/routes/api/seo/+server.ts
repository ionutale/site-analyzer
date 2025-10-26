import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { pages } from '$lib/server/db';

export const GET: RequestHandler = async ({ url }) => {
	const siteId = url.searchParams.get('siteId');
	if (!siteId) return json({ error: 'Missing siteId' }, { status: 400 });
	const slowMs = Math.max(0, Number(url.searchParams.get('slowMs') || '3000'));
	const minTitleLen = Math.max(0, Number(url.searchParams.get('minTitleLen') || '10'));
	const maxTitleLen = Math.max(minTitleLen, Number(url.searchParams.get('maxTitleLen') || '60'));
  const largeImageMinW = Math.max(0, Number(url.searchParams.get('largeImageMinW') || '1600'));
  const largeImageMinH = Math.max(0, Number(url.searchParams.get('largeImageMinH') || '1600'));
  const largeImageMinArea = Math.max(0, Number(url.searchParams.get('largeImageMinArea') || '2000000'));

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

	// a11y aggregates
	const a11yAgg = await coll
		.aggregate<{
			_id: null;
			pagesWithMissingAlt: number;
			totalMissingAlt: number;
			pagesWithAnchorNoText: number;
			totalAnchorsNoText: number;
			pagesWithNoH1: number;
			pagesWithMultipleH1: number;
		}>([
			{ $match: { siteId } },
			{
				$group: {
					_id: null,
					pagesWithMissingAlt: {
						$sum: { $cond: [{ $gt: ['$a11y.imagesMissingAlt', 0] }, 1, 0] }
					},
					totalMissingAlt: { $sum: { $ifNull: ['$a11y.imagesMissingAlt', 0] } },
					pagesWithAnchorNoText: {
						$sum: { $cond: [{ $gt: ['$a11y.anchorsWithoutText', 0] }, 1, 0] }
					},
					totalAnchorsNoText: { $sum: { $ifNull: ['$a11y.anchorsWithoutText', 0] } },
					pagesWithNoH1: { $sum: { $cond: [{ $eq: ['$a11y.h1Count', 0] }, 1, 0] } },
					pagesWithMultipleH1: { $sum: { $cond: [{ $gt: ['$a11y.h1Count', 1] }, 1, 0] } }
				}
			}
		])
		.toArray();

	const pagesMissingAltSamples = await coll
		.find(
			{ siteId, 'a11y.imagesMissingAlt': { $gt: 0 } },
			{ projection: { _id: 1, url: 1, 'a11y.imagesMissingAlt': 1 } }
		)
		.sort({ 'a11y.imagesMissingAlt': -1 })
		.limit(20)
		.toArray();
	const pagesAnchorNoTextSamples = await coll
		.find(
			{ siteId, 'a11y.anchorsWithoutText': { $gt: 0 } },
			{ projection: { _id: 1, url: 1, 'a11y.anchorsWithoutText': 1 } }
		)
		.sort({ 'a11y.anchorsWithoutText': -1 })
		.limit(20)
		.toArray();
	const pagesNoH1Samples = await coll
		.find(
			{ siteId, 'a11y.h1Count': 0 },
			{ projection: { _id: 1, url: 1, 'a11y.h1Count': 1 } }
		)
		.limit(20)
		.toArray();
	const pagesMultiH1Samples = await coll
		.find(
			{ siteId, 'a11y.h1Count': { $gt: 1 } },
			{ projection: { _id: 1, url: 1, 'a11y.h1Count': 1 } }
		)
		.sort({ 'a11y.h1Count': -1 })
		.limit(20)
		.toArray();

	// images aggregates
	const imagesAgg = await coll
		.aggregate<{
			_id: null;
			totalImages: number;
			largeImages: number;
			avif: number;
			webp: number;
			jpeg: number;
			jpg: number;
			png: number;
			gif: number;
			svg: number;
			other: number;
		}>([
			{ $match: { siteId } },
			{
				$group: {
					_id: null,
					totalImages: { $sum: { $ifNull: ['$imagesMeta.total', 0] } },
					largeImages: { $sum: { $ifNull: ['$imagesMeta.largeDimensions', 0] } },
					avif: { $sum: { $ifNull: ['$imagesMeta.counts.avif', 0] } },
					webp: { $sum: { $ifNull: ['$imagesMeta.counts.webp', 0] } },
					jpeg: { $sum: { $ifNull: ['$imagesMeta.counts.jpeg', 0] } },
					jpg: { $sum: { $ifNull: ['$imagesMeta.counts.jpg', 0] } },
					png: { $sum: { $ifNull: ['$imagesMeta.counts.png', 0] } },
					gif: { $sum: { $ifNull: ['$imagesMeta.counts.gif', 0] } },
					svg: { $sum: { $ifNull: ['$imagesMeta.counts.svg', 0] } },
					other: { $sum: { $ifNull: ['$imagesMeta.counts.other', 0] } }
				}
			}
		])
		.toArray();

	const sampleLargeImagesDocs = await coll
		.find(
			{ siteId, 'imagesMeta.sampleLarge.0': { $exists: true } },
			{ projection: { _id: 1, url: 1, 'imagesMeta.sampleLarge': 1 } }
		)
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
		thresholds: { slowMs, minTitleLen, maxTitleLen, largeImageMinW, largeImageMinH, largeImageMinArea },
		issues: {
			missingTitle,
			missingMeta,
			slow,
			non200,
			missingCanonical,
			titleTooShort,
			titleTooLong,
			a11y: {
				pagesWithMissingAlt: a11yAgg[0]?.pagesWithMissingAlt || 0,
				pagesWithAnchorNoText: a11yAgg[0]?.pagesWithAnchorNoText || 0,
				pagesWithNoH1: a11yAgg[0]?.pagesWithNoH1 || 0,
				pagesWithMultipleH1: a11yAgg[0]?.pagesWithMultipleH1 || 0
			},
			images: {
				totalImages: imagesAgg[0]?.totalImages || 0,
				largeImages: imagesAgg[0]?.largeImages || 0,
				formats: {
					avif: imagesAgg[0]?.avif || 0,
					webp: imagesAgg[0]?.webp || 0,
					jpeg: imagesAgg[0]?.jpeg || 0,
					jpg: imagesAgg[0]?.jpg || 0,
					png: imagesAgg[0]?.png || 0,
					gif: imagesAgg[0]?.gif || 0,
					svg: imagesAgg[0]?.svg || 0,
					other: imagesAgg[0]?.other || 0
				}
			},
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
			a11y: {
				missingAlt: pagesMissingAltSamples.map((d) => ({ ...d, _id: String(d._id) })),
				anchorsWithoutText: pagesAnchorNoTextSamples.map((d) => ({ ...d, _id: String(d._id) })),
				noH1: pagesNoH1Samples.map((d) => ({ ...d, _id: String(d._id) })),
				multipleH1: pagesMultiH1Samples.map((d) => ({ ...d, _id: String(d._id) }))
			},
			images: {
				largeImages: sampleLargeImagesDocs.flatMap((d: { url: string; imagesMeta?: { sampleLarge?: string[] } }) =>
					(d.imagesMeta?.sampleLarge?.slice(0, 5)?.map((u) => ({ pageUrl: d.url, imageUrl: u })) ?? [])
				)
			},
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
