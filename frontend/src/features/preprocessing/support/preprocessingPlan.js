import { Hash, Type, CalendarDays, ToggleLeft, FileText, Trash2, Droplets, Scale, Tags, Wand2 } from 'lucide-react';

export const TYPE_META = {
  numeric: { label: 'Numeric', color: '#4361EE', icon: Hash },
  numeric_like_text: { label: 'Numeric-like', color: '#4361EE', icon: Hash },
  categorical: { label: 'Categorical', color: '#F59E0B', icon: Type },
  text: { label: 'Text', color: '#F59E0B', icon: Type },
  datetime: { label: 'Datetime', color: '#7C3AED', icon: CalendarDays },
  datetime_like_text: { label: 'Datetime-like', color: '#7C3AED', icon: CalendarDays },
  boolean: { label: 'Boolean', color: '#10B981', icon: ToggleLeft },
  free_text: { label: 'Free text', color: '#EF4444', icon: FileText },
  identifier: { label: 'Identifier', color: '#EF4444', icon: Trash2 },
  empty: { label: 'Empty', color: '#94A3B8', icon: Trash2 },
};

const OPERATION_ICON_BY_KEY = {
  hash: Hash,
  type: Type,
  calendar_days: CalendarDays,
  toggle_left: ToggleLeft,
  file_text: FileText,
  trash_2: Trash2,
  droplets: Droplets,
  scale: Scale,
  tags: Tags,
  wand_2: Wand2,
};

const DEFAULT_STEP_META = {
  label: 'Operation',
  color: '#64748B',
  icon: Wand2,
  group: 'operation',
  stage: 'transformation',
  description: '',
};

const KEEP_INFERRED_TYPE_TARGET = { label: 'Keep inferred type', operation: '', target_type: null };

export const EMPTY_OPERATION_REGISTRY = {
  version: null,
  isLoaded: false,
  operations: [],
  operationsById: {},
  groups: [],
  operationCatalog: [],
  stepMeta: {},
  stageByOperation: {},
  exclusiveGroupByOperation: {},
  castOperations: [],
  castTargets: [KEEP_INFERRED_TYPE_TARGET],
  castTargetTypeByOperation: {},
  compatibleOperationsByType: {},
};

export function normalizeOperationRegistryPayload(payload) {
  const operations = Array.isArray(payload?.operations) ? payload.operations : [];
  const groups = Array.isArray(payload?.groups) ? payload.groups : [];
  const operationsById = Object.fromEntries(operations.map((operation) => [operation.id, operation]));
  const stageByOperation = Object.fromEntries(operations.map((operation) => [operation.id, operation.stage]));
  const exclusiveGroupByOperation = Object.fromEntries(operations
    .filter((operation) => operation.exclusive_group)
    .map((operation) => [operation.id, operation.exclusive_group]));
  const stepMeta = Object.fromEntries(operations.map((operation) => {
    const ui = operation.ui || {};
    const Icon = OPERATION_ICON_BY_KEY[ui.icon_key] || Wand2;
    return [operation.id, {
      label: operation.label || operation.id,
      color: ui.color || '#64748B',
      icon: Icon,
      group: ui.group || operation.group_id || operation.stage,
      stage: operation.stage,
      description: operation.description || '',
    }];
  }));
  const castTargets = Array.isArray(payload?.cast_targets) && payload.cast_targets.length
    ? payload.cast_targets
    : [KEEP_INFERRED_TYPE_TARGET];
  const castTargetTypeByOperation = payload?.cast_target_type_by_operation || Object.fromEntries(
    operations
      .filter((operation) => operation.cast_target_type)
      .map((operation) => [operation.id, operation.cast_target_type]),
  );
  const castOperations = Array.isArray(payload?.cast_operations)
    ? payload.cast_operations
    : Object.keys(castTargetTypeByOperation);
  const compatibleOperationsByType = payload?.compatible_operations_by_type || operations.reduce((acc, operation) => {
    (operation.compatible_types || []).forEach((type) => {
      acc[type] = [...(acc[type] || []), operation.id];
    });
    return acc;
  }, {});
  const operationCatalog = groups
    .map((group) => ({
      ...group,
      operations: (group.operations || []).filter((operation) => operationsById[operation]),
    }))
    .filter((group) => group.operations.length > 0)
    .sort((left, right) => Number(left.order || 0) - Number(right.order || 0));

  return {
    version: payload?.version || null,
    isLoaded: true,
    operations,
    operationsById,
    groups,
    operationCatalog,
    stepMeta,
    stageByOperation,
    exclusiveGroupByOperation,
    castOperations,
    castTargets,
    castTargetTypeByOperation,
    compatibleOperationsByType,
  };
}

function getRegistry(registry) {
  return registry || EMPTY_OPERATION_REGISTRY;
}

export function getStepMeta(operationRegistry, operation) {
  const registry = getRegistry(operationRegistry);
  return registry.stepMeta?.[operation] || DEFAULT_STEP_META;
}

export function getOperationDefaultParams(operationRegistry, operation) {
  const registry = getRegistry(operationRegistry);
  return registry.operationsById?.[operation]?.default_params || {};
}

export function getCastOperations(operationRegistry) {
  return getRegistry(operationRegistry).castOperations || [];
}

export function getCastTargets(operationRegistry) {
  return getRegistry(operationRegistry).castTargets || [KEEP_INFERRED_TYPE_TARGET];
}

export function getCastTargetTypeByOperation(operationRegistry, operation) {
  return getRegistry(operationRegistry).castTargetTypeByOperation?.[operation] || null;
}

export function getCompatibleOperationsForType(operationRegistry, type) {
  const registry = getRegistry(operationRegistry);
  return registry.compatibleOperationsByType?.[type]
    || registry.compatibleOperationsByType?.text
    || [];
}

export function getOperationStage(operationRegistry, operation) {
  return getRegistry(operationRegistry).stageByOperation?.[operation] || null;
}

export function getExclusiveGroup(operationRegistry, operation) {
  return getRegistry(operationRegistry).exclusiveGroupByOperation?.[operation] || null;
}

function removeExclusiveConflicts(steps, operationRegistry, operation, keepStepId = null) {
  if (operation === 'drop_column') return keepStepId ? steps.filter((step) => step.id === keepStepId) : [];

  const exclusiveGroup = getExclusiveGroup(operationRegistry, operation);
  if (!exclusiveGroup) return steps;

  return steps.filter((step) => (
    step.id === keepStepId
    || getExclusiveGroup(operationRegistry, step.operation) !== exclusiveGroup
  ));
}

export function getOperationCatalogForType(operationRegistry, type) {
  const compatibleOperations = new Set(getCompatibleOperationsForType(operationRegistry, type));

  return getRegistry(operationRegistry).operationCatalog
    .map((group) => ({
      ...group,
      operations: group.operations.filter((operation) => compatibleOperations.has(operation)),
    }))
    .filter((group) => group.operations.length > 0);
}

export function isCastOperation(operationRegistry, operation) {
  return getCastOperations(operationRegistry).includes(operation);
}


function isNoOpCastStep(columnPlan, operationRegistry, step) {
  if (!step || !isCastOperation(operationRegistry, step.operation)) return false;
  const targetType = getCastTargetTypeByOperation(operationRegistry, step.operation);
  const currentType = columnPlan?.inferred_type || columnPlan?.effective_type || null;
  return Boolean(targetType && currentType && targetType === currentType);
}

export function hasStepOperation(columnPlan, operation) {
  return Boolean(columnPlan?.steps?.some((step) => step.operation === operation));
}

export function getNonCastSteps(columnPlan, operationRegistry) {
  return (columnPlan?.steps || []).filter((step) => !isCastOperation(operationRegistry, step.operation));
}

export function buildManualColumnPlan(columnProfile) {
  const inferredType = columnProfile?.inferred_type || 'unknown';

  return {
    column_name: columnProfile?.column_name,
    raw_dtype: columnProfile?.raw_dtype || null,
    inferred_type: inferredType,
    effective_type: inferredType,
    semantic_type: null,
    role: 'feature',
    steps: [],
  };
}

export function normalizePreprocessingPlanColumns(planResponse) {
  if (Array.isArray(planResponse)) return planResponse;

  const plan = planResponse?.plan || planResponse?.final_plan || planResponse;

  if (Array.isArray(plan?.columns)) {
    return plan.columns.map((column) => ({
      column_name: column.column_name,
      raw_dtype: column.raw_dtype || null,
      inferred_type: column.inferred_type || column.effective_type || 'unknown',
      effective_type: column.effective_type || column.inferred_type || 'unknown',
      semantic_type: column.semantic_type || null,
      role: column.role || 'feature',
      steps: Array.isArray(column.steps) ? column.steps : [],
    }));
  }

  return [];
}

function normalizeProfileColumn(column, fallbackName = '') {
  const columnName = column?.column_name || column?.name || fallbackName;
  const inferredType = column?.inferred_type || column?.effective_type || 'unknown';

  return {
    column_name: columnName,
    raw_dtype: column?.raw_dtype || null,
    inferred_type: inferredType,
    effective_type: column?.effective_type || inferredType,
    semantic_type: column?.semantic_type || null,
    role: column?.role || 'feature',
    type_inference: {
      numeric_parse_ratio: column?.type_inference?.numeric_parse_ratio ?? null,
      datetime_parse_ratio: column?.type_inference?.datetime_parse_ratio ?? null,
    },
    common_stats: {
      total_count: column?.common_stats?.total_count ?? null,
      observed_count: column?.common_stats?.observed_count ?? null,
      missing_count: column?.common_stats?.missing_count ?? null,
      missing_ratio: column?.common_stats?.missing_ratio ?? null,
      unique_count: column?.common_stats?.unique_count ?? null,
      unique_ratio: column?.common_stats?.unique_ratio ?? null,
      is_empty: Boolean(column?.common_stats?.is_empty),
      is_constant: Boolean(column?.common_stats?.is_constant),
      is_mostly_missing: Boolean(column?.common_stats?.is_mostly_missing),
    },
    specific_stats: column?.specific_stats || {},
  };
}

function buildSkeletonColumnProfile(name, dataset) {
  return normalizeProfileColumn({
    column_name: name,
    raw_dtype: null,
    inferred_type: 'unknown',
    common_stats: {
      total_count: dataset?.rows ?? null,
      observed_count: null,
      missing_count: null,
      missing_ratio: null,
      unique_count: null,
      unique_ratio: null,
      is_empty: false,
      is_constant: false,
      is_mostly_missing: false,
    },
    specific_stats: {},
  });
}

export function buildColumnProfilesFromDataset(dataset, datasetColumns = [], datasetProfile = null) {
  if (Array.isArray(datasetProfile?.columns) && datasetProfile.columns.length) {
    return datasetProfile.columns.map((column) => normalizeProfileColumn(column));
  }

  const names = Array.isArray(datasetColumns) && datasetColumns.length
    ? datasetColumns
    : Array.isArray(dataset?.column_names)
      ? dataset.column_names
      : Array.isArray(dataset?.columns_metadata)
        ? dataset.columns_metadata.map((col) => col.name || col.column_name).filter(Boolean)
        : [];

  return names.map((name) => buildSkeletonColumnProfile(name, dataset));
}

export function makeStep(operation, reason = '', operationRegistry = null) {
  const suffix = globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}`;

  return {
    id: `${operation}_${suffix}`,
    operation,
    stage: getOperationStage(operationRegistry, operation) || undefined,
    params: { ...getOperationDefaultParams(operationRegistry, operation) },
    status: 'recommended',
    reason,
    source: 'rule_based_draft',
  };
}

export function addStepToColumn(plan, columnName, operation, operationRegistry) {
  if (isCastOperation(operationRegistry, operation)) {
    return setCastOperationForColumn(plan, columnName, operation, operationRegistry);
  }

  return plan.map((columnPlan) => {
    if (columnPlan.column_name !== columnName) return columnPlan;

    const existingSteps = removeExclusiveConflicts(columnPlan.steps, operationRegistry, operation);
    return {
      ...columnPlan,
      steps: [
        ...existingSteps,
        makeStep(operation, 'Added by user.', operationRegistry),
      ],
    };
  });
}

export function removeStepFromColumn(plan, columnName, stepId) {
  return plan.map((columnPlan) => (
    columnPlan.column_name === columnName
      ? { ...columnPlan, steps: columnPlan.steps.filter((step) => step.id !== stepId) }
      : columnPlan
  ));
}

export function replaceStepOperation(plan, columnName, stepId, operation, operationRegistry) {
  return plan.map((columnPlan) => {
    if (columnPlan.column_name !== columnName) return columnPlan;

    const compatibleSteps = removeExclusiveConflicts(
      columnPlan.steps,
      operationRegistry,
      operation,
      stepId,
    );
    const nextSteps = compatibleSteps
      .filter((step) => (
        !isCastOperation(operationRegistry, operation)
        || !isCastOperation(operationRegistry, step.operation)
        || step.id === stepId
      ))
      .map((step) => (
        step.id === stepId
          ? {
            ...step,
            operation,
            stage: getOperationStage(operationRegistry, operation) || step.stage,
            params: { ...getOperationDefaultParams(operationRegistry, operation) },
            status: 'edited_by_user',
            reason: 'Edited by user.',
          }
          : step
      ));

    return { ...columnPlan, steps: sortStepsWithCastFirst(nextSteps, operationRegistry) };
  });
}

export function getCastOperationForColumn(columnPlan, operationRegistry) {
  const castStep = columnPlan?.steps?.find((step) => (
    isCastOperation(operationRegistry, step.operation)
    && !isNoOpCastStep(columnPlan, operationRegistry, step)
  ));
  return castStep?.operation || '';
}

export function getEffectiveTypeFromColumnPlan(columnPlan, operationRegistry) {
  const castOperation = getCastOperationForColumn(columnPlan, operationRegistry);
  return getCastTargetTypeByOperation(operationRegistry, castOperation) || columnPlan?.inferred_type || 'text';
}

export function setCastOperationForColumn(plan, columnName, operation, operationRegistry) {
  return plan.map((columnPlan) => {
    if (columnPlan.column_name !== columnName) return columnPlan;

    const stepsWithoutCast = columnPlan.steps.filter((step) => !isCastOperation(operationRegistry, step.operation));
    const inferredType = columnPlan.inferred_type || columnPlan.effective_type || 'text';
    const targetType = getCastTargetTypeByOperation(operationRegistry, operation) || inferredType;
    const compatibleOperations = new Set(getCompatibleOperationsForType(operationRegistry, targetType));
    const compatibleSteps = stepsWithoutCast.filter((step) => compatibleOperations.has(step.operation));

    if (!operation || targetType === inferredType) {
      return { ...columnPlan, steps: compatibleSteps };
    }

    return {
      ...columnPlan,
      steps: [
        makeStep(operation, 'User-defined column casting before preprocessing.', operationRegistry),
        ...compatibleSteps,
      ],
    };
  });
}

function sortStepsWithCastFirst(steps, operationRegistry) {
  return [...steps].sort((left, right) => {
    const leftIsCast = isCastOperation(operationRegistry, left.operation);
    const rightIsCast = isCastOperation(operationRegistry, right.operation);
    if (leftIsCast === rightIsCast) return 0;
    return leftIsCast ? -1 : 1;
  });
}

export function resetColumnPlan(plan, columnName, targetColumn) {
  return plan.map((item) => {
    if (item.column_name !== columnName) return item;
    return {
      ...item,
      steps: [],
      status: item.column_name === targetColumn ? 'target' : item.status,
    };
  });
}
