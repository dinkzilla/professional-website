// Syncs blog posts from Medium into src/posts. Run with `npm run sync`.
//
// Medium is the source of truth: every post in the feed is regenerated and its
// local file overwritten if anything changed. The feed only carries the latest
// 10 posts, so files for older (or deleted) posts are left untouched.
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FEED_URL = 'https://medium.com/feed/@mdinkel';
// Medium rejects requests without a browser-like user agent.
const USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko)';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const postsDir = path.join(root, 'src/posts');
const imagesDir = path.join(root, 'static/blog-images');

const entities = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

function decode(text) {
	return text
		.replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
		.replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
		.replace(/&([a-z]+);/g, (match, name) => entities[name] ?? match)
		.replaceAll(' ', ' ');
}

function plainText(html) {
	return decode(html.replace(/<[^>]+>/g, ''));
}

// Medium often leaves whitespace inside <em>/<strong>, which markdown doesn't
// treat as emphasis, so move it outside the markers.
function emphasis(text, tag, marker) {
	const pattern = new RegExp(`<${tag}>(\\s*)([\\s\\S]*?)(\\s*)</${tag}>`, 'g');
	return text.replace(
		pattern,
		(_, lead, inner, trail) => lead + (inner ? marker + inner + marker : '') + trail
	);
}

// The Medium post id at the end of a link to one of my own posts, if it is one.
function ownPostId(url) {
	const { hostname, pathname } = new URL(url);
	const own =
		hostname === 'mdinkel.medium.com' ||
		(hostname === 'medium.com' && pathname.startsWith('/@mdinkel/'));
	return own ? /-([0-9a-f]{12})$/.exec(pathname)?.[1] : undefined;
}

// `localPosts` maps Medium post id -> slug for posts on this site, so links to
// my other posts point here instead of to Medium.
function inline(html, localPosts) {
	let text = html.replaceAll(' ', ' ').replace(/([*_`[\]])/g, '\\$1');
	text = emphasis(text, 'em', '*');
	text = emphasis(text, 'strong', '**');
	text = text.replace(/<a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g, (_, href, label) => {
		let url = decode(href).replace(/[?&]source=[^&#]*/, '');
		const local = localPosts.get(ownPostId(url));
		if (local) url = `/blog/${local}`;
		return `[${label}](${url})`;
	});
	text = text.replace(/<br\s*\/?>/g, '  \n');
	if (/<[a-z/]/i.test(text)) throw new Error(`unsupported inline HTML: ${text.slice(0, 200)}`);
	return text.trim();
}

function slugFromLink(link) {
	const last = decodeURIComponent(new URL(link).pathname.split('/').pop());
	return last
		.replace(/-[0-9a-f]{12}$/, '')
		.replace(/[^a-z0-9-]/g, '')
		.replace(/^-+|-+$/g, '');
}

function toMarkdown(content, slug, localPosts) {
	let html = content.replace(/<img src="https:\/\/medium\.com\/_\/stat[^>]*>/g, '');

	// Headings before any body text are not sections: a leading <h3> is the
	// story's title and an <h4> after it (or on its own) is Medium's subtitle.
	let title;
	let subtitle;
	const lead = /^(?:<h3>([\s\S]*?)<\/h3>)?(?:<h4>([\s\S]*?)<\/h4>)?/.exec(html);
	if (lead[0]) {
		if (lead[1] !== undefined) title = plainText(lead[1]);
		if (lead[2] !== undefined) subtitle = plainText(lead[2]);
		html = html.slice(lead[0].length);
	}

	const blocks = [];
	const images = [];
	let position = 0;
	const pattern = /<(p|h3|h4|blockquote|pre|figure|ul|ol)>([\s\S]*?)<\/\1>/g;
	const ensureNothingSkipped = (skipped) => {
		if (skipped.trim()) throw new Error(`unsupported HTML: ${skipped.slice(0, 200)}`);
	};

	for (const match of html.matchAll(pattern)) {
		ensureNothingSkipped(html.slice(position, match.index));
		position = match.index + match[0].length;
		const [, tag, inner] = match;

		if (tag === 'p') {
			blocks.push(inline(inner, localPosts));
		} else if (tag === 'h3') {
			blocks.push(`## ${inline(inner, localPosts)}`);
		} else if (tag === 'h4') {
			blocks.push(`### ${inline(inner, localPosts)}`);
		} else if (tag === 'blockquote') {
			blocks.push(inline(inner, localPosts).replace(/^/gm, '> '));
		} else if (tag === 'pre') {
			blocks.push('```\n' + decode(inner.replace(/<br\s*\/?>/g, '\n')) + '\n```');
		} else if (tag === 'ul' || tag === 'ol') {
			const items = [...inner.matchAll(/<li>([\s\S]*?)<\/li>/g)].map(
				(item, i) => (tag === 'ol' ? `${i + 1}. ` : '- ') + inline(item[1], localPosts)
			);
			blocks.push(items.join('\n'));
		} else {
			const src = /src="([^"]+)"/.exec(inner)?.[1];
			if (!src) throw new Error(`figure without an image: ${inner.slice(0, 200)}`);
			const caption = /<figcaption>([\s\S]*?)<\/figcaption>/.exec(inner);
			const file = path.basename(new URL(src).pathname).replace(/[^A-Za-z0-9._-]/g, '');
			images.push({ src, file });
			blocks.push(`![${caption ? inline(caption[1], localPosts) : ''}](/blog-images/${slug}/${file})`);
		}
	}
	ensureNothingSkipped(html.slice(position));

	let description = subtitle;
	if (!description) {
		const first = plainText(/<p>([\s\S]*?)<\/p>/.exec(html)?.[1] ?? '');
		description = first.length <= 180 ? first : first.slice(0, 180).replace(/\s+\S*$/, '') + '…';
	}

	return { title, body: blocks.join('\n\n') + '\n', description, images };
}

function parseFeed(xml) {
	const field = (item, tag) => {
		const match = new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${tag}>`).exec(item);
		if (!match) throw new Error(`feed item is missing <${tag}>`);
		return match[1];
	};

	const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(([, item]) => {
		const link = field(item, 'link').split('?')[0];
		const id = /-([0-9a-f]{12})$/.exec(link)?.[1];
		if (!id) throw new Error(`could not find a Medium post id in ${link}`);
		return {
			id,
			link,
			title: decode(field(item, 'title')),
			date: new Date(field(item, 'pubDate')).toISOString().slice(0, 10),
			content: field(item, 'content:encoded')
		};
	});
	if (items.length === 0) throw new Error('the feed contained no posts');
	return items;
}

// Maps Medium post id -> slug for files that have already been synced, so a
// post keeps its URL even if its title (and Medium link) later changes.
async function existingSlugs() {
	const slugs = new Map();
	for (const file of await readdir(postsDir)) {
		if (!file.endsWith('.md')) continue;
		const raw = await readFile(path.join(postsDir, file), 'utf8');
		const id = /^medium:\s*([0-9a-f]{12})\s*$/m.exec(raw.split('\n---')[0])?.[1];
		if (id) slugs.set(id, file.slice(0, -3));
	}
	return slugs;
}

async function download(url) {
	const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
	if (!response.ok) throw new Error(`${response.status} ${response.statusText} fetching ${url}`);
	return response;
}

async function main() {
	const feed = parseFeed(await (await download(FEED_URL)).text());
	const slugs = await existingSlugs();

	// Every post that will be on this site after the sync: previously synced
	// files plus whatever is in the feed now.
	const localPosts = new Map(slugs);
	for (const item of feed) {
		if (!localPosts.has(item.id)) localPosts.set(item.id, slugFromLink(item.link));
	}

	// Convert everything before writing anything, so a post Medium has formatted
	// in a way this script doesn't understand can't leave a half-finished sync.
	const posts = feed.map((item) => {
		const slug = localPosts.get(item.id);
		const { title = item.title, body, description, images } = toMarkdown(
			item.content,
			slug,
			localPosts
		);
		const frontmatter = [
			'---',
			`title: ${JSON.stringify(title)}`,
			`date: ${item.date}`,
			`description: ${JSON.stringify(description)}`,
			`medium: ${item.id}`,
			'---'
		].join('\n');
		return { slug, title, images, markdown: `${frontmatter}\n\n${body}` };
	});

	const counts = { added: 0, updated: 0, unchanged: 0 };
	for (const post of posts) {
		const dir = path.join(imagesDir, post.slug);
		let changed = false;

		for (const image of post.images) {
			const target = path.join(dir, image.file);
			if (existsSync(target)) continue;
			await mkdir(dir, { recursive: true });
			await writeFile(target, Buffer.from(await (await download(image.src)).arrayBuffer()));
			changed = true;
		}
		if (existsSync(dir)) {
			const wanted = new Set(post.images.map((image) => image.file));
			for (const file of await readdir(dir)) {
				if (wanted.has(file)) continue;
				await rm(path.join(dir, file));
				changed = true;
			}
			if (wanted.size === 0) await rm(dir, { recursive: true });
		}

		const file = path.join(postsDir, `${post.slug}.md`);
		const current = existsSync(file) ? await readFile(file, 'utf8') : null;
		if (current !== post.markdown) await writeFile(file, post.markdown);

		const status =
			current === null ? 'added' : current !== post.markdown || changed ? 'updated' : 'unchanged';
		counts[status]++;
		console.log(`${status.padEnd(9)} ${post.slug}`);
	}

	console.log(
		`\n${counts.added} added, ${counts.updated} updated, ${counts.unchanged} unchanged ` +
			`(${posts.length} posts in the Medium feed)`
	);
}

main().catch((error) => {
	console.error(`Sync failed: ${error.message}`);
	process.exit(1);
});
