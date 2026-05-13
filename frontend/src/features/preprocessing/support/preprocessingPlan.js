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

export const STEP_META = {
  drop_column: { label: 'Drop column', color: '#EF4444', icon: Trash2, group: 'drop' },
  cast_numeric: { label: 'Cast numeric', color: '#4361EE', icon: Hash, group: 'cast' },
  cast_datetime: { label: 'Cast datetime', color: '#7C3AED', icon: CalendarDays, group: 'cast' },
  cast_categorical: { label: 'Cast categorical', color: '#F59E0B', icon: Type, group: 'cast' },
  cast_text: { label: 'Cast text', color: '#64748B', icon: FileText, group: 'cast' },
  cast_boolean: { label: 'Cast boolean', color: '#10B981', icon: ToggleLeft, group: 'cast' },
  median_imputer: { label: 'Median imputer', color: '#06B6D4', icon: Droplets, group: 'imputation' },
  mean_imputer: { label: 'Mean imputer', color: '#06B6D4', icon: Droplets, group: 'imputation' },
  most_frequent_imputer: { label: 'Mode imputer', color: '#06B6D4', icon: Droplets, group: 'imputation' },
  constant_imputer: { label: 'Constant imputer', color: '#06B6D4', icon: Droplets, group: 'imputation' },
  standard_scaler: { label: 'Standard scaler', color: '#4361EE', icon: Scale, group: 'scaling' },
  robust_scaler: { label: 'Robust scaler', color: '#4361EE', icon: Scale, group: 'scaling' },
  minmax_scaler: { label: 'MinMax scaler', color: '#4361EE', icon: Scale, group: 'scaling' },
  one_hot_encoder: { label: 'One-hot encoder', color: '#F59E0B', icon: Tags, group: 'encoding' },
  ordinal_encoder: { label: 'Ordinal encoder', color: '#F59E0B', icon: Tags, group: 'encoding' },
  label_encoder: { label: 'Label encoder', color: '#F59E0B', icon: Tags, group: 'encoding' },
  frequency_encoder: { label: 'Frequency encoder', color: '#F59E0B', icon: Tags, group: 'encoding' },
  extract_datetime_features: { label: 'Datetime features', color: '#7C3AED', icon: Wand2, group: 'feature_engineering' },
  drop_original_datetime: { label: 'Drop original date', color: '#EF4444', icon: Trash2, group: 'drop' },
};

export const CAST_OPERATIONS = ['cast_numeric', 'cast_datetime', 'cast_categorical', 'cast_text', 'cast_boolean'];

export const CAST_TARGETS = [
  { label: 'Keep inferred type', operation: '' },
  { label: 'Numeric', operation: 'cast_numeric' },
  { label: 'Datetime', operation: 'cast_datetime' },
  { label: 'Categorical', operation: 'cast_categorical' },
  { label: 'Text', operation: 'cast_text' },
  { label: 'Boolean', operation: 'cast_boolean' },
];

export const CAST_TARGET_TYPE_BY_OPERATION = {
  cast_numeric: 'numeric',
  cast_datetime: 'datetime',
  cast_categorical: 'categorical',
  cast_text: 'text',
  cast_boolean: 'boolean',
};

const COMMON_CAST_OPTIONS = [...CAST_OPERATIONS];

export const STEP_OPTIONS_BY_TYPE = {
  numeric: [...COMMON_CAST_OPTIONS, 'median_imputer', 'mean_imputer', 'constant_imputer', 'standard_scaler', 'robust_scaler', 'minmax_scaler', 'drop_column'],
  numeric_like_text: [...COMMON_CAST_OPTIONS, 'median_imputer', 'mean_imputer', 'constant_imputer', 'standard_scaler', 'robust_scaler', 'minmax_scaler', 'drop_column'],
  categorical: [...COMMON_CAST_OPTIONS, 'most_frequent_imputer', 'constant_imputer', 'one_hot_encoder', 'ordinal_encoder', 'label_encoder', 'frequency_encoder', 'drop_column'],
  text: [...COMMON_CAST_OPTIONS, 'most_frequent_imputer', 'constant_imputer', 'one_hot_encoder', 'ordinal_encoder', 'label_encoder', 'frequency_encoder', 'drop_column'],
  boolean: [...COMMON_CAST_OPTIONS, 'most_frequent_imputer', 'constant_imputer', 'label_encoder', 'drop_column'],
  datetime: [...COMMON_CAST_OPTIONS, 'extract_datetime_features', 'drop_original_datetime', 'drop_column'],
  datetime_like_text: [...COMMON_CAST_OPTIONS, 'extract_datetime_features', 'drop_original_datetime', 'drop_column'],
  free_text: [...COMMON_CAST_OPTIONS, 'drop_column'],
  identifier: [...COMMON_CAST_OPTIONS, 'drop_column'],
  empty: [...COMMON_CAST_OPTIONS, 'drop_column'],
};

export const OPERATION_CATALOG = [
  {
    id: 'missing_values',
    label: 'Missing values',
    description: 'Fill null values before modeling.',
    operations: ['median_imputer', 'mean_imputer', 'most_frequent_imputer', 'constant_imputer'],
  },
  {
    id: 'scaling',
    label: 'Scaling',
    description: 'Normalize numeric magnitudes after imputation.',
    operations: ['standard_scaler', 'robust_scaler', 'minmax_scaler'],
  },
  {
    id: 'encoding',
    label: 'Encoding',
    description: 'Convert categorical values into model-ready features.',
    operations: ['one_hot_encoder', 'ordinal_encoder', 'label_encoder', 'frequency_encoder'],
  },
  {
    id: 'datetime_features',
    label: 'Datetime features',
    description: 'Extract reusable date parts and remove raw timestamps.',
    operations: ['extract_datetime_features', 'drop_original_datetime'],
  },
  {
    id: 'column_actions',
    label: 'Column actions',
    description: 'Remove columns that should not enter the model.',
    operations: ['drop_column'],
  },
];

export function getOperationCatalogForType(type) {
  const compatibleOperations = new Set(STEP_OPTIONS_BY_TYPE[type] || STEP_OPTIONS_BY_TYPE.text);

  return OPERATION_CATALOG
    .map((group) => ({
      ...group,
      operations: group.operations.filter((operation) => compatibleOperations.has(operation)),
    }))
    .filter((group) => group.operations.length > 0);
}

export function hasStepOperation(columnPlan, operation) {
  return Boolean(columnPlan?.steps?.some((step) => step.operation === operation));
}

export function getNonCastSteps(columnPlan) {
  return (columnPlan?.steps || []).filter((step) => !CAST_OPERATIONS.includes(step.operation));
}


function inferTypeFromName(columnName) {
  const name = String(columnName || '').toLowerCase();
  if (/(^id$|_id$|uuid|hash|cpf|cnpj|email|telefone|phone|document|matricula|placa)/.test(name)) return 'identifier';
  if (/(data|date|dt_|timestamp|created|updated|inicio|fim)/.test(name)) return 'datetime_like_text';
  if (/(descricao|description|comentario|comment|observacao|obs|texto|message|mensagem)/.test(name)) return 'free_text';
  if (/(ativo|active|flag|is_|has_|true|false)/.test(name)) return 'boolean';
  if (/(valor|custo|price|income|score|idade|age|tempo|qtd|quant|count|total|taxa|rate|percent)/.test(name)) return 'numeric';
  return 'categorical';
}

export function buildColumnProfilesFromDataset(dataset, datasetColumns = []) {
  const names = Array.isArray(datasetColumns) && datasetColumns.length
    ? datasetColumns
    : Array.isArray(dataset?.column_names)
      ? dataset.column_names
      : Array.isArray(dataset?.columns_metadata)
        ? dataset.columns_metadata.map((col) => col.name || col.column_name).filter(Boolean)
        : [];

  return names.map((name, index) => {
    const inferredType = inferTypeFromName(name);
    const uniqueCount = inferredType === 'identifier' ? Math.max(dataset?.rows || 100, 100) : inferredType === 'categorical' ? 6 + (index % 8) : 0;
    const totalCount = dataset?.rows || 0;
    return {
      column_name: name,
      raw_dtype: inferredType.includes('numeric') ? 'float64' : 'object',
      inferred_type: inferredType,
      type_inference: {
        numeric_parse_ratio: inferredType === 'numeric_like_text' ? 1 : inferredType === 'numeric' ? 1 : 0,
        datetime_parse_ratio: inferredType === 'datetime_like_text' ? 1 : inferredType === 'datetime' ? 1 : 0,
      },
      common_stats: {
        total_count: totalCount,
        observed_count: totalCount,
        missing_count: index % 4 === 0 ? Math.max(Math.floor(totalCount * 0.03), 0) : 0,
        missing_ratio: index % 4 === 0 ? 0.03 : 0,
        unique_count: uniqueCount || Math.max(Math.floor(totalCount * 0.12), 1),
        unique_ratio: totalCount ? (uniqueCount || Math.floor(totalCount * 0.12)) / totalCount : 0,
        is_empty: false,
        is_constant: false,
        is_mostly_missing: false,
      },
      specific_stats: buildMockSpecificStats(inferredType, index),
    };
  });
}

function buildMockSpecificStats(type, index) {
  if (type === 'numeric' || type === 'numeric_like_text') {
    return {
      mean: 50 + index * 3,
      median: 48 + index * 2,
      std: 11 + index,
      p25: 34,
      p75: 66,
      skewness: index % 3 === 0 ? 1.4 : 0.35,
      kurtosis: index % 3 === 0 ? 4.8 : 1.1,
      outlier_ratio_iqr: index % 3 === 0 ? 0.08 : 0.01,
      zero_ratio: 0,
      normality_score: index % 3 === 0 ? 0.02 : 0.41,
    };
  }
  if (type === 'datetime' || type === 'datetime_like_text') {
    return {
      parse_success_ratio: 1,
      timespan_days: 730,
      has_time_component: false,
      month_distribution: { 1: 0.09, 2: 0.08, 3: 0.1, 4: 0.06, 5: 0.11 },
      weekday_distribution: { 0: 0.16, 1: 0.14, 2: 0.15, 3: 0.15, 4: 0.16, 5: 0.12, 6: 0.12 },
    };
  }
  if (type === 'identifier') {
    return {
      top_1_ratio: 0.001,
      normalized_entropy: 0.99,
      avg_length: 16,
      numeric_parse_ratio: 0,
      datetime_parse_ratio: 0,
      unique_pattern_count: 2,
      top_pattern_ratio: 0.9,
    };
  }
  if (type === 'free_text') {
    return {
      top_1_ratio: 0.002,
      top_5_ratio: 0.01,
      normalized_entropy: 0.96,
      avg_length: 128,
      max_length: 640,
      numeric_parse_ratio: 0,
      datetime_parse_ratio: 0,
      unique_pattern_count: 100,
      top_pattern_ratio: 0.02,
    };
  }
  return {
    top_1_ratio: 0.42,
    top_5_ratio: 0.88,
    rare_value_ratio: 0.05,
    entropy: 1.8,
    normalized_entropy: 0.72,
    avg_length: 9 + index,
    median_length: 8,
    max_length: 24,
    numeric_parse_ratio: 0,
    datetime_parse_ratio: 0,
    unique_pattern_count: 3,
    top_pattern_ratio: 0.76,
    masked_top_distribution: {
      VALUE_001: 0.42,
      VALUE_002: 0.24,
      VALUE_003: 0.15,
      VALUE_004: 0.07,
    },
  };
}

export function buildDeterministicDraftPlan(columns, targetColumn) {
  return columns
    .filter((column) => column.column_name !== targetColumn)
    .map((column) => {
      const inferredType = column.inferred_type || column.type_inference?.inferred_type || 'text';
      const missingRatio = column.common_stats?.missing_ratio || 0;
      const stats = column.specific_stats || {};
      const steps = [];

      if (inferredType === 'identifier' || inferredType === 'free_text' || inferredType === 'empty') {
        steps.push(makeStep('drop_column', 'Rule-based draft: column is unlikely to help tabular ML.'));
      } else if (inferredType === 'numeric' || inferredType === 'numeric_like_text') {
        if (inferredType === 'numeric_like_text') steps.push(makeStep('cast_numeric', 'All observed values parse as numeric.'));
        if (missingRatio > 0) steps.push(makeStep('median_imputer', 'Numeric column has missing values.'));
        steps.push(makeStep((stats.outlier_ratio_iqr || 0) > 0.05 || Math.abs(stats.skewness || 0) > 1 ? 'robust_scaler' : 'standard_scaler', 'Rule-based draft for numeric scaling.'));
      } else if (inferredType === 'datetime' || inferredType === 'datetime_like_text') {
        if (inferredType === 'datetime_like_text') steps.push(makeStep('cast_datetime', 'All observed values parse as datetime.'));
        steps.push(makeStep('extract_datetime_features', 'Use datetime components as tabular features.'));
        steps.push(makeStep('drop_original_datetime', 'Drop raw datetime after feature extraction.'));
      } else {
        if (missingRatio > 0) steps.push(makeStep('most_frequent_imputer', 'Categorical/text-like column has missing values.'));
        const uniqueCount = column.common_stats?.unique_count || 0;
        steps.push(makeStep(uniqueCount > 50 ? 'frequency_encoder' : 'one_hot_encoder', 'Rule-based draft for categorical encoding.'));
      }

      return {
        column_name: column.column_name,
        inferred_type: inferredType,
        steps,
      };
    });
}

export function makeStep(operation, reason = '') {
  return {
    id: `${operation}_${Math.random().toString(36).slice(2, 9)}`,
    operation,
    params: {},
    status: 'recommended',
    reason,
    source: 'rule_based_draft',
  };
}

export function addStepToColumn(plan, columnName, operation) {
  if (CAST_OPERATIONS.includes(operation)) {
    return setCastOperationForColumn(plan, columnName, operation);
  }

  return plan.map((columnPlan) => (
    columnPlan.column_name === columnName
      ? { ...columnPlan, steps: [...columnPlan.steps, makeStep(operation, 'Added by user.')] }
      : columnPlan
  ));
}

export function removeStepFromColumn(plan, columnName, stepId) {
  return plan.map((columnPlan) => (
    columnPlan.column_name === columnName
      ? { ...columnPlan, steps: columnPlan.steps.filter((step) => step.id !== stepId) }
      : columnPlan
  ));
}

export function replaceStepOperation(plan, columnName, stepId, operation) {
  return plan.map((columnPlan) => {
    if (columnPlan.column_name !== columnName) return columnPlan;

    const nextSteps = columnPlan.steps
      .filter((step) => (
        !CAST_OPERATIONS.includes(operation)
        || !CAST_OPERATIONS.includes(step.operation)
        || step.id === stepId
      ))
      .map((step) => (
        step.id === stepId
          ? { ...step, operation, status: 'edited_by_user', reason: 'Edited by user.' }
          : step
      ));

    return { ...columnPlan, steps: sortStepsWithCastFirst(nextSteps) };
  });
}

export function getCastOperationForColumn(columnPlan) {
  return columnPlan?.steps?.find((step) => CAST_OPERATIONS.includes(step.operation))?.operation || '';
}

export function getEffectiveTypeFromColumnPlan(columnPlan) {
  const castOperation = getCastOperationForColumn(columnPlan);
  return CAST_TARGET_TYPE_BY_OPERATION[castOperation] || columnPlan?.inferred_type || 'text';
}

export function setCastOperationForColumn(plan, columnName, operation) {
  return plan.map((columnPlan) => {
    if (columnPlan.column_name !== columnName) return columnPlan;

    const stepsWithoutCast = columnPlan.steps.filter((step) => !CAST_OPERATIONS.includes(step.operation));
    const targetType = CAST_TARGET_TYPE_BY_OPERATION[operation] || columnPlan.inferred_type || 'text';
    const compatibleOperations = new Set(STEP_OPTIONS_BY_TYPE[targetType] || STEP_OPTIONS_BY_TYPE.text);
    const compatibleSteps = stepsWithoutCast.filter((step) => compatibleOperations.has(step.operation));

    if (!operation) {
      return { ...columnPlan, steps: compatibleSteps };
    }

    return {
      ...columnPlan,
      steps: [
        makeStep(operation, 'User-defined column casting before preprocessing.'),
        ...compatibleSteps,
      ],
    };
  });
}

function sortStepsWithCastFirst(steps) {
  return [...steps].sort((left, right) => {
    const leftIsCast = CAST_OPERATIONS.includes(left.operation);
    const rightIsCast = CAST_OPERATIONS.includes(right.operation);
    if (leftIsCast === rightIsCast) return 0;
    return leftIsCast ? -1 : 1;
  });
}

export function resetColumnPlan(plan, columns, columnName, targetColumn) {
  const original = buildDeterministicDraftPlan(columns, targetColumn).find((item) => item.column_name === columnName);
  if (!original) return plan;
  return plan.map((item) => (item.column_name === columnName ? original : item));
}
