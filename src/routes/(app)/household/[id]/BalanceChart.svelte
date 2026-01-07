<script lang="ts">
  import { onMount } from 'svelte';
  import { Chart, registerables } from 'chart.js';
  import 'chartjs-adapter-date-fns';
  import Checkbox from '$lib/components/Checkbox.svelte';

  Chart.register(...registerables);

  type BalanceEvent = {
    date: Date;
    youOweChange: number;
    owedToYouChange: number;
    isOptional: boolean;
  };

  let {
    balanceHistory = [],
    includeOptional = $bindable(false)
  }: { balanceHistory: BalanceEvent[]; includeOptional?: boolean } = $props();

  let canvas: HTMLCanvasElement | undefined = $state();
  let chart: Chart | null = null;

  // Filter and compute separate data points for each line
  // Each line only gets a point when its value actually changes
  // Events at the same timestamp are combined into a single point
  const computedHistory = $derived(() => {
    const filtered = includeOptional ? balanceHistory : balanceHistory.filter((e) => !e.isOptional);

    let runningYouOwe = 0;
    let runningOwedToYou = 0;

    const youOwePoints: { date: Date; value: number }[] = [];
    const owedToYouPoints: { date: Date; value: number }[] = [];

    for (const event of filtered) {
      const eventTime = new Date(event.date).getTime();

      // Handle youOwe changes - combine if same timestamp
      if (event.youOweChange !== 0) {
        runningYouOwe += event.youOweChange;
        const lastPoint = youOwePoints[youOwePoints.length - 1];
        if (lastPoint && new Date(lastPoint.date).getTime() === eventTime) {
          // Update existing point at same timestamp
          lastPoint.value = runningYouOwe;
        } else {
          youOwePoints.push({ date: event.date, value: runningYouOwe });
        }
      }

      // Handle owedToYou changes - combine if same timestamp
      if (event.owedToYouChange !== 0) {
        runningOwedToYou += event.owedToYouChange;
        const lastPoint = owedToYouPoints[owedToYouPoints.length - 1];
        if (lastPoint && new Date(lastPoint.date).getTime() === eventTime) {
          // Update existing point at same timestamp
          lastPoint.value = runningOwedToYou;
        } else {
          owedToYouPoints.push({ date: event.date, value: runningOwedToYou });
        }
      }
    }

    return { youOwePoints, owedToYouPoints };
  });

  // Insert "hold" points after each data point to create flat segments with smooth transitions
  // Returns both the points array and a parallel array indicating which points are "real" data points
  // transitionWidth is a fixed time duration for all transitions (based on total chart range)
  // isControlPoint marks which input points should be hidden (first/last manually added points)
  function addHoldPoints(
    points: { date: Date; value: number }[],
    transitionWidth: number,
    isControlPoint: boolean[]
  ): { points: { date: Date; value: number }[]; isDataPoint: boolean[] } {
    if (points.length < 2) return { points, isDataPoint: points.map((_, i) => !isControlPoint[i]) };

    const result: { date: Date; value: number }[] = [];
    const isDataPoint: boolean[] = [];

    // Maximum spacing between control points to keep flat segments truly flat
    const maxControlPointSpacing = transitionWidth * 3;

    for (let i = 0; i < points.length; i++) {
      const current = points[i];
      const next = points[i + 1];

      // Add the actual data point (hidden if it's a control point)
      result.push(current);
      isDataPoint.push(!isControlPoint[i]);

      // After each point (except the last), add control points to maintain flat segment
      if (next) {
        const currentTime = new Date(current.date).getTime();
        const nextTime = new Date(next.date).getTime();
        const gap = nextTime - currentTime;
        // Use fixed transition width, but cap at 50% of the gap if gap is too small
        const actualTransition = Math.min(transitionWidth, gap * 0.5);
        const holdEndTime = nextTime - actualTransition;
        const flatSpan = holdEndTime - currentTime;

        // Add control points along the flat span to keep it truly flat
        // Cluster more points near the start (after data point) and end (before transition)
        // to better control the bezier curve behavior at those critical areas

        // Always add a point close to the data point to anchor the flat start
        const earlyAnchor = currentTime + actualTransition * 0.5;
        if (earlyAnchor < holdEndTime) {
          result.push({ date: new Date(earlyAnchor), value: current.value });
          isDataPoint.push(false);
        }

        // Add evenly spaced intermediate points for long spans
        const middleStart = currentTime + actualTransition;
        const middleEnd = holdEndTime - actualTransition;
        if (middleEnd > middleStart) {
          const middleSpan = middleEnd - middleStart;
          const numMiddlePoints = Math.max(1, Math.floor(middleSpan / maxControlPointSpacing));
          const spacing = middleSpan / (numMiddlePoints + 1);
          for (let j = 1; j <= numMiddlePoints; j++) {
            result.push({ date: new Date(middleStart + spacing * j), value: current.value });
            isDataPoint.push(false);
          }
        }

        // Add a point close to the final hold point to anchor the flat end
        const lateAnchor = holdEndTime - actualTransition * 0.5;
        if (lateAnchor > currentTime + actualTransition) {
          result.push({ date: new Date(lateAnchor), value: current.value });
          isDataPoint.push(false);
        }

        // Add the final hold point just before the transition
        result.push({ date: new Date(holdEndTime), value: current.value });
        isDataPoint.push(false);
      }
    }
    return { points: result, isDataPoint };
  }

  // Determine appropriate time unit based on date range
  function getTimeUnit(rangeMs: number): 'hour' | 'day' | 'week' | 'month' {
    const oneDay = 24 * 60 * 60 * 1000;
    const oneWeek = 7 * oneDay;
    const oneMonth = 30 * oneDay;

    if (rangeMs <= oneDay) {
      return 'hour';
    } else if (rangeMs <= oneWeek) {
      return 'day';
    } else if (rangeMs <= oneMonth * 2) {
      return 'week';
    } else {
      return 'month';
    }
  }

  function createChart() {
    const { youOwePoints, owedToYouPoints } = computedHistory();
    if (!canvas || (youOwePoints.length === 0 && owedToYouPoints.length === 0)) return;

    // Destroy existing chart
    if (chart) {
      chart.destroy();
    }

    // Find earliest date across both datasets to add starting zero points
    const allDates = [
      ...youOwePoints.map((p) => new Date(p.date).getTime()),
      ...owedToYouPoints.map((p) => new Date(p.date).getTime())
    ];
    const earliestDate = Math.min(...allDates);
    const startDate = earliestDate - 60 * 60 * 1000; // 1 hour before first event

    // Calculate date range for time unit
    const latestDate = Math.max(...allDates);
    const rangeMs = latestDate - startDate;
    const timeUnit = getTimeUnit(rangeMs);

    // Add starting zero point and ending carry-forward point to each dataset
    // This ensures both lines extend from start to end of the chart
    const lastYouOweValue =
      youOwePoints.length > 0 ? youOwePoints[youOwePoints.length - 1].value : 0;
    const lastOwedToYouValue =
      owedToYouPoints.length > 0 ? owedToYouPoints[owedToYouPoints.length - 1].value : 0;

    // Determine if we need to add end points
    const youOweNeedsEndPoint =
      youOwePoints.length === 0 ||
      new Date(youOwePoints[youOwePoints.length - 1].date).getTime() < latestDate;
    const owedToYouNeedsEndPoint =
      owedToYouPoints.length === 0 ||
      new Date(owedToYouPoints[owedToYouPoints.length - 1].date).getTime() < latestDate;

    const youOweWithStartEnd = [
      { date: new Date(startDate), value: 0 },
      ...youOwePoints,
      // Add end point if the last point isn't already at the latest date
      ...(youOweNeedsEndPoint ? [{ date: new Date(latestDate), value: lastYouOweValue }] : [])
    ];
    const owedToYouWithStartEnd = [
      { date: new Date(startDate), value: 0 },
      ...owedToYouPoints,
      // Add end point if the last point isn't already at the latest date
      ...(owedToYouNeedsEndPoint ? [{ date: new Date(latestDate), value: lastOwedToYouValue }] : [])
    ];

    // Mark which points are control points (first and last manually added points should be hidden)
    // Format: [start control point, ...real data points (false), optional end control point]
    const youOweIsControlPoint = [
      true, // start point is a control point
      ...youOwePoints.map(() => false), // real data points
      ...(youOweNeedsEndPoint ? [true] : []) // end point is a control point if added
    ];
    const owedToYouIsControlPoint = [
      true, // start point is a control point
      ...owedToYouPoints.map(() => false), // real data points
      ...(owedToYouNeedsEndPoint ? [true] : []) // end point is a control point if added
    ];

    // Add hold points for smooth step-like transitions
    // Use 3% of total range as fixed transition width for visual consistency
    const transitionWidth = rangeMs * 0.03;
    const youOweResult = addHoldPoints(youOweWithStartEnd, transitionWidth, youOweIsControlPoint);
    const owedToYouResult = addHoldPoints(
      owedToYouWithStartEnd,
      transitionWidth,
      owedToYouIsControlPoint
    );

    // Convert to {x, y} format for time scale
    const youOweData = youOweResult.points.map((p) => ({
      x: new Date(p.date).getTime(),
      y: p.value
    }));
    const owedToYouData = owedToYouResult.points.map((p) => ({
      x: new Date(p.date).getTime(),
      y: p.value
    }));

    // Create radius arrays: visible for data points, invisible for control points
    const youOweRadii = youOweResult.isDataPoint.map((isData) => (isData ? 3 : 0));
    const owedToYouRadii = owedToYouResult.isDataPoint.map((isData) => (isData ? 3 : 0));
    // Hover radius: only show hover effect on data points
    const youOweHoverRadii = youOweResult.isDataPoint.map((isData) => (isData ? 5 : 0));
    const owedToYouHoverRadii = owedToYouResult.isDataPoint.map((isData) => (isData ? 5 : 0));

    chart = new Chart(canvas, {
      type: 'line',
      data: {
        datasets: [
          {
            label: 'You Owe',
            data: youOweData,
            borderColor: '#ef4444',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            fill: true,
            tension: 0.25,
            pointRadius: youOweRadii,
            pointHoverRadius: youOweHoverRadii,
            pointBackgroundColor: '#ef4444',
            pointBorderColor: '#fff',
            pointBorderWidth: 1
          },
          {
            label: "You're Owed",
            data: owedToYouData,
            borderColor: '#22c55e',
            backgroundColor: 'rgba(34, 197, 94, 0.1)',
            fill: true,
            tension: 0.25,
            pointRadius: owedToYouRadii,
            pointHoverRadius: owedToYouHoverRadii,
            pointBackgroundColor: '#22c55e',
            pointBorderColor: '#fff',
            pointBorderWidth: 1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          intersect: false,
          mode: 'nearest'
        },
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              usePointStyle: true,
              padding: 16
            }
          },
          tooltip: {
            filter: (tooltipItem) => {
              // Only show tooltip for data points, not control points
              const isDataPointArray =
                tooltipItem.datasetIndex === 0
                  ? youOweResult.isDataPoint
                  : owedToYouResult.isDataPoint;
              return isDataPointArray[tooltipItem.dataIndex] === true;
            },
            callbacks: {
              title: (context) => {
                const timestamp = context[0]?.parsed?.x;
                if (timestamp == null) return '';
                return new Intl.DateTimeFormat('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit'
                }).format(new Date(timestamp));
              },
              label: (context) => {
                const value = context.parsed.y ?? 0;
                return `${context.dataset.label}: $${value.toFixed(2)}`;
              }
            }
          }
        },
        scales: {
          x: {
            type: 'time',
            time: {
              unit: timeUnit,
              displayFormats: {
                hour: 'h:mm a',
                day: 'MMM d',
                week: 'MMM d',
                month: 'MMM yyyy'
              }
            },
            grid: {
              display: false
            },
            ticks: {
              maxTicksLimit: 8
            }
          },
          y: {
            beginAtZero: true,
            ticks: {
              callback: (value) => `$${value}`
            }
          }
        }
      }
    });
  }

  onMount(() => {
    createChart();
    return () => {
      if (chart) {
        chart.destroy();
      }
    };
  });

  // Recreate chart when data or filter changes
  $effect(() => {
    if (canvas && balanceHistory) {
      // Access includeOptional to track it
      const _ = includeOptional;
      createChart();
    }
  });
</script>

<div class="chart-container">
  {#if balanceHistory.length === 0}
    <div class="empty-state">
      <p>No balance history yet. Create expenses to see your balance over time.</p>
    </div>
  {:else}
    <div class="chart-controls">
      <Checkbox bind:checked={includeOptional} label="Include optional expenses" />
    </div>
    <canvas bind:this={canvas}></canvas>
  {/if}
</div>

<style>
  .chart-container {
    height: 250px;
    position: relative;
  }

  .chart-controls {
    display: flex;
    justify-content: flex-end;
    margin-bottom: var(--space-sm);
  }

  .empty-state {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--color-text-tertiary);
    font-size: 0.875rem;
    text-align: center;
  }
</style>
