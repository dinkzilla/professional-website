<script lang="ts">
	import '#lib/styles/work.css';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
</script>

<!-- work.css only applies inside (and while the page contains) .side-work -->
<main class="side-work">
	{@render children()}
</main>
