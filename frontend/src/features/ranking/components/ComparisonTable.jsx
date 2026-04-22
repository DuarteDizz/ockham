import React from 'react';
import { motion } from 'framer-motion';
import { MODEL_COLORS } from '@/features/ranking/support/ockhamData';
import { Trophy } from 'lucide-react';

export default function ComparisonTable({ results, rankingMode }) {
  if (!results || results.length === 0) return null;

  const metricKeys = Object.keys(results[0].metrics);
  const title = rankingMode === 'score' ? 'All Models — Score Ranking' : 'All Models — Ockham Ranking';

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35 }}
      className="panel-glass card-shadow overflow-hidden rounded-2xl border border-border"
    >
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <h3 className="font-heading text-base font-bold text-foreground">{title}</h3>
        <span className="text-xs text-muted-foreground">{results.length} models compared</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="w-8 px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Rank</th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Model</th>
              {metricKeys.map((k) => (
                <th key={k} className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">{k}</th>
              ))}
              <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Search Time</th>
            </tr>
          </thead>
          <tbody>
            {results.map((model, ri) => {
              const color = MODEL_COLORS[ri % MODEL_COLORS.length];
              const isBest = ri === 0;
              return (
                <tr key={model.id} className={`border-b border-border/50 transition-colors hover:bg-muted/20 ${isBest ? 'bg-blue-50/50' : ''}`}>
                  <td className="px-5 py-3.5 text-center">
                    {isBest ? (
                      <div className="gradient-primary mx-auto flex h-6 w-6 items-center justify-center rounded-full">
                        <Trophy className="h-3 w-3 text-white" />
                      </div>
                    ) : (
                      <span className="text-xs font-semibold text-muted-foreground">#{model.display_rank || ri + 1}</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-start gap-2.5">
                      <div className="mt-1 h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ background: color }} />
                      <div>
                        <span className={`text-sm ${isBest ? 'font-semibold text-foreground' : 'font-medium text-foreground'}`}>{model.name}</span>
                        <div className="mt-1 flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
                          <span className="rounded-full bg-white/70 px-2 py-0.5">Score #{model.performance_rank}</span>
                          <span className="rounded-full bg-white/70 px-2 py-0.5">Ockham #{model.ockham_rank}</span>
                        </div>
                      </div>
                    </div>
                  </td>
                  {metricKeys.map((key) => {
                    const val = model.metrics[key];
                    return (
                      <td key={key} className="px-4 py-3.5 text-center">
                        <span className="font-mono text-xs text-foreground">
                          {typeof val === 'number' ? val.toFixed(3) : val}
                        </span>
                      </td>
                    );
                  })}
                  <td className="px-4 py-3.5 text-center">
                    <span className="font-mono text-xs text-foreground">{model.training_time}s</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}
