export function createEmptyPreprocessingPlan(dataset, targetColumn = null) {
  return {
    dataset_id: dataset?.id || null,
    dataset_name: dataset?.name || dataset?.filename || 'Dataset',
    status: 'empty',
    source: 'empty',
    target_column: targetColumn,
    columns: [],
    warnings: [],
    graph_metadata: {
      layout_mode: 'stage_based',
      stages: ['input', 'columns', 'casting', 'imputation', 'datetime', 'encoding', 'scaling', 'output'],
    },
  };
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
