import type { RequestEvent } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

// Simple in-memory token bucket per clientId (IP) and key
// Disabled when RATE_LIMIT_TOKENS or RATE_LIMIT_WINDOW_MS are not set

type Bucket = {
  tokens: number;
  lastRefill: number; // ms epoch
};

const buckets = new Map<string, Bucket>();

function cfg() {
  const windowMs = Number(env.RATE_LIMIT_WINDOW_MS || 0);
  const tokens = Number(env.RATE_LIMIT_TOKENS || 0);
  const burst = Number(env.RATE_LIMIT_BURST || tokens || 0);
  return { windowMs, tokens, burst };
}

function clientIdFromEvent(event: Pick<RequestEvent, 'getClientAddress'>): string {
  try {
    return event.getClientAddress?.() || 'local';
  } catch {
    return 'local';
  }
}

export function rateLimitCheck(
  event: Pick<RequestEvent, 'getClientAddress'>,
  key: string
): { allowed: true } | { allowed: false; retryAfterMs: number } {
  const { windowMs, tokens, burst } = cfg();
  if (!windowMs || !tokens) return { allowed: true };

  const now = Date.now();
  const cid = clientIdFromEvent(event);
  const bucketKey = `${key}:${cid}`;
  const cap = Math.max(tokens, burst || tokens);

  const b = buckets.get(bucketKey) || { tokens: cap, lastRefill: now };
  // refill
  const elapsed = now - b.lastRefill;
  if (elapsed > 0) {
    const refill = Math.floor((elapsed / windowMs) * tokens);
    if (refill > 0) {
      b.tokens = Math.min(cap, b.tokens + refill);
      b.lastRefill = now;
    }
  }
  if (b.tokens <= 0) {
    const missing = 1 - b.tokens; // tokens to recover until next allowed
    const retryAfterMs = Math.ceil((missing / tokens) * windowMs);
    buckets.set(bucketKey, b);
    return { allowed: false, retryAfterMs };
  }
  b.tokens -= 1;
  buckets.set(bucketKey, b);
  return { allowed: true };
}
