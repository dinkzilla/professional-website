import { listPosts } from '#lib/server/posts.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	return { posts: listPosts().slice(0, 2) };
};
