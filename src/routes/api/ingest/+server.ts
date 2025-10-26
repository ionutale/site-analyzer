import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { collectSitemapUrls, normalizeSiteId } from '$lib/server/sitemap';
import { links } from '$lib/server/db';
import type { BulkWriteResult } from 'mongodb';

const BodySchema = z.object({ siteUrl: z.string().url() });

export const POST: RequestHandler = async ({ request }) => {
	const raw = await request.json().catch(() => null);
	const parsed = BodySchema.safeParse(raw);
	if (!parsed.success) {
		return json({ error: 'Invalid body' }, { status: 400 });
	}

	const { siteUrl } = parsed.data;
	const siteId = normalizeSiteId(siteUrl);

	// Collect URLs from sitemap(s)
	const urls = await collectSitemapUrls(siteUrl);

	const now = new Date();
	const total = urls.length;
	const ops = urls.map((url, i) => {
		// Assign per-item timestamps so UI default order (updatedAt desc) matches sitemap order.
		// First URL gets latest ts, last URL gets earliest.
		const ts = new Date(now.getTime() + (total - 1 - i));
		return {
		updateOne: {
			filter: { siteId, url },
			update: {
				$setOnInsert: {
					siteId,
					url,
					status: 'pending' as const,
					attempts: 0,
					createdAt: ts
				},
				$set: { updatedAt: ts }
			},
			upsert: true
		}
	};
	});

	const coll = await links();
	const result: BulkWriteResult | { upsertedCount: number } = ops.length
		? await coll.bulkWrite(ops, { ordered: false })
		: { upsertedCount: 0 };

	const pendingTotal = await coll.countDocuments({ siteId, status: 'pending' });

	const upserted = 'upsertedCount' in result ? result.upsertedCount : 0;
	return json({ siteId, discovered: urls.length, upserted, pendingTotal });
};
