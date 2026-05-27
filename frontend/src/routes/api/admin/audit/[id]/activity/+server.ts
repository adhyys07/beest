import { env } from '$env/dynamic/private';
import { tryRefreshToken } from '$lib/server/auth';
import type { RequestHandler } from './$types';

const BACKEND_URL = env.BACKEND_URL ?? 'http://localhost:3001';

// Streaming proxy — the backend emits NDJSON progress events, so unlike the
// JSON-buffering proxyWithRefresh we pipe the response body straight through.
export const GET: RequestHandler = async ({ cookies, params }) => {
	const url = `${BACKEND_URL}/api/admin/audit/${params.id}/activity`;

	let token = cookies.get('auth_token');
	if (!token) {
		token = (await tryRefreshToken(cookies)) ?? undefined;
		if (!token) return new Response('Not authenticated', { status: 401 });
	}

	let res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
	if (res.status === 401) {
		const newToken = await tryRefreshToken(cookies);
		if (!newToken) return new Response('Not authenticated', { status: 401 });
		res = await fetch(url, { headers: { Authorization: `Bearer ${newToken}` } });
	}

	if (!res.ok || !res.body) {
		return new Response(
			JSON.stringify({ type: 'error', error: `backend ${res.status}` }) + '\n',
			{ status: res.status, headers: { 'Content-Type': 'application/x-ndjson' } }
		);
	}

	return new Response(res.body, {
		status: 200,
		headers: {
			'Content-Type': 'application/x-ndjson; charset=utf-8',
			'Cache-Control': 'no-cache',
			'X-Accel-Buffering': 'no'
		}
	});
};
