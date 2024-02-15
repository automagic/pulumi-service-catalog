<script lang="ts">
	import CatalogDisplay from '../components/CatalogDisplay.svelte';
	import type { PageServerData } from './$types';

	export let data: PageServerData;
</script>

<div class="catalog-page">
	<h1>Service Catalog</h1>

	{#each data.items as item}
		<CatalogDisplay {item} />
	{/each}
</div>

<style>
	.catalog-page {
		padding: 2rem 4rem;
		display: flex;
		align-items: center;
		flex-direction: column;
		justify-content: center;
	}
</style>
