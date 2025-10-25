import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { chromium } from 'playwright';
import { links, pages, type LinkDoc, type PageDoc } from '$lib/server/db';

const HEADLESS = (process.env.PLAYWRIGHT_HEADLESS || 'true') !== 'false';
const MAX_ATTEMPTS = Number(process.env.WORKER_MAX_ATTEMPTS || '3');

async function leaseOne(siteId?: string): Promise<LinkDoc | null> {
  const coll = await links();
  // requeue stale
  await coll.updateMany(
    { status: 'in_progress', leasedAt: { $lt: new Date(Date.now() - 15 * 60_000) }, attempts: { $lt: MAX_ATTEMPTS } },
    { $set: { status: 'pending' }, $unset: { leasedAt: '' } }
  );

  const query: Record<string, unknown> = { status: 'pending' };
  if (siteId) query.siteId = siteId;

  const doc = await coll.findOneAndUpdate(
    query,
    { $set: { status: 'in_progress', leasedAt: new Date() }, $inc: { attempts: 1 } },
    { sort: { createdAt: 1 }, returnDocument: 'after' }
  );
  return doc ?? null;
}

async function processOne(doc: LinkDoc): Promise<void> {
  const browser = await chromium.launch({ headless: HEADLESS });
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
      { $set: { status: 'done', updatedAt: now }, $unset: { leasedAt: '' }, $setOnInsert: { createdAt: now } }
    );
  } catch (err) {
    const now = new Date();
    const lColl = await links();
    await lColl.updateOne(
      { siteId: doc.siteId, url: doc.url },
      { $set: { status: 'error', lastError: String((err as Error)?.message || err), updatedAt: now }, $unset: { leasedAt: '' } }
    );
  } finally {
    await pg.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

export const POST: RequestHandler = async ({ url, request }) => {
  if (process.env.NODE_ENV === 'production') return json({ error: 'Not allowed' }, { status: 403 });
  const token = env.DEV_API_TOKEN;
  if (token) {
    const reqToken = request.headers.get('x-dev-token');
    if (reqToken !== token) return json({ error: 'Unauthorized' }, { status: 401 });
  }

  const siteId = url.searchParams.get('siteId') || undefined;
  const count = Math.max(1, Math.min(5, Number(url.searchParams.get('count') || '3')));

  const processed: string[] = [];
  for (let i = 0; i < count; i++) {
    const job = await leaseOne(siteId);
    if (!job) break;
    await processOne(job);
    processed.push(job.url);
  }

  return json({ ok: true, processedCount: processed.length });
};
