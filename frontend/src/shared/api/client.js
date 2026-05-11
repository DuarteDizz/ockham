const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');

function getErrorMessageFromPayload(payload, fallbackMessage) {
  if (!payload) return fallbackMessage;

  try {
    const parsed = JSON.parse(payload);
    if (typeof parsed?.detail === 'string') return parsed.detail;
    if (Array.isArray(parsed?.detail)) return parsed.detail.map((item) => item.msg || String(item)).join('; ');
    if (typeof parsed?.message === 'string') return parsed.message;
  } catch {
    // Non-JSON error bodies are handled below.
  }

  return payload || fallbackMessage;
}

export async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, options);

  if (!response.ok) {
    const text = await response.text();
    throw new Error(getErrorMessageFromPayload(text, `Request failed with status ${response.status}`));
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    return null;
  }

  return response.json();
}

export async function apiGet(path) {
  return request(path, { method: 'GET' });
}

export async function apiPost(path, body) {
  return request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function apiUpload(path, formData) {
  return request(path, {
    method: 'POST',
    body: formData,
  });
}
