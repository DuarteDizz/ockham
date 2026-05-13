import React from 'react';
import { Sparkles } from 'lucide-react';

export default function TopHeader({ datasetName, status, problemType, setProblemType, rankingMode, setRankingMode, activeView }) {
  const isProblemTypeLocked = status === 'processing';
  const statusMeta = {
    idle: { label: 'Awaiting benchmark', className: 'bg-slate-100/80 text-slate-600' },
    processing: { label: 'Running benchmark', className: 'bg-amber-50/90 text-amber-600' },
    done: { label: 'Results ready', className: 'bg-emerald-50/90 text-emerald-600' },
    failed: { label: 'Run failed', className: 'bg-red-50/90 text-red-600' },
  }[status] || { label: status, className: 'bg-slate-100/80 text-slate-600' };

  const title = activeView === 'datasets' || activeView === 'dataset-detail'
    ? 'Dataset Library'
    : activeView === 'preprocessing'
      ? 'Preprocessing Pipeline'
      : 'Model Comparison';

  return (
    <header className="panel-glass sticky top-4 z-20 mb-6 rounded-[28px] border border-white/60 px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-heading text-[28px] font-extrabold tracking-[-0.04em] text-foreground">{title}</h2>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>Dataset:</span>
            <span className="rounded-full border border-white/70 bg-white/[0.76] px-2.5 py-1 font-semibold text-foreground">{datasetName || 'No dataset selected'}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="rounded-full border border-white/60 bg-white/60 p-1">
            {[
              { key: 'classification', label: 'Classification' },
              { key: 'regression', label: 'Regression' },
            ].map((option) => (
              <button
                type="button"
                key={option.key}
                onClick={() => setProblemType(option.key)}
                disabled={isProblemTypeLocked}
                className={`rounded-full px-3.5 py-2 text-xs font-semibold transition ${problemType === option.key ? 'gradient-primary text-white shadow-[0_10px_20px_rgba(10,73,194,0.16)]' : 'text-muted-foreground hover:text-foreground'} ${isProblemTypeLocked ? 'cursor-not-allowed opacity-60 hover:text-muted-foreground' : ''}`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="rounded-full border border-white/60 bg-white/60 p-1">
            {[
              { key: 'ockham', label: 'Ockham' },
              { key: 'score', label: 'Score' },
            ].map((option) => (
              <button
                type="button"
                key={option.key}
                onClick={() => setRankingMode(option.key)}
                className={`rounded-full px-3.5 py-2 text-xs font-semibold transition ${rankingMode === option.key ? 'bg-white text-ockham-navy shadow-[0_10px_20px_rgba(10,73,194,0.08)]' : 'text-muted-foreground hover:text-foreground'}`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <span className={`rounded-full px-3 py-2 text-xs font-semibold ${statusMeta.className}`}>{statusMeta.label}</span>
        </div>
      </div>
    </header>
  );
}
