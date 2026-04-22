import React from 'react';
import { motion } from 'framer-motion';
import { Clock, Info, Sparkles, Trophy, Zap } from 'lucide-react';

import { MODEL_COLORS } from '@/features/ranking/support/ockhamData';
import MetricsOverview from './MetricsOverview';

export default function BestModelPanel({ results, rankingMode = 'ockham' }) {
  if (!results || results.length === 0) return null;

  const best = results[0];
  const runner = results[1];

  const bestByScore = results.find((item) => item.performance_rank === 1) || best;
  const bestByOckham = results.find((item) => item.ockham_rank === 1) || best;
  const alternative = rankingMode === 'score' ? bestByOckham : bestByScore;

  const primaryMetric = best.primaryMetricLabel || Object.keys(best.metrics)[0];
  const alternativeMetric = alternative?.primaryMetricLabel || primaryMetric;
  const diff = runner
    ? (best.metrics[primaryMetric] || 0) - (runner.metrics[primaryMetric] || 0)
    : 0;

  const bestColor = MODEL_COLORS[0];
  const rankLabel =
    rankingMode === 'score'
      ? `Score Rank #${best.performance_rank}`
      : `Ockham Rank #${best.ockham_rank}`;
  const helperLabel =
    rankingMode === 'score' ? 'Best by Score' : 'Recommended by Ockham';
  const sameWinner = bestByScore?.id === bestByOckham?.id;
  const llmSummary =
    best.ockham_components?.llm_summary ||
    best.capabilityProfile?.summary?.why_ockham_likes_this_model ||
    '';

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1, duration: 0.4 }}
      className="panel-glass card-shadow-md rounded-2xl border border-primary/15 bg-gradient-to-br from-blue-50/82 via-white/70 to-cyan-50/80 p-6"
    >
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-4">
          <div className="gradient-primary flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl shadow-lg shadow-primary/20">
            <Trophy className="h-6 w-6 text-white" />
          </div>

          <div>
            <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              {helperLabel}
            </p>
            <h2 className="font-heading text-2xl font-extrabold leading-tight text-foreground">
              {best.name}
            </h2>

            <div className="mt-1.5 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                <span>{best.training_time}s search</span>
              </div>

              {runner ? (
                <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
                  <Zap className="h-3.5 w-3.5" />
                  <span>
                    {diff >= 0 ? '+' : ''}
                    {(diff * 100).toFixed(2)} pts vs next
                  </span>
                </div>
              ) : null}

              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                {rankLabel}
              </span>
            </div>
          </div>
        </div>

        <div className="text-left lg:text-right">
          <p className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">
            {primaryMetric}
          </p>
          <p
            className="font-heading text-4xl font-extrabold"
            style={{ color: bestColor }}
          >
            {best.metrics[primaryMetric]?.toFixed(3)}
          </p>
        </div>
      </div>

      <MetricsOverview results={results} embedded />

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl border border-white/80 bg-white/70 px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {rankingMode === 'score' ? 'Current score winner' : 'Current Ockham winner'}
          </p>

          <div className="mt-1 flex items-center gap-2">
            {rankingMode === 'score' ? (
              <Trophy className="h-4 w-4 text-amber-500" />
            ) : (
              <Sparkles className="h-4 w-4 text-primary" />
            )}
            <span className="font-semibold text-foreground">{best.name}</span>
          </div>

          {rankingMode === 'ockham' ? (
            <p className="mt-1 text-xs text-muted-foreground">
              {llmSummary ||
                'Chosen in Ockham mode by balancing measured performance with simplicity, stability, and operational tradeoffs.'}
            </p>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">
              Highest tuned performance among all compared models.
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-white/80 bg-white/70 px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {sameWinner
              ? 'Mode alignment'
              : rankingMode === 'score'
                ? 'Ockham recommendation'
                : 'Score winner'}
          </p>

          {sameWinner ? (
            <div className="mt-1 flex items-center gap-2 text-sm font-semibold text-foreground">
              <Sparkles className="h-4 w-4 text-primary" />
              Same model wins both modes
            </div>
          ) : alternative ? (
            <>
              <div className="mt-1 flex items-center gap-2">
                {rankingMode === 'score' ? (
                  <Sparkles className="h-4 w-4 text-primary" />
                ) : (
                  <Trophy className="h-4 w-4 text-amber-500" />
                )}
                <span className="font-semibold text-foreground">{alternative.name}</span>
              </div>

              <p className="mt-1 text-xs text-muted-foreground">
                {alternativeMetric}:{' '}
                {typeof alternative.metrics?.[alternativeMetric] === 'number'
                  ? alternative.metrics[alternativeMetric].toFixed(3)
                  : '—'}
              </p>
            </>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">
              No alternative winner available.
            </p>
          )}
        </div>
      </div>

      {best.hyperparameters && Object.keys(best.hyperparameters).length > 0 ? (
        <div className="mt-4 border-t border-border/40 pt-4">
          <p className="mb-2 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            <Info className="h-3 w-3" />
            Hyperparameters
          </p>

          <div className="flex flex-wrap gap-2">
            {Object.entries(best.hyperparameters).map(([key, value]) => (
              <span
                key={key}
                className="rounded-lg border border-white/80 bg-white/70 px-2.5 py-1 font-mono text-xs text-foreground backdrop-blur-md"
              >
                {key}: <span className="font-semibold">{String(value)}</span>
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </motion.div>
  );
}
