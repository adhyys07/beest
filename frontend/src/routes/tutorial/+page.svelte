<script lang="ts">
  import { onMount, tick } from 'svelte';

  let { data } = $props();
  let pageEl: HTMLDivElement;
  let cardEls: HTMLDivElement[] = [];
  let currentCard = $state(0); // index of the card the user is currently on

  const cards = [
    { n: 1, label: 'Start a Project',      x: 55, y: 4200, rot: 2.5 },
    { n: 2, label: 'Add Details',           x: 18, y: 3400, rot: -1.5 },
    { n: 3, label: 'Set Up Hackatime',      x: 60, y: 2850, rot: 1 },
    { n: 4, label: 'Join the Community',    x: 22, y: 2050, rot: -2.5 },
    { n: 5, label: 'Welcome',               x: 50, y: 1500, rot: 2 },
  ];

  type Segment = { d: string; index: number };
  let segments: Segment[] = $state([]);

  function computeSegments() {
    if (!pageEl || cardEls.length === 0) return;
    const pageRect = pageEl.getBoundingClientRect();
    const PAD = 24; // gap between arrow tip and card edge

    const rects = cardEls.map(el => {
      const r = el.getBoundingClientRect();
      return {
        cx: r.left - pageRect.left + r.width / 2,
        cy: r.top - pageRect.top + r.height / 2,
        top: r.top - pageRect.top,
        bottom: r.top - pageRect.top + r.height,
        left: r.left - pageRect.left,
        right: r.left - pageRect.left + r.width
      };
    });

    const segs: Segment[] = [];
    for (let i = 0; i < rects.length - 1; i++) {
      const src = rects[i];
      const dst = rects[i + 1];

      // Cards scroll bottom-to-top, so src is below dst
      // Arrow starts from top edge of source card, ends near bottom edge of target card
      const startX = src.cx;
      const startY = src.top - PAD;
      const endX = dst.cx;
      const endY = dst.bottom + PAD + 30; // +30 to account for arrowhead extending beyond line end

      const cpY = (startY + endY) / 2;
      segs.push({
        d: `M ${startX} ${startY} C ${startX} ${cpY}, ${endX} ${cpY}, ${endX} ${endY}`,
        index: i
      });
    }
    segments = segs;
  }

  let offsetY = $state(0);
  let heroEl: HTMLDivElement;

  function scrollToCard(index: number) {
    currentCard = index;
    const el = cardEls[index];
    if (!el) return;
    const cardTop = el.offsetTop;
    const cardHeight = el.offsetHeight;
    const viewH = window.innerHeight;
    offsetY = -(cardTop + cardHeight / 2 - viewH / 2);
  }

  function scrollToHero() {
    currentCard = cards.length;
    offsetY = 0;
  }

  onMount(() => {
    (async () => {
      await tick();
      computeSegments();
      scrollToCard(0);
    })();
    const resizeHandler = () => {
      computeSegments();
      scrollToCard(currentCard);
    };
    window.addEventListener('resize', resizeHandler);
    return () => window.removeEventListener('resize', resizeHandler);
  });
</script>

<div class="viewport">
<div class="page" bind:this={pageEl} style="transform: translateY({offsetY}px);">
  <div class="hero-top" bind:this={heroEl}>
    <img src="/images/tutorial-top.webp" alt="" class="hero-img" />
  </div>

  <!-- Decorative pipes -->
  <div class="pipe pipe-l1" aria-hidden="true"></div>
  <div class="pipe pipe-r1" aria-hidden="true"></div>
  <div class="pipe pipe-l2" aria-hidden="true"></div>
  <div class="pipe pipe-r2" aria-hidden="true"></div>
  <div class="pipe pipe-l3" aria-hidden="true"></div>
  <div class="pipe pipe-r3" aria-hidden="true"></div>

  <!-- Decorative gears -->
  <svg class="gear gear-l1" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <g fill="#b8956e"><circle cx="50" cy="50" r="30"/>{#each Array(8) as _, t}<rect x="43" y="4" width="14" height="22" rx="3" transform="rotate({t*45} 50 50)"/>{/each}</g><circle cx="50" cy="50" r="12" fill="#deb49d"/>
  </svg>
  <svg class="gear gear-r1" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <g fill="#a8845e"><circle cx="50" cy="50" r="30"/>{#each Array(8) as _, t}<rect x="43" y="4" width="14" height="22" rx="3" transform="rotate({t*45 + 22.5} 50 50)"/>{/each}</g><circle cx="50" cy="50" r="12" fill="#c49a7a"/>
  </svg>
  <svg class="gear gear-l2" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <g fill="#917053"><circle cx="50" cy="50" r="30"/>{#each Array(8) as _, t}<rect x="43" y="4" width="14" height="22" rx="3" transform="rotate({t*45} 50 50)"/>{/each}</g><circle cx="50" cy="50" r="12" fill="#a8845e"/>
  </svg>
  <svg class="gear gear-r2" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <g fill="#7a6348"><circle cx="50" cy="50" r="30"/>{#each Array(8) as _, t}<rect x="43" y="4" width="14" height="22" rx="3" transform="rotate({t*45 + 22.5} 50 50)"/>{/each}</g><circle cx="50" cy="50" r="12" fill="#917053"/>
  </svg>
  <svg class="gear gear-l3" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <g fill="#634e38"><circle cx="50" cy="50" r="30"/>{#each Array(8) as _, t}<rect x="43" y="4" width="14" height="22" rx="3" transform="rotate({t*45} 50 50)"/>{/each}</g><circle cx="50" cy="50" r="12" fill="#7a6348"/>
  </svg>

  <!-- Strata: hero → card 5 section -->
  <div class="rock-strata" style="position:absolute;top:1300px;left:0;right:0;background:#d8ac96" aria-hidden="true">
    <svg viewBox="0 0 1440 120" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
      <polygon points="0,40 140,25 300,55 440,20 580,50 720,15 860,48 1000,28 1140,58 1280,22 1440,45 1440,120 0,120" fill="#c8a488" />
      <polygon points="0,65 160,50 320,78 460,45 600,72 760,48 900,80 1040,52 1180,82 1320,55 1440,70 1440,120 0,120" fill="#deb49d" />
    </svg>
  </div>

  <!-- Section bg: card 5 -->
  <div class="section-bg" style="top:1350px;height:550px;background:#deb49d"></div>

  <!-- Strata: #deb49d → #c49a7a -->
  <div class="rock-strata" style="position:absolute;top:1900px;left:0;right:0;background:#deb49d" aria-hidden="true">
    <svg viewBox="0 0 1440 120" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
      <polygon points="0,38 180,52 340,28 500,55 660,20 820,50 980,35 1140,58 1300,22 1440,45 1440,120 0,120" fill="#d0a585" />
      <polygon points="0,62 200,75 360,50 520,78 680,45 840,72 1000,52 1160,80 1320,55 1440,68 1440,120 0,120" fill="#c49a7a" />
    </svg>
  </div>

  <!-- Section bg: card 4 -->
  <div class="section-bg" style="top:1950px;height:550px;background:#c49a7a"></div>

  <!-- Strata: #c49a7a → #a8845e -->
  <div class="rock-strata" style="position:absolute;top:2500px;left:0;right:0;background:#c49a7a" aria-hidden="true">
    <svg viewBox="0 0 1440 120" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
      <polygon points="0,35 180,52 340,28 500,58 660,22 820,55 980,32 1140,60 1300,25 1440,48 1440,120 0,120" fill="#b68e6c" />
      <polygon points="0,60 200,75 380,48 540,78 700,42 860,72 1020,50 1180,76 1340,54 1440,68 1440,120 0,120" fill="#a8845e" />
    </svg>
  </div>

  <!-- Section bg: card 3 -->
  <div class="section-bg" style="top:2550px;height:650px;background:#a8845e"></div>

  <!-- Strata: #a8845e → #7a6348 -->
  <div class="rock-strata" style="position:absolute;top:3200px;left:0;right:0;background:#a8845e" aria-hidden="true">
    <svg viewBox="0 0 1440 120" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
      <polygon points="0,38 160,55 320,30 480,60 640,25 800,52 960,35 1120,58 1280,28 1440,50 1440,120 0,120" fill="#917053" />
      <polygon points="0,62 200,78 360,52 520,80 680,48 840,75 1000,55 1160,82 1320,58 1440,72 1440,120 0,120" fill="#7a6348" />
    </svg>
  </div>

  <!-- Section bg: card 2 -->
  <div class="section-bg" style="top:3250px;height:700px;background:#7a6348"></div>

  <!-- Strata: #7a6348 → #4b3a2a -->
  <div class="rock-strata" style="position:absolute;top:3950px;left:0;right:0;background:#7a6348" aria-hidden="true">
    <svg viewBox="0 0 1440 120" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
      <polygon points="0,42 140,28 300,58 440,22 580,52 720,18 860,50 1000,30 1140,55 1280,25 1440,48 1440,120 0,120" fill="#634e38" />
      <polygon points="0,68 180,80 340,55 500,82 660,50 820,78 980,58 1140,84 1300,60 1440,75 1440,120 0,120" fill="#4b3a2a" />
    </svg>
  </div>

  <!-- Section bg: card 1 -->
  <div class="section-bg" style="top:4000px;height:1000px;background:#4b3a2a"></div>

  {#if segments.length > 0}
    <svg class="path-line" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <marker id="arrowhead" viewBox="0 0 10 10" refX="0" refY="5"
          markerWidth="50" markerHeight="50" orient="auto" markerUnits="userSpaceOnUse">
          <polyline points="0,0 10,5 0,10" fill="none" stroke="#000000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
        </marker>
        <marker id="arrowhead-active" viewBox="0 0 10 10" refX="0" refY="5"
          markerWidth="50" markerHeight="50" orient="auto" markerUnits="userSpaceOnUse">
          <polyline points="0,0 10,5 0,10" fill="none" stroke="#c43b3b" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
        </marker>
      </defs>
      {#each segments as seg}
        {@const active = seg.index < currentCard}
        <path
          d={seg.d}
          fill="none"
          stroke={active ? '#c43b3b' : '#000000'}
          stroke-width="10"
          stroke-linecap="round"
          marker-end={active ? 'url(#arrowhead-active)' : 'url(#arrowhead)'}
          class="segment-arrow"
        />
      {/each}
    </svg>
  {/if}

  <div class="content">
    {#each cards as card, i}
      <div
        class="card"
        bind:this={cardEls[i]}
        style="top: {card.y}px; left: {card.x}%; transform: rotate({card.rot}deg);"
      >
        <h2>{card.n}. {card.label}</h2>
        <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam.</p>
        {#if i < cards.length - 1}
          <button class="next-btn" onclick={() => scrollToCard(i + 1)}>Next &uarr;</button>
        {:else}
          <button class="next-btn" onclick={scrollToHero}>Finish &uarr;</button>
        {/if}
      </div>
    {/each}
  </div>
</div>
</div>

<style>
  .viewport {
    position: fixed;
    inset: 0;
    overflow: hidden;
  }

  .page {
    position: relative;
    min-height: 5000px;
    background: #dfb59e;
    transition: transform 0.8s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .section-bg {
    position: absolute;
    left: 0;
    right: 0;
    z-index: 0;
  }

  .rock-strata {
    display: block;
    width: 100%;
    line-height: 0;
    z-index: 0;
  }

  .rock-strata svg {
    display: block;
    width: 100%;
    height: 80px;
  }

  .path-line {
    position: absolute;
    inset: 0;
    width: 100%;
    min-height: 5000px;
    overflow: visible;
    pointer-events: none;
    z-index: 2;
  }

  .segment-arrow {
    transition: opacity 0.4s ease;
  }

  .hero-top {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 1350px;
    z-index: 1;
    overflow: hidden;
    background: #d8ac96;
  }

  .hero-img {
    width: 100%;
    object-fit: contain;
    object-position: center top;
    display: block;
    mask-image: linear-gradient(to bottom, black 60%, transparent 100%);
    -webkit-mask-image: linear-gradient(to bottom, black 60%, transparent 100%);
  }

  .content {
    position: absolute;
    inset: 0;
    z-index: 3;
  }

  .card {
    position: absolute;
    width: 520px;
    min-height: 220px;
    background: #f5f0e8;
    color: #2a2220;
    padding: 3rem 3rem;
    border-radius: 8px;
    box-shadow: 0 6px 30px rgba(0, 0, 0, 0.4), 0 2px 8px rgba(0, 0, 0, 0.3);
    font-family: "Courier New", monospace;
  }

  .card h2 {
    margin: 0 0 1.25rem;
    font-size: 1.6rem;
    font-family: "Stone Breaker", "Courier New", monospace;
    letter-spacing: 0.03em;
    color: #3b3029;
    border-bottom: 2px solid #d4cabb;
    padding-bottom: 0.75rem;
  }

  .card p {
    margin: 0;
    font-size: 1.05rem;
    line-height: 1.7;
    color: #4a4240;
  }

  .next-btn {
    display: block;
    margin: 1.5rem auto 0;
    padding: 0.6rem 1.6rem;
    background: #3b3029;
    color: #e8e0d4;
    border: none;
    border-radius: 4px;
    font-family: "Courier New", monospace;
    font-size: 0.95rem;
    cursor: pointer;
    transition: background 0.2s;
  }

  .next-btn:hover {
    background: #c9a84c;
    color: #2a2220;
  }

  /* ── decorative pipes ───────────────────────────── */
  .pipe {
    position: absolute;
    background: #8a8279;
    border-radius: 6px;
    z-index: 4;
    pointer-events: none;
  }
  .pipe::after {
    content: '';
    position: absolute;
    background: #9e958a;
    border-radius: 4px;
  }

  .pipe-l1 {
    width: 180px; height: 22px;
    top: 1650px; left: -40px;
    transform: rotate(-5deg);
    opacity: 0.6;
  }
  .pipe-l1::after {
    width: 14px; height: 34px;
    right: -2px; top: -6px;
  }

  .pipe-r1 {
    width: 160px; height: 20px;
    top: 2150px; right: -30px;
    transform: rotate(-8deg);
    opacity: 0.55;
  }
  .pipe-r1::after {
    width: 14px; height: 32px;
    left: -2px; top: -6px;
  }

  .pipe-l2 {
    width: 150px; height: 18px;
    top: 2750px; left: -30px;
    transform: rotate(4deg);
    opacity: 0.5;
  }
  .pipe-l2::after {
    width: 12px; height: 28px;
    right: -2px; top: -5px;
  }

  .pipe-r2 {
    width: 170px; height: 20px;
    top: 3400px; right: -40px;
    transform: rotate(6deg);
    opacity: 0.45;
  }
  .pipe-r2::after {
    width: 14px; height: 30px;
    left: -2px; top: -5px;
  }

  .pipe-l3 {
    width: 140px; height: 16px;
    top: 4000px; left: -20px;
    transform: rotate(-3deg);
    opacity: 0.4;
  }
  .pipe-l3::after {
    width: 12px; height: 26px;
    right: -2px; top: -5px;
  }

  .pipe-r3 {
    width: 160px; height: 18px;
    top: 4400px; right: -30px;
    transform: rotate(-10deg);
    opacity: 0.4;
  }
  .pipe-r3::after {
    width: 14px; height: 28px;
    left: -2px; top: -5px;
  }

  /* ── decorative gears ───────────────────────────── */
  .gear {
    position: absolute;
    pointer-events: none;
    z-index: 4;
  }

  .gear-l1 {
    width: 90px; height: 90px;
    top: 1850px; left: -20px;
    opacity: 0.55;
  }

  .gear-r1 {
    width: 120px; height: 120px;
    top: 2450px; right: -30px;
    opacity: 0.5;
  }

  .gear-l2 {
    width: 100px; height: 100px;
    top: 3100px; left: -25px;
    opacity: 0.45;
  }

  .gear-r2 {
    width: 80px; height: 80px;
    top: 3700px; right: -15px;
    opacity: 0.4;
  }

  .gear-l3 {
    width: 110px; height: 110px;
    top: 4300px; left: -30px;
    opacity: 0.35;
  }
</style>
