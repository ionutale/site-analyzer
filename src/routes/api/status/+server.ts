import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { links } from '$lib/server/db';

export const GET: RequestHandler = async ({ url }) => {
	const siteId = url.searchParams.get('siteId');
	if (!siteId) return json({ error: 'Missing siteId' }, { status: 400 });

	const coll = await links();
	const pipeline = [{ $match: { siteId } }, { $group: { _id: '$status', count: { $sum: 1 } } }];

	const stats = new Map<string, number>();
	for await (const doc of coll.aggregate<{ _id: string; count: number }>(pipeline)) {
		stats.set(doc._id, doc.count);
	}

	const pending = stats.get('pending') || 0;
	const in_progress = stats.get('in_progress') || 0;
	const done = stats.get('done') || 0;
	const error = stats.get('error') || 0;
	const total = pending + in_progress + done + error;

	return json({ siteId, pending, in_progress, done, error, total });
};
