import { env } from '$env/dynamic/private';
import { proxyWithRefresh } from '$lib/server/auth';
import type { RequestHandler } from './$types';

const BACKEND_URL = env.BACKEND_URL ?? 'http://localhost:3001';

export const PATCH: RequestHandler = async ({ cookies, params, request }) => {
	const body = await request.text();
	return proxyWithRefresh(cookies, `${BACKEND_URL}/api/admin/devlogs/${params.id}/review`, {
		method: 'PATCH',
		headers: { 'Content-Type': 'application/json' },
		body,
	});
};
