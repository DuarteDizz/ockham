import { request } from './client';

export async function uploadDataset(file) {
  const formData = new FormData();
  formData.append('file', file);
  return request('/datasets/upload', { method: 'POST', body: formData });
}

export function fetchDatasets() {
  return request('/datasets');
}

export function fetchDataset(datasetId) {
  return request(`/datasets/${datasetId}`);
}

export function fetchDatasetPreview(datasetId, limit = 20) {
  const searchParams = new URLSearchParams({ limit: String(limit) });
  return request(`/datasets/${datasetId}/preview?${searchParams.toString()}`);
}

export function deleteDataset(datasetId) {
  return request(`/datasets/${datasetId}`, { method: 'DELETE' });
}
