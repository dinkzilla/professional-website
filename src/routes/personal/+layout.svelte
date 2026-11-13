<script lang="ts">
	import '#lib/styles/personal.css';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
</script>

<!-- personal.css only applies inside (and while the page contains) .side-personal -->
<main class="side-personal">
	{@render children()}
</main>
