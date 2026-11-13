import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, loadEnv } from 'vite';

// The site is built twice from the same code: once with the work side at the top level (for
// mdinkel.com) and once with the personal side there (for dink.money). See src/lib/sides.ts.
// The DEFAULT_SIDE environment variable (or .env entry) picks which; work if unset.
export default defineConfig(({ mode }) => {
	const side = loadEnv(mode, '.', 'DEFAULT_SIDE').DEFAULT_SIDE === 'personal' ? 'personal' : 'work';
	const other = side === 'work' ? 'personal' : 'work';
	const out = side === 'work' ? 'build' : 'build-personal';
	// Separate ports so both variants can run side by side.
	const offset = side === 'work' ? 0 : 1;

	return {
		define: { __DEFAULT_SIDE__: JSON.stringify(side) },
		server: { port: 5173 + offset },
		preview: { port: 4173 + offset },
		plugins: [
			sveltekit({
				compilerOptions: {
					// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
					runes: ({ filename }) =>
						filename.split(/[/\\]/).includes('node_modules') ? undefined : true
				},

				// The whole site is prerendered to static files in /build (or /build-personal).
				adapter: adapter({ fallback: '404.html', pages: out, assets: out }),

				// Prerender by crawling from each side's public home page. The default ('*') would
				// start from the route files' own paths, which are not the public URLs.
				prerender: { entries: ['/', `/${other}/`] }
			})
		]
	};
});
