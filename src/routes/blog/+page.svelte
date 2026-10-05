<script lang="ts">
	import { formatDate, site } from '#lib/site.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>Blog | {site.name}</title>
	<meta
		name="description"
		content="Writing on software architecture, engineering leadership, startups, security and AI."
	/>
</svelte:head>

<div class="page">
	<header class="page-header">
		<a class="back" href="/">← Main</a>
		<h1 class="page-title">Blog</h1>
	</header>

	<ul class="post-grid">
		{#each data.posts as post (post.slug)}
			<li>
				<a class="card" href="/blog/{post.slug}/">
					<p class="label">{formatDate(post.date)}</p>
					<h3>{post.title}</h3>
					<p>{post.description}</p>
					<span class="read">Read →</span>
				</a>
			</li>
		{/each}
	</ul>
</div>

<style>
	.post-grid {
		margin-top: clamp(2rem, 4vw, 2.5rem);
	}
</style>
