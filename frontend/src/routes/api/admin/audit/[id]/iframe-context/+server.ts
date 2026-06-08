import { env } from '$env/dynamic/private';
import { proxyWithRefresh } from '$lib/server/auth';
import type { RequestHandler } from './$types';

const BACKEND_URL = env.BACKEND_URL ?? 'http://localhost:3001';

// Mints an opaque, single-use context for the private audit iframe service.
// Returns { ctx }; the panel embeds `${AUDIT_SVC_URL}/panel?ctx=<ctx>`.
export const POST: RequestHandler = async ({ cookies, params }) => {
	return proxyWithRefresh(
		cookies,
		`${BACKEND_URL}/api/admin/audit/${params.id}/iframe-context`,
		{ method: 'POST' }
	);
};
