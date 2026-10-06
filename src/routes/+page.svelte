<script lang="ts">
	import { tick } from 'svelte';
	import { cubicInOut } from 'svelte/easing';
	import { Tween } from 'svelte/motion';
	import { formatDate, mailto, site } from '#lib/site.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// The "Why Matt?" card is drawn as three stacked pieces (title, text, contact) that read
	// as one box. The middle piece folds up like an accordion: while animating it is sliced,
	// borders and shadow included, into SLATS horizontal strips that hinge on each other and
	// zigzag in 3D. `unfold` runs from 1 (flat, open) to 0 (folded shut); the fold angle and
	// the height of the middle piece derive from it.
	const SLATS = 6;
	const FOLD_MS = 900;
	const CARD_SHADOW = 6; // px: the card's drop shadow, so the right-hand strip folds too

	let whyOpen = $state(false);
	let slide = $state(0); // how far the toggle travels from beside the title to the corner
	let measuring = $state(false);
	let whyHeight = $state(0);
	let whyContent = $state<HTMLDivElement>();
	const unfold = new Tween(0, { duration: FOLD_MS, easing: cubicInOut });

	// Past this point the slats are flat to the eye, but the seams between them still show; swap
	// in the real piece early rather than let them linger through the easing's long tail.
	const FLAT = 0.97;

	const folding = $derived(
		unfold.current !== unfold.target && !(unfold.target === 1 && unfold.current > FLAT),
	);
	const foldAngle = $derived((1 - unfold.current) * 90);
	const foldShade = $derived(Math.sin((foldAngle * Math.PI) / 180));
	const bodyHeight = $derived(
		folding ? `${whyHeight * Math.cos((foldAngle * Math.PI) / 180)}px` : whyOpen ? 'auto' : '0px',
	);

	async function toggleWhy() {
		const opening = !whyOpen;
		if (!folding) {
			// The text is display:none while folded, so briefly show it (still clipped by the
			// zero-height body) to measure how tall the unfolded slats need to be.
			if (opening) {
				measuring = true;
				await tick();
			}
			whyHeight = whyContent?.offsetHeight ?? 0;
			measuring = false;
		}
		whyOpen = opening;
		const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		unfold.set(opening ? 1 : 0, { duration: reduceMotion ? 0 : FOLD_MS });
	}

	const clients = [
		{ name: 'Jet It', src: '/logos/jet-it.png' },
		{ name: 'EZLinks', src: '/logos/ez-links.png' },
		{ name: 'Katilyst', src: '/logos/katilyst.png' },
		{ name: 'Altigo', src: '/logos/altigo.png' },
		{ name: 'SingleComm', src: '/logos/singlecomm.jpg' },
		{ name: 'Loeb NYC', src: '/logos/loeb-nyc.jpg' },
		{ name: 'Dominion Energy', src: '/logos/dominion-energy.svg' },
		{ name: 'Advocate', src: '/logos/advocate.svg' },
		{ name: 'DG Dean', src: '/logos/dgdean.png' },
		{ name: 'IBS Club Software', src: '/logos/ibs-club-software.png' },
		{ name: 'Pangea Health', src: '/logos/pangea-health.jpg' },
		{ name: 'Altria', src: '/logos/altria.svg' },
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
		<img class="photo" src="/matt-dinkel.png" alt="Matt Dinkel" width="512" height="512" />
		<h1 class="page-title">{site.name}</h1>
		<p class="tagline">
			Fractional Engineering Leadership for startups and small businesses.
		</p>
	</header>

	<section class="why">
		<div class="piece why-top" class:open={whyOpen} class:folding style:--slide="{slide}px">
			<span class="spacer" bind:clientWidth={slide}></span>
			<h2 class="section-title">Why Matt?</h2>
			<button
				class="fold-toggle"
				type="button"
				aria-expanded={whyOpen}
				aria-controls="why-body"
				aria-label={whyOpen ? 'Fold up "Why Matt?"' : 'Unfold "Why Matt?"'}
				onclick={toggleWhy}
			>
				{#if whyOpen}
					<svg viewBox="0 0 24 24" aria-hidden="true">
						<path d="M6 6 18 18M18 6 6 18" />
					</svg>
				{:else}
					<svg viewBox="0 0 24 24" aria-hidden="true">
						<path d="m7 4 5 4 5-4M7 10l5 4 5-4M7 16l5 4 5-4" />
					</svg>
				{/if}
			</button>
			<span class="spacer"></span>
		</div>
		<div id="why-body" class="why-body" class:closed={!whyOpen && !folding} style:height={bodyHeight}>
			<div class="piece why-mid" class:ghost={folding}>
				<div
					class="why-content"
					bind:this={whyContent}
					hidden={folding || (!whyOpen && !measuring)}
				>
					{@render whyText()}
				</div>
			</div>
			{#if folding}
				<div
					class="fold"
					aria-hidden="true"
					inert
					style:--fold="{foldAngle}deg"
					style:--shade={foldShade}
					style:--slat="{whyHeight / SLATS}px"
					style:--shadow="{CARD_SHADOW}px"
				>
					{@render slat(0)}
				</div>
			{/if}
		</div>
		<div class="piece why-bottom">
			<div class="contact">
				<a class="button" href={mailto}>Let's Talk!</a>
				<span><span class="address">{site.email}</span></span>
			</div>
		</div>
	</section>

	{#snippet slat(i: number)}
		<div class="slat" class:first={i === 0} class:toward={i % 2 === 1} class:away={i > 0 && i % 2 === 0}>
			<div class="slice">
				<div class="clone piece why-mid" style:translate="0 calc({-i} * var(--slat))">
					<div class="why-content">{@render whyText()}</div>
				</div>
			</div>
			{#if i + 1 < SLATS}
				{@render slat(i + 1)}
			{/if}
		</div>
	{/snippet}

	{#snippet whyText()}
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
			I have been working in software development for over 15 years and have experience with companies and teams
			of all sizes. I have managed teams of 15 engineers working together and built early proof-of-concepts as a
			solo developer working part-time. I have worked in Fortune 500 IT departments and in tech startups that are
			still fighting to become profitable. My breadth of experience makes me especially adaptable and I have
			developed a deep understanding of when different development strategies will actually provide
			<span style="color: var(--purple)"><b><em>real business value</em></b></span>.
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
	{/snippet}


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

	<section>
		<h2 class="section-title outside">Who I've worked with:</h2>
		<ul class="logos">
			{#each clients as client (client.src)}
				<li><img src={client.src} alt={client.name} loading="lazy" /></li>
			{/each}
			<li class="you">
				<a class="you-button" href={mailto}><span class="you-prefix">Next Partner:</span>You?</a>
			</li>
		</ul>
	</section>
</div>

<style>
	/* Stacked and centred on phones (photo, name, tagline); on wider screens the photo
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
		width: 75%;
		height: auto;
		aspect-ratio: 1;
		border: 2px solid var(--ink);
		border-radius: 0.9rem;
		box-shadow: 6px 6px 0 var(--ink);
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

	/* 60px on desktop, easing down to 40px on phones. */
	section {
		margin-top: clamp(2.5rem, 7vw, 3.75rem);
	}

	.section-title {
		margin-bottom: 1.75rem;
	}

	/* The card is three stacked pieces (title / text / contact) with no borders between them,
	   so they read as a single .card. Only the middle piece folds. All three are positioned so
	   they paint in order and each piece's shadow is covered by the piece below it. */
	.why {
		font-size: 1.1875rem;
	}

	.piece {
		position: relative;
		display: flow-root; /* keeps the title's and contact row's margins inside the pieces */
		padding-inline: var(--box-padding);
		border: 2px solid var(--ink);
		background: var(--cream);
		box-shadow: 6px 6px 0 var(--ink);
		color: var(--ink);
	}

	/* Title row: [spacer][title][toggle][spacer]. The equal spacers centre the pair by default
	   (the folded state); one spacer's measured width is how far each slides to reach its
	   corner, the title left and the toggle right. */
	.why-top {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding-top: var(--box-padding);
		padding-bottom: 1.75rem;
		border-bottom: 0;
		border-radius: 0.9rem 0.9rem 0 0;
	}

	/* Trims the shadow at the hinge line so it doesn't poke out under the folding slats. Only
	   while folding: at rest the piece below covers the shadow anyway, and the clip edge lands
	   on a fractional pixel, which anti-aliases into a faint seam. */
	.why-top.folding {
		clip-path: inset(-12px -12px 0 -12px);
	}

	.why-mid {
		border-top: 0;
		border-bottom: 0;
		box-shadow: 6px 0 0 var(--ink);
	}

	.why-bottom {
		padding-bottom: var(--box-padding);
		border-top: 0;
		border-radius: 0 0 0.9rem 0.9rem;
	}

	/* The shadow is offset 6px down, so it starts 6px below this piece's top edge; this fills
	   that notch in the shadow strip. (right: -8px = the 2px border + the 6px shadow.) */
	.why-bottom::before {
		content: '';
		position: absolute;
		top: 0;
		right: -8px;
		width: 6px;
		height: 6px;
		background: var(--ink);
	}

	.why p {
		margin: 0 0 1.2rem;
	}

	.why-top .section-title {
		margin-bottom: 0; /* the row's padding-bottom carries the gap instead */
		translate: 0 0;
		transition: translate 0.9s cubic-bezier(0.65, 0, 0.35, 1);
	}

	.spacer {
		flex: 1;
	}

	.fold-toggle {
		flex: none;
		display: grid;
		place-items: center;
		width: 2.75rem;
		height: 2.75rem;
		padding: 0;
		border: 2px solid var(--ink);
		border-radius: 0.6rem;
		background: var(--red);
		box-shadow: 4px 4px 0 var(--ink);
		color: var(--ink);
		cursor: pointer;
		translate: 0 0;
		transition:
			transform 0.12s,
			box-shadow 0.12s,
			translate 0.9s cubic-bezier(0.65, 0, 0.35, 1),
			background-color 0.9s;
	}

	.why-top:not(.open) .fold-toggle {
		background: var(--green);
	}

	/* Open: the title and toggle slide apart to their corners, in step with the unfold, and
	   the toggle goes red. */
	.why-top.open .section-title {
		translate: calc(-1 * var(--slide)) 0;
	}

	.why-top.open .fold-toggle {
		translate: var(--slide) 0;
	}

	@media (prefers-reduced-motion: reduce) {
		.why-top .section-title {
			transition: none;
		}

		.fold-toggle {
			transition:
				transform 0.12s,
				box-shadow 0.12s;
		}
	}

	.fold-toggle:hover {
		transform: translate(2px, 2px);
		box-shadow: 2px 2px 0 var(--ink);
	}

	.fold-toggle svg {
		width: 1.5rem;
		height: 1.5rem;
		fill: none;
		stroke: currentColor;
		stroke-width: 3;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	.why-body {
		position: relative;
	}

	.why-body.closed {
		overflow: hidden;
	}

	/* While the slats are showing, the real middle piece gets out of the way. */
	.why-mid.ghost {
		visibility: hidden;
	}

	/* flow-root keeps child margins inside so offsetHeight is the true height of the text. */
	.why-content {
		display: flow-root;
	}

	.why-content[hidden] {
		display: none;
	}

	/* The accordion: each slat is a strip of the middle piece, hinged along the bottom edge of
	   the slat above (nested, so rotations compound) and rotated the opposite way to zigzag.
	   The fold is widened by the shadow so the shadow strip folds too; the clone inside is
	   pulled back to the real width so its text wraps identically. */
	.fold {
		position: absolute;
		top: 0;
		left: 0;
		right: calc(-1 * var(--shadow));
		z-index: 1;
		perspective: 1400px;
		perspective-origin: 50% 0;
	}

	.slat {
		position: relative;
		height: var(--slat);
		transform-origin: 50% 0;
		transform-style: preserve-3d;
	}

	.slat .slat {
		position: absolute;
		top: 100%;
		left: 0;
		right: 0;
	}

	.slat.first {
		transform: rotateX(calc(-1 * var(--fold)));
	}

	.slat.away {
		transform: rotateX(calc(-2 * var(--fold)));
	}

	.slat.toward {
		transform: rotateX(calc(2 * var(--fold)));
	}

	.slice {
		height: 100%;
		overflow: hidden;
	}

	.clone {
		margin-right: var(--shadow);
	}

	/* Faces turned away from the light darken as they fold. */
	.first .clone,
	.away .clone {
		filter: brightness(calc(1 - var(--shade) * 0.3));
	}

	.toward .clone {
		filter: brightness(calc(1 - var(--shade) * 0.08));
	}

	.contact {
		justify-content: center;
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
			grid-template-columns: repeat(3, 1fr);
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
		background: var(--cream);
		box-shadow: 5px 5px 0 var(--ink);
	}

	/* Several logos have white baked into the bitmap; multiply turns that white into the
	   cream behind it, so they sit on the tile like the transparent ones do. */
	.logos img {
		max-width: 100%;
		max-height: 100%;
		object-fit: contain;
		mix-blend-mode: multiply;
	}

	/* Fills the slots left over after the 13 logos: one on the 2-wide grid, two on the
	   3-wide grid. A big orange "Let's Talk!" in the title font. */
	.logos .you {
		padding: 0;
		border: 0;
		background: none;
		box-shadow: none;
	}

	.you-button {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.3em;
		width: 100%;
		height: 100%;
		border: 2px solid var(--ink);
		border-radius: 0.9rem;
		background: var(--orange);
		box-shadow: 5px 5px 0 var(--ink);
		color: var(--ink);
		font-family: var(--display);
		font-size: 2.5rem;
		font-weight: 700;
		letter-spacing: -0.025em;
		text-decoration: none;
		transition:
			transform 0.12s,
			box-shadow 0.12s;
	}

	.you-button:hover {
		transform: translate(2px, 2px);
		box-shadow: 3px 3px 0 var(--ink);
	}

	.you-prefix {
		display: none;
	}

	@media (min-width: 40rem) {
		.logos .you {
			grid-column: span 2;
		}

		.you-button {
			font-size: clamp(1.5rem, 4vw, 2rem);
		}

		.you-prefix {
			display: inline;
		}
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
	}

	/* Section titles that sit on the page background rather than inside a card. */
	.heading-row .section-title,
	.section-title.outside {
		color: var(--cream);
		text-shadow: 0.06em 0.06em 0 var(--ink);
	}
</style>
