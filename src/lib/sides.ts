// The site has two sides, work and personal, and is deployed twice: mdinkel.com defaults to
// work and dink.money to personal. Both deployments contain every page. A deployment serves
// its default side at the top level and the other side under a prefix:
//
//                   mdinkel.com      dink.money
//   work home       /                /work/
//   blog            /blog/           /work/blog/
//   personal home   /personal/       /
//
// The route files always live in src/routes/work and src/routes/personal; the `reroute` hook
// (src/hooks.ts) maps the public URLs onto them. Which side is the default is fixed at build
// time by the DEFAULT_SIDE environment variable (see vite.config.ts).

export type Side = 'work' | 'personal';

export const DEFAULT_SIDE: Side = __DEFAULT_SIDE__;
export const OTHER_SIDE: Side = DEFAULT_SIDE === 'work' ? 'personal' : 'work';

/** Each side's own domain, where its pages are served at the top level. */
export const origins: Record<Side, string> = {
	work: 'https://mdinkel.com',
	personal: 'https://dink.money'
};

function hasPrefix(pathname: string, side: Side) {
	return pathname === `/${side}` || pathname.startsWith(`/${side}/`);
}

/**
 * The URL, in this deployment, of a page on `side`. `path` is the page's path within its
 * side, e.g. `href('work', '/blog/')`. Use this for every internal link.
 */
export function href(side: Side, path: string): string {
	return side === DEFAULT_SIDE ? path : `/${side}${path}`;
}

/** The one address search engines should index a page under: on its own side's domain. */
export function canonical(side: Side, path: string): string {
	return origins[side] + path;
}

/** Which side a public URL in this deployment belongs to. */
export function sideOf(pathname: string): Side {
	return hasPrefix(pathname, OTHER_SIDE) ? OTHER_SIDE : DEFAULT_SIDE;
}

/** Maps a public URL in this deployment to the route that renders it. */
export function routeFor(pathname: string): string {
	// SvelteKit's own endpoints (in dev, /_app/env.js is one) pass through this hook too.
	if (pathname.startsWith('/_app/')) return pathname;
	if (hasPrefix(pathname, OTHER_SIDE)) return pathname;
	// The default side is only served unprefixed. Its prefixed address must not work as a
	// second URL for the same page, so send it somewhere no route exists.
	if (hasPrefix(pathname, DEFAULT_SIDE)) return `/404${pathname}`;
	return `/${DEFAULT_SIDE}${pathname}`;
}
