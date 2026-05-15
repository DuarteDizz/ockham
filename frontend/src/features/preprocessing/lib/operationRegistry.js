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
  numeric: [...COMMON_CAST_OPTIONS, 'median_imputer', 'mean_imputer', 'constant_imputer', 'drop_rows_missing', 'standard_scaler', 'robust_scaler', 'minmax_scaler', 'maxabs_scaler', 'drop_column'],
  numeric_like_text: [...COMMON_CAST_OPTIONS, 'median_imputer', 'mean_imputer', 'constant_imputer', 'drop_rows_missing', 'standard_scaler', 'robust_scaler', 'minmax_scaler', 'maxabs_scaler', 'drop_column'],
  categorical: [...COMMON_CAST_OPTIONS, 'most_frequent_imputer', 'constant_imputer', 'drop_rows_missing', 'one_hot_encoder', 'ordinal_encoder', 'label_encoder', 'frequency_encoder', 'target_encoder', 'hashing_encoder', 'drop_column'],
  text: [...COMMON_CAST_OPTIONS, 'most_frequent_imputer', 'constant_imputer', 'drop_rows_missing', 'one_hot_encoder', 'ordinal_encoder', 'label_encoder', 'frequency_encoder', 'target_encoder', 'hashing_encoder', 'drop_column'],
  boolean: [...COMMON_CAST_OPTIONS, 'most_frequent_imputer', 'constant_imputer', 'drop_rows_missing', 'label_encoder', 'drop_column'],
  datetime: [...COMMON_CAST_OPTIONS, 'drop_rows_missing', 'extract_datetime_features', 'drop_original_datetime', 'drop_column'],
  datetime_like_text: [...COMMON_CAST_OPTIONS, 'drop_rows_missing', 'extract_datetime_features', 'drop_original_datetime', 'drop_column'],
  free_text: [...COMMON_CAST_OPTIONS, 'drop_rows_missing', 'drop_column'],
  identifier: [...COMMON_CAST_OPTIONS, 'drop_rows_missing', 'drop_column'],
  empty: [...COMMON_CAST_OPTIONS, 'drop_column'],
};

export const OPERATION_CATALOG = [
  {
    id: 'missing_values',
    label: 'Missing values',
    description: 'Fill or remove null values before modeling.',
    operations: ['median_imputer', 'mean_imputer', 'most_frequent_imputer', 'constant_imputer', 'drop_rows_missing'],
  },
  {
    id: 'scaling',
    label: 'Scaling',
    description: 'Normalize numeric magnitudes after imputation.',
    operations: ['standard_scaler', 'robust_scaler', 'minmax_scaler', 'maxabs_scaler'],
  },
  {
    id: 'encoding',
    label: 'Encoding',
    description: 'Convert categorical values into model-ready features.',
    operations: ['one_hot_encoder', 'ordinal_encoder', 'label_encoder', 'frequency_encoder', 'target_encoder', 'hashing_encoder'],
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
