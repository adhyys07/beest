import { env } from '$env/dynamic/private';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const CAT_API_KEY = env.CAT_API_KEY ?? '';

export const GET: RequestHandler = async () => {
	if (!CAT_API_KEY) {
		return json({ url: null });
	}
	try {
		const res = await fetch(
			'https://api.thecatapi.com/v1/images/search?size=med&mime_types=jpg&format=json&has_breeds=true&order=RANDOM&page=0&limit=1',
			{ headers: { 'Content-Type': 'application/json', 'x-api-key': CAT_API_KEY } },
		);
		if (!res.ok) return json({ url: null });
		const data = await res.json();
		return json({ url: data?.[0]?.url ?? null });
	} catch {
		return json({ url: null });
	}
};
