import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pages } from '$lib/server/db';
import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';

export const POST: RequestHandler = async ({ request }) => {
	const { siteId, url } = await request.json();
	if (!siteId || !url) return json({ error: 'Missing siteId or url' }, { status: 400 });

	let chrome;
	try {
		chrome = await chromeLauncher.launch({ chromeFlags: ['--headless'] });
		const options = {
			logLevel: 'info',
			output: 'json',
			onlyCategories: ['performance'],
			port: chrome.port
		};
		
		// @ts-expect-error - lighthouse types are tricky
		const runnerResult = await lighthouse(url, options);
		if (!runnerResult) throw new Error('Lighthouse failed to produce result');
		const report = runnerResult.lhr;

		const audits = report.audits;
		const categories = report.categories;

		const performance = {
			score: (categories.performance.score || 0) * 100,
			fcp: audits['first-contentful-paint'].numericValue,
			lcp: audits['largest-contentful-paint'].numericValue,
			cls: audits['cumulative-layout-shift'].numericValue,
			speedIndex: audits['speed-index'].numericValue,
			auditedAt: new Date()
		};

		const pColl = await pages();
		await pColl.updateOne(
			{ siteId, url },
			{ $set: { performance } }
		);

		return json({ success: true, performance });
	} catch (e: unknown) {
		console.error('Lighthouse error:', e);
		const msg = e instanceof Error ? e.message : 'Lighthouse failed';
		return json({ error: msg }, { status: 500 });
	} finally {
		if (chrome) await chrome.kill();
	}
};
