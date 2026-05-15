import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Plus, RotateCcw, Sparkles, Trash2, X } from 'lucide-react';
import {
  TYPE_META,
  addStepToColumn,
  getCastOperationForColumn,
  getCastTargets,
  getCompatibleOperationsForType,
  getEffectiveTypeFromColumnPlan,
  getNonCastSteps,
  getOperationCatalogForType,
  getStepMeta,
  hasStepOperation,
  isCastOperation,
  removeStepFromColumn,
  replaceStepOperation,
  resetColumnPlan,
  setCastOperationForColumn,
} from '@/features/preprocessing/support/preprocessingPlan';

function CollapsibleSection({ title, subtitle, badge, defaultOpen = true, children }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white/60 shadow-sm">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="flex w-full items-start justify-between gap-3 px-3 py-3 text-left transition-colors hover:bg-white/65"
        aria-expanded={isOpen}
      >
        <span className="min-w-0">
          <span className="block text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{title}</span>
          {subtitle ? <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">{subtitle}</span> : null}
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {badge ? (
            <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-muted-foreground">
              {badge}
            </span>
          ) : null}
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </span>
      </button>
      <AnimatePresence initial={false}>
        {isOpen ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="border-t border-slate-200/70 p-3">{children}</div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function CastingControl({ column, columnPlan, plan, operationRegistry, onPlanChange }) {
  const selectedOperation = getCastOperationForColumn(columnPlan, operationRegistry);
  const originalTypeMeta = TYPE_META[column?.inferred_type || columnPlan.inferred_type] || TYPE_META.text;
  const effectiveType = getEffectiveTypeFromColumnPlan(columnPlan, operationRegistry);
  const effectiveTypeMeta = TYPE_META[effectiveType] || TYPE_META.text;

  return (
    <CollapsibleSection
      title="1. Column casting"
      subtitle={(
        <>
          Original <span className="font-bold" style={{ color: originalTypeMeta.color }}>{originalTypeMeta.label}</span>
          {selectedOperation ? (
            <> → Effective <span className="font-bold" style={{ color: effectiveTypeMeta.color }}>{effectiveTypeMeta.label}</span></>
          ) : null}
        </>
      )}
      badge={selectedOperation ? 'active' : null}
      defaultOpen
    >
      <select
        value={selectedOperation}
        onChange={(event) => onPlanChange(setCastOperationForColumn(plan, columnPlan.column_name, event.target.value, operationRegistry))}
        className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-foreground outline-none focus:border-primary/40"
      >
        {getCastTargets(operationRegistry).map((target) => (
          <option key={target.operation || 'none'} value={target.operation}>{target.label}</option>
        ))}
      </select>
      <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
        Casting is always applied before imputation, encoding, scaling or feature extraction.
      </p>
    </CollapsibleSection>
  );
}

function StepCard({ step, columnName, effectiveType, plan, operationRegistry, onPlanChange }) {
  const meta = getStepMeta(operationRegistry, step.operation);
  const Icon = meta.icon;
  const compatible = getCompatibleOperationsForType(operationRegistry, effectiveType)
    .filter((operation) => !isCastOperation(operationRegistry, operation));

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      className="rounded-2xl border bg-white/75 p-2.5 shadow-sm"
      style={{ borderColor: `${meta.color}28` }}
    >
      <div className="mb-2 flex items-center gap-2">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl" style={{ background: `${meta.color}15`, color: meta.color }}>
          <Icon className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-heading font-bold text-foreground">{meta.label}</p>
          <p className="truncate text-[10px] text-muted-foreground">{step.reason || 'User editable preprocessing step.'}</p>
        </div>
        <button
          type="button"
          onClick={() => onPlanChange(removeStepFromColumn(plan, columnName, step.id))}
          className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-500"
          title="Remove operation"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <select
        value={step.operation}
        onChange={(event) => onPlanChange(replaceStepOperation(plan, columnName, step.id, event.target.value, operationRegistry))}
        className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-foreground outline-none focus:border-primary/40"
      >
        {compatible.map((operation) => (
          <option key={operation} value={operation}>{getStepMeta(operationRegistry, operation).label || operation}</option>
        ))}
      </select>
      <div className="mt-2 flex items-center justify-between text-[10px] font-semibold text-muted-foreground">
        <span className="capitalize">{String(meta.group || '').replace('_', ' ')}</span>
        <span className={step.status === 'edited_by_user' ? 'text-primary' : ''}>{step.status || 'recommended'}</span>
      </div>
    </motion.div>
  );
}

function OperationButton({ operation, columnPlan, plan, operationRegistry, onPlanChange }) {
  const meta = getStepMeta(operationRegistry, operation);
  const Icon = meta.icon;
  const alreadyAdded = hasStepOperation(columnPlan, operation);

  return (
    <button
      type="button"
      onClick={() => onPlanChange(addStepToColumn(plan, columnPlan.column_name, operation, operationRegistry))}
      disabled={alreadyAdded}
      className="group flex items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition-all disabled:cursor-default disabled:opacity-55 enabled:hover:-translate-y-0.5 enabled:hover:shadow-sm"
      style={{ background: `${meta.color}0d`, borderColor: `${meta.color}26`, color: meta.color }}
      title={alreadyAdded ? 'Operation already exists in this column plan' : `Add ${meta.label}`}
    >
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-white/70">
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[11px] font-extrabold">{meta.label}</span>
        <span className="block truncate text-[9px] font-semibold opacity-70">{alreadyAdded ? 'already added' : String(meta.group || '').replace('_', ' ')}</span>
      </span>
      {!alreadyAdded ? <Plus className="h-3.5 w-3.5 opacity-70" /> : null}
    </button>
  );
}

function OperationCatalog({ columnPlan, effectiveType, plan, operationRegistry, onPlanChange }) {
  const groups = getOperationCatalogForType(operationRegistry, effectiveType);

  if (!groups.length) {
    return (
      <CollapsibleSection title="3. Add operation" subtitle="Compatible operations for this column." defaultOpen>
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white/45 p-3 text-xs text-muted-foreground">
          No compatible operations available for this column type.
        </div>
      </CollapsibleSection>
    );
  }

  return (
    <CollapsibleSection title="3. Add operation" subtitle="Operations are grouped by preprocessing stage." defaultOpen>
      <div className="space-y-2.5">
        {groups.map((group) => (
          <div key={group.id} className="rounded-2xl border border-white/70 bg-white/65 p-2.5">
            <div className="mb-2">
              <p className="text-[11px] font-heading font-extrabold text-foreground">{group.label}</p>
              <p className="text-[10px] leading-snug text-muted-foreground">{group.description}</p>
            </div>
            <div className="grid grid-cols-1 gap-1.5">
              {group.operations.map((operation) => (
                <OperationButton
                  key={operation}
                  operation={operation}
                  columnPlan={columnPlan}
                  plan={plan}
                  operationRegistry={operationRegistry}
                  onPlanChange={onPlanChange}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </CollapsibleSection>
  );
}

function OperationSequence({ steps, columnPlan, effectiveType, plan, operationRegistry, onPlanChange }) {
  return (
    <CollapsibleSection
      title="2. Current sequence"
      subtitle="These operations will run after casting."
      badge={`${steps.length} step${steps.length === 1 ? '' : 's'}`}
      defaultOpen
    >
      {steps.length ? (
        <div className="space-y-2.5">
          <AnimatePresence>
            {steps.map((step) => (
              <StepCard
                key={step.id}
                step={step}
                columnName={columnPlan.column_name}
                effectiveType={effectiveType}
                plan={plan}
                operationRegistry={operationRegistry}
                onPlanChange={onPlanChange}
              />
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white/55 p-3 text-xs leading-relaxed text-muted-foreground">
          No preprocessing operation added yet. Choose an operation below or drop the column if it should not be used as a feature.
        </div>
      )}
    </CollapsibleSection>
  );
}

export default function TransformPanel({ column, columnPlan, targetColumn, plan, operationRegistry, onPlanChange }) {
  const [isPanelOpen, setIsPanelOpen] = useState(true);

  if (!column || !columnPlan) {
    return (
      <div className="flex min-h-[180px] flex-col items-center justify-center rounded-[28px] border border-white/70 bg-white/55 p-6 text-center shadow-sm backdrop-blur-xl">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-3xl bg-primary/10 text-primary">
          <Sparkles className="h-6 w-6" />
        </div>
        <p className="text-xs font-heading font-bold text-foreground">Select a column</p>
        <p className="mt-1 max-w-[220px] text-xs text-muted-foreground">Edit, add, remove or reset preprocessing steps.</p>
      </div>
    );
  }

  const effectiveType = getEffectiveTypeFromColumnPlan(columnPlan, operationRegistry);
  const typeMeta = TYPE_META[effectiveType] || TYPE_META.text;
  const originalTypeMeta = TYPE_META[column.inferred_type] || TYPE_META.text;
  const TypeIcon = typeMeta.icon;
  const nonCastSteps = getNonCastSteps(columnPlan, operationRegistry);
  const isDropped = columnPlan.steps.some((step) => step.operation === 'drop_column');

  return (
    <div className="overflow-hidden rounded-[28px] border border-white/70 bg-white/65 shadow-sm backdrop-blur-xl">
      <div className="border-b border-white/70 p-4">
        <div className="mb-3 flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl" style={{ background: `${typeMeta.color}15`, color: typeMeta.color }}>
            <TypeIcon className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-heading font-extrabold text-foreground">{columnPlan.column_name}</p>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: typeMeta.color }}>{typeMeta.label}</p>
            {effectiveType !== column.inferred_type ? (
              <p className="mt-0.5 text-[10px] text-muted-foreground">Cast from <span style={{ color: originalTypeMeta.color }}>{originalTypeMeta.label}</span></p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => setIsPanelOpen((current) => !current)}
            className="rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-muted-foreground transition-colors hover:text-foreground"
            title={isPanelOpen ? 'Collapse operations panel' : 'Expand operations panel'}
            aria-expanded={isPanelOpen}
          >
            <ChevronDown className={`h-4 w-4 transition-transform ${isPanelOpen ? 'rotate-180' : ''}`} />
          </button>
          <button
            type="button"
            onClick={() => onPlanChange(resetColumnPlan(plan, columnPlan.column_name, targetColumn))}
            className="rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-muted-foreground transition-colors hover:text-foreground"
            title="Reset column plan"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>
        {isDropped ? (
          <div className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50/80 px-3 py-2 text-xs font-bold text-red-500">
            <Trash2 className="h-4 w-4" /> This column is currently removed from the output dataset.
          </div>
        ) : null}
      </div>

      <AnimatePresence initial={false}>
        {isPanelOpen ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="space-y-3 p-4">
              <CastingControl column={column} columnPlan={columnPlan} plan={plan} operationRegistry={operationRegistry} onPlanChange={onPlanChange} />
              <OperationSequence
                steps={nonCastSteps}
                columnPlan={columnPlan}
                effectiveType={effectiveType}
                plan={plan}
                operationRegistry={operationRegistry}
                onPlanChange={onPlanChange}
              />
              <OperationCatalog
                columnPlan={columnPlan}
                effectiveType={effectiveType}
                plan={plan}
                operationRegistry={operationRegistry}
                onPlanChange={onPlanChange}
              />
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
