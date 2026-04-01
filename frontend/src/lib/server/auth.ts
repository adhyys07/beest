import { env } from '$env/dynamic/private';
import type { Cookies } from '@sveltejs/kit';

const BACKEND_URL = env.BACKEND_URL ?? 'http://localhost:3001';

const COOKIE_OPTS = {
	path: '/',
	httpOnly: true,
	sameSite: 'lax' as const,
	secure: env.NODE_ENV === 'production'
};

/**
 * Tries to authenticate the user via JWT, falling back to refresh token.
 * Returns user claims on success, null on failure (both tokens expired).
 * Transparently sets new cookies when a refresh occurs.
 */
export async function getAuthenticatedUser(
	cookies: Cookies
): Promise<Record<string, any> | null> {
	const token = cookies.get('auth_token');
	const refreshToken = cookies.get('refresh_token');

	// 1. Try the JWT
	if (token) {
		const res = await fetch(`${BACKEND_URL}/api/auth/me`, {
			headers: { Authorization: `Bearer ${token}` }
		});
		if (res.ok) return res.json();
	}

	// 2. JWT expired or missing — try refresh
	if (refreshToken) {
		const res = await fetch(`${BACKEND_URL}/api/auth/refresh`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ refreshToken })
		});

		if (res.ok) {
			const data = await res.json();

			// Set the rotated tokens
			cookies.set('auth_token', data.token, { ...COOKIE_OPTS, maxAge: 3600 });
			cookies.set('refresh_token', data.refreshToken, {
				...COOKIE_OPTS,
				maxAge: 90 * 24 * 60 * 60
			});

			// Fetch user claims with the new JWT
			const meRes = await fetch(`${BACKEND_URL}/api/auth/me`, {
				headers: { Authorization: `Bearer ${data.token}` }
			});
			if (meRes.ok) return meRes.json();
		}
	}

	// 3. Both expired — clean up
	cookies.delete('auth_token', { path: '/' });
	cookies.delete('refresh_token', { path: '/' });
	return null;
}
