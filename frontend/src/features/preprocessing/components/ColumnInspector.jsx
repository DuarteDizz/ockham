import React from 'react';
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Hash,
  Info,
  RotateCcw,
  Scale,
  Scissors,
  Sparkles,
  Tag,
  Type,
} from 'lucide-react';
import { operationLabel } from '@/features/preprocessing/support/preprocessingPlan';

const OPERATION_GROUPS = [
  {
    title: 'Drop / Cast',
    items: ['drop_column', 'cast_numeric', 'cast_datetime'],
  },
  {
    title: 'Imputation',
    items: ['median_imputer', 'mean_imputer', 'most_frequent_imputer', 'constant_imputer'],
  },
  {
    title: 'Scaling',
    items: ['standard_scaler', 'robust_scaler', 'minmax_scaler', 'maxabs_scaler'],
  },
  {
    title: 'Encoding',
    items: ['one_hot_encoder', 'ordinal_encoder', 'label_encoder', 'frequency_encoder', 'target_encoder', 'hashing_encoder'],
  },
  {
    title: 'Datetime',
    items: ['extract_datetime_features', 'drop_original_datetime'],
  },
];

const TYPE_META = {
  numeric: { icon: Hash, color: '#0A49C2', label: 'Numeric' },
  numeric_like_text: { icon: Hash, color: '#0A49C2', label: 'Numeric-like text' },
  text: { icon: Type, color: '#F59E0B', label: 'Text/Object' },
  datetime: { icon: CalendarDays, color: '#0DA9C2', label: 'Datetime' },
  datetime_like_text: { icon: CalendarDays, color: '#0DA9C2', label: 'Datetime-like text' },
  empty: { icon: AlertTriangle, color: '#EF4444', label: 'Empty' },
};

function pct(value) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return `${(Number(value) * 100).toFixed(1)}%`;
}

function Stat({ label, value, color = '#0A49C2' }) {
  return (
    <div className="rounded-2xl border border-border/80 bg-white/70 px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-heading font-extrabold tabular-nums" style={{ color }}>{value ?? '—'}</p>
    </div>
  );
}

function StepPill({ step, index, onRemove, onApprove }) {
  const color = step.status === 'approved' ? '#12B981' : step.status === 'edited_by_user' ? '#7C3AED' : '#0A49C2';
  return (
    <div className="rounded-2xl border border-white/70 bg-white/72 p-3 card-shadow">
      <div className="flex items-start gap-2.5">
        <div className="flex h-7 w-7 items-center justify-center rounded-xl text-[11px] font-bold" style={{ background: `${color}16`, color }}>
          {index + 1}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-heading font-bold text-foreground">{operationLabel(step.operation)}</p>
          {step.reason ? <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{step.reason}</p> : null}
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <button type="button" onClick={onApprove} className="rounded-xl border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-600 hover:bg-emerald-100">
          Approve
        </button>
        <button type="button" onClick={onRemove} className="rounded-xl border border-red-100 bg-red-50 px-2.5 py-1 text-[11px] font-bold text-red-500 hover:bg-red-100">
          Remove
        </button>
      </div>
    </div>
  );
}

export default function ColumnInspector({ column, onAddStep, onRemoveStep, onApproveStep, onResetColumn }) {
  if (!column) {
    return (
      <aside className="flex h-full w-96 flex-shrink-0 items-center justify-center border-l border-border/80 bg-white/40 p-6">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-3xl bg-primary/10 text-primary">
            <Sparkles className="h-6 w-6" />
          </div>
          <p className="text-sm font-heading font-bold text-foreground">Select a column</p>
          <p className="mt-1 max-w-52 text-xs leading-relaxed text-muted-foreground">Inspect profiler evidence and tune the recommended preprocessing steps.</p>
        </div>
      </aside>
    );
  }

  const meta = TYPE_META[column.inferred_type] || TYPE_META.text;
  const Icon = meta.icon;
  const common = column.common_stats || {};
  const stats = column.specific_stats || {};

  return (
    <aside className="flex h-full w-96 flex-shrink-0 flex-col border-l border-border/80 bg-white/50 backdrop-blur-xl">
      <div className="border-b border-border/80 p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl" style={{ background: `${meta.color}16` }}>
            <Icon className="h-5 w-5" style={{ color: meta.color }} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-heading font-extrabold text-foreground">{column.column_name}</p>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: meta.color }}>{meta.label}</p>
          </div>
          <button type="button" onClick={onResetColumn} className="rounded-xl border border-border bg-white/70 p-2 text-muted-foreground hover:text-primary">
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
        <section>
          <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
            <Info className="h-3.5 w-3.5" /> Profiler evidence
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Missing" value={pct(common.missing_ratio)} color={common.missing_ratio > 0 ? '#EF4444' : '#12B981'} />
            <Stat label="Unique" value={common.unique_count} color={meta.color} />
            <Stat label="Top value" value={pct(stats.top_1_ratio)} color="#F59E0B" />
            <Stat label="Parse num" value={pct(stats.numeric_parse_ratio ?? column.type_inference?.numeric_parse_ratio)} color="#0A49C2" />
            <Stat label="Parse date" value={pct(stats.datetime_parse_ratio ?? column.type_inference?.datetime_parse_ratio)} color="#0DA9C2" />
            <Stat label="Avg length" value={stats.avg_length != null ? Number(stats.avg_length).toFixed(1) : '—'} color="#7C3AED" />
          </div>
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
              <CheckCircle2 className="h-3.5 w-3.5" /> Steps
            </div>
            <span className="text-xs text-muted-foreground">{column.steps?.length || 0}</span>
          </div>
          <div className="space-y-2">
            {(column.steps || []).map((step, index) => (
              <StepPill
                key={step.id || `${step.operation}_${index}`}
                step={step}
                index={index}
                onRemove={() => onRemoveStep(column.column_name, index)}
                onApprove={() => onApproveStep(column.column_name, index)}
              />
            ))}
            {!column.steps?.length ? (
              <div className="rounded-2xl border border-dashed border-border bg-white/50 p-4 text-center text-xs text-muted-foreground">No steps configured for this column.</div>
            ) : null}
          </div>
        </section>

        <section>
          <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Add operation</div>
          <div className="space-y-3">
            {OPERATION_GROUPS.map((group) => (
              <div key={group.title}>
                <p className="mb-1.5 text-[10px] font-semibold text-muted-foreground">{group.title}</p>
                <div className="flex flex-wrap gap-1.5">
                  {group.items.map((operation) => (
                    <button
                      key={operation}
                      type="button"
                      onClick={() => onAddStep(column.column_name, operation)}
                      className="rounded-xl border border-border bg-white/70 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 hover:border-primary/25 hover:bg-primary/5 hover:text-primary"
                    >
                      {operationLabel(operation)}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </aside>
  );
}
