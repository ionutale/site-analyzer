import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { links } from '$lib/server/db';

export const GET: RequestHandler = async () => {
	const coll = await links();
	const pipeline = [
		{
			$group: {
				_id: '$siteId',
				total: { $sum: 1 },
				pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
				in_progress: { $sum: { $cond: [{ $eq: ['$status', 'in_progress'] }, 1, 0] } },
				done: { $sum: { $cond: [{ $eq: ['$status', 'done'] }, 1, 0] } },
				error: { $sum: { $cond: [{ $eq: ['$status', 'error'] }, 1, 0] } },
				lastUpdated: { $max: '$updatedAt' }
			}
		},
		{ $sort: { lastUpdated: -1 } }
	];
	const items = await coll.aggregate(pipeline).toArray();
	return json(
		items.map((d) => ({
			siteId: String(d._id),
			total: d.total,
			pending: d.pending,
			in_progress: d.in_progress,
			done: d.done,
			error: d.error,
			lastUpdated: d.lastUpdated
		}))
	);
};
