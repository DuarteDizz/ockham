import { getModelVisual } from '@/features/experiments/support/modelVisuals';

const METRIC_LABELS = {
  accuracy: 'Accuracy',
  precision_weighted: 'Precision',
  recall_weighted: 'Recall',
  f1_weighted: 'F1-Score',
  r2: 'R² Score',
  neg_mean_absolute_error: 'MAE',
  neg_root_mean_squared_error: 'RMSE',
  neg_mean_squared_error: 'MSE',
};

export const EMPTY_LIVE_TRAINING_META = Object.freeze({
  progress: 0,
  liveStep: null,
  liveMessage: '',
  startedAt: null,
});

function titleCase(value = '') {
  return value
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getOptunaEnvelope(payload = {}) {
  return payload?.optuna || null;
}

function getOptunaBestParams(payload = {}) {
  return payload?.best_params || getOptunaEnvelope(payload)?.best_params || getOptunaEnvelope(payload)?.best_trial?.params || {};
}

function getOptunaBestValue(payload = {}) {
  return payload?.best_score ?? getOptunaEnvelope(payload)?.best_value ?? getOptunaEnvelope(payload)?.best_trial?.value ?? null;
}

function getOptunaDuration(payload = {}) {
  return payload?.total_search_time ?? getOptunaEnvelope(payload)?.duration_seconds ?? null;
}

function mapBestModel(modelName, score) {
  return modelName ? { modelName, score: score ?? 0 } : null;
}

export function mapApiModelToUiModel(model) {
  const visual = getModelVisual(model.id, model.category);
  return {
    id: model.id,
    name: model.name,
    category: model.category,
    problem_type: model.problem_type,
    search_backend: model.search_backend || null,
    accent: visual.accent,
    iconKey: visual.iconKey,
  };
}

export function mapApiModelsToUiModels(response) {
  return (response?.models || []).map(mapApiModelToUiModel);
}

export function mapApiExperiment(item = {}) {
  const experimentId = item.experiment_id || item.id || '';
  const selectedModels = Array.isArray(item.selected_models) ? item.selected_models : [];
  const displayModels = Array.isArray(item.models) ? item.models : selectedModels;
  const bestOckhamModel = item.best_model_by_ockham || item.best_model || null;
  const bestOckhamScore = item.best_score_by_ockham ?? item.best_score ?? null;
  const bestScoreModel = item.best_model_by_score || null;
  const bestScoreValue = item.best_score_by_score ?? null;

  return {
    id: experimentId,
    experimentId,
    datasetId: item.dataset_id || '',
    problemType: item.problem_type || '',
    targetColumn: item.target_column || '',
    selectedModels,
    status: item.status || 'queued',
    progress: item.progress ?? 0,
    rankingMode: item.ranking_mode || 'ockham',
    createdAt: item.created_at || item.run_at || null,
    updatedAt: item.updated_at || item.run_at || item.created_at || null,
    models: displayModels,
    bestByOckham: mapBestModel(bestOckhamModel, bestOckhamScore),
    bestByScore: mapBestModel(bestScoreModel, bestScoreValue) || mapBestModel(bestOckhamModel, bestOckhamScore),
    primaryMetric: item.primary_metric || null,
    trainingState: item.training_state || null,
    liveStep: item.live_step || null,
    liveMessage: item.live_message || null,
    startedAt: item.started_at || item.created_at || null,
  };
}

export function mapApiDataset(item = {}) {
  return {
    id: item.dataset_id,
    datasetId: item.dataset_id,
    name: item.name,
    rows: item.rows,
    columns: item.columns,
    columnNames: item.column_names || [],
    status: item.status,
    createdAt: item.created_at,
    file_type: item.file_type || item.name?.split('.').pop()?.toLowerCase() || 'csv',
    size_kb: item.size_kb || null,
    experiments: (item.experiments || []).map(mapApiExperiment),
  };
}

function normalizeMetricValue(metricKey, value) {
  if (typeof value !== 'number') return value;
  if (metricKey.startsWith('neg_')) return Math.abs(value);
  return value;
}

export function mapMetrics(metricsMean = {}) {
  const mapped = {};
  Object.entries(metricsMean).forEach(([key, value]) => {
    const label = METRIC_LABELS[key] || titleCase(key);
    mapped[label] = normalizeMetricValue(key, value);
  });

  if (mapped.RMSE != null && mapped.MSE == null) {
    mapped.MSE = Number((mapped.RMSE ** 2).toFixed(6));
  }

  return mapped;
}

export function mapMetricStd(metricsStd = {}) {
  const mapped = {};
  Object.entries(metricsStd).forEach(([key, value]) => {
    const label = METRIC_LABELS[key] || titleCase(key);
    mapped[label] = Math.abs(value);
  });
  return mapped;
}

function mapPrimaryMetricLabel(primaryMetric) {
  return METRIC_LABELS[primaryMetric] || titleCase(primaryMetric || 'score');
}

function mapEmbeddedDiagnostics(payload = {}) {
  if (!payload || typeof payload !== 'object') return null;
  const hasAny = [
    payload.confusion_matrix,
    payload.roc_curve,
    payload.learning_curve,
    payload.validation_curve,
    payload.actual_vs_predicted,
  ].some((item) => item != null);

  if (!hasAny) return null;

  return {
    experimentId: payload.experiment_id || null,
    modelId: payload.model_id || null,
    primaryMetric: payload.primary_metric || null,
    primaryMetricLabel: mapPrimaryMetricLabel(payload.primary_metric),
    cvFoldScores: payload.cv_fold_scores || {},
    confusionMatrix: payload.confusion_matrix || null,
    rocCurve: payload.roc_curve || null,
    learningCurve: payload.learning_curve || null,
    validationCurve: payload.validation_curve || null,
    actualVsPredicted: payload.actual_vs_predicted || null,
    availableValidationParams: payload.available_validation_params || [],
    selectedValidationParam: payload.selected_validation_param || '',
    capabilityProfile: payload.capability_profile || null,
  };
}

export function mapApiResultToUiResult(item, rankingMode = 'ockham') {
  const optuna = getOptunaEnvelope(item);
  const totalSearchTime = getOptunaDuration(item);
  const bestParams = getOptunaBestParams(item);
  const bestScore = getOptunaBestValue(item);
  const visual = getModelVisual(item.model_id, item.category);

  return {
    id: item.model_id,
    name: item.model_name,
    category: item.category,
    problemType: item.problem_type,
    accent: visual.accent,
    iconKey: visual.iconKey,
    training_time: Number(totalSearchTime?.toFixed?.(3) || totalSearchTime || 0),
    metrics: mapMetrics(item.metrics_mean),
    metricsStd: mapMetricStd(item.metrics_std),
    hyperparameters: bestParams,
    bestScore,
    primaryMetric: item.primary_metric,
    primaryMetricLabel: mapPrimaryMetricLabel(item.primary_metric),
    performance_rank: item.performance_rank,
    ockham_rank: item.ockham_rank,
    display_rank: rankingMode === 'score' ? item.performance_rank : item.ockham_rank,
    isRecommended: rankingMode === 'score' ? item.performance_rank === 1 : item.is_ockham_recommended,
    structural_scores: item.structural_scores,
    feature_stats: {
      used_feature_count: item.structural_scores?.used_feature_count,
      total_feature_count: item.structural_scores?.total_feature_count,
      expanded_feature_count: item.structural_scores?.expanded_feature_count,
      used_feature_ratio: item.structural_scores?.used_feature_ratio,
    },
    ockham_components: item.ockham_components,
    inference_time_per_1000_rows: item.inference_time_per_1000_rows,
    fit_time_mean: item.fit_time_mean,
    total_search_time: totalSearchTime,
    optunaSummary: optuna,
    cvFoldScores: item.cv_fold_scores || {},
    capabilityProfile: item.capability_profile || null,
    embeddedDiagnostics: mapEmbeddedDiagnostics(item),
    raw: item,
  };
}

export function mapApiResultsToUiResults(response, rankingMode = 'ockham') {
  return (response?.results || []).map((item) => mapApiResultToUiResult(item, rankingMode));
}

export function mapDiagnostics(response) {
  const optuna = getOptunaEnvelope(response);
  return {
    experimentId: response?.experiment_id || null,
    modelId: response?.model_id || null,
    primaryMetric: response?.primary_metric || null,
    primaryMetricLabel: mapPrimaryMetricLabel(response?.primary_metric),
    cvFoldScores: response?.cv_fold_scores || {},
    confusionMatrix: response?.confusion_matrix || null,
    rocCurve: response?.roc_curve || null,
    learningCurve: response?.learning_curve || null,
    validationCurve: response?.validation_curve || null,
    actualVsPredicted: response?.actual_vs_predicted || null,
    availableValidationParams: response?.available_validation_params || [],
    selectedValidationParam: response?.selected_validation_param || '',
    capabilityProfile: response?.capability_profile || null,
    optunaSummary: optuna,
  };
}


export function mapApiResultsMetadata(response, rankingMode = 'ockham') {
  return {
    rankingMode: response?.ranking_mode || rankingMode || 'ockham',
    rankingProvider: response?.ranking_provider || null,
    rankingStatus: response?.ranking_status || null,
    rankingError: response?.ranking_error || null,
    isOckhamFallback:
      (response?.ranking_mode || rankingMode) === 'ockham'
      && Boolean(response?.ranking_provider)
      && response.ranking_provider !== 'ollama_json',
  };
}
