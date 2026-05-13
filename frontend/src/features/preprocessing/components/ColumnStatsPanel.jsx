import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart2, AlertTriangle, CheckCircle2, ChevronDown } from 'lucide-react';
import { TYPE_META } from '@/features/preprocessing/support/preprocessingPlan';

function formatValue(value) {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'number') {
    if (Math.abs(value) >= 1000) return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
    return Number(value).toLocaleString(undefined, { maximumFractionDigits: 3 });
  }
  return String(value);
}

function CollapsibleStatsSection({ title, subtitle, defaultOpen = true, children }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="overflow-hidden rounded-2xl border border-white/70 bg-white/60 shadow-sm">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="flex w-full items-start justify-between gap-3 px-3 py-3 text-left transition-colors hover:bg-white/70"
        aria-expanded={isOpen}
      >
        <span className="min-w-0">
          <span className="block text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{title}</span>
          {subtitle ? <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">{subtitle}</span> : null}
        </span>
        <ChevronDown className={`mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence initial={false}>
        {isOpen ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="border-t border-white/70 p-3">{children}</div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function StatBox({ label, value, color }) {
  return (
    <div className="rounded-2xl border border-white/70 bg-white/70 p-2.5 shadow-sm">
      <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className="font-heading text-base font-extrabold tabular-nums" style={{ color }}>{formatValue(value)}</p>
    </div>
  );
}

function RatioBar({ label, value, color }) {
  const pct = Math.max(0, Math.min(Number(value || 0) * 100, 100));
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
        <span>{label}</span>
        <span>{pct.toFixed(1)}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-200/70">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

function DistributionBars({ distribution, color }) {
  const entries = Object.entries(distribution || {}).slice(0, 6);
  if (!entries.length) return null;
  const max = Math.max(...entries.map(([, value]) => Number(value)), 0.01);
  return (
    <div className="space-y-2">
      {entries.map(([label, value]) => (
        <div key={label} className="flex items-center gap-2">
          <span className="w-20 truncate text-[10px] font-semibold text-muted-foreground">{label}</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200/70">
            <div className="h-full rounded-full" style={{ width: `${(Number(value) / max) * 100}%`, background: color }} />
          </div>
          <span className="w-10 text-right text-[10px] font-semibold text-muted-foreground">{(Number(value) * 100).toFixed(0)}%</span>
        </div>
      ))}
    </div>
  );
}

export default function ColumnStatsPanel({ column }) {
  const [isPanelOpen, setIsPanelOpen] = useState(true);

  if (!column) {
    return (
      <div className="flex min-h-[180px] flex-col items-center justify-center rounded-[28px] border border-white/70 bg-white/55 p-6 text-center shadow-sm backdrop-blur-xl">
        <BarChart2 className="mb-3 h-8 w-8 text-muted-foreground/40" />
        <p className="text-sm font-heading font-bold text-foreground">Select a column</p>
        <p className="mt-1 max-w-[220px] text-xs text-muted-foreground">Inspect profiling metrics and edit preprocessing steps.</p>
      </div>
    );
  }

  const meta = TYPE_META[column.inferred_type] || TYPE_META.text;
  const Icon = meta.icon;
  const common = column.common_stats || {};
  const stats = column.specific_stats || {};
  const missingRatio = common.missing_ratio || 0;

  return (
    <div className="overflow-hidden rounded-[28px] border border-white/70 bg-white/65 shadow-sm backdrop-blur-xl">
      <div className="flex items-start gap-3 p-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl" style={{ background: `${meta.color}15`, color: meta.color }}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-heading font-extrabold text-foreground">{column.column_name}</p>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: meta.color }}>{meta.label}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Profiling metrics</p>
        </div>
        <button
          type="button"
          onClick={() => setIsPanelOpen((current) => !current)}
          className="rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-muted-foreground transition-colors hover:text-foreground"
          title={isPanelOpen ? 'Collapse profiling panel' : 'Expand profiling panel'}
          aria-expanded={isPanelOpen}
        >
          <ChevronDown className={`h-4 w-4 transition-transform ${isPanelOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>

      <AnimatePresence initial={false}>
        {isPanelOpen ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="space-y-3 border-t border-white/70 p-4">
              <CollapsibleStatsSection title="Core statistics" subtitle="Observed, missing and uniqueness metrics." defaultOpen>
                <div className="grid grid-cols-2 gap-2">
                  <StatBox label="Observed" value={common.observed_count} color={meta.color} />
                  <StatBox label="Missing" value={common.missing_count} color={missingRatio > 0 ? '#EF4444' : '#10B981'} />
                  <StatBox label="Unique" value={common.unique_count} color={meta.color} />
                  <StatBox label="Unique %" value={(common.unique_ratio || 0) * 100} color={meta.color} />
                </div>
              </CollapsibleStatsSection>

              <CollapsibleStatsSection title="Missing values" subtitle={missingRatio > 0 ? 'Missing data detected.' : 'No missing values detected.'} defaultOpen={missingRatio > 0}>
                {missingRatio > 0 ? (
                  <div className="rounded-2xl border border-red-200 bg-red-50/80 p-3">
                    <div className="mb-2 flex items-center gap-2 text-xs font-bold text-red-500"><AlertTriangle className="h-4 w-4" /> Missing values</div>
                    <RatioBar label="Missing ratio" value={missingRatio} color="#EF4444" />
                  </div>
                ) : (
                  <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50/80 px-3 py-2 text-xs font-bold text-emerald-600">
                    <CheckCircle2 className="h-4 w-4" /> No missing values detected
                  </div>
                )}
              </CollapsibleStatsSection>

              {(column.inferred_type || '').includes('numeric') ? (
                <CollapsibleStatsSection title="Numeric profile" subtitle="Distribution, skewness and outlier signals." defaultOpen>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <StatBox label="Mean" value={stats.mean} color={meta.color} />
                      <StatBox label="Std" value={stats.std} color={meta.color} />
                      <StatBox label="Skew" value={stats.skewness} color={Math.abs(stats.skewness || 0) > 1 ? '#F59E0B' : meta.color} />
                      <StatBox label="Outliers" value={(stats.outlier_ratio_iqr || 0) * 100} color={(stats.outlier_ratio_iqr || 0) > 0.05 ? '#F59E0B' : meta.color} />
                    </div>
                    <RatioBar label="Zero ratio" value={stats.zero_ratio || 0} color={meta.color} />
                    <RatioBar label="IQR outliers" value={stats.outlier_ratio_iqr || 0} color="#F59E0B" />
                  </div>
                </CollapsibleStatsSection>
              ) : null}

              {column.inferred_type === 'text' || column.inferred_type === 'categorical' || column.inferred_type === 'identifier' || column.inferred_type === 'free_text' ? (
                <CollapsibleStatsSection title="Text/categorical profile" subtitle="Cardinality, entropy and masked distribution." defaultOpen>
                  <div className="mb-3 grid grid-cols-2 gap-2">
                    <StatBox label="Top 1 %" value={(stats.top_1_ratio || 0) * 100} color={meta.color} />
                    <StatBox label="Entropy" value={stats.normalized_entropy} color={meta.color} />
                    <StatBox label="Avg length" value={stats.avg_length} color={meta.color} />
                    <StatBox label="Patterns" value={stats.unique_pattern_count} color={meta.color} />
                  </div>
                  <DistributionBars distribution={stats.masked_top_distribution} color={meta.color} />
                </CollapsibleStatsSection>
              ) : null}

              {(column.inferred_type || '').includes('datetime') ? (
                <CollapsibleStatsSection title="Datetime profile" subtitle="Parse success, time span and calendar distribution." defaultOpen>
                  <div className="mb-3 grid grid-cols-2 gap-2">
                    <StatBox label="Parse %" value={(stats.parse_success_ratio || 0) * 100} color={meta.color} />
                    <StatBox label="Span days" value={stats.timespan_days} color={meta.color} />
                    <StatBox label="Months" value={stats.month_unique_count} color={meta.color} />
                    <StatBox label="Weekdays" value={stats.weekday_unique_count} color={meta.color} />
                  </div>
                  <DistributionBars distribution={stats.month_distribution} color={meta.color} />
                </CollapsibleStatsSection>
              ) : null}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
