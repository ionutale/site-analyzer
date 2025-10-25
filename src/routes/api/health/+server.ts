import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';

export const GET: RequestHandler = async () => {
	try {
		const db = await getDb();
		const res = await db.command({ ping: 1 });
		return json({ ok: true, res });
	} catch (err) {
		return json({ ok: false, error: String((err as Error)?.message || err) }, { status: 500 });
	}
};
