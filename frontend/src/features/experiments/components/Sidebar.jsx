import React, { useMemo, useState } from 'react';
import { ChevronRight, Database, LayoutDashboard, Play, RotateCcw, Search, Sparkles, Target, Workflow } from 'lucide-react';
import OckhamLogo from '@/shared/components/OckhamLogo';
import ModelGlyph from '@/features/experiments/components/ModelGlyph';

const NAV_ITEMS = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'datasets', label: 'Datasets', icon: Database },
  { key: 'preprocessing', label: 'Preprocessing', icon: Workflow },
];

const GROUP_ACCENT = '#4361EE';
const GROUP_TEXT = '#A8B8FF';

const CATEGORY_COLORS = {
  'Linear Models': GROUP_ACCENT,
  'Regularized Linear Models': GROUP_ACCENT,
  'Tree & Ensemble Models': GROUP_ACCENT,
  'Kernel Methods': GROUP_ACCENT,
  'Probabilistic & Neighbors': GROUP_ACCENT,
};

const CATEGORY_TEXT_COLORS = {
  'Linear Models': GROUP_TEXT,
  'Regularized Linear Models': GROUP_TEXT,
  'Tree & Ensemble Models': GROUP_TEXT,
  'Kernel Methods': GROUP_TEXT,
  'Probabilistic & Neighbors': GROUP_TEXT,
};

const CATEGORY_ORDER = [
  'Linear Models',
  'Regularized Linear Models',
  'Tree & Ensemble Models',
  'Kernel Methods',
  'Probabilistic & Neighbors',
];

// The sidebar uses a fixed grouping instead of a fully dynamic one so the model list
// stays stable between runs and easier to scan.
function resolveModelCategory(model) {
  const modelId = model.id;
  const rawCategory = model.category || '';

  if (['linear-regression', 'polynomial-regression', 'logistic-regression'].includes(modelId)) {
    return 'Linear Models';
  }

  if (['ridge-regression', 'lasso-regression'].includes(modelId)) {
    return 'Regularized Linear Models';
  }

  if (['decision-tree-regression', 'random-forest-regression', 'xgboost-regression'].includes(modelId)) {
    return 'Tree & Ensemble Models';
  }

  if (['svr', 'svc'].includes(modelId)) {
    return 'Kernel Methods';
  }

  if (['naive-bayes-classifier', 'knn-classifier'].includes(modelId)) {
    return 'Probabilistic & Neighbors';
  }

  if (['Linear', 'Feature Expansion'].includes(rawCategory)) {
    return 'Linear Models';
  }

  if (rawCategory === 'Regularized') {
    return 'Regularized Linear Models';
  }

  if (['Tree-Based', 'Ensemble', 'Boosting', 'Trees'].includes(rawCategory)) {
    return 'Tree & Ensemble Models';
  }

  if (rawCategory === 'Kernel') {
    return 'Kernel Methods';
  }

  if (['Probabilistic', 'Instance-Based', 'Neighbors'].includes(rawCategory)) {
    return 'Probabilistic & Neighbors';
  }

  return 'Linear Models';
}

function groupModelsByCategory(models) {
  const groups = CATEGORY_ORDER.reduce((acc, category) => {
    acc[category] = [];
    return acc;
  }, {});

  models.forEach((model) => {
    const category = resolveModelCategory(model);
    if (!groups[category]) groups[category] = [];
    groups[category].push(model);
  });

  return Object.fromEntries(
    Object.entries(groups).filter(([, items]) => items.length > 0),
  );
}

function GroupHeader({ category, models, selectedCount, open, onToggle, disabled = false }) {
  const color = CATEGORY_COLORS[category] || GROUP_ACCENT;
  const textColor = CATEGORY_TEXT_COLORS[category] || GROUP_TEXT;

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors ${disabled ? 'cursor-not-allowed opacity-60' : 'hover:bg-white/[0.03]'}`}
    >
      <div
        className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
        style={{ background: color, opacity: 0.75 }}
      />

      <span
        className="flex-1 text-[10px] font-bold uppercase tracking-[0.16em]"
        style={{ color: textColor }}
      >
        {category}
      </span>

      <span
        className="text-[10px] font-semibold tabular-nums"
        style={{ color: 'rgba(168,184,255,0.72)' }}
      >
        {models.length}
      </span>

      {selectedCount > 0 ? (
        <span
          className="rounded-full px-1.5 py-0.5 text-[9px] font-bold tabular-nums"
          style={{
            background: 'rgba(67,97,238,0.16)',
            color: textColor,
            border: '1px solid rgba(67,97,238,0.22)',
          }}
        >
          {selectedCount}
        </span>
      ) : null}

      <ChevronRight
        className="h-3 w-3 flex-shrink-0 transition-transform"
        style={{
          color: 'rgba(168,184,255,0.34)',
          transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
        }}
      />
    </button>
  );
}

function NavButton({ active, icon: Icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
        active ? 'bg-white/10 text-white' : 'text-white/50 hover:bg-white/5 hover:text-white/85'
      }`}
    >
      <Icon className="h-4 w-4 flex-shrink-0" />
      <span>{label}</span>
      {active ? <div className="ml-auto h-1.5 w-1.5 rounded-full bg-cyan-300" /> : null}
    </button>
  );
}

function ModelBadge({ model, selected }) {
  const color = model.accent || '#4F7CFF';
  const background = selected
    ? `linear-gradient(180deg, ${color}, ${color}dd)`
    : `linear-gradient(180deg, ${color}40, ${color}22)`;

  return (
    <div
      className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl border"
      style={{
        background,
        borderColor: selected ? `${color}80` : `${color}35`,
        boxShadow: selected ? `0 10px 18px ${color}22` : 'none',
      }}
    >
      <ModelGlyph iconKey={model.iconKey} color="#ffffff" size={15} strokeWidth={1.75} />
    </div>
  );
}

export default function Sidebar({
  problemType,
  setProblemType,
  targetColumn,
  setTargetColumn,
  datasetColumns,
  models = [],
  selectedModels,
  toggleModel,
  selectAllModels,
  clearModels,
  status,
  runComparison,
  resetExperiment,
  datasetName,
  activeView,
  setActiveView,
  openPreprocessing,
  error,
  isCancellingExperiment = false,
}) {
  const [search, setSearch] = useState('');
  const [openGroups, setOpenGroups] = useState({});
  const navActive = activeView === 'dataset-detail' ? 'datasets' : activeView;

  // Search filters inside the existing groups so the visual structure stays familiar.
  const filtered = useMemo(() => {
    if (!search) return models;
    const term = search.toLowerCase();

    return models.filter((model) => {
      const category = resolveModelCategory(model);
      return model.name.toLowerCase().includes(term) || category.toLowerCase().includes(term);
    });
  }, [models, search]);

  const groupedModels = useMemo(() => groupModelsByCategory(filtered), [filtered]);
  const groupEntries = useMemo(() => Object.entries(groupedModels), [groupedModels]);

  const allSelected = models.length > 0 && models.every((model) => selectedModels.includes(model.id));
  const isInteractionLocked = status === 'processing' || isCancellingExperiment;

  const canRun =
    Boolean(datasetName) &&
    Boolean(targetColumn) &&
    selectedModels.length >= 2 &&
    !isInteractionLocked;

  function setAllGroups(open) {
    const nextState = {};
    groupEntries.forEach(([category]) => {
      nextState[category] = open;
    });
    setOpenGroups(nextState);
  }

  const allGroupsOpen =
    groupEntries.length > 0 &&
    groupEntries.every(([category]) => (openGroups[category] ?? true) === true);

  return (
    <aside className="sidebar-dark flex h-screen w-72 flex-shrink-0 flex-col border-r border-white/10">
      <style>
        {`
          .models-scroll-area {
            scrollbar-width: thin;
            scrollbar-color: rgba(168,184,255,0.26) transparent;
          }

          .models-scroll-area::-webkit-scrollbar {
            width: 8px;
          }

          .models-scroll-area::-webkit-scrollbar-track {
            background: transparent;
          }

          .models-scroll-area::-webkit-scrollbar-thumb {
            background: rgba(168,184,255,0.22);
            border-radius: 999px;
            border: 2px solid transparent;
            background-clip: padding-box;
          }

          .models-scroll-area::-webkit-scrollbar-thumb:hover {
            background: rgba(168,184,255,0.34);
            background-clip: padding-box;
          }
        `}
      </style>

      <div className="px-5 py-5">
        <OckhamLogo />
      </div>

      <div className="space-y-1 px-3 pb-4">
        {NAV_ITEMS.map(({ key, label, icon }) => (
          <NavButton
            key={key}
            active={navActive === key}
            icon={icon}
            label={label}
            onClick={() => (key === 'preprocessing' && openPreprocessing ? openPreprocessing() : setActiveView(key))}
          />
        ))}
      </div>

      <div className="mx-4 border-t border-white/10" />

      <div className="space-y-4 px-4 py-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3.5 backdrop-blur-md">
          <div className="mb-1 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">
            <Database className="h-3.5 w-3.5" /> Active Dataset
          </div>
          <div className="truncate text-sm font-semibold text-white">
            {datasetName || 'Choose a dataset'}
          </div>
          {datasetName ? (
            <div className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-medium text-cyan-200/85">
              Ready for benchmark
            </div>
          ) : null}
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between px-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">
              Problem Type
            </p>
            {isInteractionLocked ? (
              <span className="text-[10px] font-medium text-white/30">Locked during run</span>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-1.5 backdrop-blur-md">
            <button
              type="button"
              onClick={() => setProblemType('regression')}
              disabled={isInteractionLocked}
              className={`rounded-xl px-3 py-2 text-xs font-semibold transition-all ${
                problemType === 'regression'
                  ? 'bg-white/10 text-white'
                  : 'text-white/45 hover:text-white/70'
              } ${isInteractionLocked ? 'cursor-not-allowed opacity-55 hover:text-white/45' : ''}`}
            >
              Regression
            </button>

            <button
              type="button"
              onClick={() => setProblemType('classification')}
              disabled={isInteractionLocked}
              className={`rounded-xl px-3 py-2 text-xs font-semibold transition-all ${
                problemType === 'classification'
                  ? 'bg-white/10 text-white'
                  : 'text-white/45 hover:text-white/70'
              } ${isInteractionLocked ? 'cursor-not-allowed opacity-55 hover:text-white/45' : ''}`}
            >
              Classification
            </button>
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center gap-2 px-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">
            <Target className="h-3.5 w-3.5" /> Target Column
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-2 backdrop-blur-md">
            <select
              value={targetColumn}
              onChange={(e) => setTargetColumn(e.target.value)}
              disabled={isInteractionLocked}
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white/85 outline-none transition-colors focus:border-white/25"
            >
              {!datasetColumns.length ? <option value="">No columns available</option> : null}
              {datasetColumns.map((column) => (
                <option key={column} value={column} className="text-slate-900">
                  {column}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="mx-4 border-t border-white/10" />

      <div className="flex min-h-0 flex-1 flex-col px-4 py-4">
        <div className="mb-3 flex items-center justify-between px-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">
            Models
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => { if (isInteractionLocked) return; setAllGroups(!allGroupsOpen); }}
              disabled={isInteractionLocked}
              className={`text-[11px] font-medium text-cyan-200/80 transition-colors ${isInteractionLocked ? 'cursor-not-allowed opacity-55 hover:text-cyan-200/80' : 'hover:text-white'}`}
            >
              {allGroupsOpen ? 'Collapse all' : 'Expand all'}
            </button>

            <button
              type="button"
              onClick={() => { if (isInteractionLocked) return; (allSelected ? clearModels() : selectAllModels(models.map((m) => m.id))); }}
              disabled={isInteractionLocked}
              className={`text-[11px] font-medium text-cyan-200/80 transition-colors ${isInteractionLocked ? 'cursor-not-allowed opacity-55 hover:text-cyan-200/80' : 'hover:text-white'}`}
            >
              {allSelected ? 'Clear' : 'Select all'}
            </button>
          </div>
        </div>

        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-300" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search models..."
            disabled={isInteractionLocked}
            className={`w-full rounded-xl border border-white/10 bg-white/[0.04] py-2 pl-9 pr-3 text-sm text-white/85 placeholder:text-white/28 outline-none transition-colors focus:border-white/25 ${isInteractionLocked ? 'cursor-not-allowed opacity-55' : ''}`}
          />
        </div>

        <div className="models-scroll-area min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">
          <div className="space-y-2 pb-2">
            {groupEntries.map(([category, categoryModels]) => {
              const isOpen = search ? true : openGroups[category] ?? true;
              const selectedCount = categoryModels.filter((model) => selectedModels.includes(model.id)).length;

              return (
                <div key={category} className="space-y-1">
                  <GroupHeader
                    category={category}
                    models={categoryModels}
                    selectedCount={selectedCount}
                    open={isOpen}
                    onToggle={() => {
                      if (isInteractionLocked) return;
                      setOpenGroups((current) => ({ ...current, [category]: !isOpen }));
                    }}
                    disabled={isInteractionLocked}
                  />

                  {isOpen ? (
                    <div className="space-y-1 pl-1">
                      {categoryModels.map((model) => {
                        const selected = selectedModels.includes(model.id);

                        return (
                          <button
                            key={model.id}
                            type="button"
                            onClick={() => { if (isInteractionLocked) return; toggleModel(model.id); }}
                            disabled={isInteractionLocked}
                            className={`group flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm transition-all ${
                              selected
                                ? 'bg-white/[0.09] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]'
                                : 'text-white/55'
                            } ${isInteractionLocked ? 'cursor-not-allowed opacity-60' : 'hover:bg-white/[0.05] hover:text-white/85'}`}
                          >
                            <ModelBadge model={model} selected={selected} />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium leading-tight">{model.name}</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="border-t border-white/10 px-4 py-5">
        {error ? (
          <div className="mb-3 rounded-2xl border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-xs text-red-200">
            {error}
          </div>
        ) : null}

        {status === 'done' ? (
          <button
            type="button"
            onClick={resetExperiment}
            className="mb-2 flex w-full items-center justify-center gap-2 rounded-2xl border border-white/15 px-4 py-2.5 text-sm font-medium text-white/60 transition-all hover:bg-white/5"
          >
            <RotateCcw className="h-4 w-4" /> Reset Experiment
          </button>
        ) : null}

        <button
          type="button"
          onClick={runComparison}
          disabled={!canRun}
          className="flex w-full items-center justify-center gap-2 rounded-2xl gradient-primary px-4 py-3 text-sm font-bold text-white shadow-lg shadow-primary/30 transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
        >
          {isInteractionLocked ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              Processing...
            </>
          ) : (
            <>
              <Play className="h-4 w-4" /> Apply
            </>
          )}
        </button>

        {!datasetName ? <p className="mt-2 text-center text-xs text-white/28">Choose a dataset in Datasets</p> : null}
        {datasetName && !targetColumn ? <p className="mt-2 text-center text-xs text-white/28">Select a target column</p> : null}
        {targetColumn && selectedModels.length < 2 ? <p className="mt-2 text-center text-xs text-white/28">Select at least 2 models</p> : null}
      </div>
    </aside>
  );
}