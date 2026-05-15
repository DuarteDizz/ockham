import { fetchExperiment } from '@/shared/api/experiments';
import {
  EMPTY_LIVE_TRAINING_META,
  mapApiExperiment,
} from '@/features/experiments/support/mappers';

export function getEmptyLiveTrainingMeta() {
  return { ...EMPTY_LIVE_TRAINING_META };
}

export function buildUiTrainingState(apiTrainingState = [], fallbackIds = [], modelMetaById = {}) {
  const source = apiTrainingState.length
    ? apiTrainingState
    : fallbackIds.map((id) => ({ id, status: 'pending' }));

  return source.map((item) => ({
    id: item.id,
    name: item.name || modelMetaById[item.id]?.name || item.id,
    color: modelMetaById[item.id]?.accent || '#4361EE',
    iconKey: modelMetaById[item.id]?.iconKey || 'linear-regression',
    status: item.status || 'pending',
  }));
}

export function delay(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export async function waitForExperimentToStop(experimentId, { timeoutMs = 120000, intervalMs = 350 } = {}) {
  if (!experimentId) return null;

  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const latest = mapApiExperiment(await fetchExperiment(experimentId));

      if (['cancelled', 'done', 'failed'].includes(latest.status)) {
        return latest;
      }
    } catch (err) {
      if (err?.message === 'Experiment not found.') {
        return { experimentId, status: 'cancelled' };
      }

      throw err;
    }

    await delay(intervalMs);
  }

  throw new Error('Timed out while waiting for the experiment cancellation to finish.');
}
