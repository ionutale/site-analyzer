import { pages } from '$lib/server/db';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	const siteId = url.searchParams.get('siteId');
	const format = url.searchParams.get('format') || 'csv';

	if (!siteId) {
		return json({ error: 'Missing siteId' }, { status: 400 });
	}

	const pColl = await pages();
	const docs = await pColl.find({ siteId }).toArray();

	if (format === 'csv') {
		const headers = [
			'URL',
			'Status',
			'Title',
			'Word Count',
			'Load Time (ms)',
			'Missing Alt Images',
			'H1 Count',
            'Meta Description Length',
            'Structure Issues'
		];

		const rows = docs.map(doc => {
			return [
				doc.url,
				doc.statusCode || '',
				`"${(doc.title || '').replace(/"/g, '""')}"`,
				doc.wordCount || 0,
				doc.loadTimeMs || 0,
				doc.a11y?.imagesMissingAlt || 0,
				doc.a11y?.h1Count || 0,
                doc.seo?.metaDescriptionLength || 0,
                `"${(doc.seo?.structureIssues || []).join(', ').replace(/"/g, '""')}"`
			].join(',');
		});

		const csv = [headers.join(','), ...rows].join('\n');

		return new Response(csv, {
			headers: {
				'Content-Type': 'text/csv',
				'Content-Disposition': `attachment; filename="site-audit-${siteId}.csv"`
			}
		});
	}

	return json({ error: 'Unsupported format' }, { status: 400 });
};
