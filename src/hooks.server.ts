import type { Handle } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';

// Public routes that don't require authentication on SSR
const PUBLIC_PATHS = new Set<string>(['/', '/login', '/robots.txt', '/favicon.ico']);

function isPublic(pathname: string) {
	if (PUBLIC_PATHS.has(pathname)) return true;
	// Allow framework/internal and static assets
	if (pathname.startsWith('/_app') || pathname.startsWith('/__vite')) return true;
	if (pathname.startsWith('/screenshots') || pathname.startsWith('/static')) return true;
	return false;
}

export const handle: Handle = async ({ event, resolve }) => {
	const pathname = event.url.pathname;
	if (!isPublic(pathname)) {
		const isAuthed = event.cookies.get('sa_auth') === '1';
		if (!isAuthed) {
			const redirectTo = `${pathname}${event.url.search || ''}`;
			throw redirect(302, `/login?redirect=${encodeURIComponent(redirectTo)}`);
		}
	}
	return resolve(event);
};
