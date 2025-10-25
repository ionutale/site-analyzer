import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { links, pages } from '$lib/server/db';

export const POST: RequestHandler = async ({ url, request }) => {
	if (process.env.NODE_ENV === 'production') return json({ error: 'Not allowed' }, { status: 403 });
	const token = env.DEV_API_TOKEN;
	if (token) {
		const reqToken = request.headers.get('x-dev-token');
		if (reqToken !== token) return json({ error: 'Unauthorized' }, { status: 401 });
	}
	const siteId = url.searchParams.get('siteId');
	if (!siteId) return json({ error: 'Missing siteId' }, { status: 400 });
	const l = await links();
	const p = await pages();
	const res1 = await l.deleteMany({ siteId });
	const res2 = await p.deleteMany({ siteId });
	return json({
		ok: true,
		deleted: { links: res1.deletedCount ?? 0, pages: res2.deletedCount ?? 0 }
	});
};
