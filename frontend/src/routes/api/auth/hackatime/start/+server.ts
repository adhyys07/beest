import { redirect } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';

const BACKEND_URL = env.BACKEND_URL ?? 'http://localhost:3001';

// POST only — prevents CSRF via cross-site links (GET + sameSite:lax cookies)
export const POST: RequestHandler = async ({ cookies }) => {
	const token = cookies.get('auth_token');
	if (!token) {
		return new Response('Not authenticated', { status: 401 });
	}

	// Ask the backend to generate Hackatime OAuth state + authorize URL
	const res = await fetch(`${BACKEND_URL}/api/hackatime/start`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${token}`
		}
	});

	if (!res.ok) {
		return new Response('Failed to start Hackatime auth', { status: 502 });
	}

	const { url: authorizeUrl, state } = await res.json();

	// Store state in httpOnly cookie for the callback
	cookies.set('hackatime_state', state, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax' as const,
		secure: env.NODE_ENV === 'production',
		maxAge: 600
	});

	redirect(302, authorizeUrl);
};
