<script lang="ts">
	// Streams the project owner's Hackatime activity from /api/admin/audit/:id/activity
	// and reports filtered active minutes back to the parent so excluding an
	// activity type (e.g. AI Coding) subtracts that time from the approved hours.
	import { onMount } from 'svelte';
	import uPlot from 'uplot';
	import 'uplot/dist/uPlot.min.css';

	type Summary = {
		count: number;
		spanSeconds: number;
		activeMinutes: number;
		firstAt: number;
		lastAt: number;
		coveredDays: number;
		aiPercent?: number;
		aiCount?: number;
		pasteLikeCount?: number;
	};

	type Filterable = {
		editorList: string[];
		categoryList: string[];
		times: number[];
		editorIdx: number[];
		categoryIdx: number[];
	};

	type HeartbeatsResponse = {
		summary: Summary;
		editorBreakdown: Record<string, number>;
		categoryBreakdown: Record<string, number>;
		userAgents: Array<{ ua: string; count: number }>;
		anomalies: {
			autoClicker: { severity: 'none' | 'low' | 'high'; evidence?: string };
			macroTyper: { severity: 'none' | 'low' | 'high'; evidence?: string };
			offRepo: { count: number; sampleEntities?: string[] };
		};
		points: [number[], (number | null)[], (number | null)[]];
		filterable?: Filterable;
		hackatimeProjects?: string[];
		error?: string;
	};

	let {
		projectId,
		onFilterChange,
		onComplete
	}: {
		projectId: string;
		onFilterChange?: (info: {
			totalActiveMinutes: number;
			filteredActiveMinutes: number | null;
			aiPercent: number | null;
		}) => void;
		onComplete?: (data: HeartbeatsResponse) => void;
	} = $props();

	let data = $state<HeartbeatsResponse | null>(null);
	let loadError = $state<string | null>(null);
	let loading = $state(true);

	let chartContainer: HTMLDivElement | null = $state(null);
	let hoverIdx = $state<number | null>(null);
	let chartRef: uPlot | null = null;

	function zoomBy(factor: number) {
		if (!chartRef || !data) return;
		const xs = data.points[0];
		if (xs.length === 0) return;
		const fullMin = xs[0];
		const fullMax = xs[xs.length - 1];
		const cur = chartRef.scales.x;
		const min = cur.min ?? fullMin;
		const max = cur.max ?? fullMax;
		const center = (min + max) / 2;
		const halfRange = ((max - min) / 2) * factor;
		let nextMin = center - halfRange;
		let nextMax = center + halfRange;
		if (nextMax - nextMin > fullMax - fullMin) {
			nextMin = fullMin;
			nextMax = fullMax;
		}
		if (nextMax - nextMin < 60) {
			nextMin = center - 30;
			nextMax = center + 30;
		}
		chartRef.setScale('x', { min: nextMin, max: nextMax });
	}

	function zoomReset() {
		if (!chartRef || !data) return;
		const xs = data.points[0];
		if (xs.length === 0) return;
		chartRef.setScale('x', { min: xs[0], max: xs[xs.length - 1] });
	}

	let progressDays = $state<{ seen: number; total: number; matched: number; raw: number } | null>(
		null
	);

	onMount(() => {
		let cancelled = false;
		(async () => {
			try {
				const res = await fetch(`/api/admin/audit/${projectId}/activity`);
				if (!res.ok || !res.body) {
					if (!cancelled) loadError = `HTTP ${res.status}`;
					return;
				}
				const reader = res.body.getReader();
				const dec = new TextDecoder();
				let buf = '';
				while (!cancelled) {
					const { value, done } = await reader.read();
					if (done) break;
					buf += dec.decode(value, { stream: true });
					let nl;
					while ((nl = buf.indexOf('\n')) >= 0) {
						const line = buf.slice(0, nl).trim();
						buf = buf.slice(nl + 1);
						if (!line) continue;
						handleEvent(JSON.parse(line));
					}
				}
				if (buf.trim()) handleEvent(JSON.parse(buf.trim()));
			} catch (err) {
				if (!cancelled) loadError = err instanceof Error ? err.message : String(err);
			} finally {
				if (!cancelled) loading = false;
			}
		})();
		return () => {
			cancelled = true;
		};
	});

	function handleEvent(evt: { type: string; [k: string]: unknown }) {
		if (evt.type === 'meta') {
			progressDays = { seen: 0, total: (evt.daysQueried as number) ?? 0, matched: 0, raw: 0 };
			loading = false;
		} else if (evt.type === 'day') {
			progressDays = {
				seen: (evt.daysSeen as number) ?? (progressDays?.seen ?? 0) + 1,
				total: (evt.daysTotal as number) ?? progressDays?.total ?? 0,
				matched: (evt.matchedCountSoFar as number) ?? progressDays?.matched ?? 0,
				raw: (evt.rawCountSoFar as number) ?? progressDays?.raw ?? 0
			};
		} else if (evt.type === 'complete') {
			const analysis = evt.analysis as HeartbeatsResponse;
			analysis.hackatimeProjects = evt.hackatimeProjects as string[] | undefined;
			data = analysis;
			onComplete?.(analysis);
		} else if (evt.type === 'error') {
			data = {
				summary: { count: 0, spanSeconds: 0, activeMinutes: 0, firstAt: 0, lastAt: 0, coveredDays: 0 },
				editorBreakdown: {},
				categoryBreakdown: {},
				userAgents: [],
				anomalies: {
					autoClicker: { severity: 'none' },
					macroTyper: { severity: 'none' },
					offRepo: { count: 0 }
				},
				points: [[], [], []],
				error: evt.error as string
			};
		}
	}

	const editorEntries = $derived.by<Array<[string, number]>>(() =>
		data ? Object.entries(data.editorBreakdown).sort((a, b) => b[1] - a[1]) : []
	);
	const categoryEntries = $derived.by<Array<[string, number]>>(() =>
		data ? Object.entries(data.categoryBreakdown).sort((a, b) => b[1] - a[1]) : []
	);

	let excludedEditors = $state(new Set<string>());
	let excludedCategories = $state(new Set<string>());

	function toggleEditor(name: string) {
		const next = new Set(excludedEditors);
		if (next.has(name)) next.delete(name);
		else next.add(name);
		excludedEditors = next;
	}
	function toggleCategory(name: string) {
		const next = new Set(excludedCategories);
		if (next.has(name)) next.delete(name);
		else next.add(name);
		excludedCategories = next;
	}

	function activeMinutesExcluding(
		f: Filterable,
		exEd: Set<string>,
		exCat: Set<string>
	): number {
		let active = 0;
		let lastT = -Infinity;
		for (let i = 0; i < f.times.length; i++) {
			const ed = f.editorList[f.editorIdx[i]];
			const cat = f.categoryList[f.categoryIdx[i]];
			if (exEd.has(ed) || exCat.has(cat)) continue;
			const t = f.times[i];
			if (t - lastT > 120) active += 1;
			else if (Math.floor(t / 60) !== Math.floor(lastT / 60)) active += 1;
			lastT = t;
		}
		return active;
	}

	const filteredActiveMinutes = $derived.by<number | null>(() => {
		if (!data?.filterable) return null;
		if (excludedEditors.size === 0 && excludedCategories.size === 0) return null;
		return activeMinutesExcluding(data.filterable, excludedEditors, excludedCategories);
	});

	// Report filtered/total active minutes up to the parent so it can adjust the
	// approved hours when an activity type is excluded.
	$effect(() => {
		if (!data || data.error) return;
		onFilterChange?.({
			totalActiveMinutes: data.summary.activeMinutes,
			filteredActiveMinutes,
			aiPercent: typeof data.summary.aiPercent === 'number' ? data.summary.aiPercent : null
		});
	});

	function fmtHoursMinutes(mins: number): string {
		if (mins < 1) return '0h';
		if (mins < 60) return `${mins}m`;
		const h = Math.floor(mins / 60);
		const m = mins % 60;
		return m > 0 ? `${h}h ${m}m` : `${h}h`;
	}

	$effect(() => {
		if (!data || data.error || !chartContainer) return;
		const container = chartContainer;
		const points = data.points;
		if (!points || !points[0] || points[0].length === 0) return;

		const opts: uPlot.Options = {
			width: container.clientWidth || 600,
			height: 320,
			scales: { x: { time: true }, y: { auto: true }, y2: { auto: true } },
			axes: [
				{ stroke: 'rgba(127,127,127,0.7)', grid: { stroke: 'rgba(127,127,127,0.18)', width: 1 } },
				{ scale: 'y', label: 'line', stroke: 'rgba(127,127,127,0.7)', grid: { stroke: 'rgba(127,127,127,0.18)', width: 1 } },
				{ scale: 'y2', side: 1, label: 'cursor', stroke: 'rgba(127,127,127,0.7)', grid: { show: false } }
			],
			series: [
				{},
				{
					label: 'line number',
					scale: 'y',
					stroke: '#6f8fff',
					paths: () => null,
					points: { show: true, size: 6, fill: 'rgba(111,143,255,0.6)', stroke: '#6f8fff' }
				},
				{
					label: 'cursor position',
					scale: 'y2',
					stroke: '#ed344f',
					paths: () => null,
					points: { show: true, size: 6, fill: 'rgba(237,52,79,0.55)', stroke: '#ed344f' }
				}
			],
			cursor: { drag: { x: false, y: false, setScale: false } },
			hooks: {
				setCursor: [(u) => { hoverIdx = u.cursor.idx ?? null; }]
			}
		};

		const chart = new uPlot(opts, points as uPlot.AlignedData, container);
		chartRef = chart;
		const fullMin = points[0][0];
		const fullMax = points[0][points[0].length - 1];

		const onDblClick = () => chart.setScale('x', { min: fullMin, max: fullMax });
		container.addEventListener('dblclick', onDblClick);

		const onWheel = (e: WheelEvent) => {
			e.preventDefault();
			const over = chart.over.getBoundingClientRect();
			const xPx = e.clientX - over.left;
			if (xPx < 0 || xPx > over.width) return;
			const anchor = chart.posToVal(xPx, 'x');
			const factor = e.deltaY > 0 ? 1.15 : 1 / 1.15;
			const cur = chart.scales.x;
			const min = cur.min ?? fullMin;
			const max = cur.max ?? fullMax;
			let nextMin = anchor - (anchor - min) * factor;
			let nextMax = anchor + (max - anchor) * factor;
			if (nextMax - nextMin > fullMax - fullMin) {
				nextMin = fullMin;
				nextMax = fullMax;
			}
			chart.setScale('x', { min: nextMin, max: nextMax });
		};
		container.addEventListener('wheel', onWheel, { passive: false });

		const ro = new ResizeObserver(() => chart.setSize({ width: container.clientWidth, height: 320 }));
		ro.observe(container);

		return () => {
			ro.disconnect();
			container.removeEventListener('dblclick', onDblClick);
			container.removeEventListener('wheel', onWheel);
			chart.destroy();
			chartRef = null;
		};
	});

	const hoverInfo = $derived.by(() => {
		if (!data || hoverIdx == null) return null;
		const [xs, ys, ys2] = data.points;
		if (hoverIdx < 0 || hoverIdx >= xs.length) return null;
		return { t: xs[hoverIdx], ln: ys[hoverIdx], cp: ys2[hoverIdx] };
	});

	function fmtTs(unix: number): string {
		const d = new Date(unix * 1000);
		const p = (n: number) => String(n).padStart(2, '0');
		return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
	}
</script>

<div class="act-card">
	{#if loading}
		<div class="muted">connecting to hackatime…</div>
	{:else if loadError}
		<div class="err">failed to load: {loadError}</div>
	{:else if !data && progressDays}
		<div class="progress">
			<div class="progress-head">
				<span class="muted">streaming hackatime · day {progressDays.seen} / {progressDays.total}</span>
				<span class="progress-counts">{progressDays.matched.toLocaleString()} matched</span>
			</div>
			<div class="progress-bar">
				<div
					class="progress-fill"
					style:width={progressDays.total > 0
						? `${Math.round((progressDays.seen / progressDays.total) * 100)}%`
						: '0%'}
				></div>
			</div>
		</div>
	{:else if data?.error}
		<div class="placeholder">
			<strong>
				{#if data.error === 'owner-not-linked'}Owner hasn't linked Hackatime
				{:else if data.error === 'no-hackatime-project'}No Hackatime project linked
				{:else if data.error === 'hackatime-auth-failed'}Hackatime auth failed
				{:else}Hackatime fetch failed{/if}
			</strong>
			<span class="muted">no heartbeat graph available</span>
		</div>
	{:else if data}
		<div class="summary">
			{data.summary.count.toLocaleString()} heartbeats ·
			{#if filteredActiveMinutes !== null}
				<span class="filtered-time">
					{fmtHoursMinutes(filteredActiveMinutes)} active
					<span class="of">of {fmtHoursMinutes(data.summary.activeMinutes)}</span>
				</span>
			{:else}
				{fmtHoursMinutes(data.summary.activeMinutes)} active
			{/if}
			· {data.summary.coveredDays} days
			{#if typeof data.summary.aiPercent === 'number'}
				<span
					class="ai-pill"
					class:ai-low={data.summary.aiPercent < 25}
					class:ai-mid={data.summary.aiPercent >= 25 && data.summary.aiPercent < 60}
					class:ai-high={data.summary.aiPercent >= 60}
					title="heartbeats matched as AI editor / AI category / large paste"
				>
					{data.summary.aiPercent}% AI/paste
				</span>
			{/if}
		</div>

		<div class="chart-wrap">
			{#if hoverInfo}
				<div class="readout">
					<span><em>time</em> {fmtTs(hoverInfo.t)}</span>
					<span><em>line</em> {hoverInfo.ln ?? '—'}</span>
					<span><em>cursor</em> {hoverInfo.cp ?? '—'}</span>
				</div>
			{/if}
			<div class="zoom-controls">
				<button type="button" class="zoom-btn" title="zoom in" onclick={() => zoomBy(0.5)}>+</button>
				<button type="button" class="zoom-btn" title="zoom out" onclick={() => zoomBy(2)}>−</button>
				<button type="button" class="zoom-btn zoom-reset" title="reset" onclick={zoomReset}>reset</button>
			</div>
			<div class="chart" bind:this={chartContainer}></div>
		</div>

		<p class="hint">Click an activity pill to exclude its time (e.g. AI Coding) — the approved hours below update automatically.</p>

		<div class="strip">
			<span class="strip-label">Categories:</span>
			{#if categoryEntries.length === 0}
				<span class="muted">none</span>
			{:else}
				{#each categoryEntries as [name, count] (name)}
					<button
						type="button"
						class="pill"
						class:excluded={excludedCategories.has(name)}
						title={excludedCategories.has(name) ? 'click to include' : 'click to exclude'}
						onclick={() => toggleCategory(name)}
					>
						{name} · {count.toLocaleString()}
					</button>
				{/each}
			{/if}
		</div>

		<div class="strip">
			<span class="strip-label">Editors:</span>
			{#if editorEntries.length === 0}
				<span class="muted">none</span>
			{:else}
				{#each editorEntries as [name, count] (name)}
					<button
						type="button"
						class="pill"
						class:excluded={excludedEditors.has(name)}
						title={excludedEditors.has(name) ? 'click to include' : 'click to exclude'}
						onclick={() => toggleEditor(name)}
					>
						{name} · {count.toLocaleString()}
					</button>
				{/each}
			{/if}
		</div>
	{/if}
</div>

<style>
	.act-card {
		background: transparent;
		display: flex;
		flex-direction: column;
		gap: 0.7rem;
		color: var(--text);
		font-family: inherit;
	}
	.summary { color: var(--text); font-size: 0.88rem; font-variant-numeric: tabular-nums; }
	.ai-pill {
		display: inline-block;
		font-size: 0.7rem;
		padding: 0.16rem 0.55rem;
		border-radius: 999px;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		font-weight: 700;
		border: 1px solid;
		margin-left: 0.4rem;
		vertical-align: middle;
	}
	.ai-pill.ai-low { border-color: var(--approve, #2e9e3f); background: rgba(46, 158, 63, 0.18); color: var(--approve, #2e9e3f); }
	.ai-pill.ai-mid { border-color: var(--warn, #c4a437); background: rgba(196, 164, 55, 0.18); color: var(--warn, #c4a437); }
	.ai-pill.ai-high { border-color: var(--reject, #ed344f); background: rgba(196, 55, 78, 0.18); color: var(--reject, #ed344f); }

	.chart-wrap { position: relative; width: 100%; }
	.chart { width: 100%; min-height: 320px; touch-action: pan-y; }

	.zoom-controls { position: absolute; top: 0.25rem; left: 0.25rem; z-index: 2; display: flex; gap: 0.25rem; }
	.zoom-btn {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 0.3rem;
		color: var(--text);
		font-size: 0.85rem;
		font-weight: 600;
		min-width: 1.6rem;
		height: 1.6rem;
		cursor: pointer;
		font-family: inherit;
	}
	.zoom-btn:hover { border-color: var(--accent); }
	.zoom-btn.zoom-reset { font-size: 0.66rem; text-transform: uppercase; letter-spacing: 0.08em; }

	.readout {
		position: absolute;
		top: 0.25rem;
		right: 0.25rem;
		z-index: 2;
		display: flex;
		gap: 0.5rem;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 0.4rem;
		padding: 0.3rem 0.5rem;
		font-size: 0.74rem;
		color: var(--text);
		font-variant-numeric: tabular-nums;
		pointer-events: none;
	}
	.readout em { color: var(--text-muted); font-style: normal; text-transform: uppercase; letter-spacing: 0.06em; font-size: 0.62rem; margin-right: 0.2rem; }

	.hint { margin: 0; font-size: 0.78rem; color: var(--text-muted); }

	.strip { display: flex; flex-wrap: wrap; align-items: center; gap: 0.4rem; }
	.strip-label { color: var(--text-muted); font-size: 0.7rem; letter-spacing: 0.08em; text-transform: uppercase; margin-right: 0.2rem; }

	.pill {
		font-family: inherit;
		font-size: 0.76rem;
		padding: 0.2rem 0.65rem;
		border-radius: 999px;
		background: var(--surface-2, #f3f4f6);
		color: var(--text);
		border: 1px solid var(--border);
		cursor: pointer;
	}
	.pill:hover { border-color: var(--accent); }
	.pill.excluded { background: transparent; border-color: var(--border); color: var(--text-muted); text-decoration: line-through; }

	.filtered-time { color: var(--approve); font-weight: 600; }
	.filtered-time .of { color: var(--text-muted); font-weight: 400; margin-left: 0.2rem; }

	.muted { color: var(--text-muted); font-style: italic; font-size: 0.85rem; }
	.err { color: var(--reject); font-size: 0.85rem; }
	.placeholder {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		color: var(--text-muted);
		padding: 1rem;
		background: var(--surface-2);
		border-radius: 0.5rem;
		border: 1px dashed var(--border);
		text-align: center;
	}

	.progress { display: flex; flex-direction: column; gap: 0.45rem; }
	.progress-head { display: flex; justify-content: space-between; align-items: baseline; gap: 0.6rem; font-size: 0.85rem; }
	.progress-counts { color: var(--approve); font-variant-numeric: tabular-nums; font-weight: 600; }
	.progress-bar { height: 6px; background: var(--surface-2); border: 1px solid var(--border); border-radius: 999px; overflow: hidden; }
	.progress-fill { height: 100%; background: var(--accent); transition: width 0.25s ease-out; }
</style>
