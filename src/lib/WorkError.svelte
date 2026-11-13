<script lang="ts">
	import '#lib/styles/work.css';
	import { page } from '$app/state';
	import { href } from '#lib/sides.ts';
	import { site } from '#lib/site.ts';
</script>

<svelte:head>
	<title>{page.status === 404 ? 'Page not found' : 'Error'} | {site.name}</title>
</svelte:head>

<main class="side-work">
	<div class="page">
		<header class="page-header">
			<h1 class="page-title">{page.status}</h1>
			<p class="tagline">
				{page.status === 404 ? "That page doesn't exist." : 'Something went wrong.'}
			</p>
			<p class="actions">
				<a class="button" href={href('work', '/')}>Main</a>
				<a class="button" href={href('work', '/blog/')}>Blog</a>
			</p>
		</header>
	</div>
</main>

<style>
	.actions {
		display: flex;
		gap: 1rem;
		margin: 2rem 0 0;
	}
</style>
