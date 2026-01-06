<script lang="ts">
  import { onMount } from 'svelte';
  import { Chart, registerables } from 'chart.js';
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

  // Filter and compute running totals based on includeOptional
  const computedHistory = $derived(() => {
    const filtered = includeOptional ? balanceHistory : balanceHistory.filter((e) => !e.isOptional);

    let runningYouOwe = 0;
    let runningOwedToYou = 0;
    return filtered.map((event) => {
      runningYouOwe += event.youOweChange;
      runningOwedToYou += event.owedToYouChange;
      return {
        date: event.date,
        youOwe: runningYouOwe,
        owedToYou: runningOwedToYou
      };
    });
  });

  // Determine the date range to decide on formatting
  function getDateRange(data: { date: Date }[]): number {
    if (data.length < 2) return 0;
    const first = new Date(data[0].date).getTime();
    const last = new Date(data[data.length - 1].date).getTime();
    return last - first;
  }

  function formatDateLabel(date: Date, rangeMs: number): string {
    const d = new Date(date);
    const oneDay = 24 * 60 * 60 * 1000;
    const oneWeek = 7 * oneDay;

    if (rangeMs <= oneDay) {
      // Within a day: show time only
      return new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        minute: '2-digit'
      }).format(d);
    } else if (rangeMs <= oneWeek) {
      // Within a week: show day + time
      return new Intl.DateTimeFormat('en-US', {
        weekday: 'short',
        hour: 'numeric',
        minute: '2-digit'
      }).format(d);
    } else {
      // More than a week: show date only
      return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric'
      }).format(d);
    }
  }

  function createChart() {
    const history = computedHistory();
    if (!canvas || history.length === 0) return;

    // Destroy existing chart
    if (chart) {
      chart.destroy();
    }

    // Add a starting point at 0 if we have data
    const dataWithStart =
      history.length > 0
        ? [
            {
              date: new Date(new Date(history[0].date).getTime() - 60 * 60 * 1000),
              youOwe: 0,
              owedToYou: 0
            },
            ...history
          ]
        : history;

    const rangeMs = getDateRange(dataWithStart);
    const labels = dataWithStart.map((p) => formatDateLabel(p.date, rangeMs));
    const youOweData = dataWithStart.map((p) => p.youOwe);
    const owedToYouData = dataWithStart.map((p) => p.owedToYou);

    chart = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'You Owe',
            data: youOweData,
            borderColor: '#ef4444',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            fill: true,
            tension: 0.3,
            pointRadius: 4,
            pointHoverRadius: 6
          },
          {
            label: "You're Owed",
            data: owedToYouData,
            borderColor: '#22c55e',
            backgroundColor: 'rgba(34, 197, 94, 0.1)',
            fill: true,
            tension: 0.3,
            pointRadius: 4,
            pointHoverRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          intersect: false,
          mode: 'index'
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
            callbacks: {
              label: (context) => {
                const value = context.parsed.y ?? 0;
                return `${context.dataset.label}: $${value.toFixed(2)}`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: {
              display: false
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
