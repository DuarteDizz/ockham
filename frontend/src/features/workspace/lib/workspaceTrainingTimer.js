export function parseStartedAtMs(value) {
  if (!value) return null;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? null : parsed;
}

function getTrainingTimerStorageKey(experimentId) {
  return experimentId ? `ockham-live-training-start:${experimentId}` : '';
}

function getActiveTrainingTimerStorageKey() {
  return 'ockham-live-training-active-start';
}

function getActiveTrainingExperimentStorageKey() {
  return 'ockham-live-training-active-experiment';
}

export function persistTrainingStartedAt(experimentId, startedAtValue) {
  if (typeof window === 'undefined') return null;

  const startedAtMs = parseStartedAtMs(startedAtValue);
  if (!startedAtMs) return null;

  const storageKey = getTrainingTimerStorageKey(experimentId);
  if (storageKey) {
    window.sessionStorage.setItem(storageKey, String(startedAtMs));
  }

  window.sessionStorage.setItem(getActiveTrainingTimerStorageKey(), String(startedAtMs));

  if (experimentId) {
    window.sessionStorage.setItem(getActiveTrainingExperimentStorageKey(), experimentId);
  }

  return startedAtMs;
}

export function readPersistedTrainingStartedAt(experimentId) {
  if (typeof window === 'undefined') return null;

  const storageKey = getTrainingTimerStorageKey(experimentId);
  const directRawValue = storageKey ? window.sessionStorage.getItem(storageKey) : null;
  const activeExperimentId = window.sessionStorage.getItem(getActiveTrainingExperimentStorageKey());
  const activeRawValue = window.sessionStorage.getItem(getActiveTrainingTimerStorageKey());

  const rawValue = directRawValue || (!experimentId || activeExperimentId === experimentId ? activeRawValue : null);
  if (!rawValue) return null;

  const parsedValue = Number(rawValue);
  return Number.isNaN(parsedValue) ? null : parsedValue;
}

export function clearPersistedTrainingStartedAt(experimentId) {
  if (typeof window === 'undefined') return;

  const storageKey = getTrainingTimerStorageKey(experimentId);
  if (storageKey) {
    window.sessionStorage.removeItem(storageKey);
  }

  const activeExperimentId = window.sessionStorage.getItem(getActiveTrainingExperimentStorageKey());
  if (!experimentId || !activeExperimentId || activeExperimentId === experimentId) {
    window.sessionStorage.removeItem(getActiveTrainingTimerStorageKey());
    window.sessionStorage.removeItem(getActiveTrainingExperimentStorageKey());
  }
}
