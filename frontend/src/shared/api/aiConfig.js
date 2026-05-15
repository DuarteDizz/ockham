import { apiGet, apiPost } from './client';

export function getAiConfig() {
  return apiGet('/ai/config');
}

export function updateAiConfig(payload) {
  return apiPost('/ai/config', payload);
}

export function resetAiConfig() {
  return apiPost('/ai/config/reset', {});
}
