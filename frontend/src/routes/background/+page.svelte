<script lang="ts">
  let clouds = [
    { top: 10, left: 5, opacity: 0.7, scale: 0.6 },
    { top: 25, left: 60, opacity: 0.5, scale: 0.45 },
    { top: 45, left: 20, opacity: 0.6, scale: 0.55 },
  ];

  let scrollY = 0;
</script>

<svelte:window bind:scrollY />

<div class="sky">
  <div class="sky-tile"></div>
  <div class="sky-tint"></div>

  {#each clouds as cloud}
    <img
      src="/images/cloud.webp"
      alt=""
      class="cloud"
      style="
        top: {cloud.top}%;
        left: {cloud.left}%;
        opacity: {cloud.opacity};
        transform: scale({cloud.scale}) translateY({scrollY * -0.05}px);
      "
    />
  {/each}
</div>

<style>
  .sky {
    position: fixed;
    inset: 0;
    overflow: hidden;
  }

  .sky-tile {
    position: absolute;
    inset: 0;
    background: url('/images/sky.webp') center 55% / cover no-repeat;
  }

  .sky-tint {
    position: absolute;
    inset: 0;
    background: linear-gradient(to bottom, #3d6e99, #5b72a0);
    mix-blend-mode: color;
  }

  .cloud {
    position: absolute;
    width: 55vw;
    height: auto;
    pointer-events: none;
    will-change: transform;
  }
</style>
