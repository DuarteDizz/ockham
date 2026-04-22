import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import useOckhamStore from '@/features/workspace/state/WorkspaceContext';
import EmptyState from '@/shared/components/EmptyState';
import ProcessingState from '@/features/experiments/components/ProcessingState';
import BestModelPanel from '@/features/ranking/components/BestModelPanel';
import ComparisonChart from '@/features/ranking/components/ComparisonChart';
import ComparisonTable from '@/features/ranking/components/ComparisonTable';
import OckhamLogo from '@/shared/components/OckhamLogo';

function OckhamFallbackBanner({ rankingMeta }) {
  if (!rankingMeta?.isOckhamFallback) return null;

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-950 shadow-sm">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
        <div>
          <p className="font-semibold">Ockham fallback used</p>
          <p className="mt-1 text-amber-900/90">
            The LLM ranking could not be completed, so the Ockham view below is using deterministic score-based fallback.
          </p>
          {rankingMeta?.rankingError ? (
            <p className="mt-1 text-xs text-amber-900/80">
              Reason: {rankingMeta.rankingError}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function DashboardReadyState({ store }) {
  const canRun = Boolean(store.datasetName) && Boolean(store.targetColumn) && store.selectedModels.length >= 2;

  return (
    <main className="flex min-h-full items-center justify-center px-4 pb-8 md:px-6 animate-fade-in">
      <div className="mx-auto max-w-3xl text-center">
        <div className="mx-auto w-fit">
          <OckhamLogo showLabel={false} size="lg" />
        </div>
        <h2 className="mt-6 font-heading text-3xl font-extrabold tracking-[-0.04em] text-foreground">Ready to run your next benchmark</h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
          Your dataset is loaded. Select a target column, choose at least two models and launch the comparison to populate the dashboard.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3 text-sm">
          <span className="rounded-2xl border border-white/60 bg-white/70 px-4 py-3 text-muted-foreground">Dataset: <span className="font-semibold text-foreground">{store.datasetName}</span></span>
          <span className="rounded-2xl border border-white/60 bg-white/70 px-4 py-3 text-muted-foreground">Target: <span className="font-semibold text-foreground">{store.targetColumn || 'Not selected'}</span></span>
          <span className="rounded-2xl border border-white/60 bg-white/70 px-4 py-3 text-muted-foreground">Models: <span className="font-semibold text-foreground">{store.selectedModels.length}</span></span>
        </div>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={store.runComparison} disabled={!canRun || store.status === 'processing'} className="inline-flex items-center gap-2 rounded-2xl gradient-primary px-5 py-3 text-sm font-semibold text-white shadow-[0_16px_26px_rgba(10,73,194,0.18)] disabled:opacity-50">
            Run comparison
          </button>
          <button type="button" onClick={() => store.setActiveView('datasets')} className="inline-flex items-center gap-2 rounded-2xl border border-white/70 bg-white/80 px-5 py-3 text-sm font-semibold text-foreground">
            Open datasets
          </button>
        </div>
      </div>
    </main>
  );
}

export default function Dashboard() {
  const store = useOckhamStore();

  if (store.status === 'idle' && !store.datasetName) {
    return <EmptyState uploadDataset={store.uploadDataset} datasetName={store.datasetName} />;
  }

  if (store.status === 'processing') {
    return <ProcessingState />;
  }

  if (!store.results?.length) {
    return <DashboardReadyState store={store} />;
  }

  return (
    <main className="min-h-full px-4 pb-6 md:px-6">
      <div className="space-y-5 pb-8">
        <div className="flex justify-end">
          <button type="button" onClick={store.resetExperiment} className="panel-soft inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm text-muted-foreground transition-all hover:bg-white/90 hover:text-foreground">
            <RotateCcw className="h-4 w-4" /> Reset
          </button>
        </div>

        <OckhamFallbackBanner rankingMeta={store.rankingMeta} />
        <BestModelPanel results={store.results} rankingMode={store.rankingMode} />
        <ComparisonTable results={store.results} rankingMode={store.rankingMode} />
        <ComparisonChart results={store.results} problemType={store.problemType} rankingMode={store.rankingMode} />
      </div>
    </main>
  );
}
