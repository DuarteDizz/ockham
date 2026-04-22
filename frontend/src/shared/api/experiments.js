import { request } from './client';

export function fetchDatasetExperiments(datasetId) {
  return request(`/experiments/by-dataset/${datasetId}`);
}

export function fetchExperiment(experimentId) {
  return request(`/experiments/${experimentId}`);
}

export function runExperimentDirect(payload) {
  return request('/experiments/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}


export function abortExperiment(experimentId) {
  return request(`/experiments/${experimentId}/abort`, { method: 'POST' });
}

export function deleteExperiment(experimentId) {
  return request(`/experiments/${experimentId}`, { method: 'DELETE' });
}

export function fetchExperimentResults(experimentId, rankingMode = 'ockham') {
  return request(`/experiments/${experimentId}/results?ranking_mode=${rankingMode}`);
}

export function fetchModelDiagnostics(experimentId, modelId, options = {}) {
  const { validationParam = null, scope = 'full' } = options;
  const params = new URLSearchParams();
  if (validationParam) params.set('validation_param', validationParam);
  if (scope && scope !== 'full') params.set('scope', scope);
  const query = params.toString() ? `?${params.toString()}` : '';
  return request(`/experiments/${experimentId}/models/${modelId}/diagnostics${query}`);
}
