<script lang="ts">
  import type { ComponentType } from 'svelte';

  type Column<T> = {
    key: string;
    label: string;
    sortable?: boolean;
    render?: (item: T) => string;
    cellClass?: (item: T) => string;
    cellColor?: (item: T) => 'danger' | 'success' | 'warning' | 'primary' | 'secondary' | undefined;
    component?: ComponentType;
  };

  type Props<T> = {
    data: T[];
    columns: Column<T>[];
    striped?: boolean;
    hoverable?: boolean;
  };

  let { data = $bindable(), columns, striped = false, hoverable = true }: Props<any> = $props();

  let sortKey = $state<string | null>(null);
  let sortDirection = $state<'asc' | 'desc'>('asc');

  function handleSort(key: string) {
    if (sortKey === key) {
      sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      sortKey = key;
      sortDirection = 'asc';
    }
  }

  let sortedData = $derived(() => {
    if (!sortKey) return data;

    return [...data].sort((a, b) => {
      const aVal = a[sortKey as keyof typeof a];
      const bVal = b[sortKey as keyof typeof b];

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  });
</script>

<div class="table-container">
  <table class="table" class:striped class:hoverable>
    <thead>
      <tr>
        {#each columns as column}
          <th>
            {#if column.sortable}
              <button class="sort-btn" onclick={() => handleSort(column.key)}>
                {column.label}
                {#if sortKey === column.key}
                  <span class="sort-icon">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                {/if}
              </button>
            {:else}
              {column.label}
            {/if}
          </th>
        {/each}
      </tr>
    </thead>
    <tbody>
      {#each sortedData() as item, i}
        <tr>
          {#each columns as column}
            {@const colorClass = column.cellColor ? `cell-${column.cellColor(item)}` : ''}
            <td class="{column.cellClass ? column.cellClass(item) : ''} {colorClass}">
              {#if column.component}
                {@const Component = column.component}
                <Component {item} />
              {:else if column.render}
                {column.render(item)}
              {:else}
                {item[column.key]}
              {/if}
            </td>
          {/each}
        </tr>
      {/each}
    </tbody>
  </table>
</div>

<style>
  .table-container {
    width: 100%;
    overflow-x: auto;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    margin-bottom: var(--space-lg);
  }

  .table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.875rem;
  }

  thead {
    background-color: var(--color-bg-secondary);
    border-bottom: 2px solid var(--color-border);
  }

  th {
    padding: var(--space-md);
    text-align: left;
    font-weight: 600;
    color: var(--color-text-primary);
  }

  td {
    padding: var(--space-md);
    color: var(--color-text-primary);
    border-bottom: 1px solid var(--color-border);
  }

  tr:last-child td {
    border-bottom: none;
  }

  .striped tbody tr:nth-child(even) {
    background-color: var(--color-bg-secondary);
  }

  .hoverable tbody tr:hover {
    background-color: var(--color-bg-tertiary);
  }

  .sort-btn {
    background: none;
    border: none;
    padding: 0;
    font: inherit;
    color: var(--color-text-primary);
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    font-weight: 600;
  }

  .sort-btn:hover {
    color: var(--color-primary);
  }

  .sort-icon {
    color: var(--color-secondary);
    font-size: 0.875rem;
  }

  /* Cell color utilities */
  td.cell-danger {
    color: var(--color-danger, #dc2626);
    font-weight: 600;
  }

  td.cell-success {
    color: var(--color-success, #16a34a);
    font-weight: 600;
  }

  td.cell-warning {
    color: var(--color-warning, #f59e0b);
    font-weight: 600;
  }

  td.cell-primary {
    color: var(--color-primary);
    font-weight: 600;
  }

  td.cell-secondary {
    color: var(--color-secondary);
    font-weight: 600;
  }
</style>
