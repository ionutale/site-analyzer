import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { sites } from '$lib/server/db';

export const POST: RequestHandler = async ({ request }) => {
	const { siteId, schedule } = await request.json();
	if (!siteId || !['manual', 'daily', 'weekly', 'monthly'].includes(schedule)) {
		return json({ error: 'Invalid parameters' }, { status: 400 });
	}

	const coll = await sites();
	await coll.updateOne(
		{ siteId },
		{ $set: { schedule } },
		{ upsert: true }
	);

	return json({ success: true, schedule });
};
