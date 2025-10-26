import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { pages } from '$lib/server/db';
import { ObjectId } from 'mongodb';
import sanitizeHtml from 'sanitize-html';

export const GET: RequestHandler = async ({ params }) => {
	const { id } = params;
	if (!id) return json({ error: 'Missing id' }, { status: 400 });

	let _id: ObjectId;
	try {
		_id = new ObjectId(id);
	} catch {
		return json({ error: 'Invalid id' }, { status: 400 });
	}

	const coll = await pages();
	const doc = await coll.findOne({ _id });
	if (!doc) return json({ error: 'Not found' }, { status: 404 });

	// Return minimal fields for UI
	const sanitizedExcerpt = sanitizeHtml(doc.textExcerpt ?? '', {
		allowedTags: ['b', 'i', 'em', 'strong', 'a', 'p', 'ul', 'ol', 'li', 'br', 'span'],
		allowedAttributes: { a: ['href', 'rel', 'target'] },
		transformTags: {
			a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer', target: '_blank' })
		}
	});
	return json({
		_id: String(doc._id),
		siteId: doc.siteId,
		url: doc.url,
		statusCode: doc.statusCode ?? null,
		fetchedAt: doc.fetchedAt,
		contentType: doc.contentType ?? null,
		title: doc.title ?? null,
		textExcerpt: doc.textExcerpt ?? null,
		sanitizedExcerpt,
		content: doc.content,
		screenshotPath: doc.screenshotPath ?? null,
		a11y: {
			imagesMissingAlt: doc.a11y?.imagesMissingAlt ?? 0,
			anchorsWithoutText: doc.a11y?.anchorsWithoutText ?? 0,
			h1Count: doc.a11y?.h1Count ?? 0
		},
		imagesMeta: {
			total: doc.imagesMeta?.total ?? 0,
			counts: {
				avif: doc.imagesMeta?.counts?.avif ?? 0,
				webp: doc.imagesMeta?.counts?.webp ?? 0,
				jpeg: doc.imagesMeta?.counts?.jpeg ?? 0,
				jpg: doc.imagesMeta?.counts?.jpg ?? 0,
				png: doc.imagesMeta?.counts?.png ?? 0,
				gif: doc.imagesMeta?.counts?.gif ?? 0,
				svg: doc.imagesMeta?.counts?.svg ?? 0,
				other: doc.imagesMeta?.counts?.other ?? 0
			},
			largeDimensions: doc.imagesMeta?.largeDimensions ?? 0,
			sampleLarge: doc.imagesMeta?.sampleLarge?.slice(0, 10) ?? []
		}
	});
};
