import { apiGet, apiPost } from './client';

export function getLlmConfig() {
  return apiGet('/llm/config');
}

export function updateLlmConfig(payload) {
  return apiPost('/llm/config', payload);
}

export function resetLlmConfig() {
  return apiPost('/llm/config/reset', {});
}
