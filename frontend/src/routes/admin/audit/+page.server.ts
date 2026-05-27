import { redirect } from '@sveltejs/kit';
import { getAuthenticatedUser } from '$lib/server/auth';
import { env } from '$env/dynamic/private';
import type { PageServerLoad } from './$types';

const BACKEND_URL = env.BACKEND_URL ?? 'http://localhost:3001';

// Second-pass review is SUPER ADMIN only.
export const load: PageServerLoad = async ({ cookies }) => {
	const user = await getAuthenticatedUser(cookies);
	if (!user) redirect(302, '/');

	const token = cookies.get('auth_token');
	const adminRes = await fetch(`${BACKEND_URL}/api/auth/scope?scope=admin`, {
		headers: { Authorization: `Bearer ${token}` }
	});
	if (!adminRes.ok) redirect(302, '/home');
	const data = await adminRes.json();

	return { user, role: data.perms };
};
