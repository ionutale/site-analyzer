import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { chromium, type Browser } from 'playwright';
import { links, pages, type LinkDoc, type PageDoc } from '$lib/server/db';
import { rateLimitCheck } from '$lib/server/rate-limit';
import crypto from 'node:crypto';

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
		const t0 = Date.now();
		const resp = await pg.goto(doc.url, { waitUntil: 'networkidle', timeout: 45000 });
		const loadTimeMs = Date.now() - t0;
		const statusCode = resp?.status() ?? null;
		const contentType = resp?.headers()['content-type'] ?? null;
		const title = await pg.title();
		const html = await pg.content();
		const metaDescription = await pg
			.$eval(
				'meta[name="description"], meta[property="og:description"]',
				(el: Element) => (el as HTMLMetaElement).content || '',
				{ strict: false }
			)
			.catch(() => '');
		const canonicalUrl = await pg
			.$eval(
				'link[rel="canonical"]',
				(el: Element) => (el as HTMLLinkElement).getAttribute('href') || '',
				{ strict: false }
			)
			.catch(() => '');
		const textContent = await pg.evaluate(() => (document?.body?.innerText || '').trim());

		// Basic a11y + images checks (parity with worker)
		const a11yAndImages = await pg.evaluate(() => {
			function extFromUrl(u: string): string {
				try {
					const url = new URL(u, location.href);
					const p = url.pathname.toLowerCase();
					const m = p.match(/\.([a-z0-9]+)$/);
					return m ? m[1] : '';
				} catch {
					return '';
				}
			}

			const imgs = Array.from(document.images || []).map((img) => ({
				src: (img as HTMLImageElement).currentSrc || (img as HTMLImageElement).src || '',
				alt: (img as HTMLImageElement).alt || '',
				w: (img as HTMLImageElement).naturalWidth || 0,
				h: (img as HTMLImageElement).naturalHeight || 0
			}));
			const imagesMissingAlt = imgs.filter((i) => !i.alt || !i.alt.trim()).length;
			const total = imgs.length;
			const counts: Record<string, number> = { avif: 0, webp: 0, jpeg: 0, jpg: 0, png: 0, gif: 0, svg: 0, other: 0 };
			const large: string[] = [];
			imgs.forEach((i) => {
				const ext = extFromUrl(i.src);
				if (ext in counts) counts[ext]++;
				else if (ext === 'jpe') counts.jpeg++;
				else counts.other++;
				const area = i.w * i.h;
				if (i.w >= 1600 || i.h >= 1600 || area >= 2_000_000) {
					if (large.length < 5) large.push(i.src);
				}
			});

			const anchors = Array.from(document.querySelectorAll('a')) as HTMLAnchorElement[];
			const anchorsWithoutText = anchors.filter(
				(a) => !(a.textContent && a.textContent.trim()) && !(a.getAttribute('aria-label') || '').trim()
			).length;
			const h1Count = document.querySelectorAll('h1').length;

			return {
				a11y: { imagesMissingAlt, anchorsWithoutText, h1Count },
				imagesMeta: { total, counts, largeDimensions: large.length, sampleLarge: large }
			};
		});

		const excerpt = html.slice(0, 2000);
		const normalizedText = (textContent || '').toLowerCase().replace(/\s+/g, ' ').trim();
		const contentHash = crypto.createHash('sha256').update(normalizedText).digest('hex');
		const contentLength = html.length;
		const wordCount = (textContent || '').split(/\s+/).filter(Boolean).length;
		const titleLength = (title || '').length;

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
					titleLength,
					metaDescription: metaDescription || null,
					loadTimeMs,
					canonicalUrl: canonicalUrl || null,
					content: html,
					contentLength,
					textExcerpt: excerpt,
					textContent: textContent || null,
					wordCount,
					contentHash,
					...a11yAndImages,
					ingestId: (doc as unknown as { ingestId?: string | null }).ingestId ?? null,
					ingestedAt: now
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
	const count = Math.max(1, Math.min(10, Number(url.searchParams.get('count') || '3')));
	const drain = (url.searchParams.get('drain') || 'false') === 'true';
	const maxTotal = Math.max(0, Number(url.searchParams.get('max') || '0')); // 0 = no cap

	let processedTotal = 0;
	const browser = await chromium.launch({ headless: HEADLESS });
	try {
		// When drain=false, run a single batch; when drain=true, loop until queue is empty or maxTotal reached
		do {
			const jobs: LinkDoc[] = [];
			for (let i = 0; i < count; i++) {
				const job = await leaseOne(siteId);
				if (!job) break;
				jobs.push(job);
			}
			if (jobs.length === 0) break;

			await Promise.all(jobs.map((j) => processWithBrowser(browser, j)));
			processedTotal += jobs.length;

			if (maxTotal > 0 && processedTotal >= maxTotal) break;
		} while (drain);
	} finally {
		await browser.close().catch(() => {});
	}

	return json({ ok: true, processedCount: processedTotal });
};
