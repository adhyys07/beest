<script lang="ts">
	import { onMount } from 'svelte';
	import { Axis, Chart, Highlight, Points, Spline, Svg, Tooltip } from 'layerchart';
	import { scaleUtc } from 'd3-scale';
	import { utcFormat } from 'd3-time-format';

	interface HistoryPoint {
		date: string;
		count: number;
	}
	interface Payload {
		history: HistoryPoint[];
		today: { count: number; timestamp: number };
	}

	let payload = $state<Payload | null>(null);
	let error = $state(false);

	// Combined series: historical points at UTC midnight + today's rolling-24h point.
	// Flagged so the "today" point can be highlighted and labelled differently.
	interface ChartPoint {
		time: Date;
		count: number;
		label: string;
		isToday: boolean;
	}

	const shortDate = utcFormat('%b %-d');
	const longDate = utcFormat('%a %b %-d');

	const points: ChartPoint[] = $derived.by(() => {
		if (!payload) return [];
		const hist: ChartPoint[] = payload.history.map((h) => ({
			time: new Date(h.date + 'T00:00:00Z'),
			count: h.count,
			label: longDate(new Date(h.date + 'T00:00:00Z')),
			isToday: false
		}));
		hist.push({
			time: new Date(payload.today.timestamp),
			count: payload.today.count,
			label: 'Today (rolling 24h)',
			isToday: true
		});
		return hist;
	});

	const todayCount = $derived(payload?.today.count ?? null);

	onMount(async () => {
		try {
			const res = await fetch('/api/admin/stats/dau/history');
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

<div class="dau-card">
	<div class="dau-header">
		<span class="dau-title">Daily Active Users</span>
		<span class="dau-today">{todayCount ?? '…'} <small>today</small></span>
	</div>
	<div class="dau-chart">
		{#if error}
			<p class="dau-msg">Failed to load.</p>
		{:else if !payload}
			<p class="dau-msg">Loading…</p>
		{:else if points.length === 0}
			<p class="dau-msg">No data.</p>
		{:else}
			<Chart
				data={points}
				x="time"
				y="count"
				xScale={scaleUtc()}
				yDomain={[0, null]}
				yNice
				padding={{ top: 12, bottom: 28, left: 36, right: 12 }}
				tooltip={{ mode: 'bisect-x' }}
			>
				<Svg>
					<Axis
						placement="left"
						grid={{ class: 'dau-grid' }}
						rule
						ticks={4}
						format={(v: number) => String(v)}
					/>
					<Axis placement="bottom" rule ticks={6} format={(v: Date) => shortDate(v)} />
					<Spline class="dau-line" />
					<Points class="dau-dot" r={3} />
					<Highlight points lines />
					<Tooltip.Root let:data>
						<Tooltip.Header>{(data as ChartPoint).label}</Tooltip.Header>
						<Tooltip.List>
							<Tooltip.Item label="Active users" value={(data as ChartPoint).count} />
						</Tooltip.List>
					</Tooltip.Root>
				</Svg>
			</Chart>
		{/if}
	</div>
</div>

<style>
	.dau-card {
		display: flex;
		flex-direction: column;
		padding: 1rem 1.25rem;
		background: #1e1e1e;
		border: 2px solid #444;
		border-radius: 8px;
		margin-bottom: 1rem;
	}

	.dau-header {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		margin-bottom: 0.5rem;
	}

	.dau-title {
		font-size: 0.8rem;
		color: #888;
		letter-spacing: 0.02em;
	}

	.dau-today {
		font-size: 1.5rem;
		font-weight: 700;
		color: #e0e0e0;
		line-height: 1;
	}

	.dau-today small {
		font-size: 0.7rem;
		font-weight: 500;
		color: #888;
		margin-left: 0.25rem;
	}

	.dau-chart {
		height: 220px;
		width: 100%;
	}

	.dau-msg {
		margin: 0;
		padding-top: 4rem;
		text-align: center;
		color: #888;
		font-size: 0.85rem;
	}

	.dau-chart :global(.dau-line) {
		stroke: #8bd0f7;
		stroke-width: 2;
		fill: none;
	}

	.dau-chart :global(.dau-dot) {
		fill: #8bd0f7;
		stroke: #1e1e1e;
		stroke-width: 1.5;
	}

	.dau-chart :global(.dau-grid path),
	.dau-chart :global(.dau-grid line) {
		stroke: #2a2a2a;
	}

	.dau-chart :global(text) {
		fill: #888;
		font-size: 11px;
	}

	.dau-chart :global(.tick line),
	.dau-chart :global(.rule) {
		stroke: #444;
	}
</style>
