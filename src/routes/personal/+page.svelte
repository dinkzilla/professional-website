<script lang="ts">
	import { canonical } from '#lib/sides.ts';
	import { site } from '#lib/site.ts';
</script>

<svelte:head>
	<title>Personal | {site.name}</title>
	<link rel="canonical" href={canonical('personal', '/')} />
</svelte:head>
