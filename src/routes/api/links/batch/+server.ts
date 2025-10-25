import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { links } from '$lib/server/db';
import { ObjectId } from 'mongodb';

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json().catch(() => null);
	if (!body) return json({ error: 'Invalid JSON' }, { status: 400 });
	const { siteId, ids, action } = body as {
		siteId?: string;
		ids?: string[];
		action?: 'retry' | 'purge';
	};
	if (!siteId || !Array.isArray(ids) || ids.length === 0 || !action) {
		return json({ error: 'Missing siteId, ids, or action' }, { status: 400 });
	}
	const _ids: ObjectId[] = [];
	for (const s of ids) {
		try {
			_ids.push(new ObjectId(s));
		} catch {
			// ignore invalid ids
		}
	}
	if (_ids.length === 0) return json({ error: 'No valid ids' }, { status: 400 });

	const coll = await links();
	if (action === 'retry') {
		const res = await coll.updateMany(
			{ _id: { $in: _ids }, siteId },
			{ $set: { status: 'pending', attempts: 0 }, $unset: { leasedAt: '', lastError: '' } }
		);
		return json({ ok: true, modified: res.modifiedCount });
	}
	if (action === 'purge') {
		const res = await coll.deleteMany({ _id: { $in: _ids }, siteId, status: 'error' });
		return json({ ok: true, deleted: res.deletedCount });
	}
	return json({ error: 'Unknown action' }, { status: 400 });
};
