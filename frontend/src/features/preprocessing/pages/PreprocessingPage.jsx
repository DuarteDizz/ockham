import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  GitBranch,
  PlusCircle,
  RotateCcw,
  Sparkles,
  Table2,
  Workflow,
  Play,
  ShieldCheck,
} from 'lucide-react';
import useOckhamStore from '@/features/workspace/state/WorkspaceContext';
import { fetchDatasetPreview } from '@/shared/api/datasets';
import { createAgenticPreprocessingPlan, streamAgenticPreprocessingPlan } from '@/shared/api/preprocessing';
import PipelineGraph from '@/features/preprocessing/components/pipeline-graph/PipelineGraph';
import ColumnTable from '@/features/preprocessing/components/ColumnTable';
import ColumnStatsPanel from '@/features/preprocessing/components/ColumnStatsPanel';
import DatasetPreviewTable from '@/features/preprocessing/components/DatasetPreviewTable';
import TransformPanel from '@/features/preprocessing/components/TransformPanel';
import AgentRunPanel from '@/features/preprocessing/components/AgentRunPanel';
import { buildColumnProfilesFromDataset } from '@/features/preprocessing/lib/columnProfiles';
import { buildManualColumnPlan, normalizePreprocessingPlanColumns } from '@/features/preprocessing/lib/planNormalization';

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

function PipelineStartActions({ planSource, isGeneratingAgenticPlan, onStartManual, onGenerateAgentic }) {
  return (
    <div className="mb-4 rounded-[28px] border border-white/70 bg-white/65 p-4 shadow-sm backdrop-blur-xl">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="font-heading text-sm font-extrabold text-foreground">Start the preprocessing flow</p>
          <p className="mt-1 text-xs text-muted-foreground">
            The canvas starts empty. Add columns manually or ask Ockham to recommend a pipeline with the agentic flow.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onStartManual}
            className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-bold shadow-sm transition-all ${
              planSource === 'manual'
                ? 'border-primary/30 bg-primary/10 text-primary'
                : 'border-slate-200 bg-white text-muted-foreground hover:text-foreground'
            }`}
          >
            <PlusCircle className="h-4 w-4" /> Build manually
          </button>
          <button
            type="button"
            onClick={onGenerateAgentic}
            disabled={isGeneratingAgenticPlan}
            className="inline-flex items-center gap-2 rounded-2xl gradient-primary px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-primary/25 transition-all hover:opacity-90 disabled:cursor-wait disabled:opacity-65"
          >
            <Sparkles className="h-4 w-4" />
            {isGeneratingAgenticPlan ? 'Generating recommendation...' : 'Generate AI recommendation'}
          </button>
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
  const [planSource, setPlanSource] = useState('empty');
  const [selectedColumn, setSelectedColumn] = useState('');
  const [status, setStatus] = useState('Empty');
  const [validationResult, setValidationResult] = useState(null);
  const [agentEvents, setAgentEvents] = useState([]);
  const [isGeneratingAgenticPlan, setIsGeneratingAgenticPlan] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [previewState, setPreviewState] = useState({
    isLoading: false,
    error: '',
    rows: [],
    columns: [],
    rowCount: 0,
  });

  useEffect(() => {
    if (!dataset?.id) {
      setPlan([]);
      setPlanSource('empty');
      setSelectedColumn('');
      setStatus('Empty');
      setValidationResult(null);
      setAgentEvents([]);
      return;
    }

    setPlan([]);
    setPlanSource('empty');
    setSelectedColumn('');
    setStatus('Empty');
    setValidationResult(null);
    setAgentEvents([]);
    setErrorMessage('');
  }, [dataset?.id, store.targetColumn]);

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

  const markUserEdited = (nextPlan) => {
    setPlan(nextPlan);
    setStatus('User edited');
    setPlanSource((current) => (current === 'agentic' || current === 'agentic_edited' ? 'agentic_edited' : 'manual'));
    setValidationResult(null);
  };

  const handleStartManualPipeline = () => {
    setPlanSource('manual');
    setStatus('Manual draft');
    setErrorMessage('');
  };

  const handleAddColumnToPipeline = (columnName) => {
    if (!columnName || columnName === store.targetColumn) return;

    const profile = columns.find((column) => column.column_name === columnName);
    if (!profile) return;

    setPlan((currentPlan) => {
      const alreadyExists = currentPlan.some((item) => item.column_name === columnName);
      if (alreadyExists) return currentPlan;
      return [...currentPlan, buildManualColumnPlan(profile)];
    });

    setPlanSource('manual');
    setStatus('Manual draft');
    setSelectedColumn(columnName);
    setErrorMessage('');
  };

  const handleGenerateAgenticPlan = async () => {
    if (!dataset?.id) return;

    setIsGeneratingAgenticPlan(true);
    setErrorMessage('');
    setAgentEvents([]);
    setValidationResult(null);

    try {
      const finalEvent = await streamAgenticPreprocessingPlan(dataset.id, {
        problemType: store.problemType || 'classification',
        targetColumn: store.targetColumn || null,
      }, {
        onEvent: (event) => {
          setAgentEvents((currentEvents) => [...currentEvents, event]);
        },
      });

      const nextPlan = normalizePreprocessingPlanColumns(finalEvent || {});
      setPlan(nextPlan);
      setPlanSource('agentic');
      setStatus('Agentic draft');
      setValidationResult(finalEvent?.validation_result || null);
      setSelectedColumn((current) => current && nextPlan.some((item) => item.column_name === current)
        ? current
        : nextPlan[0]?.column_name || '');
    } catch (error) {
      setErrorMessage(error?.message || 'Failed to generate AI preprocessing recommendation.');
      setAgentEvents((currentEvents) => [
        ...currentEvents,
        { kind: 'error', message: error?.message || 'Failed to generate AI preprocessing recommendation.' },
      ]);
    } finally {
      setIsGeneratingAgenticPlan(false);
    }
  };

  const validatePlan = () => {
    if (!plan.length) {
      setStatus('Empty');
      setValidationResult({ is_valid: false, errors: [{ message: 'No columns were added to the preprocessing plan.' }], warnings: [] });
      return;
    }

    const invalid = plan.some((item) => !item.steps.length && item.column_name !== store.targetColumn);
    const nextStatus = invalid ? 'Needs review' : 'Validated';
    setStatus(nextStatus);
    setValidationResult({
      is_valid: !invalid,
      errors: invalid ? [{ message: 'One or more columns have no preprocessing steps.' }] : [],
      warnings: [],
    });
  };

  const resetPlan = () => {
    setPlan([]);
    setPlanSource('empty');
    setSelectedColumn('');
    setStatus('Empty');
    setValidationResult(null);
    setAgentEvents([]);
    setErrorMessage('');
  };

  const runPipeline = () => {
    if (!plan.length) {
      setStatus('Empty');
      setErrorMessage('Add columns manually or generate an AI recommendation before running the pipeline.');
      return;
    }
    setStatus('Executed locally');
  };

  const operationCount = plan.reduce((acc, item) => acc + item.steps.length, 0);
  const droppedCount = plan.filter((item) => item.steps.some((step) => step.operation === 'drop_column')).length;
  const planModeLabel = {
    empty: 'Empty canvas',
    manual: 'Manual draft',
    agentic: 'Agentic draft',
    agentic_edited: 'Agentic · edited',
  }[planSource] || planSource;

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
          <p className="mt-1 text-sm text-muted-foreground">Start from an empty canvas, build manually, or generate an agentic recommendation from deterministic profiling.</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={resetPlan} className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-muted-foreground shadow-sm transition-colors hover:text-foreground"><RotateCcw className="h-4 w-4" /> Reset</button>
          <button type="button" onClick={validatePlan} className="inline-flex items-center gap-2 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-2.5 text-sm font-bold text-primary shadow-sm transition-colors hover:bg-primary/10"><ShieldCheck className="h-4 w-4" /> Validate</button>
          <button type="button" onClick={runPipeline} className="inline-flex items-center gap-2 rounded-2xl gradient-primary px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-primary/25 transition-all hover:opacity-90"><Play className="h-4 w-4" /> Run Pipeline</button>
        </div>
      </div>

      <PipelineStartActions
        planSource={planSource}
        isGeneratingAgenticPlan={isGeneratingAgenticPlan}
        onStartManual={handleStartManualPipeline}
        onGenerateAgentic={handleGenerateAgenticPlan}
      />

      {errorMessage ? (
        <div className="mb-4 rounded-2xl border border-red-200 bg-red-50/80 px-4 py-3 text-sm font-semibold text-red-600">
          {errorMessage}
        </div>
      ) : null}

      <AgentRunPanel
        events={agentEvents}
        isRunning={isGeneratingAgenticPlan}
      />

      <div className="mb-4 grid grid-cols-1 gap-3 lg:grid-cols-4">
        <MetricCard label="Dataset" value={dataset.name} icon={GitBranch} />
        <MetricCard label="Pipeline status" value={status} icon={CheckCircle2} />
        <MetricCard label="Mode" value={planModeLabel} icon={Sparkles} />
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
            <ColumnTable
              columns={columns}
              plan={plan}
              selectedColumn={selectedColumn}
              targetColumn={store.targetColumn}
              onSelectColumn={setSelectedColumn}
              onAddColumnToPipeline={handleAddColumnToPipeline}
            />
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
            onPlanChange={markUserEdited}
          />
          <ColumnStatsPanel column={selectedProfile} />
        </aside>
      </div>
    </main>
  );
}
