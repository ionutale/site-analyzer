import { chromium, type Browser } from 'playwright';
import pLimit from 'p-limit';
import crypto from 'node:crypto';
import { links, pages, type LinkDoc, type PageDoc } from '../src/lib/server/db';

const HEADLESS = (process.env.PLAYWRIGHT_HEADLESS || 'true') !== 'false';
const CONCURRENCY = Number(process.env.WORKER_CONCURRENCY || '3');
const MAX_ATTEMPTS = Number(process.env.WORKER_MAX_ATTEMPTS || '3');
const LEASE_TIMEOUT_MS = Number(process.env.LEASE_TIMEOUT_MS || '900000');

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
    { sort: { createdAt: 1 }, returnDocument: 'after' }
  );
  return (res && res.value) ? res.value : null;
}

async function processLink(b: Browser, doc: LinkDoc): Promise<void> {
  const pg = await b.newPage();
  try {
    const resp = await pg.goto(doc.url, { waitUntil: 'networkidle', timeout: 45000 });
    const statusCode = resp?.status() ?? null;
    const contentType = resp?.headers()['content-type'] ?? null;
    const title = await pg.title();
    const html = await pg.content();

    const excerpt = html.slice(0, 2000);
    const hash = crypto.createHash('sha256').update(html).digest('hex');

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
          textExcerpt: excerpt,
          contentHash: hash
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
  }
}

async function run() {
  const limit = pLimit(CONCURRENCY);
  const browser = await chromium.launch({ headless: HEADLESS });
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
