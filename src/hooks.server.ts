import type { Handle } from '@sveltejs/kit';

// No-op for now; rate limiting is applied per-endpoint via helper.
// This file is kept to allow future global middleware (auth, rate limit, etc.).

export const handle: Handle = async ({ event, resolve }) => {
  return resolve(event);
};
