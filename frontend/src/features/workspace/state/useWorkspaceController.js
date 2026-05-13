import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  deleteDataset as deleteDatasetApi,
  fetchDataset,
  fetchDatasets,
  uploadDataset as uploadDatasetApi,
} from '@/shared/api/datasets';
import {
  deleteExperiment as deleteExperimentApi,
  abortExperiment as abortExperimentApi,
  fetchDatasetExperiments,
  fetchExperiment,
  fetchExperimentResults,
  fetchModelDiagnostics,
  runExperimentDirect,
} from '@/shared/api/experiments';
import { fetchModels } from '@/shared/api/models';
import {
  mapApiDataset,
  mapApiExperiment,
  mapApiModelsToUiModels,
  mapApiResultsMetadata,
  mapApiResultsToUiResults,
  mapDiagnostics,
} from '@/features/experiments/support/mappers';
import {
  getCachedDiagnosticsForModel,
  injectRocAucIntoResults,
  isDiagnosticsDashboardReady,
  isDiagnosticsFullyReady,
} from '@/features/workspace/state/workspaceDiagnostics';
import { sortUiResultsByRankingMode } from '@/features/workspace/state/workspaceResults';
import {
  buildUiTrainingState,
  delay,
  getEmptyLiveTrainingMeta,
  waitForExperimentToStop,
} from '@/features/workspace/state/workspaceTraining';
import {
  clearPersistedTrainingStartedAt,
  parseStartedAtMs,
  persistTrainingStartedAt,
  readPersistedTrainingStartedAt,
} from '@/features/workspace/state/workspaceTrainingTimer';

const DEFAULT_PROBLEM_TYPE = 'classification';
const DEFAULT_RANKING_MODE = 'ockham';

function getExperimentPollingDelayMs(attemptCount) {
  if (attemptCount <= 30) return 1000;
  if (attemptCount <= 90) return 2000;
  if (attemptCount <= 210) return 5000;
  return 10000;
}

export function useWorkspaceController() {
  const [activeView, setActiveView] = useState('datasets');
  const [problemType, setProblemTypeState] = useState(DEFAULT_PROBLEM_TYPE);
  const [models, setModels] = useState([]);
  const [selectedModels, setSelectedModels] = useState([]);

  const [datasetId, setDatasetId] = useState('');
  const [datasetName, setDatasetName] = useState('');
  const [datasetColumns, setDatasetColumns] = useState([]);
  const [targetColumn, setTargetColumnState] = useState('');

  const [experimentId, setExperimentId] = useState('');
  const [rankingMode, setRankingModeState] = useState(DEFAULT_RANKING_MODE);
  const [status, setStatus] = useState('idle');
  const [results, setResults] = useState([]);
  const [rankingMeta, setRankingMeta] = useState({
    rankingMode: DEFAULT_RANKING_MODE,
    rankingProvider: null,
    rankingStatus: null,
    rankingError: null,
    isOckhamFallback: false,
  });
  const [diagnosticsByModel, setDiagnosticsByModel] = useState({});
  const [trainingProgress, setTrainingProgress] = useState([]);
  const [liveTrainingMeta, setLiveTrainingMeta] = useState(getEmptyLiveTrainingMeta);
  const [liveElapsedMs, setLiveElapsedMs] = useState(0);
  const [liveTimerStartMs, setLiveTimerStartMs] = useState(() => readPersistedTrainingStartedAt(''));

  const [uploadedDatasets, setUploadedDatasets] = useState([]);
  const [experimentsForSelectedDataset, setExperimentsForSelectedDataset] = useState([]);
  const [datasetDetailId, setDatasetDetailId] = useState('');
  const [preprocessingDatasetId, setPreprocessingDatasetId] = useState('');

  const [isUploading, setIsUploading] = useState(false);
  const [isHydratingDataset, setIsHydratingDataset] = useState(false);
  const [isDatasetsLoading, setIsDatasetsLoading] = useState(false);
  const [isExperimentsLoading, setIsExperimentsLoading] = useState(false);
  const [isDeletingDataset, setIsDeletingDataset] = useState(false);
  const [isCancellingExperiment, setIsCancellingExperiment] = useState(false);
  const [cancelOverlayPhase, setCancelOverlayPhase] = useState('idle');
  const [error, setError] = useState('');

  const trainingClearTimeoutRef = useRef(null);
  const activeRunExperimentRef = useRef('');
  const diagnosticsCacheRef = useRef({});
  const diagnosticsInFlightRef = useRef({});
  const pollSequenceRef = useRef(0);
  const cancelRequestedRef = useRef(false);
  const runStartedAtRef = useRef(null);

  // Long polling reads from refs, so we mirror diagnostics there to avoid stale closures.
  useEffect(() => {
    diagnosticsCacheRef.current = diagnosticsByModel;
  }, [diagnosticsByModel]);

  useEffect(() => {
    const activeExperimentId = experimentId || activeRunExperimentRef.current;
    const startedAtMs = parseStartedAtMs(liveTrainingMeta?.startedAt)
      || parseStartedAtMs(runStartedAtRef.current)
      || readPersistedTrainingStartedAt(activeExperimentId);

    if (startedAtMs) {
      persistTrainingStartedAt(activeExperimentId, new Date(startedAtMs).toISOString());
      setLiveTimerStartMs((currentValue) => {
        if (!currentValue) return startedAtMs;
        return Math.min(currentValue, startedAtMs);
      });
    }

    const effectiveStartMs = startedAtMs || liveTimerStartMs;
    const shouldTick = status === 'processing' && Boolean(effectiveStartMs);

    const updateElapsed = () => {
      if (!effectiveStartMs) {
        setLiveElapsedMs(0);
        return;
      }
      setLiveElapsedMs(Math.max(Date.now() - effectiveStartMs, 0));
    };

    updateElapsed();

    if (!shouldTick) {
      if (['idle', 'done', 'failed', 'cancelled'].includes(status) && !isCancellingExperiment) {
        clearPersistedTrainingStartedAt(activeExperimentId);
        setLiveTimerStartMs(null);
      }
      return undefined;
    }

    const intervalId = window.setInterval(updateElapsed, 1000);
    window.addEventListener('focus', updateElapsed);
    document.addEventListener('visibilitychange', updateElapsed);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', updateElapsed);
      document.removeEventListener('visibilitychange', updateElapsed);
    };
  }, [experimentId, isCancellingExperiment, liveTimerStartMs, liveTrainingMeta?.startedAt, status]);

  // Dashboard-derived values stay here so the pages can stay mostly presentational.
  const primaryMetric = useMemo(() => {
    if (!results.length) return problemType === 'regression' ? 'R² Score' : 'F1-Score';
    return results[0].primaryMetricLabel || (problemType === 'regression' ? 'R² Score' : 'F1-Score');
  }, [results, problemType]);

  const charts = useMemo(() => {
    if (!results.length) return [];
    return results.map((item) => ({
      model: item.name,
      primary: item.metrics[item.primaryMetricLabel] ?? item.bestScore,
      training: item.training_time,
      rank: item.display_rank,
    }));
  }, [results]);

  // Reset only the live run state. Dataset selection and navigation intentionally stay intact.
  function setIdleRunVisuals() {
    runStartedAtRef.current = null;
    setResults([]);
    setRankingMeta({
      rankingMode: DEFAULT_RANKING_MODE,
      rankingProvider: null,
      rankingStatus: null,
      rankingError: null,
      isOckhamFallback: false,
    });
    setDiagnosticsByModel({});
    setTrainingProgress([]);
    clearPersistedTrainingStartedAt(experimentId || activeRunExperimentRef.current);
    setLiveTrainingMeta(getEmptyLiveTrainingMeta());
    setLiveElapsedMs(0);
    setLiveTimerStartMs(null);
    setExperimentId('');
    setStatus('idle');
    setRankingModeState(DEFAULT_RANKING_MODE);
  }

  function clearSelectedDataset() {
    setDatasetId('');
    setDatasetName('');
    setDatasetColumns([]);
    setTargetColumnState('');
    setExperimentsForSelectedDataset([]);
    setIdleRunVisuals();
  }

  function clearRunLifecycle() {
    pollSequenceRef.current += 1;

    if (trainingClearTimeoutRef.current) {
      window.clearTimeout(trainingClearTimeoutRef.current);
      trainingClearTimeoutRef.current = null;
    }

    activeRunExperimentRef.current = '';
  }

  function resetProcessingView() {
    clearRunLifecycle();
    runStartedAtRef.current = null;
    clearPersistedTrainingStartedAt(experimentId || activeRunExperimentRef.current);
    setTrainingProgress([]);
    setLiveTrainingMeta(getEmptyLiveTrainingMeta());
    setLiveElapsedMs(0);
    setLiveTimerStartMs(null);
    setStatus('idle');
    setExperimentId('');
    setResults([]);
    setRankingMeta({
      rankingMode: DEFAULT_RANKING_MODE,
      rankingProvider: null,
      rankingStatus: null,
      rankingError: null,
      isOckhamFallback: false,
    });
    setCancelOverlayPhase('idle');
  }

  // Data loading stays centralized here so pages and panels can stay thin.
  async function loadModels(nextType, { preserveSelection = false } = {}) {
    const response = await fetchModels(nextType);
    const uiModels = mapApiModelsToUiModels(response);

    setModels(uiModels);
    setSelectedModels((current) => {
      if (preserveSelection) {
        const validSelection = current.filter((modelId) => uiModels.some((item) => item.id === modelId));
        if (validSelection.length) return validSelection;
      }

      return uiModels.slice(0, Math.min(3, uiModels.length)).map((item) => item.id);
    });
  }

  async function refreshDatasets({ preserveSelection = true } = {}) {
    setIsDatasetsLoading(true);
    try {
      const response = await fetchDatasets();
      const datasets = (response?.datasets || []).map(mapApiDataset);
      setUploadedDatasets(datasets);

      if (preserveSelection && datasetId && !datasets.some((item) => item.id === datasetId)) {
        clearSelectedDataset();
      }

      if (datasetDetailId && !datasets.some((item) => item.id === datasetDetailId)) {
        setDatasetDetailId('');
        if (activeView === 'dataset-detail') setActiveView('datasets');
      }

      return datasets;
    } finally {
      setIsDatasetsLoading(false);
    }
  }

  async function refreshExperiments(nextDatasetId = datasetId) {
    if (!nextDatasetId) {
      setExperimentsForSelectedDataset([]);
      return [];
    }

    setIsExperimentsLoading(true);
    try {
      const response = await fetchDatasetExperiments(nextDatasetId);
      const experiments = (response?.experiments || []).map(mapApiExperiment);
      setExperimentsForSelectedDataset(experiments);
      setUploadedDatasets((current) => current.map((dataset) => (
        dataset.id === nextDatasetId ? { ...dataset, experiments } : dataset
      )));
      return experiments;
    } catch (err) {
      setExperimentsForSelectedDataset([]);
      throw err;
    } finally {
      setIsExperimentsLoading(false);
    }
  }

  async function hydrateDatasetSelection(
    nextDatasetId,
    { preferredProblemType = null, switchView = false, preserveTarget = true } = {},
  ) {
    if (!nextDatasetId) return;

    setIsHydratingDataset(true);
    setError('');

    try {
      clearRunLifecycle();
      const response = await fetchDataset(nextDatasetId);
      const nextColumns = response.column_names || [];

      setDatasetId(response.dataset_id);
      setDatasetName(response.name);
      setDatasetColumns(nextColumns);
      setTargetColumnState((current) => {
        if (preserveTarget && current && nextColumns.includes(current)) return current;
        return nextColumns[nextColumns.length - 1] || '';
      });
      setResults([]);
      setDiagnosticsByModel({});
      setExperimentId('');
      setStatus('idle');

      await refreshExperiments(response.dataset_id);

      const nextType = preferredProblemType || problemType;
      if (nextType !== problemType) setProblemTypeState(nextType);
      await loadModels(nextType, { preserveSelection: false });

      if (switchView) setActiveView('dashboard');
    } catch (err) {
      setError(err.message || 'Could not load dataset details.');
    } finally {
      setIsHydratingDataset(false);
    }
  }

  // Long polling reads from refs, so we mirror diagnostics there to avoid stale closures.
  useEffect(() => {
    let cancelled = false;

    async function boot() {
      try {
        setError('');
        const [modelsResponse, datasetsResponse] = await Promise.all([
          fetchModels(DEFAULT_PROBLEM_TYPE),
          fetchDatasets(),
        ]);

        if (cancelled) return;

        const uiModels = mapApiModelsToUiModels(modelsResponse);
        setModels(uiModels);
        setSelectedModels(uiModels.slice(0, Math.min(3, uiModels.length)).map((item) => item.id));

        const datasets = (datasetsResponse?.datasets || []).map(mapApiDataset);
        setUploadedDatasets(datasets);

        if (!datasets.length) {
          setActiveView('datasets');
          return;
        }

        await hydrateDatasetSelection(datasets[0].id, {
          preferredProblemType: DEFAULT_PROBLEM_TYPE,
          switchView: false,
          preserveTarget: false,
        });
        setActiveView('dashboard');
      } catch (err) {
        if (!cancelled) setError(err.message || 'Could not initialize Ockham workspace.');
      }
    }

    boot();
    return () => {
      cancelled = true;
      clearRunLifecycle();
    };
  }, []);

  async function setProblemType(nextType) {
    if (!nextType || nextType === problemType) return;
    if (status === 'processing' || isCancellingExperiment) return;

    clearRunLifecycle();
    setError('');
    setProblemTypeState(nextType);
    setIdleRunVisuals();

    try {
      await loadModels(nextType);
    } catch (err) {
      setError(err.message || 'Could not switch problem type.');
    }
  }

  function toggleModel(modelId) {
    if (status === 'processing' || isCancellingExperiment) return;
    setError('');
    setSelectedModels((current) => {
      if (current.includes(modelId)) {
        const nextSelection = current.filter((value) => value !== modelId);
        return nextSelection.length ? nextSelection : current;
      }
      return [...current, modelId];
    });
    setStatus('idle');
  }

  function selectAllModels(modelIds) {
    if (status === 'processing' || isCancellingExperiment) return;
    setError('');
    setSelectedModels(modelIds);
    setStatus('idle');
  }

  function clearModels() {
    if (status === 'processing' || isCancellingExperiment) return;
    setError('');
    if (models.length) setSelectedModels([models[0].id]);
    setStatus('idle');
  }

  function setTargetColumn(nextColumn) {
    if (status === 'processing' || isCancellingExperiment) return;
    setTargetColumnState(nextColumn);
    setIdleRunVisuals();
  }

  async function uploadDataset(file) {
    if (!file) return;

    clearRunLifecycle();
    setTrainingProgress([]);
    setLiveTrainingMeta(getEmptyLiveTrainingMeta());
    setStatus('idle');
    setIsUploading(true);
    setError('');

    try {
      const uploaded = await uploadDatasetApi(file);
      await refreshDatasets({ preserveSelection: false });
      await hydrateDatasetSelection(uploaded.dataset_id, {
        preferredProblemType: problemType,
        switchView: true,
        preserveTarget: false,
      });
    } catch (err) {
      setError(err.message || 'Could not upload dataset.');
    } finally {
      setIsUploading(false);
    }
  }

  async function deleteDataset(datasetToDeleteId) {
    if (!datasetToDeleteId) return;
    if (!window.confirm('Delete this dataset and all associated experiments/results? This action cannot be undone.')) {
      return;
    }

    setIsDeletingDataset(true);
    setError('');

    try {
      await deleteDatasetApi(datasetToDeleteId);
      const datasets = await refreshDatasets({ preserveSelection: false });

      if (datasetId === datasetToDeleteId) {
        if (datasets.length) {
          await hydrateDatasetSelection(datasets[0].id, {
            preferredProblemType: problemType,
            switchView: activeView === 'dashboard',
            preserveTarget: false,
          });
        } else {
          clearSelectedDataset();
          setActiveView('datasets');
        }
      }

      if (datasetDetailId === datasetToDeleteId) {
        setDatasetDetailId('');
        setActiveView('datasets');
      }
    } catch (err) {
      setError(err.message || 'Could not delete dataset.');
    } finally {
      setIsDeletingDataset(false);
    }
  }

  function resetExperiment() {
    clearRunLifecycle();
    setIdleRunVisuals();
    setError('');
  }

  async function loadResults(mode = rankingMode, explicitExperimentId = experimentId) {
    if (!explicitExperimentId) return [];

    const response = await fetchExperimentResults(explicitExperimentId, mode);
    const mappedResults = mapApiResultsToUiResults(response, mode);
    const nextRankingMeta = mapApiResultsMetadata(response, mode);

    setDiagnosticsByModel((current) => {
      const next = { ...current };
      mappedResults.forEach((item) => {
        const embedded = item.embeddedDiagnostics;
        if (!embedded) return;
        const cacheKey = `${explicitExperimentId}:${item.id}:${embedded.selectedValidationParam || '__default__'}`;
        const defaultKey = `${explicitExperimentId}:${item.id}:__default__`;
        next[cacheKey] = { ...embedded, experimentId: explicitExperimentId, modelId: item.id };
        if (!next[defaultKey]) next[defaultKey] = next[cacheKey];
      });
      diagnosticsCacheRef.current = next;
      return next;
    });

    const uiResults = mappedResults.map((item) => {
      const fallbackDiagnostics = item.embeddedDiagnostics || null;
      const cachedDiagnostics =
        getCachedDiagnosticsForModel(
          diagnosticsCacheRef.current,
          explicitExperimentId,
          item.id,
        ) || fallbackDiagnostics;
      if (cachedDiagnostics?.rocCurve?.auc == null) return item;
      return {
        ...item,
        metrics: {
          ...item.metrics,
          'ROC AUC': cachedDiagnostics.rocCurve.auc,
        },
      };
    });

    setResults(uiResults);
    setRankingMeta(nextRankingMeta);
    setRankingModeState(mode);
    return uiResults;
  }

  // Diagnostics loading is cached per experiment/model/validation parameter.
  const loadDiagnostics = useCallback(async (
    modelId,
    validationParam = null,
    explicitExperimentId = experimentId,
    options = {},
  ) => {
    const targetExperimentId = explicitExperimentId || experimentId;
    if (!targetExperimentId || !modelId) return null;

    const {
      forceRefresh = false,
      requireComplete = false,
      expectedProblemType = problemType,
    } = options;

    const cacheKey = `${targetExperimentId}:${modelId}:${validationParam || '__default__'}`;
    const cache = diagnosticsCacheRef.current;
    const cached = cache[cacheKey];
    const cacheSatisfiesRequest = cached && (!requireComplete ? isDiagnosticsDashboardReady(cached, expectedProblemType) : isDiagnosticsFullyReady(cached, expectedProblemType));

    if (!forceRefresh && cacheSatisfiesRequest) {
      if (cached?.rocCurve?.auc != null) {
        setResults((current) => injectRocAucIntoResults(current, modelId, cached));
      }
      return cached;
    }

    if (diagnosticsInFlightRef.current[cacheKey]) {
      return diagnosticsInFlightRef.current[cacheKey];
    }

    const requestPromise = (async () => {
      try {
        const response = await fetchModelDiagnostics(targetExperimentId, modelId, {
          validationParam,
          scope: requireComplete ? 'full' : 'minimal',
        });
        const mapped = mapDiagnostics(response);

        setDiagnosticsByModel((current) => {
          const next = { ...current, [cacheKey]: mapped };
          diagnosticsCacheRef.current = next;
          return next;
        });

        if (mapped?.rocCurve?.auc != null) {
          setResults((current) => injectRocAucIntoResults(current, modelId, mapped));
        }

        return mapped;
      } catch (err) {
        setError(err.message || 'Could not load model diagnostics.');
        return null;
      } finally {
        delete diagnosticsInFlightRef.current[cacheKey];
      }
    })();

    diagnosticsInFlightRef.current[cacheKey] = requestPromise;
    return requestPromise;
  }, [experimentId, problemType]);


  // The dashboard only closes the live training state once the winner diagnostics exist.
  const ensureDashboardHydrated = useCallback(async (
    resultList,
    explicitExperimentId = experimentId,
  ) => {
    const targetExperimentId = explicitExperimentId || experimentId;
    const bestResult = Array.isArray(resultList) ? resultList[0] : null;
    if (!bestResult || !targetExperimentId) return null;

    const attempts = 3;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      const diagnostics = await loadDiagnostics(bestResult.id, null, targetExperimentId, {
        forceRefresh: attempt > 1,
        requireComplete: false,
        expectedProblemType: problemType,
      });

      if (isDiagnosticsDashboardReady(diagnostics, problemType)) {
        return diagnostics;
      }

      if (attempt < attempts) {
        if (cancelRequestedRef.current || activeRunExperimentRef.current !== targetExperimentId) {
          throw new Error('__experiment_cancelled__');
        }

        setLiveTrainingMeta((current) => ({
          ...current,
          progress: Math.max(current.progress || 0, 99),
          liveStep: 'dashboard_loading',
          liveMessage: `Training finished. Preparing winner diagnostics (${attempt}/${attempts})...`,
        }));
        await delay(350);
      }
    }

    throw new Error('Training finished, but the winner diagnostics could not be prepared.');
  }, [experimentId, loadDiagnostics, problemType]);

  async function setRankingMode(mode) {
    if (mode === rankingMode) return;

    setError('');
    setRankingModeState(mode);
    setResults((current) => sortUiResultsByRankingMode(current, mode));

    if (!experimentId) return;

    try {
      const uiResults = await loadResults(mode, experimentId);
    } catch (err) {
      setError(err.message || 'Could not switch ranking mode.');
    }
  }

  async function loadExperimentById(nextExperimentId, { mode = rankingMode || DEFAULT_RANKING_MODE, switchView = true } = {}) {
    if (!nextExperimentId) return;

    clearRunLifecycle();
    setError('');

    try {
      const experiment = mapApiExperiment(await fetchExperiment(nextExperimentId));
      await hydrateDatasetSelection(experiment.datasetId, {
        preferredProblemType: experiment.problemType,
        switchView: false,
      });

      setExperimentId(experiment.experimentId);
      setTargetColumnState(experiment.targetColumn);
      const availableModelIds = new Set(models.map((item) => item.id));
      const validExperimentModels = experiment.selectedModels.filter((modelId) => availableModelIds.has(modelId));
      setSelectedModels(validExperimentModels.length ? validExperimentModels : experiment.selectedModels);
      setStatus(experiment.status || 'done');
      setTrainingProgress([]);
      const stableStartedAt = experiment.startedAt || runStartedAtRef.current || null;
      runStartedAtRef.current = stableStartedAt;
      const persistedStartedAtMs = persistTrainingStartedAt(experiment.experimentId, stableStartedAt);
      setLiveTimerStartMs(persistedStartedAtMs);

      setLiveTrainingMeta({
        progress: experiment.progress ?? 0,
        liveStep: experiment.liveStep || null,
        liveMessage: experiment.liveMessage || '',
        startedAt: stableStartedAt,
      });
      setRankingModeState(mode);

      await loadResults(mode, experiment.experimentId);

      if (switchView) setActiveView('dashboard');
    } catch (err) {
      setError(err.message || 'Could not load experiment.');
    }
  }

  // Experiment lifecycle actions.
  async function runComparison() {
    if (isCancellingExperiment) {
      setError('Wait for the current cancellation to finish before starting a new experiment.');
      return;
    }
    if (!datasetId) {
      setError('Choose a dataset first.');
      return;
    }
    if (!targetColumn) {
      setError('Select a target column.');
      return;
    }
    if (selectedModels.length < 2) {
      setError('Select at least 2 models.');
      return;
    }

    const validModelIds = new Set(models.map((item) => item.id));
    const invalidSelection = selectedModels.filter((id) => !validModelIds.has(id));
    if (invalidSelection.length) {
      setError('Your selected models are out of sync. Please reselect the models for this experiment.');
      setSelectedModels(models.slice(0, Math.min(3, models.length)).map((item) => item.id));
      setStatus('idle');
      return;
    }

    clearRunLifecycle();
    cancelRequestedRef.current = false;
    setCancelOverlayPhase('idle');
    setError('');
    setStatus('processing');
    setDiagnosticsByModel({});
    setResults([]);
    setRankingMeta({
      rankingMode: DEFAULT_RANKING_MODE,
      rankingProvider: null,
      rankingStatus: null,
      rankingError: null,
      isOckhamFallback: false,
    });

    const localStartedAt = new Date().toISOString();
    runStartedAtRef.current = localStartedAt;
    const localStartedAtMs = persistTrainingStartedAt(experimentId || activeRunExperimentRef.current, localStartedAt) || Date.now();
    setLiveTimerStartMs(localStartedAtMs);
    const selectedModelsSnapshot = [...selectedModels];
    const modelMetaById = Object.fromEntries(models.map((item) => [item.id, item]));

    try {
      const experiment = mapApiExperiment(await runExperimentDirect({
        dataset_id: datasetId,
        problem_type: problemType,
        target_column: targetColumn,
        selected_models: selectedModelsSnapshot,
      }));

      const pollSequence = pollSequenceRef.current + 1;
      pollSequenceRef.current = pollSequence;
      activeRunExperimentRef.current = experiment.experimentId;
      setExperimentId(experiment.experimentId);
      setActiveView('dashboard');
      setTrainingProgress(buildUiTrainingState(experiment.trainingState, selectedModelsSnapshot, modelMetaById));
      const stableStartedAt = experiment.startedAt || runStartedAtRef.current || localStartedAt;
      runStartedAtRef.current = stableStartedAt;
      const stableStartedAtMs = persistTrainingStartedAt(experiment.experimentId, stableStartedAt) || localStartedAtMs;
      setLiveTimerStartMs((currentValue) => (currentValue ? Math.min(currentValue, stableStartedAtMs) : stableStartedAtMs));

      setLiveTrainingMeta({
        progress: experiment.progress ?? 0,
        liveStep: experiment.liveStep || null,
        liveMessage: experiment.liveMessage || 'Preparing experiment and waiting to start workers.',
        startedAt: stableStartedAt,
      });

      let attempts = 0;
      while (pollSequenceRef.current === pollSequence && activeRunExperimentRef.current === experiment.experimentId) {
        attempts += 1;

        const latest = mapApiExperiment(await fetchExperiment(experiment.experimentId));
        if (pollSequenceRef.current !== pollSequence || activeRunExperimentRef.current !== experiment.experimentId) {
          throw new Error('Experiment tracking was interrupted.');
        }

        setStatus(latest.status === 'failed' ? 'failed' : 'processing');
        setTrainingProgress(buildUiTrainingState(latest.trainingState, selectedModelsSnapshot, modelMetaById));
        setLiveTrainingMeta((current) => {
          const stableStartedAt = current.startedAt || runStartedAtRef.current || latest.startedAt || experiment.startedAt || localStartedAt;
          runStartedAtRef.current = stableStartedAt;
          const stableStartedAtMs = persistTrainingStartedAt(experiment.experimentId, stableStartedAt) || localStartedAtMs;
          setLiveTimerStartMs((currentValue) => (currentValue ? Math.min(currentValue, stableStartedAtMs) : stableStartedAtMs));

          return {
            progress: latest.progress ?? 0,
            liveStep: latest.liveStep || null,
            liveMessage: latest.liveMessage || '',
            startedAt: stableStartedAt,
          };
        });

        if (latest.status === 'done') break;
        if (latest.status === 'cancel_requested' || latest.status === 'cancelled') throw new Error('__experiment_cancelled__');
        if (latest.status === 'failed') throw new Error(latest.liveMessage || 'Experiment failed during execution.');
        await delay(getExperimentPollingDelayMs(attempts));
      }

      setLiveTrainingMeta((current) => ({
        ...current,
        progress: Math.max(current.progress || 0, 97),
        liveStep: 'llm_judging',
        liveMessage: 'Training finished. Sending benchmark evidence to Ockham AI for the final judgment.',
      }));

      const uiResults = await loadResults(DEFAULT_RANKING_MODE, experiment.experimentId);
      if (cancelRequestedRef.current || activeRunExperimentRef.current !== experiment.experimentId) {
        throw new Error('__experiment_cancelled__');
      }
      await delay(Math.min(5800, 2600 + uiResults.length * 520));
      if (cancelRequestedRef.current || activeRunExperimentRef.current !== experiment.experimentId) {
        throw new Error('__experiment_cancelled__');
      }

      setLiveTrainingMeta((current) => ({
        ...current,
        progress: Math.max(current.progress || 0, 99),
        liveStep: 'dashboard_loading',
        liveMessage: 'AI judgment completed. Preparing winner diagnostics and populating the dashboard.',
      }));

      await ensureDashboardHydrated(uiResults, experiment.experimentId);
      if (cancelRequestedRef.current || activeRunExperimentRef.current !== experiment.experimentId) {
        throw new Error('__experiment_cancelled__');
      }

      setStatus('done');
      setLiveTrainingMeta((current) => ({
        ...current,
        progress: 100,
        liveStep: 'completed',
        liveMessage: 'Dashboard loaded. Ranked results and diagnostics are ready.',
      }));

      refreshDatasets().catch(() => {});
      refreshExperiments(datasetId).catch(() => {});

      trainingClearTimeoutRef.current = window.setTimeout(() => {
        if (activeRunExperimentRef.current === experiment.experimentId) {
          setTrainingProgress([]);
        }
        trainingClearTimeoutRef.current = null;
      }, 1200);
    } catch (err) {
      clearRunLifecycle();

      if (cancelRequestedRef.current || err.message === '__experiment_cancelled__' || err.message === 'Experiment tracking was interrupted.') {
        setError('');
        return;
      }

      setTrainingProgress([]);
      setLiveTrainingMeta(getEmptyLiveTrainingMeta());
      setStatus('idle');
      setError(err.message || 'Could not run experiment.');
    }
  }

  async function cancelLiveTraining() {
    if (status !== 'processing' || isCancellingExperiment) return;

    const shouldCancel = window.confirm('Cancel this experiment? Ockham will stop the active workers before allowing a new run.');
    if (!shouldCancel) return;

    const targetExperimentId = experimentId;
    const currentLiveStep = liveTrainingMeta?.liveStep;
    const shouldAbortBackend = targetExperimentId && !['llm_judging', 'dashboard_loading', 'completed'].includes(currentLiveStep);

    setError('');
    cancelRequestedRef.current = true;
    setIsCancellingExperiment(true);
    setCancelOverlayPhase('pending');
    setLiveTrainingMeta((current) => ({
      ...current,
      progress: Math.max(current.progress || 0, 97),
      liveMessage: shouldAbortBackend
        ? 'Stopping active workers and waiting for the backend to confirm the cancellation.'
        : 'Stopping the current run and clearing the final transition.',
    }));

    try {
      if (shouldAbortBackend) {
        await abortExperimentApi(targetExperimentId);
        await waitForExperimentToStop(targetExperimentId);
      } else {
        await delay(650);
      }

      setCancelOverlayPhase('confirmed');
      setLiveTrainingMeta((current) => ({
        ...current,
        progress: 100,
        liveMessage: 'Cancellation confirmed. Ockham has stopped the active run and cleared the current session.',
      }));
      await delay(650);

      resetProcessingView();
      cancelRequestedRef.current = false;
      refreshDatasets().catch(() => {});
      refreshExperiments(datasetId).catch(() => {});
    } catch (err) {
      cancelRequestedRef.current = false;
      setCancelOverlayPhase('idle');
      setError(err.message || 'Could not cancel experiment.');
    } finally {
      setIsCancellingExperiment(false);
    }
  }

  async function deleteExperiment(experimentToDeleteId) {
    if (!experimentToDeleteId) return;
    if (!window.confirm('Delete this experiment? This action cannot be undone.')) {
      return;
    }

    setError('');

    try {
      await deleteExperimentApi(experimentToDeleteId);
      await refreshDatasets();
      await refreshExperiments(datasetDetailId || datasetId);

      if (experimentId === experimentToDeleteId) {
        clearRunLifecycle();
        setIdleRunVisuals();
        if (activeView === 'dashboard' && datasetId) {
          setActiveView('dataset-detail');
          setDatasetDetailId(datasetId);
        }
      }
    } catch (err) {
      setError(err.message || 'Could not delete experiment.');
    }
  }

  function openDatasetDetail(nextDatasetId) {
    setDatasetDetailId(nextDatasetId);
    setActiveView('dataset-detail');
    refreshExperiments(nextDatasetId).catch(() => {});
  }

  function closeDatasetDetail() {
    setDatasetDetailId('');
    setActiveView('datasets');
  }


  async function openPreprocessing(nextDatasetId = datasetId || datasetDetailId) {
    if (!nextDatasetId) {
      setActiveView('datasets');
      return;
    }

    setPreprocessingDatasetId(nextDatasetId);
    setDatasetDetailId(nextDatasetId);
    setActiveView('preprocessing');

    if (nextDatasetId !== datasetId || !datasetColumns.length) {
      await hydrateDatasetSelection(nextDatasetId, {
        preferredProblemType: problemType,
        switchView: false,
        preserveTarget: true,
      });
      setActiveView('preprocessing');
      setDatasetDetailId(nextDatasetId);
      setPreprocessingDatasetId(nextDatasetId);
    }
  }

  async function openDatasetFromLibrary(nextDatasetId) {
    await hydrateDatasetSelection(nextDatasetId, {
      preferredProblemType: problemType,
      switchView: true,
      preserveTarget: true,
    });
    setDatasetDetailId('');
  }

  const value = {
    // Navigation and workspace state.
    activeView,
    setActiveView,
    problemType,
    setProblemType,
    models,
    selectedModels,
    toggleModel,
    selectAllModels,
    clearModels,
    datasetId,
    datasetName,
    datasetColumns,
    targetColumn,
    setTargetColumn,
    uploadDataset,
    deleteDataset,
    deleteExperiment,
    openDatasetDetail,
    closeDatasetDetail,
    openPreprocessing,
    openDatasetFromLibrary,
    datasetDetailId,
    preprocessingDatasetId,
    runComparison,
    cancelLiveTraining,
    resetExperiment,
    status,
    trainingProgress,
    liveTrainingMeta,
    liveElapsedMs,
    liveTimerStartMs,
    results,
    charts,
    primaryMetric,
    experimentId,
    rankingMode,
    rankingMeta,
    setRankingMode,
    diagnosticsByModel,
    loadDiagnostics,
    loadResults,
    loadExperimentById,
    uploadedDatasets,
    experimentsForSelectedDataset,
    hydrateDatasetSelection,
    refreshDatasets,
    refreshExperiments,
    isUploading,
    isHydratingDataset,
    isDatasetsLoading,
    isExperimentsLoading,
    isDeletingDataset,
    isCancellingExperiment,
    cancelOverlayPhase,
    error,
  };

  return value;
}

