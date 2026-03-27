<script lang="ts">
  let { data } = $props();
</script>

<div class="page">
  <div class="strata-sidebar" aria-hidden="true">
    <svg viewBox="0 0 120 1440" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
      <polygon points="40,0 25,140 55,300 20,440 50,580 15,720 48,860 28,1000 58,1140 22,1280 45,1440 120,1440 120,0" fill="#5e5648" />
      <polygon points="65,0 50,160 78,320 45,460 72,600 48,760 80,900 52,1040 82,1180 55,1320 70,1440 120,1440 120,0" fill="#56494a" />
    </svg>
  </div>
  <div class="content">
    <h1>Welcome back, {data.user.name ?? 'Hacker'}!</h1>
    <p>You're RSVP'd for #BEEST.</p>
  </div>
</div>

<style>
  .page {
    display: flex;
    min-height: 100vh;
    background: #4b4840;
  }

  .strata-sidebar {
    flex-shrink: 0;
    width: 80px;
    background: #786e5c;
    line-height: 0;
  }

  .strata-sidebar svg {
    width: 100%;
    height: 100%;
    display: block;
  }

  .content {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    font-family: "Courier New", monospace;
    color: #e8e0d4;
    background: #56494a;
  }

  h1 {
    margin-bottom: 0.5rem;
    font-family: "Stone Breaker", "Courier New", monospace;
    letter-spacing: 0.04em;
  }
</style>
