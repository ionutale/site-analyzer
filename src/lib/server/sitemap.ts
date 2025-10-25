import { XMLParser } from 'fast-xml-parser';

export function normalizeSiteId(siteUrl: string): string {
	const u = new URL(siteUrl);
	return u.hostname.toLowerCase();
}

async function tryFetch(url: string): Promise<Response | null> {
	try {
		const res = await fetch(url, { redirect: 'follow' });
		if (res.ok) return res;
		return null;
	} catch {
		return null;
	}
}

export async function discoverSitemaps(siteUrl: string): Promise<string[]> {
	const u = new URL(siteUrl);
	const base = `${u.protocol}//${u.host}`;
	const candidates = new Set<string>();

	// Try robots.txt entries first
	const robotsRes = await tryFetch(`${base}/robots.txt`);
	if (robotsRes) {
		const txt = await robotsRes.text();
		for (const line of txt.split(/\r?\n/)) {
			const m = line.match(/^sitemap:\s*(.+)$/i);
			if (m) {
				try {
					const sm = new URL(m[1].trim(), base).toString();
					candidates.add(sm);
				} catch {
					// ignore invalid sitemap URL
				}
			}
		}
	}

	// Fallback to /sitemap.xml
	candidates.add(`${base}/sitemap.xml`);

	// Filter only those that return 200
	const list = Array.from(candidates);
	const results: string[] = [];
	for (const sm of list) {
		const res = await tryFetch(sm);
		if (res) results.push(sm);
	}
	return Array.from(new Set(results));
}

function parseSitemapURLs(xml: string): { urls: string[]; childSitemaps: string[] } {
	const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' });
	const doc = parser.parse(xml);
	const urls: string[] = [];
	const childSitemaps: string[] = [];

	if (doc.urlset && Array.isArray(doc.urlset.url)) {
		for (const entry of doc.urlset.url) {
			if (entry.loc) urls.push(String(entry.loc));
		}
	} else if (doc.urlset && doc.urlset.url && doc.urlset.url.loc) {
		urls.push(String(doc.urlset.url.loc));
	}

	if (doc.sitemapindex) {
		const list = Array.isArray(doc.sitemapindex.sitemap)
			? doc.sitemapindex.sitemap
			: [doc.sitemapindex.sitemap];
		for (const sm of list) {
			if (sm && sm.loc) childSitemaps.push(String(sm.loc));
		}
	}

	return { urls, childSitemaps };
}

export async function collectSitemapUrls(siteUrl: string, maxDepth = 2): Promise<string[]> {
	const seen = new Set<string>();
	const toVisit = await discoverSitemaps(siteUrl);
	const collected = new Set<string>();

	let depth = 0;
	let queue = toVisit;

	while (queue.length && depth <= maxDepth) {
		const nextQueue: string[] = [];
		for (const smUrl of queue) {
			if (seen.has(smUrl)) continue;
			seen.add(smUrl);
			const res = await tryFetch(smUrl);
			if (!res) continue;
			const xml = await res.text();
			const { urls, childSitemaps } = parseSitemapURLs(xml);
			urls.forEach((u) => collected.add(u));
			childSitemaps.forEach((c) => {
				try {
					nextQueue.push(new URL(c, smUrl).toString());
				} catch {
					// ignore invalid child sitemap URL
				}
			});
		}
		queue = nextQueue;
		depth += 1;
	}

	return Array.from(collected);
}
