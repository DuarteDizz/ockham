import React, { useMemo, useState } from 'react';
import { PlusCircle, Search, SlidersHorizontal, Target } from 'lucide-react';
import { STEP_META, TYPE_META } from '@/features/preprocessing/support/preprocessingPlan';

function formatPct(value) {
  if (value === null || value === undefined) return '—';
  return `${(Number(value) * 100).toFixed(1)}%`;
}

export default function ColumnTable({
  columns,
  plan,
  selectedColumn,
  targetColumn,
  onSelectColumn,
  onAddColumnToPipeline,
}) {
  const [search, setSearch] = useState('');
  const planMap = useMemo(() => Object.fromEntries(plan.map((item) => [item.column_name, item])), [plan]);
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return columns;
    return columns.filter((column) => column.column_name.toLowerCase().includes(query));
  }, [columns, search]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[28px] border border-white/70 bg-white/65 shadow-sm backdrop-blur-xl">
      <div className="flex items-center justify-between border-b border-white/70 px-5 py-4">
        <div>
          <p className="text-sm font-heading font-extrabold text-foreground">Available columns</p>
          <p className="text-xs text-muted-foreground">{filtered.length} of {columns.length} columns · add features to the current pipeline</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search columns..."
            className="w-56 rounded-2xl border border-slate-200 bg-white/80 py-2 pl-9 pr-3 text-sm outline-none focus:border-primary/40"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full min-w-[980px] border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur-xl">
            <tr className="border-b border-slate-200/80 text-left text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              <th className="px-5 py-3">Column</th>
              <th className="px-3 py-3">Type</th>
              <th className="px-3 py-3">Missing</th>
              <th className="px-3 py-3">Unique</th>
              <th className="px-3 py-3">Profile</th>
              <th className="px-3 py-3">Steps</th>
              <th className="px-3 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((column) => {
              const item = planMap[column.column_name];
              const isInPipeline = Boolean(item);
              const isTarget = targetColumn === column.column_name;
              const type = column.inferred_type || 'text';
              const meta = TYPE_META[type] || TYPE_META.text;
              const Icon = meta.icon;
              const selected = selectedColumn === column.column_name;
              const stats = column.specific_stats || {};
              return (
                <tr
                  key={column.column_name}
                  onClick={() => onSelectColumn(column.column_name)}
                  className="cursor-pointer border-b border-slate-100 transition-colors hover:bg-primary/[0.035]"
                  style={{ background: selected ? `${meta.color}0d` : 'transparent' }}
                >
                  <td className="px-5 py-3">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl" style={{ background: `${meta.color}14`, color: meta.color }}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p title={column.column_name} className="truncate font-heading font-bold text-foreground">{column.column_name}</p>
                        <p className="text-[10px] text-muted-foreground">{column.raw_dtype || 'unknown dtype'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <span className="rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: `${meta.color}12`, color: meta.color }}>{meta.label}</span>
                  </td>
                  <td className="px-3 py-3 font-semibold text-muted-foreground">{formatPct(column.common_stats?.missing_ratio || 0)}</td>
                  <td className="px-3 py-3 font-semibold text-muted-foreground">{column.common_stats?.unique_count ?? '—'}</td>
                  <td className="px-3 py-3 text-xs text-muted-foreground">
                    {(type || '').includes('numeric') ? `skew ${Number(stats.skewness || 0).toFixed(2)} · outliers ${formatPct(stats.outlier_ratio_iqr || 0)}` : null}
                    {type === 'text' || type === 'categorical' || type === 'identifier' || type === 'free_text' ? `top ${formatPct(stats.top_1_ratio || 0)} · entropy ${Number(stats.normalized_entropy || 0).toFixed(2)}` : null}
                    {(type || '').includes('datetime') ? `span ${stats.timespan_days ?? '—'} days` : null}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {(item?.steps || []).slice(0, 3).map((step) => {
                        const stepMeta = STEP_META[step.operation] || STEP_META.drop_column;
                        return <span key={step.id} className="rounded-full px-2 py-1 text-[10px] font-bold" style={{ background: `${stepMeta.color}12`, color: stepMeta.color }}>{stepMeta.label}</span>;
                      })}
                      {!item?.steps?.length ? <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"><SlidersHorizontal className="h-3 w-3" /> none</span> : null}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right">
                    {isTarget ? (
                      <span className="inline-flex items-center gap-1 rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] font-bold text-amber-700">
                        <Target className="h-3.5 w-3.5" /> Target
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={isInPipeline}
                        onClick={(event) => {
                          event.stopPropagation();
                          onAddColumnToPipeline?.(column.column_name);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-bold text-muted-foreground shadow-sm transition-colors hover:text-primary disabled:cursor-default disabled:bg-slate-50 disabled:text-muted-foreground/60"
                      >
                        <PlusCircle className="h-3.5 w-3.5" /> {isInPipeline ? 'In pipeline' : 'Add'}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
