import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, CheckCircle2, Eye, GitBranch, RotateCcw, Table2, Workflow, Play, ShieldCheck } from 'lucide-react';
import useOckhamStore from '@/features/workspace/state/WorkspaceContext';
import { fetchDatasetPreview } from '@/shared/api/datasets';
import PipelineGraph from '@/features/preprocessing/components/PipelineGraph';
import ColumnTable from '@/features/preprocessing/components/ColumnTable';
import ColumnStatsPanel from '@/features/preprocessing/components/ColumnStatsPanel';
import DatasetPreviewTable from '@/features/preprocessing/components/DatasetPreviewTable';
import TransformPanel from '@/features/preprocessing/components/TransformPanel';
import {
  buildColumnProfilesFromDataset,
  buildDeterministicDraftPlan,
} from '@/features/preprocessing/support/preprocessingPlan';

function MetricCard({ label, value, icon: Icon }) {
  return (
    <div className="panel-glass min-w-0 overflow-hidden rounded-3xl border border-white/70 px-5 py-4 shadow-sm">
      <div className="flex min-w-0 items-center gap-3">
        {Icon ? (
          <div className="flex h-9 w-9 flex-none items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Icon className="h-4 w-4" />
          </div>
        ) : null}
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
          <p title={String(value ?? '')} className="mt-0.5 truncate font-heading text-lg font-extrabold text-foreground">{value}</p>
        </div>
      </div>
    </div>
  );
}

export default function PreprocessingPage() {
  const store = useOckhamStore();
  const dataset = useMemo(() => {
    const id = store.preprocessingDatasetId || store.datasetDetailId || store.datasetId;
    return store.uploadedDatasets.find((item) => item.id === id) || null;
  }, [store.datasetId, store.datasetDetailId, store.preprocessingDatasetId, store.uploadedDatasets]);

  const columns = useMemo(() => buildColumnProfilesFromDataset(dataset, store.datasetColumns), [dataset, store.datasetColumns]);
  const [view, setView] = useState('graph');
  const [plan, setPlan] = useState([]);
  const [selectedColumn, setSelectedColumn] = useState('');
  const [status, setStatus] = useState('Draft');
  const [previewState, setPreviewState] = useState({
    isLoading: false,
    error: '',
    rows: [],
    columns: [],
    rowCount: 0,
  });

  useEffect(() => {
    const draft = buildDeterministicDraftPlan(columns, store.targetColumn);
    setPlan(draft);
    setSelectedColumn((current) => current && draft.some((item) => item.column_name === current) ? current : draft[0]?.column_name || '');
    setStatus('Draft');
  }, [columns, store.targetColumn]);

  useEffect(() => {
    if (!dataset?.id) {
      setPreviewState({ isLoading: false, error: '', rows: [], columns: [], rowCount: 0 });
      return undefined;
    }

    let isCurrentRequest = true;
    setPreviewState((current) => ({ ...current, isLoading: true, error: '' }));

    fetchDatasetPreview(dataset.id, 20)
      .then((response) => {
        if (!isCurrentRequest) return;
        setPreviewState({
          isLoading: false,
          error: '',
          rows: response?.preview_rows || [],
          columns: response?.column_names || [],
          rowCount: response?.row_count || 0,
        });
      })
      .catch((error) => {
        if (!isCurrentRequest) return;
        setPreviewState({
          isLoading: false,
          error: error?.message || 'Could not load dataset preview.',
          rows: [],
          columns: [],
          rowCount: 0,
        });
      });

    return () => {
      isCurrentRequest = false;
    };
  }, [dataset?.id]);

  const selectedProfile = useMemo(() => columns.find((column) => column.column_name === selectedColumn) || null, [columns, selectedColumn]);
  const selectedPlan = useMemo(() => plan.find((item) => item.column_name === selectedColumn) || null, [plan, selectedColumn]);

  const validatePlan = () => {
    const invalid = plan.some((item) => !item.steps.length && item.column_name !== store.targetColumn);
    setStatus(invalid ? 'Needs review' : 'Validated');
  };

  const resetPlan = () => {
    setPlan(buildDeterministicDraftPlan(columns, store.targetColumn));
    setStatus('Draft');
  };

  const runPipeline = () => {
    setStatus('Executed locally');
  };

  const plannedColumnCount = plan.length;
  const operationCount = plan.reduce((acc, item) => acc + item.steps.length, 0);
  const droppedCount = plan.filter((item) => item.steps.some((step) => step.operation === 'drop_column')).length;

  if (!dataset) {
    return (
      <main className="min-h-full px-4 pb-8 md:px-6 animate-fade-in">
        <button type="button" onClick={() => store.setActiveView('datasets')} className="mb-6 flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Datasets</button>
        <div className="panel-glass rounded-3xl border border-white/70 p-10 text-center shadow-sm">
          <p className="font-heading text-lg font-extrabold text-foreground">No active dataset</p>
          <p className="mt-1 text-sm text-muted-foreground">Choose a dataset before designing a preprocessing pipeline.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-full px-4 pb-8 md:px-6 animate-fade-in">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <button type="button" onClick={() => store.openDatasetDetail?.(dataset.id) || store.setActiveView('datasets')} className="mb-3 flex max-w-full items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"><ArrowLeft className="h-4 w-4 flex-none" /> <span title={dataset.name} className="truncate">{dataset.name}</span></button>
          <h1 className="font-heading text-3xl font-extrabold tracking-tight text-foreground">Preprocessing Pipeline</h1>
          <p className="mt-1 text-sm text-muted-foreground">Rule-based draft for testing pipeline features. Agents can be connected later.</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={resetPlan} className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-muted-foreground shadow-sm transition-colors hover:text-foreground"><RotateCcw className="h-4 w-4" /> Reset</button>
          <button type="button" onClick={validatePlan} className="inline-flex items-center gap-2 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-2.5 text-sm font-bold text-primary shadow-sm transition-colors hover:bg-primary/10"><ShieldCheck className="h-4 w-4" /> Validate</button>
          <button type="button" onClick={runPipeline} className="inline-flex items-center gap-2 rounded-2xl gradient-primary px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-primary/25 transition-all hover:opacity-90"><Play className="h-4 w-4" /> Run Pipeline</button>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 lg:grid-cols-4">
        <MetricCard label="Dataset" value={dataset.name} icon={GitBranch} />
        <MetricCard label="Pipeline status" value={status} icon={CheckCircle2} />
        <MetricCard label="Columns in plan" value={plannedColumnCount} icon={Table2} />
        <MetricCard label="Operations" value={`${operationCount} · ${droppedCount} dropped`} icon={Workflow} />
      </div>

      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-1 rounded-2xl border border-white/70 bg-white/65 p-1 shadow-sm backdrop-blur-xl">
          {[
            { key: 'graph', label: 'Graph', icon: GitBranch },
            { key: 'table', label: 'Columns', icon: Table2 },
            { key: 'preview', label: 'Preview', icon: Eye },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setView(key)}
              className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition-all ${view === key ? 'gradient-primary text-white shadow-lg shadow-primary/25' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </div>
        <p className="text-xs font-medium text-muted-foreground">Target column: <span className="font-bold text-foreground">{store.targetColumn || 'not selected'}</span></p>
      </div>

      <div className="grid min-h-[640px] grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-h-[640px]">
          {view === 'table' ? (
            <ColumnTable columns={columns} plan={plan} selectedColumn={selectedColumn} onSelectColumn={setSelectedColumn} />
          ) : view === 'preview' ? (
            <DatasetPreviewTable
              datasetName={dataset.name}
              rows={previewState.rows}
              columns={previewState.columns}
              rowCount={previewState.rowCount}
              isLoading={previewState.isLoading}
              error={previewState.error}
              selectedColumn={selectedColumn}
              onSelectColumn={setSelectedColumn}
            />
          ) : (
            <PipelineGraph datasetName={dataset.name} columns={columns} plan={plan} selectedColumn={selectedColumn} onSelectColumn={setSelectedColumn} />
          )}
        </div>

        <aside className="flex h-fit flex-col gap-4 self-start xl:sticky xl:top-5">
          <TransformPanel
            column={selectedProfile}
            columnPlan={selectedPlan}
            columns={columns}
            targetColumn={store.targetColumn}
            plan={plan}
            onPlanChange={(nextPlan) => { setPlan(nextPlan); setStatus('User edited'); }}
          />
          <ColumnStatsPanel column={selectedProfile} />
        </aside>
      </div>
    </main>
  );
}
