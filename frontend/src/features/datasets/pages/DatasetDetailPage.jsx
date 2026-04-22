import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Database,
  Trophy,
  BarChart2,
  Tag,
  ChevronRight,
  FlaskConical,
  Layers,
  Trash2,
} from 'lucide-react';
import useOckhamStore from '@/features/workspace/state/WorkspaceContext';
import { MODEL_COLORS } from '@/features/ranking/support/ockhamData';

const FILE_TYPE_COLORS = { csv: '#10B981', xlsx: '#4361EE', json: '#F59E0B' };

function ExperimentCard({ exp, index, onOpenExperiment, onDeleteExperiment }) {
  const primaryMetric = exp.primaryMetric || (exp.problemType === 'regression' ? 'R² Score' : 'Accuracy');
  const ockhamScoreLabel = exp.bestByOckham?.score != null ? Number(exp.bestByOckham.score).toFixed(3) : '—';
  const bestScoreLabel = exp.bestByScore?.score != null ? Number(exp.bestByScore.score).toFixed(3) : '—';
  const sameWinner = exp.bestByOckham?.modelName && exp.bestByOckham?.modelName === exp.bestByScore?.modelName;
  const color = exp.problemType === 'regression' ? '#4361EE' : '#7C3AED';
  const date = exp.updatedAt ? new Date(exp.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.06 }} className="panel-glass rounded-2xl border border-white/70 card-shadow p-5 hover:card-shadow-md transition-all">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${color}18` }}>
            <FlaskConical className="w-5 h-5" style={{ color }} />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color }}>{exp.problemType === 'regression' ? 'Regression' : 'Classification'}</p>
            <p className="text-sm font-bold text-foreground mt-0.5">{exp.models?.length || 0} models compared</p>
          </div>
        </div>
        {date ? <span className="text-xs text-muted-foreground">{date}</span> : null}
      </div>

      {(exp.bestByOckham || exp.bestByScore) ? (
        <div className="grid gap-2 mb-4 sm:grid-cols-2">
          {exp.bestByOckham ? (
            <div className="flex items-center gap-2.5 bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-100 rounded-xl px-4 py-3">
              <Trophy className="w-4 h-4 text-amber-500 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-amber-600/70 font-semibold">Ockham Winner</p>
                <p className="text-sm font-bold text-foreground truncate">{exp.bestByOckham.modelName}</p>
              </div>
              <div className="ml-auto text-right flex-shrink-0">
                <p className="text-[10px] text-muted-foreground">{primaryMetric}</p>
                <p className="text-lg font-heading font-extrabold text-foreground">{ockhamScoreLabel}</p>
              </div>
            </div>
          ) : null}
          {exp.bestByScore ? (
            <div className="flex items-center gap-2.5 bg-white/80 border border-white/80 rounded-xl px-4 py-3">
              <Trophy className="w-4 h-4 text-primary flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-primary/70 font-semibold">Best Score</p>
                <p className="text-sm font-bold text-foreground truncate">{exp.bestByScore.modelName}</p>
              </div>
              <div className="ml-auto text-right flex-shrink-0">
                <p className="text-[10px] text-muted-foreground">{primaryMetric}</p>
                <p className="text-lg font-heading font-extrabold text-foreground">{bestScoreLabel}</p>
              </div>
            </div>
          ) : null}
          {sameWinner ? <p className="sm:col-span-2 text-[11px] text-muted-foreground">Same optimized model won both the score and Ockham rankings.</p> : null}
        </div>
      ) : null}

      {exp.models && exp.models.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {exp.models.map((m, i) => (
            <span key={`${exp.id}-${m}-${i}`} className="px-2.5 py-1 rounded-full text-xs font-medium" style={{ background: `${MODEL_COLORS[i % MODEL_COLORS.length]}15`, color: MODEL_COLORS[i % MODEL_COLORS.length] }}>
              {m}
            </span>
          ))}
        </div>
      ) : null}

      <div className="flex gap-2">
        <button type="button" onClick={() => onOpenExperiment(exp.experimentId, exp.rankingMode || 'ockham')} className="flex-1 rounded-xl border border-primary/15 bg-primary/5 px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/10">
          Open in Dashboard
        </button>
        <button type="button" onClick={() => onDeleteExperiment(exp.experimentId)} className="rounded-xl border border-destructive/15 bg-destructive/5 px-3 py-2 text-xs font-semibold text-destructive hover:bg-destructive/10">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </motion.div>
  );
}

export default function DatasetDetailPage() {
  const store = useOckhamStore();
  const dataset = useMemo(() => store.uploadedDatasets.find((item) => item.id === store.datasetDetailId), [store.uploadedDatasets, store.datasetDetailId]);
  const color = FILE_TYPE_COLORS[dataset?.file_type] || '#4361EE';

  if (!dataset) {
    return (
      <main className="min-h-full px-4 pb-8 md:px-6 animate-fade-in">
        <button type="button" onClick={store.closeDatasetDetail} className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 mb-6"><ArrowLeft className="w-4 h-4" /> Datasets</button>
        <div className="rounded-2xl border border-border bg-white p-10 text-center text-muted-foreground">Dataset not found.</div>
      </main>
    );
  }

  return (
    <main className="min-h-full px-4 pb-8 md:px-6 animate-fade-in">
      <div className="flex items-center gap-2 text-sm mb-6">
        <button type="button" onClick={store.closeDatasetDetail} className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"><ArrowLeft className="w-4 h-4" /> Datasets</button>
        <ChevronRight className="w-3 h-3 text-muted-foreground" />
        <span className="text-foreground font-semibold truncate">{dataset.name}</span>
      </div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="panel-glass rounded-2xl border border-white/70 card-shadow p-6 mb-6">
        <div className="flex items-start gap-5">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: `${color}18` }}>
            <Database className="w-7 h-7" style={{ color }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-heading font-extrabold text-foreground">{dataset.name}</h1>
              <span className="text-xs font-bold uppercase px-2.5 py-0.5 rounded-full" style={{ background: `${color}18`, color }}>.{dataset.file_type || 'csv'}</span>
            </div>
            {dataset.description ? <p className="text-sm text-muted-foreground mt-1">{dataset.description}</p> : null}
            <div className="flex items-center gap-5 mt-3 flex-wrap">
              {dataset.rows ? <div className="flex items-center gap-1.5 text-sm text-muted-foreground"><Layers className="w-3.5 h-3.5" /><span><b className="text-foreground">{dataset.rows.toLocaleString()}</b> rows</span></div> : null}
              {dataset.columns ? <div className="flex items-center gap-1.5 text-sm text-muted-foreground"><BarChart2 className="w-3.5 h-3.5" /><span><b className="text-foreground">{dataset.columns}</b> columns</span></div> : null}
              {dataset.size_kb ? <div className="flex items-center gap-1.5 text-sm text-muted-foreground"><Tag className="w-3.5 h-3.5" /><span><b className="text-foreground">{dataset.size_kb}</b> KB</span></div> : null}
            </div>
          </div>
        </div>
      </motion.div>

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-heading font-bold text-foreground flex items-center gap-2">
          <FlaskConical className="w-4 h-4 text-primary" />
          Experiments
          <span className="text-xs font-normal text-muted-foreground ml-1">({dataset.experiments?.length || 0})</span>
        </h2>
      </div>

      {(!dataset.experiments || dataset.experiments.length === 0) ? (
        <div className="flex flex-col items-center justify-center py-16 text-center panel-glass rounded-2xl border border-white/70 card-shadow">
          <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-4"><FlaskConical className="w-6 h-6 text-muted-foreground" /></div>
          <h3 className="text-sm font-heading font-bold text-foreground mb-1">No experiments yet</h3>
          <p className="text-xs text-muted-foreground mb-4">Go to the Dashboard and run a comparison using this dataset</p>
          <button type="button" onClick={() => store.openDatasetFromLibrary(dataset.id)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl gradient-primary text-white font-bold text-sm shadow-lg shadow-primary/25 hover:opacity-90 transition-all">Run Experiment</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {dataset.experiments.map((exp, i) => (
            <ExperimentCard
              key={exp.experimentId || i}
              exp={exp}
              index={i}
              onOpenExperiment={(id, mode) => store.loadExperimentById(id, { mode, switchView: true })}
              onDeleteExperiment={store.deleteExperiment}
            />
          ))}
        </div>
      )}
    </main>
  );
}
