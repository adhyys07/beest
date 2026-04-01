<script lang="ts">
  let { data } = $props();
</script>

{#if data.error}
  <div class="callback-error">
    <p>{data.error}</p>
    <a href="/tutorial">Back to tutorial</a>
  </div>
{:else}
  <p>Connecting Hackatime…</p>
{/if}

<style>
  .callback-error {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100vh;
    gap: 1rem;
    font-family: sans-serif;
    color: white;
    background: #2e3563;
  }

  .callback-error a {
    color: white;
    text-decoration: underline;
  }
</style>
