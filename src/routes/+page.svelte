<script lang="ts">
	import { formatDate, mailto, site } from '#lib/site.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const clients = [
		{ name: 'Jet It', src: '/logos/jet-it.png' },
		{ name: 'EZLinks', src: '/logos/ez-links.jpg' },
		{ name: 'Katilyst', src: '/logos/katilyst.png' },
		{ name: 'Altigo', src: '/logos/altigo.png' },
		{ name: 'SingleComm', src: '/logos/singlecomm.jpg' },
		//{ name: 'DG Dean', src: '/logos/dgdean.png' },
		{ name: 'Loeb NYC', src: '/logos/loeb-nyc.jpg' },
		{ name: 'Advocate', src: '/logos/advocate.svg' },
		{ name: 'IBS Club Software', src: '/logos/ibs-club-software.jpg' },
		{ name: 'Pangea Health', src: '/logos/pangea-health.jpg' },
		{ name: 'Altria', src: '/logos/altria.svg' },
		{ name: 'Dominion Energy', src: '/logos/dominion-energy.svg' },
		{ name: 'College Board', src: '/logos/college-board.svg' },
	];
</script>

<svelte:head>
	<title>{site.name} | Fractional CTO/CISO and Engineering Leadership</title>
	<meta name="description" content={site.description} />
	<meta property="og:title" content={site.name} />
	<meta property="og:description" content={site.description} />
	<meta property="og:type" content="website" />
	<meta property="og:url" content={site.url} />
</svelte:head>

<div class="page">
	<header class="page-header">
		<h1 class="page-title">{site.name}</h1>
		<img class="photo" src="/matt-dinkel.png" alt="Matt Dinkel" width="512" height="512" />
		<p class="tagline">
			Fractional Engineering Leadership for startups and small businesses.
		</p>
	</header>

	<section class="card box why">
		<h2 class="section-title">Why Matt?</h2>
		<div>
			<p>
				The development needs of small businesses and startups are often drastically different than
				those of large companies.
			</p>
			<p>
				When costs and time matter and hard decisions are made daily, it
				is important that your development team is doing more than just building tools for you. A
				true partner should help you make appropriate and realistic technical decisions with a
				strong understanding of your business's goals, risks, and limitations in mind.
			</p>
			<p>
				I have been working in software development since 2010 and have experience with companies and teams
				of all sizes. I have managed large teams with massive budgets and built early proof-of-concepts as a solo
				developer working part-time. My breadth of experience makes me especially adaptable and I have developed a
				deep understanding of when different development strategies will actually provide real value.
			</p>
			<p>
				I am especially passionate about helping development teams scale. Both technology and
				process changes are often required to help grow from a single team of developers to multiple
				teams operating independently. With the right approach, it is possible to navigate these
				changes while laying the foundation to grow even further.
			</p>
			<p>
				I would love to learn about your business and help you avoid the pitfalls of technical
				organization growth.
			</p>
			<div class="contact">
				<a class="button" href={mailto}>Let's Talk!</a>
				<span><span class="address">{site.email}</span></span>
			</div>
		</div>
	</section>

	<section class="card box">
		<h2 class="section-title">Who I've worked with:</h2>
		<ul class="logos">
			{#each clients as client (client.src)}
				<li><img src={client.src} alt={client.name} loading="lazy" /></li>
			{/each}
		</ul>
	</section>

	<section>
		<div class="heading-row">
			<h2 class="section-title">Blog</h2>
			<a class="button" href="/blog/">All posts →</a>
		</div>
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
	</section>
</div>

<style>
	/* Stacked and centred on phones (name, photo, tagline); on wider screens the photo
	   sits to the right of the centred name and tagline. */
	.page-header {
		display: grid;
		justify-items: center;
		gap: 1.25rem;
		text-align: center;
	}

	.tagline {
		margin: 0;
		font-size: clamp(1.1rem, 2.4vw, 1.35rem);
	}

	.photo {
		width: 9rem;
		height: 9rem;
		border: 2px solid var(--ink);
		border-radius: 0.9rem;
		box-shadow: 6px 6px 0 var(--orange);
		object-fit: cover;
	}

	@media (min-width: 48rem) {
		.page-header {
			grid-template-columns: 1fr auto;
			grid-template-areas:
				'name photo'
				'tagline photo';
			align-items: center;
			gap: 0.5rem 2rem;
		}

		.page-title {
			grid-area: name;
			align-self: end;
			white-space: nowrap;
		}

		.tagline {
			grid-area: tagline;
			align-self: start;
		}

		.photo {
			grid-area: photo;
			width: 10rem;
			height: 10rem;
		}
	}

	section {
		margin-top: clamp(3.5rem, 8vw, 5rem);
	}

	header + section {
		margin-top: clamp(2rem, 4vw, 2.5rem);
	}

	.section-title {
		margin-bottom: 1.75rem;
	}

	.why {
		font-size: 1.1875rem;
	}

	.why p {
		margin: 0 0 1.2rem;
	}

	.contact {
		margin-top: 0.75rem;
	}

	.logos {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 1rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	@media (min-width: 40rem) {
		.logos {
			grid-template-columns: repeat(4, 1fr);
			gap: 1.25rem;
		}
	}

	.logos li {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 6rem;
		padding: 1.1rem;
		border: 2px solid var(--ink);
		border-radius: 0.9rem;
		background: #fff;
		box-shadow: 5px 5px 0 var(--purple);
	}

	.logos img {
		max-width: 100%;
		max-height: 100%;
		object-fit: contain;
	}

	.heading-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 1rem 2rem;
		margin-bottom: 1.75rem;
	}

	.heading-row .section-title {
		margin: 0;
		color: var(--cream);
		text-shadow: 0.06em 0.06em 0 var(--ink);
	}
</style>
