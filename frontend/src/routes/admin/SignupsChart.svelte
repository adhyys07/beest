<script lang="ts">
	import { onMount } from 'svelte';
	import { LineChart } from 'layerchart';
	import { scaleUtc } from 'd3-scale';
	import { utcFormat } from 'd3-time-format';

	interface HistoryPoint {
		date: string;
		count: number;
	}
	interface Payload {
		daily: HistoryPoint[];
		cumulative: HistoryPoint[];
		total: number;
	}

	let payload = $state<Payload | null>(null);
	let error = $state(false);

	interface ChartPoint {
		time: Date;
		count: number;
	}

	const shortDate = utcFormat('%b %-d');
	const longDate = utcFormat('%a %b %-d, %Y');

	const points: ChartPoint[] = $derived.by(() => {
		if (!payload) return [];
		return payload.cumulative.map((h) => ({
			time: new Date(h.date + 'T00:00:00Z'),
			count: h.count
		}));
	});

	const totalSignups = $derived(payload?.total ?? null);

	onMount(async () => {
		try {
			const res = await fetch('/api/admin/stats/signups');
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

<div class="signups-card">
	<div class="signups-header">
		<span class="signups-title">Cumulative Sign-ups</span>
		<span class="signups-total">{totalSignups ?? '…'} <small>total</small></span>
	</div>
	<div class="signups-chart">
		{#if error}
			<p class="signups-msg">Failed to load.</p>
		{:else if !payload}
			<p class="signups-msg">Loading…</p>
		{:else if points.length === 0}
			<p class="signups-msg">No data.</p>
		{:else}
			<LineChart
				data={points}
				x="time"
				xScale={scaleUtc()}
				yDomain={[0, null]}
				padding={{ top: 8, bottom: 24, left: 52, right: 16 }}
				series={[{ key: 'count', value: 'count', label: 'Sign-ups', color: '#a7e3a0' }]}
				props={{
					xAxis: {
						format: (v: Date) => shortDate(v),
						ticks: 6,
						tickLabelProps: { class: 'signups-tick' }
					},
					yAxis: {
						format: (v: number) => String(v),
						ticks: 4,
						tickLabelProps: { class: 'signups-tick' }
					},
					grid: { class: 'signups-grid' },
					rule: { class: 'signups-rule' },
					spline: { class: 'signups-line' },
					highlight: { points: { class: 'signups-dot-hover', r: 5 } },
					tooltip: {
						root: {
							classes: { root: 'signups-tooltip', container: 'signups-tooltip-inner' }
						},
						header: {
							format: (v: Date | string) => longDate(new Date(v as Date)),
							classes: { root: 'signups-tooltip-header' }
						},
						item: {
							classes: { root: 'signups-tooltip-item', label: 'signups-tooltip-label' }
						}
					}
				}}
			/>
		{/if}
	</div>
</div>

<style>
	.signups-card {
		display: flex;
		flex-direction: column;
		padding: 1rem 1.25rem;
		background: #1e1e1e;
		border: 2px solid #444;
		border-radius: 8px;
		margin-bottom: 1rem;
	}

	.signups-header {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		margin-bottom: 0.5rem;
	}

	.signups-title {
		font-size: 0.8rem;
		color: #888;
		letter-spacing: 0.02em;
	}

	.signups-total {
		font-size: 1.5rem;
		font-weight: 700;
		color: #e0e0e0;
		line-height: 1;
	}

	.signups-total small {
		font-size: 0.7rem;
		font-weight: 500;
		color: #888;
		margin-left: 0.25rem;
	}

	.signups-chart {
		height: 260px;
		width: 100%;
	}

	.signups-msg {
		margin: 0;
		padding-top: 4rem;
		text-align: center;
		color: #888;
		font-size: 0.85rem;
	}

	.signups-chart :global(.signups-tick) {
		fill: #c8c8c8 !important;
		stroke: none !important;
		font-size: 11px;
	}

	.signups-chart :global(.signups-line) {
		stroke: #a7e3a0;
		stroke-width: 2;
		fill: none;
	}

	.signups-chart :global(.signups-dot-hover) {
		fill: #d2f0cc;
		stroke: #1e1e1e;
		stroke-width: 2;
	}

	.signups-chart :global(.signups-grid) {
		stroke: #2a2a2a;
	}

	.signups-chart :global(.signups-rule) {
		stroke: #555;
	}

	.signups-chart :global(.tick) {
		stroke: #444;
	}

	.signups-chart :global(.signups-tooltip) {
		position: absolute;
		z-index: 50;
		pointer-events: none;
	}

	.signups-chart :global(.signups-tooltip-inner) {
		background: #2a2a2a;
		color: #e0e0e0;
		border: 1px solid #555;
		border-radius: 6px;
		padding: 6px 10px;
		font-size: 12px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
		white-space: nowrap;
	}

	.signups-chart :global(.signups-tooltip-header) {
		font-weight: 600;
		color: #e0e0e0;
		margin-bottom: 2px;
	}

	.signups-chart :global(.signups-tooltip-item) {
		display: flex;
		justify-content: space-between;
		gap: 0.75rem;
		color: #c8c8c8;
	}

	.signups-chart :global(.signups-tooltip-label) {
		color: #888;
	}
</style>
