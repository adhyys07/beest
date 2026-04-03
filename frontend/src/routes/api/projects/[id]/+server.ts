import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';

const BACKEND_URL = env.BACKEND_URL ?? 'http://localhost:3001';

export const PATCH: RequestHandler = async ({ cookies, request, params }) => {
	const token = cookies.get('auth_token');
	if (!token) {
		return new Response(JSON.stringify({ error: 'Not authenticated' }), {
			status: 401,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	const body = await request.json();

	const res = await fetch(`${BACKEND_URL}/api/projects/${params.id}`, {
		method: 'PATCH',
		headers: {
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify(body)
	});

	const data = await res.json().catch(() => ({}));

	return new Response(JSON.stringify(data), {
		status: res.status,
		headers: { 'Content-Type': 'application/json' }
	});
};

export const DELETE: RequestHandler = async ({ cookies, params }) => {
	const token = cookies.get('auth_token');
	if (!token) {
		return new Response(JSON.stringify({ error: 'Not authenticated' }), {
			status: 401,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	const res = await fetch(`${BACKEND_URL}/api/projects/${params.id}`, {
		method: 'DELETE',
		headers: { Authorization: `Bearer ${token}` }
	});

	const data = await res.json().catch(() => ({}));

	return new Response(JSON.stringify(data), {
		status: res.status,
		headers: { 'Content-Type': 'application/json' }
	});
};
