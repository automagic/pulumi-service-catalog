<script lang="ts">
  import type { CatalogItem } from "../models";
  export let item: CatalogItem;
</script>

<div class="catalog-item">
  <p>Name: <b>{item.name}</b></p>
  <p>Description: <b>{item.description}</b></p>
  <div class="catalog-details">
    <span>Repository url : <b>{item.repository_url}</b></span>
    <span>Branch: <b>{item.branch}</b></span>
  </div>
</div>

<style>
  .catalog-item {
    border: 1px solid grey;
    padding: 2rem;
    width: 50%;
    margin: 1rem;
    border-radius: 10px;
  }

  .catalog-details {
    display: flex;
    justify-content: space-between;
  }
</style>
