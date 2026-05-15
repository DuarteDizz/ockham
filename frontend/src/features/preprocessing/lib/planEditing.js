import { CAST_OPERATIONS, CAST_TARGET_TYPE_BY_OPERATION, STEP_OPTIONS_BY_TYPE } from './operationRegistry';

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
  return plan.map((item) => {
    if (item.column_name !== columnName) return item;
    return {
      ...item,
      steps: [],
      status: item.column_name === targetColumn ? 'target' : item.status,
    };
  });
}
