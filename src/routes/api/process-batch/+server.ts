import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { chromium, type Browser } from 'playwright';
import { links, pages, type LinkDoc, type PageDoc } from '$lib/server/db';
import { rateLimitCheck } from '$lib/server/rate-limit';

const HEADLESS = (process.env.PLAYWRIGHT_HEADLESS || 'true') !== 'false';
const MAX_ATTEMPTS = Number(process.env.WORKER_MAX_ATTEMPTS || '3');

async function leaseOne(siteId?: string): Promise<LinkDoc | null> {
	const coll = await links();
	// requeue stale
	await coll.updateMany(
		{
			status: 'in_progress',
			leasedAt: { $lt: new Date(Date.now() - 15 * 60_000) },
			attempts: { $lt: MAX_ATTEMPTS }
		},
		{ $set: { status: 'pending' }, $unset: { leasedAt: '' } }
	);

	const query: Record<string, unknown> = { status: 'pending' };
	if (siteId) query.siteId = siteId;

	const doc = await coll.findOneAndUpdate(
		query,
		{ $set: { status: 'in_progress', leasedAt: new Date() }, $inc: { attempts: 1 } },
		{ sort: { createdAt: -1, updatedAt: -1, _id: -1 }, returnDocument: 'after' }
	);
	return doc ?? null;
}

async function processWithBrowser(browser: Browser, doc: LinkDoc): Promise<void> {
	const pg = await browser.newPage();
	try {
		const resp = await pg.goto(doc.url, { waitUntil: 'networkidle', timeout: 45000 });
		const statusCode = resp?.status() ?? null;
		const contentType = resp?.headers()['content-type'] ?? null;
		const title = await pg.title();
		const html = await pg.content();

		const excerpt = html.slice(0, 2000);

		const now = new Date();
		const pColl = await pages();
		await pColl.updateOne(
			{ siteId: doc.siteId, url: doc.url },
			{
				$set: {
					siteId: doc.siteId,
					url: doc.url,
					statusCode,
					fetchedAt: now,
					contentType,
					title,
					content: html,
					textExcerpt: excerpt
				} satisfies Partial<PageDoc>
			},
			{ upsert: true }
		);

		const lColl = await links();
		await lColl.updateOne(
			{ siteId: doc.siteId, url: doc.url },
			{
				$set: { status: 'done', updatedAt: now },
				$unset: { leasedAt: '' },
				$setOnInsert: { createdAt: now }
			}
		);
	} catch (err) {
		const now = new Date();
		const lColl = await links();
		await lColl.updateOne(
			{ siteId: doc.siteId, url: doc.url },
			{
				$set: {
					status: 'error',
					lastError: String((err as Error)?.message || err),
					updatedAt: now
				},
				$unset: { leasedAt: '' }
			}
		);
	} finally {
		await pg.close().catch(() => {});
	}
}

export const POST: RequestHandler = async (event) => {
	const { url, request } = event;
	const rl = rateLimitCheck(event, 'process-batch');
	if (!rl.allowed) {
		return json(
			{ error: 'rate_limited' },
			{
				status: 429,
				headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) }
			}
		);
	}
	if (process.env.NODE_ENV === 'production') return json({ error: 'Not allowed' }, { status: 403 });
	const token = env.DEV_API_TOKEN;
	if (token) {
		const reqToken = request.headers.get('x-dev-token');
		if (reqToken !== token) return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const siteId = url.searchParams.get('siteId') || undefined;
	const count = Math.max(1, Math.min(5, Number(url.searchParams.get('count') || '3')));

	// Lease up to "count" jobs first, then process concurrently using a single browser
	const jobs: LinkDoc[] = [];
	for (let i = 0; i < count; i++) {
		const job = await leaseOne(siteId);
		if (!job) break;
		jobs.push(job);
	}
	if (jobs.length === 0) return json({ ok: true, processedCount: 0 });

	const browser = await chromium.launch({ headless: HEADLESS });
	try {
		await Promise.all(jobs.map((j) => processWithBrowser(browser, j)));
	} finally {
		await browser.close().catch(() => {});
	}

	return json({ ok: true, processedCount: jobs.length });
};
