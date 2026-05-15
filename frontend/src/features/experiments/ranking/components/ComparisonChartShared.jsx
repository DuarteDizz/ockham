import { motion } from 'framer-motion';

import { CHART_COLORS } from '@/features/experiments/ranking/support/chartConstants';

export function Panel({ title, subtitle, icon: Icon, children, actions = null, className = '' }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className={`panel-glass card-shadow rounded-[24px] border border-white/70 p-5 ${className}`}
    >
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/75 text-primary shadow-sm backdrop-blur-md">
            <Icon className="h-4.5 w-4.5" strokeWidth={1.9} />
          </div>
          <div>
            <h3 className="font-heading text-lg font-bold text-foreground">{title}</h3>
            {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
          </div>
        </div>
        {actions}
      </div>
      {children}
    </motion.section>
  );
}

export function ChartLegend({ items = [] }) {
  if (!items.length) return null;

  return (
    <div className="mb-4 flex flex-wrap gap-2">
      {items.map((item) => (
        <div
          key={item.key || item.label}
          title={item.title || item.label}
          className="flex items-center gap-2 rounded-full border border-white/60 bg-white/60 px-3 py-1.5 text-xs text-muted-foreground shadow-[0_1px_0_rgba(255,255,255,0.35)]"
        >
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ background: item.color || CHART_COLORS.primary }}
          />
          <span className="max-w-[140px] truncate font-medium text-foreground/90">
            {item.label}
          </span>
        </div>
      ))}
    </div>
  );
}

export function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="rounded-2xl border border-white/80 bg-white/90 px-3 py-2 text-sm shadow-[0_18px_38px_rgba(11,16,32,0.14)] backdrop-blur-md">
      {label != null ? <p className="mb-1 font-semibold text-foreground">{label}</p> : null}
      {payload.map((entry) => (
        <div key={`${entry.name}-${entry.dataKey}`} className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: entry.color || entry.stroke || CHART_COLORS.primary }} />
          <span>{entry.name}: </span>
          <span className="font-semibold text-foreground">
            {typeof entry.value === 'number' ? entry.value.toFixed(3) : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export function Placeholder({ text }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-white/50 px-4 py-10 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}

export function RegressionScatterTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;

  const point = payload[0]?.payload;
  if (!point) return null;

  return (
    <div className="rounded-2xl border border-white/80 bg-white/90 px-3 py-2 text-sm shadow-[0_18px_38px_rgba(11,16,32,0.14)] backdrop-blur-md">
      <p className="mb-1 font-semibold text-foreground">Sample {point.sample}</p>
      {[
        ['Actual', point.actual],
        ['Predicted', point.predicted],
        ['Residual', point.residual],
        ['Distance to ideal line', point.idealDistance],
      ].map(([label, value]) => (
        <div key={label} className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: point.color || CHART_COLORS.primary }} />
          <span>{label}: </span>
          <span className="font-semibold text-foreground">
            {typeof value === 'number' ? value.toFixed(3) : value}
          </span>
        </div>
      ))}
    </div>
  );
}

export function AggregatedPredictedSampleTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;

  const point = payload[0]?.payload;
  if (!point) return null;

  return (
    <div className="rounded-2xl border border-white/80 bg-white/90 px-3 py-2 text-sm shadow-[0_18px_38px_rgba(11,16,32,0.14)] backdrop-blur-md">
      <p className="mb-1 font-semibold text-foreground">Samples {label}</p>
      <div className="mt-1 text-xs text-muted-foreground">
        Points in bucket: <span className="font-semibold text-foreground">{point.pointCount}</span>
      </div>
      <div className="mt-1 text-xs text-muted-foreground">
        Predicted mean: <span className="font-semibold text-foreground">{point.predicted.toFixed(3)}</span>
      </div>
      <div className="mt-1 text-xs text-muted-foreground">
        Actual mean: <span className="font-semibold text-foreground">{point.actual.toFixed(3)}</span>
      </div>
      <div className="mt-1 text-xs text-muted-foreground">
        Actual min: <span className="font-semibold text-foreground">{point.actualMin.toFixed(3)}</span>
      </div>
      <div className="mt-1 text-xs text-muted-foreground">
        Actual max: <span className="font-semibold text-foreground">{point.actualMax.toFixed(3)}</span>
      </div>
    </div>
  );
}
