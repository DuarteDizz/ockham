export function getCachedDiagnosticsForModel(cache, currentExperimentId, modelId) {
  if (!currentExperimentId || !modelId) return null;

  const defaultKey = `${currentExperimentId}:${modelId}:__default__`;
  if (cache[defaultKey]) return cache[defaultKey];

  const prefix = `${currentExperimentId}:${modelId}:`;
  const matchingKey = Object.keys(cache).find((key) => key.startsWith(prefix));
  return matchingKey ? cache[matchingKey] : null;
}

export function injectRocAucIntoResults(currentResults, modelId, diagnostics) {
  const auc = diagnostics?.rocCurve?.auc;
  if (auc == null || !Array.isArray(currentResults) || !currentResults.length) return currentResults;

  let changed = false;
  const nextResults = currentResults.map((item) => {
    if (item.id !== modelId) return item;
    if (item.metrics?.['ROC AUC'] === auc) return item;

    changed = true;
    return {
      ...item,
      metrics: {
        ...item.metrics,
        'ROC AUC': auc,
      },
    };
  });

  return changed ? nextResults : currentResults;
}

function hasValidationCurvePayload(diagnostics) {
  if (!diagnostics) return false;
  if (diagnostics.validationCurve) return true;
  return !(Array.isArray(diagnostics.availableValidationParams) && diagnostics.availableValidationParams.length > 0);
}

function hasRegressionDiagnostics(diagnostics) {
  const bundle = diagnostics?.actualVsPredicted;
  if (!bundle) return false;
  const actual = Array.isArray(bundle.actual) ? bundle.actual : [];
  const predicted = Array.isArray(bundle.predicted) ? bundle.predicted : [];
  return actual.length > 0 && predicted.length > 0;
}

function hasClassificationDiagnostics(diagnostics) {
  const roc = diagnostics?.rocCurve;
  const confusion = diagnostics?.confusionMatrix;
  const hasRoc = Array.isArray(roc?.fpr) && roc.fpr.length > 1 && Array.isArray(roc?.tpr) && roc.tpr.length > 1;
  const hasConfusion = Array.isArray(confusion?.matrix) && confusion.matrix.length > 0;
  return hasRoc || hasConfusion;
}

export function isDiagnosticsDashboardReady(diagnostics, problemType) {
  if (!diagnostics) return false;

  const hasLearningCurve = Boolean(diagnostics.learningCurve);
  const hasTaskSpecific = problemType === 'regression'
    ? hasRegressionDiagnostics(diagnostics)
    : hasClassificationDiagnostics(diagnostics);

  return hasLearningCurve && hasTaskSpecific;
}

export function isDiagnosticsFullyReady(diagnostics, problemType) {
  return isDiagnosticsDashboardReady(diagnostics, problemType) && hasValidationCurvePayload(diagnostics);
}
