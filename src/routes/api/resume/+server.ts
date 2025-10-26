import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { links } from '$lib/server/db';
import { rateLimitCheck } from '$lib/server/rate-limit';

const MAX_ATTEMPTS = Number(process.env.WORKER_MAX_ATTEMPTS || '3');
const LEASE_TIMEOUT_MS = Number(process.env.LEASE_TIMEOUT_MS || '900000');

export const POST: RequestHandler = async (event) => {
	const { url } = event;
	const rl = rateLimitCheck(event, 'resume');
	if (!rl.allowed) {
		return json({ error: 'rate_limited' }, {
			status: 429,
			headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) }
		});
	}
	const siteId = url.searchParams.get('siteId');
	if (!siteId) return json({ error: 'Missing siteId' }, { status: 400 });
	const mode = (url.searchParams.get('mode') || 'all').toLowerCase();

	const coll = await links();

	// Requeue stale in_progress leases
	const requeueFilter: Record<string, unknown> = {
		siteId,
		status: 'in_progress',
		leasedAt: { $lt: new Date(Date.now() - LEASE_TIMEOUT_MS) },
		attempts: { $lt: MAX_ATTEMPTS }
	};
	const requeueRes = await coll.updateMany(requeueFilter, {
		$set: { status: 'pending' },
		$unset: { leasedAt: '' }
	});

	let retryResCount = 0;
	if (mode === 'all' || mode === 'retry-errors') {
		const retryFilter: Record<string, unknown> = {
			siteId,
			status: 'error',
			attempts: { $lt: MAX_ATTEMPTS }
		};
		const retryRes = await coll.updateMany(retryFilter, {
			$set: { status: 'pending' },
			$unset: { leasedAt: '' }
		});
		retryResCount = retryRes.modifiedCount ?? 0;
	}

	return json({
		ok: true,
		requeuedStale: requeueRes.modifiedCount ?? 0,
		retriedErrors: retryResCount
	});
};
