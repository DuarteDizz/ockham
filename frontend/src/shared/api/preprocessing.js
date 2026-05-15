import { buildApiUrl, request } from './client';

export function fetchDatasetProfile(datasetId) {
  return request(`/datasets/${datasetId}/profile`);
}

export function fetchPreprocessingOperationRegistry() {
  return request('/preprocessing/operations');
}

export async function streamAgenticPreprocessingPlan(datasetId, payload = {}, handlers = {}) {
  const response = await fetch(buildApiUrl(`/datasets/${datasetId}/preprocessing/agent-plan/stream`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      problem_type: payload.problemType || 'classification',
      target_column: payload.targetColumn || null,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed with status ${response.status}`);
  }

  if (!response.body) {
    throw new Error('The browser did not expose a streaming response body.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let finalEvent = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;
      const event = JSON.parse(trimmedLine);
      handlers.onEvent?.(event);
      if (event.kind === 'final') finalEvent = event;
      if (event.kind === 'error') throw new Error(event.message || 'Agentic preprocessing failed.');
    }
  }

  const remaining = buffer.trim();
  if (remaining) {
    const event = JSON.parse(remaining);
    handlers.onEvent?.(event);
    if (event.kind === 'final') finalEvent = event;
    if (event.kind === 'error') throw new Error(event.message || 'Agentic preprocessing failed.');
  }

  return finalEvent;
}
