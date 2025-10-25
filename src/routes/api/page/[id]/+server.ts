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
    transformTags: { a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer', target: '_blank' }) }
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
    screenshotPath: doc.screenshotPath ?? null
  });
};
