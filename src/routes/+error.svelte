<script lang="ts">
	import { page } from '$app/state';
	import PersonalError from '#lib/PersonalError.svelte';
	import { sideOf } from '#lib/sides.ts';
	import WorkError from '#lib/WorkError.svelte';

	// Errors render outside both sides' layouts, so each side's error page brings its own
	// wrapper and stylesheet. The URL decides which side's page to show.
	const side = $derived(sideOf(page.url.pathname));
</script>

{#if side === 'work'}
	<WorkError />
{:else}
	<PersonalError />
{/if}
