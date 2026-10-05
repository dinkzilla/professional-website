import { marked } from 'marked';

export interface PostSummary {
	slug: string;
	title: string;
	date: string;
	description: string;
	minutes: number;
}

export interface Post extends PostSummary {
	html: string;
	/** Link to the post on Medium, for posts synced from there. */
	mediumUrl?: string;
}

// Each post is a markdown file in src/posts. The filename is the URL slug and
// the frontmatter needs `title`, `date` (YYYY-MM-DD) and `description`. Posts
// synced from Medium also carry their Medium post id as `medium`.
const files = import.meta.glob<string>('/src/posts/*.md', {
	query: '?raw',
	import: 'default',
	eager: true
});

function parse(path: string, raw: string): Post {
	const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(raw);
	if (!match) throw new Error(`${path} is missing frontmatter`);

	const meta: Record<string, string> = {};
	for (const line of match[1].split('\n')) {
		const i = line.indexOf(':');
		if (i === -1) continue;
		const value = line.slice(i + 1).trim();
		meta[line.slice(0, i).trim()] = value.startsWith('"') ? JSON.parse(value) : value;
	}
	for (const key of ['title', 'date', 'description']) {
		if (!meta[key]) throw new Error(`${path} is missing "${key}" in its frontmatter`);
	}

	const body = match[2];
	return {
		slug: path.split('/').pop()!.replace(/\.md$/, ''),
		title: meta.title,
		date: meta.date,
		description: meta.description,
		minutes: Math.max(1, Math.round(body.split(/\s+/).length / 230)),
		html: marked.parse(body, { async: false }),
		mediumUrl: meta.medium ? `https://medium.com/p/${meta.medium}` : undefined
	};
}

const posts = Object.entries(files)
	.map(([path, raw]) => parse(path, raw))
	.sort((a, b) => b.date.localeCompare(a.date));

export function listPosts(): PostSummary[] {
	return posts.map(({ html: _html, ...summary }) => summary);
}

export function getPost(slug: string): Post | undefined {
	return posts.find((post) => post.slug === slug);
}
