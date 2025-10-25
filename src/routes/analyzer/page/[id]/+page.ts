import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch, params }) => {
  const res = await fetch(`/api/page/${params.id}`);
  if (!res.ok) {
    let msg = 'Failed to load page';
    try {
      const body = await res.json();
      if (body?.error) msg = String(body.error);
    } catch {
      // ignore JSON parse errors
    }
    return { page: null as unknown as never, error: msg };
  }
  const page = await res.json();
  return { page };
};
