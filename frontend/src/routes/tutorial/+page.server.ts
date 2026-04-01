import { redirect } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { getAuthenticatedUser } from '$lib/server/auth';
import type { PageServerLoad } from './$types';

const BACKEND_URL = env.BACKEND_URL ?? 'http://localhost:3001';

export const load: PageServerLoad = async ({ url, cookies }) => {
	const user = await getAuthenticatedUser(cookies);
	if (!user) redirect(302, '/');

	const token = cookies.get('auth_token')!;

	const onboardingRes = await fetch(`${BACKEND_URL}/api/onboarding/status`, {
		headers: { Authorization: `Bearer ${token}` }
	});

	const onboarding = onboardingRes.ok
		? await onboardingRes.json()
		: { hackatime: false, slack: false, project: false };

	const stage = url.searchParams.get('stage');

	return { user, onboarding, stage: stage ? parseInt(stage, 10) : null };
};
