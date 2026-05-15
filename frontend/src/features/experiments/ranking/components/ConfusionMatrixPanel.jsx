import { motion } from 'framer-motion';

import { Placeholder } from '@/features/experiments/ranking/components/ComparisonChartShared';
import { deriveConfusionStats } from '@/features/experiments/ranking/support/comparisonData';
import { CHART_COLORS, getConfusionCellTone } from '@/features/experiments/ranking/support/chartConstants';

function ConfusionPill({ label, value, tone = 'neutral' }) {
  const tones = {
    primary: {
      background: 'rgba(10,73,194,0.08)',
      border: 'rgba(10,73,194,0.16)',
      valueColor: CHART_COLORS.primary,
    },
    warning: {
      background: 'rgba(245,158,11,0.08)',
      border: 'rgba(245,158,11,0.16)',
      valueColor: '#B45309',
    },
    neutral: {
      background: 'rgba(255,255,255,0.74)',
      border: 'rgba(226,232,240,0.86)',
      valueColor: 'rgba(15,23,42,0.78)',
    },
  };

  const colors = tones[tone] || tones.neutral;

  return (
    <div
      className="flex items-center gap-2 rounded-full border px-3 py-1.5"
      style={{
        background: colors.background,
        borderColor: colors.border,
      }}
    >
      <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </span>
      <span className="text-sm font-heading font-bold" style={{ color: colors.valueColor }}>
        {value}
      </span>
    </div>
  );
}

function ConfusionLegendDot({ color, label }) {
  return (
    <div className="flex items-center gap-2">
      <span className="h-2.5 w-2.5 rounded-[4px]" style={{ background: color }} />
      <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </span>
    </div>
  );
}

export function ConfusionMatrixPanel({ diagnostics }) {
  const matrix = diagnostics?.confusionMatrix;
  if (!matrix?.labels?.length || !matrix?.matrix?.length) {
    return <Placeholder text="Confusion matrix unavailable for this model." />;
  }

  const labels = matrix.labels;
  const matrixValues = matrix.matrix;
  const flatValues = matrixValues.flat();
  const maxValue = Math.max(...flatValues, 1);
  const totalSamples = flatValues.reduce((sum, value) => sum + value, 0);
  const correctPredictions = labels.reduce((sum, _, index) => sum + (matrixValues[index]?.[index] || 0), 0);
  const overallAccuracy = totalSamples > 0 ? correctPredictions / totalSamples : 0;
  const misclassifiedSamples = Math.max(totalSamples - correctPredictions, 0);
  const errorRate = totalSamples > 0 ? misclassifiedSamples / totalSamples : 0;
  const perClassStats = deriveConfusionStats(labels, matrixValues);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Predicted × Actual
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Read confusion quickly through the diagonal for correct predictions and the off-diagonal for class mix-ups.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <ConfusionPill label="Accuracy" value={`${(overallAccuracy * 100).toFixed(1)}%`} tone="primary" />
          <ConfusionPill label="Samples" value={totalSamples.toLocaleString()} />
          <ConfusionPill label="Error rate" value={`${(errorRate * 100).toFixed(1)}%`} tone="warning" />
        </div>
      </div>

      <div className="overflow-x-auto pb-1">
        <div className="min-w-[720px]">
          <div className="mb-2 grid gap-2" style={{ gridTemplateColumns: `140px repeat(${labels.length}, minmax(110px, 1fr))` }}>
            <div className="flex items-end rounded-[18px] border border-white/80 bg-white/74 px-4 py-3">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Actual</div>
                <div className="mt-1 text-xs font-semibold text-foreground/70">Rows</div>
              </div>
            </div>

            {labels.map((label) => (
              <div
                key={`col-header-${label}`}
                className="flex min-h-[58px] items-end justify-center rounded-[18px] border border-white/80 bg-white/74 px-3 py-3 text-center"
                title={label}
              >
                <span className="block max-w-[120px] truncate text-[11px] font-semibold leading-tight text-foreground/76">
                  {label}
                </span>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            {matrixValues.map((row, rowIndex) => (
              <motion.div
                key={`matrix-row-${labels[rowIndex]}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.03 * rowIndex, duration: 0.28 }}
                className="grid gap-2"
                style={{ gridTemplateColumns: `140px repeat(${labels.length}, minmax(110px, 1fr))` }}
              >
                <div
                  className="flex min-h-[64px] items-center rounded-[18px] border border-white/80 bg-white/72 px-4"
                  title={labels[rowIndex]}
                >
                  <div>
                    <div className="max-w-[104px] truncate text-sm font-semibold text-foreground/82">
                      {labels[rowIndex]}
                    </div>
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      Support {perClassStats[rowIndex]?.support ?? 0}
                    </div>
                  </div>
                </div>

                {row.map((value, colIndex) => {
                  const isDiagonal = rowIndex === colIndex;
                  const intensity = maxValue > 0 ? value / maxValue : 0;
                  const share = totalSamples > 0 ? (value / totalSamples) * 100 : 0;
                  const tone = getConfusionCellTone(isDiagonal, intensity);

                  return (
                    <motion.div
                      key={`matrix-cell-${rowIndex}-${colIndex}`}
                      whileHover={{ y: -1 }}
                      transition={{ duration: 0.18 }}
                      className="group relative flex min-h-[64px] flex-col items-center justify-center rounded-[18px] border px-3 text-center"
                      style={{
                        background: tone.background,
                        borderColor: tone.border,
                        boxShadow: isDiagonal && intensity > 0.34
                          ? '0 10px 22px rgba(10,73,194,0.10)'
                          : '0 8px 18px rgba(15,23,42,0.04)',
                      }}
                      title={`${labels[rowIndex]} predicted as ${labels[colIndex]} · ${value} samples (${share.toFixed(1)}%)`}
                    >
                      <div
                        className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full"
                        style={{
                          background: isDiagonal ? 'rgba(10,73,194,0.10)' : 'rgba(245,158,11,0.10)',
                        }}
                      >
                        {isDiagonal ? (
                          <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                            <path d="M1 4.2L2.7 6 7 1.6" stroke={CHART_COLORS.primary} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        ) : value > 0 ? (
                          <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                            <path d="M2 2L6 6M6 2L2 6" stroke={CHART_COLORS.amber} strokeWidth="1.35" strokeLinecap="round" />
                          </svg>
                        ) : null}
                      </div>

                      <span className="text-[22px] font-heading font-extrabold leading-none" style={{ color: tone.valueColor }}>
                        {value}
                      </span>
                      <span className="mt-1 text-[11px] font-semibold" style={{ color: tone.metaColor }}>
                        {share.toFixed(1)}%
                      </span>
                    </motion.div>
                  );
                })}
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <ConfusionLegendDot color="rgba(10,73,194,0.72)" label="Correct" />
        <ConfusionLegendDot color="rgba(245,158,11,0.58)" label="Misclassified" />
      </div>

      <div className="rounded-[22px] border border-white/80 bg-white/62 p-4 shadow-[0_10px_22px_rgba(15,23,42,0.04)]">
        <div className="mb-3 grid gap-3 px-1" style={{ gridTemplateColumns: 'minmax(0,1fr) 88px 88px 88px 88px' }}>
          <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Class</span>
          {['Precision', 'Recall', 'F1', 'Support'].map((label) => (
            <span key={label} className="text-right text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
              {label}
            </span>
          ))}
        </div>

        <div className="space-y-1.5">
          {perClassStats.map((stat, index) => (
            <motion.div
              key={`class-stat-${stat.label}`}
              initial={{ opacity: 0, x: 6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.04 * index, duration: 0.24 }}
              className="grid items-center gap-3 rounded-[16px] border border-white/70 bg-white/72 px-4 py-3"
              style={{ gridTemplateColumns: 'minmax(0,1fr) 88px 88px 88px 88px' }}
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-foreground/82" title={stat.label}>
                  {stat.label}
                </div>
              </div>

              <span className="text-right text-sm font-semibold" style={{ color: CHART_COLORS.primary }}>
                {(stat.precision * 100).toFixed(1)}%
              </span>
              <span className="text-right text-sm font-semibold" style={{ color: CHART_COLORS.green }}>
                {(stat.recall * 100).toFixed(1)}%
              </span>
              <span className="text-right text-sm font-semibold" style={{ color: CHART_COLORS.amber }}>
                {(stat.f1 * 100).toFixed(1)}%
              </span>
              <span className="text-right text-sm font-semibold text-foreground/72">
                {stat.support}
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
