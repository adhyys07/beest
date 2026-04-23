<script lang="ts">
	import { onMount } from 'svelte';

	interface FunnelPayload {
		signedUp: number;
		loggedIn: number;
		linkedHackatime: number;
		submittedProject: number;
		approvedProject: number;
	}

	let payload = $state<FunnelPayload | null>(null);
	let error = $state(false);

	interface Stage {
		label: string;
		count: number;
	}

	const stages: Stage[] = $derived.by(() => {
		if (!payload) return [];
		return [
			{ label: 'Signed up (RSVP)', count: payload.signedUp },
			{ label: 'Logged in to beest', count: payload.loggedIn },
			{ label: 'Linked Hackatime', count: payload.linkedHackatime },
			{ label: 'Submitted a project', count: payload.submittedProject },
			{ label: 'Got a project approved', count: payload.approvedProject }
		];
	});

	const maxCount = $derived(stages.length > 0 ? Math.max(...stages.map((s) => s.count), 1) : 1);
	const topCount = $derived(stages.length > 0 ? stages[0].count : 0);

	function pct(n: number): string {
		if (topCount === 0) return '—';
		return `${Math.round((n / topCount) * 100)}%`;
	}

	function width(n: number): string {
		return `${Math.max(3, (n / maxCount) * 100)}%`;
	}

	onMount(async () => {
		try {
			const res = await fetch('/api/admin/stats/funnel');
			if (!res.ok) {
				error = true;
				return;
			}
			payload = await res.json();
		} catch {
			error = true;
		}
	});
</script>

<div class="funnel-card">
	<div class="funnel-header">
		<span class="funnel-title">User Funnel</span>
	</div>
	{#if error}
		<p class="funnel-msg">Failed to load.</p>
	{:else if !payload}
		<p class="funnel-msg">Loading…</p>
	{:else}
		<ol class="funnel-stages">
			{#each stages as stage, i}
				{@const dropoff = i > 0 ? stages[i - 1].count - stage.count : 0}
				<li class="funnel-stage">
					<div class="funnel-stage-head">
						<span class="funnel-label">{stage.label}</span>
						<span class="funnel-nums">
							<strong>{stage.count.toLocaleString()}</strong>
							<span class="funnel-pct">{pct(stage.count)}</span>
						</span>
					</div>
					<div class="funnel-bar-wrap">
						<div class="funnel-bar" style="width: {width(stage.count)};"></div>
					</div>
					{#if i > 0 && dropoff > 0}
						<div class="funnel-drop">−{dropoff.toLocaleString()} drop-off</div>
					{/if}
				</li>
			{/each}
		</ol>
	{/if}
</div>

<style>
	.funnel-card {
		display: flex;
		flex-direction: column;
		padding: 1rem 1.25rem;
		background: #1e1e1e;
		border: 2px solid #444;
		border-radius: 8px;
		margin-bottom: 1rem;
	}

	.funnel-header {
		margin-bottom: 0.75rem;
	}

	.funnel-title {
		font-size: 0.8rem;
		color: #888;
		letter-spacing: 0.02em;
	}

	.funnel-msg {
		margin: 0.5rem 0;
		color: #888;
		font-size: 0.85rem;
	}

	.funnel-stages {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.funnel-stage {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.funnel-stage-head {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		font-size: 0.85rem;
		color: #c8c8c8;
	}

	.funnel-label {
		color: #c8c8c8;
	}

	.funnel-nums strong {
		color: #e0e0e0;
		font-weight: 700;
	}

	.funnel-pct {
		color: #888;
		margin-left: 0.5rem;
		font-size: 0.75rem;
	}

	.funnel-bar-wrap {
		height: 14px;
		background: #2a2a2a;
		border-radius: 3px;
		overflow: hidden;
	}

	.funnel-bar {
		height: 100%;
		background: linear-gradient(90deg, #8bd0f7, #6fa8d6);
		transition: width 0.3s ease;
	}

	.funnel-drop {
		font-size: 0.7rem;
		color: #b47a7a;
		margin-top: 0.1rem;
	}
</style>
