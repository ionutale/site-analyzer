import { chromium, type Browser } from 'playwright';
import pLimit from 'p-limit';
import crypto from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { links, pages, sites, type LinkDoc, type PageDoc } from '../src/lib/server/db';

const HEADLESS = (process.env.PLAYWRIGHT_HEADLESS || 'true') !== 'false';
// Prefer CONCURRENT_WORKERS, fall back to legacy WORKER_CONCURRENCY for backward compatibility
const CONCURRENCY = Number(
	process.env.CONCURRENT_WORKERS || process.env.WORKER_CONCURRENCY || '3'
);
const MAX_ATTEMPTS = Number(process.env.WORKER_MAX_ATTEMPTS || '3');
const LEASE_TIMEOUT_MS = Number(process.env.LEASE_TIMEOUT_MS || '900000');
const SCREENSHOTS = (process.env.PLAYWRIGHT_SCREENSHOTS || 'false') === 'true';
const SCREENSHOTS_DIR =
	process.env.SCREENSHOTS_DIR || path.join(process.cwd(), 'static', 'screenshots');

// Large image thresholds (configurable)
const LARGE_IMG_MIN_W = Number(process.env.LARGE_IMG_MIN_W || '1600');
const LARGE_IMG_MIN_H = Number(process.env.LARGE_IMG_MIN_H || '1600');
const LARGE_IMG_MIN_AREA = Number(process.env.LARGE_IMG_MIN_AREA || '2000000');

// Scheduler config
const SCHEDULER_INTERVAL_MS = 60000; // Check every minute

async function checkSchedules() {
	try {
		const sColl = await sites();
		const now = new Date();
		const dueSites = await sColl.find({
			schedule: { $in: ['daily', 'weekly', 'monthly'] }
		}).toArray();

		for (const site of dueSites) {
			const lastRun = site.lastScheduledRun || site.createdAt;
			let nextRun = new Date(lastRun);
			
			if (site.schedule === 'daily') nextRun.setDate(nextRun.getDate() + 1);
			else if (site.schedule === 'weekly') nextRun.setDate(nextRun.getDate() + 7);
			else if (site.schedule === 'monthly') nextRun.setMonth(nextRun.getMonth() + 1);

			if (now >= nextRun) {
				console.log(`[scheduler] Triggering scheduled run for ${site.siteId}`);
				
				// Trigger refetch logic (simplified version of /api/refetch-site)
				const lColl = await links();
				const ingestId = crypto.randomUUID();
				
				// Reset all links to pending
				await lColl.updateMany(
					{ siteId: site.siteId },
					{
						$set: {
							status: 'pending',
							updatedAt: now,
							ingestId
						},
						$unset: { leasedAt: '', lastError: '' },
						$inc: { attempts: 0 } // just to touch the doc if needed
					}
				);

				// Update lastScheduledRun
				await sColl.updateOne(
					{ siteId: site.siteId },
					{ $set: { lastScheduledRun: now } }
				);
			}
		}
	} catch (e) {
		console.error('[scheduler] Error:', e);
	}
}

async function leaseOne(): Promise<LinkDoc | null> {
	const coll = await links();
	const now = new Date();

	// Requeue stale in_progress to pending
	await coll.updateMany(
		{
			status: 'in_progress',
			leasedAt: { $lt: new Date(Date.now() - LEASE_TIMEOUT_MS) },
			attempts: { $lt: MAX_ATTEMPTS }
		},
		{ $set: { status: 'pending' }, $unset: { leasedAt: '' } }
	);

	const res = await coll.findOneAndUpdate(
		{ status: 'pending' },
		{ $set: { status: 'in_progress', leasedAt: now }, $inc: { attempts: 1 } },
		{ sort: { createdAt: -1, updatedAt: -1, _id: -1 }, returnDocument: 'after' }
	);
	return res && res.value ? res.value : null;
}

async function processLink(b: Browser, doc: LinkDoc): Promise<void> {
	const pg = await b.newPage();
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

		// Accessibility + images quick checks in the page context
		const analysisResult = await pg.evaluate((thresholds) => {
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
			const imagesMissingAltUrls = imgs.filter((i) => !i.alt || !i.alt.trim()).map(i => i.src).slice(0, 10);

			const total = imgs.length;
			const counts: Record<string, number> = { avif: 0, webp: 0, jpeg: 0, jpg: 0, png: 0, gif: 0, svg: 0, other: 0 };
			const large: string[] = [];
			imgs.forEach((i) => {
				const ext = extFromUrl(i.src);
				if (ext in counts) counts[ext]++;
				else if (ext === 'jpe') counts.jpeg++;
				else counts.other++;
				const area = i.w * i.h;
				if (i.w >= thresholds.minW || i.h >= thresholds.minH || area >= thresholds.minArea) {
					if (large.length < 5) large.push(i.src);
				}
			});

			const anchors = Array.from(document.querySelectorAll('a')) as HTMLAnchorElement[];
			const anchorsWithoutText = anchors.filter(
				(a) => !(a.textContent && a.textContent.trim()) && !(a.getAttribute('aria-label') || '').trim()
			).length;
			
			const outgoingLinks = Array.from(new Set(anchors
				.map(a => a.href)
				.filter(href => href && !href.startsWith('javascript:') && !href.startsWith('mailto:') && !href.startsWith('tel:'))
			));
			
			// H-tag analysis
			const hTags = {
				h1: document.querySelectorAll('h1').length,
				h2: document.querySelectorAll('h2').length,
				h3: document.querySelectorAll('h3').length,
				h4: document.querySelectorAll('h4').length,
				h5: document.querySelectorAll('h5').length,
				h6: document.querySelectorAll('h6').length,
			};
			const h1Count = hTags.h1;

			const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'));
            const structureIssues: string[] = [];
            if (hTags.h1 === 0) structureIssues.push('Missing H1');
            if (hTags.h1 > 1) structureIssues.push('Multiple H1');
            
            let lastLevel = 0;
            headings.forEach(h => {
                const level = parseInt(h.tagName.substring(1));
				// Check for skipped levels (e.g. H1 -> H3), but allow starting with any level if it's the first one (though usually should be H1)
				if (lastLevel > 0 && level > lastLevel + 1) {
                    structureIssues.push(`Skipped heading level: H${lastLevel} -> H${level}`);
                }
                lastLevel = level;
            });
			const uniqueStructureIssues = [...new Set(structureIssues)];

			// Structured data
			const structuredData = !!document.querySelector('script[type="application/ld+json"]');

			return {
				a11y: { imagesMissingAlt, imagesMissingAltUrls, anchorsWithoutText, h1Count },
				imagesMeta: { total, counts, largeDimensions: large.length, sampleLarge: large },
				seo: { hTags, structureIssues: uniqueStructureIssues, structuredData },
				outgoingLinks
			};
		}, { minW: LARGE_IMG_MIN_W, minH: LARGE_IMG_MIN_H, minArea: LARGE_IMG_MIN_AREA });

		const excerpt = html.slice(0, 2000);
		const normalizedText = (textContent || '').toLowerCase().replace(/\s+/g, ' ').trim();
		const hash = crypto.createHash('sha256').update(normalizedText).digest('hex');
		const contentLength = html.length;
		const wordCount = (textContent || '').split(/\s+/).filter(Boolean).length;
		const titleLength = (title || '').length;

		// Meta description analysis
		const metaDescriptionLength = (metaDescription || '').length;
		const metaDescriptionIssues: string[] = [];
		if (!metaDescription) metaDescriptionIssues.push('Missing');
		else if (metaDescriptionLength < 50) metaDescriptionIssues.push('Too short (<50 chars)');
		else if (metaDescriptionLength > 160) metaDescriptionIssues.push('Too long (>160 chars)');

		let screenshotPath: string | null = null;
		if (SCREENSHOTS) {
			try {
				await fs.mkdir(SCREENSHOTS_DIR, { recursive: true });
				const fname = `${doc.siteId}-${crypto.createHash('sha1').update(doc.url).digest('hex')}.jpg`;
				const fpath = path.join(SCREENSHOTS_DIR, fname);
				await pg.screenshot({ path: fpath, type: 'jpeg', fullPage: true, quality: 60 });
				screenshotPath = `/screenshots/${fname}`;
			} catch {
				// ignore screenshot errors
			}
		}

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
					contentHash: hash,
					screenshotPath,
					...analysisResult,
					outgoingLinks: analysisResult.outgoingLinks,
					seo: {
						...analysisResult.seo,
						metaDescriptionLength,
						metaDescriptionIssues
					},
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

async function run() {
	const limit = pLimit(CONCURRENCY);
	const browser = await chromium.launch({ headless: HEADLESS });

	// Start scheduler loop
	setInterval(checkSchedules, SCHEDULER_INTERVAL_MS);
	checkSchedules(); // Run once immediately

	try {
		while (true) {
			const batch: LinkDoc[] = [];
			for (let i = 0; i < CONCURRENCY; i++) {
				const job = await leaseOne();
				if (!job) break;
				batch.push(job);
			}

			if (batch.length === 0) {
				// idle
				await new Promise((r) => setTimeout(r, 3000));
				continue;
			}

			await Promise.all(batch.map((job) => limit(() => processLink(browser, job))));
		}
	} finally {
		await browser.close();
	}
}

run().catch((e) => {
	console.error('Worker fatal error:', e);
	process.exit(1);
});
