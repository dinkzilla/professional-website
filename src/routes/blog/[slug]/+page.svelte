<script lang="ts">
	import { formatDate, mailto, site } from '#lib/site.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	let post = $derived(data.post);
</script>

<svelte:head>
	<title>{post.title} | {site.name}</title>
	<meta name="description" content={post.description} />
	<meta property="og:title" content={post.title} />
	<meta property="og:description" content={post.description} />
	<meta property="og:type" content="article" />
	<meta property="og:url" content="{site.url}/blog/{post.slug}" />
	<meta property="article:published_time" content={post.date} />
</svelte:head>

<article class="page">
	<div class="page-header">
		<a class="back" href="/blog/">← Blog</a>
		<a class="back" href="/">← Main</a>
	</div>

	<div class="card box">
		<header>
			<h1>{post.title}</h1>
			<p class="label">
				{site.name} · <time datetime={post.date}>{formatDate(post.date)}</time>
				{#if post.mediumUrl}
					· <a href={post.mediumUrl} target="_blank" rel="noopener">Read on Medium</a>
				{/if}
			</p>
		</header>
		<div class="prose">
			<!-- Rendered at build time from the markdown files in src/posts -->
			{@html post.html}
		</div>
	</div>

	<aside class="card box">
		<p>
			<strong>Interested in learning more?</strong>
		<br/>
			Reach out for a free consultation.
		</p>
		<div class="contact">
			<a class="button" href={mailto}>Let's Talk!</a>
			<span><span class="address">{site.email}</span></span>
		</div>
	</aside>
</article>

<style>
	.back {
		margin: 0 1.25rem 0 0;
	}

	.page-header + .card {
		margin-top: 1.25rem;
	}

	h1 {
		color: var(--purple);
		font-size: clamp(2.25rem, 6.5vw, 3.75rem);
		letter-spacing: -0.03em;
	}

	.label {
		margin: 1.25rem 0 0;
		color: var(--orange);
	}

	.label a {
		color: inherit;
	}

	.label a:hover {
		color: var(--purple);
	}

	aside {
		margin-top: clamp(2rem, 4vw, 2.5rem);
		font-size: 1.1875rem;
	}

	.prose {
		margin-top: 2rem;
		font-size: 1.1875rem;
		line-height: 1.7;
		overflow-wrap: break-word;
	}

	.prose :global(:first-child) {
		margin-top: 0;
	}

	.prose :global(:last-child) {
		margin-bottom: 0;
	}

	.prose :global(h2) {
		margin: 3rem 0 1rem;
		font-size: 1.9rem;
	}

	.prose :global(h3) {
		margin: 2.5rem 0 0.75rem;
		font-size: 1.4rem;
	}

	.prose :global(p),
	.prose :global(ul),
	.prose :global(ol),
	.prose :global(blockquote),
	.prose :global(pre) {
		margin: 0 0 1.2rem;
	}

	.prose :global(li) {
		margin-bottom: 0.5rem;
	}

	.prose :global(strong) {
		font-weight: 800;
	}

	.prose :global(blockquote) {
		padding: 0.25rem 0 0.25rem 1.25rem;
		border-left: 5px solid var(--orange);
		font-weight: 600;
	}

	.prose :global(blockquote p:last-child) {
		margin-bottom: 0;
	}

	.prose :global(img) {
		display: block;
		margin: 2rem auto;
		border: 2px solid var(--ink);
		border-radius: 0.6rem;
	}

	.prose :global(pre) {
		padding: 1.1rem 1.25rem;
		overflow-x: auto;
		border-radius: 0.6rem;
		background: var(--night);
		color: #eceaf5;
		font-family: var(--mono);
		font-size: 0.8rem;
		line-height: 1.7;
	}

	.prose :global(:not(pre) > code) {
		font-family: var(--mono);
		font-size: 0.85em;
	}

	aside p {
		margin: 0 0 1.25rem;
	}
</style>
