import {
  CHART_COLORS,
  clamp,
  getMetricValue,
  getResidualHeatColor,
  normalizeRelativeTime,
  shortenCapabilityLabel,
  toPercent,
} from '@/features/ranking/support/chartConstants';

export function buildCapabilityProfile(best, allResults, problemType, rankingMode) {
  if (!best) return [];

  if (Array.isArray(best.capabilityProfile?.radar_axes) && best.capabilityProfile.radar_axes.length) {
    return best.capabilityProfile.radar_axes.map((axis) => ({
      subject: shortenCapabilityLabel(axis.subject),
      value: axis.value,
    }));
  }

  if (rankingMode === 'ockham' && best.ockham_components) {
    const c = best.ockham_components;
    return [
      { subject: 'Predictive', value: toPercent(c.performance ?? 0) },
      { subject: 'Generaliz.', value: toPercent((c.stability ?? 0.5) * 0.65 + (c.performance ?? 0) * 0.35) },
      { subject: 'Stability', value: toPercent(c.stability ?? 0) },
      { subject: 'Parsimony', value: toPercent(c.parsimony ?? 0) },
      { subject: 'Interpret.', value: toPercent(((best.structural_scores?.interpretability_score ?? 3) - 1) / 4) },
      { subject: 'Operational', value: toPercent(c.operational_efficiency ?? ((c.training_efficiency ?? 0) + (c.inference_efficiency ?? 0)) / 2) },
    ];
  }

  const stabilityStd = best.metricsStd?.[best.primaryMetricLabel] ?? 0.02;
  const stability = clamp(100 - (stabilityStd / (problemType === 'classification' ? 0.05 : 0.10)) * 100, 0, 100);
  const fitEfficiency = normalizeRelativeTime(allResults, 'fit_time_mean')(best.fit_time_mean);
  const inferEfficiency = normalizeRelativeTime(allResults, 'inference_time_per_1000_rows')(best.inference_time_per_1000_rows);
  const efficiency = (fitEfficiency + inferEfficiency) / 2;

  return [
    { subject: best.primaryMetricLabel || 'Primary', value: toPercent(getMetricValue(best, best.primaryMetricLabel)) },
    { subject: 'Stability', value: Number(stability.toFixed(1)) },
    { subject: 'Feature Use', value: toPercent(best.feature_stats?.used_feature_ratio ?? 0.5) },
    { subject: 'Interpret.', value: toPercent(((best.structural_scores?.interpretability_score ?? 3) - 1) / 4) },
    { subject: 'Simplicity', value: toPercent((best.structural_scores?.simplicity_score ?? 3) / 5) },
    { subject: 'Operational', value: Number(efficiency.toFixed(1)) },
  ];
}

export function buildCrossValidationData(results, diagnosticsMap) {
  const series = results.filter((item) => {
    const metricKey = item.primaryMetric || diagnosticsMap[item.id]?.primaryMetric;
    const foldScores = item.cvFoldScores?.[metricKey] || diagnosticsMap[item.id]?.cvFoldScores?.[metricKey];
    return Array.isArray(foldScores) && foldScores.length;
  });

  if (!series.length) return [];

  const foldCount = Math.max(
    ...series.map((item) => {
      const metricKey = item.primaryMetric || diagnosticsMap[item.id]?.primaryMetric;
      const foldScores = item.cvFoldScores?.[metricKey] || diagnosticsMap[item.id]?.cvFoldScores?.[metricKey];
      return foldScores?.length || 0;
    }),
  );
  if (!foldCount) return [];

  return Array.from({ length: foldCount }, (_, index) => {
    const row = { fold: `Fold ${index + 1}` };
    series.forEach((item) => {
      const metricKey = item.primaryMetric || diagnosticsMap[item.id]?.primaryMetric;
      const foldScores = item.cvFoldScores?.[metricKey] || diagnosticsMap[item.id]?.cvFoldScores?.[metricKey];
      const value = foldScores?.[index];
      if (value != null) row[item.name] = Number(value.toFixed(3));
    });
    return row;
  });
}

export function buildLearningData(diagnostics) {
  const curve = diagnostics?.learningCurve;
  if (!curve) return [];
  return curve.train_sizes.map((size, index) => ({
    size,
    Train: curve.train_scores_mean[index],
    Validation: curve.validation_scores_mean[index],
  }));
}

export function buildValidationData(diagnostics) {
  const curve = diagnostics?.validationCurve;
  if (!curve) return [];
  return curve.param_values.map((value, index) => ({
    param: String(value),
    Train: curve.train_scores_mean[index],
    Validation: curve.validation_scores_mean[index],
  }));
}

function interpolateRoc(curve, steps = 21) {
  const grid = Array.from({ length: steps }, (_, idx) => idx / (steps - 1));
  const fpr = curve?.fpr || [];
  const tpr = curve?.tpr || [];
  if (!fpr.length || !tpr.length) return { grid, values: [] };

  const values = grid.map((x) => {
    if (x <= fpr[0]) return tpr[0];
    if (x >= fpr[fpr.length - 1]) return tpr[tpr.length - 1];
    for (let i = 1; i < fpr.length; i += 1) {
      if (x <= fpr[i]) {
        const x0 = fpr[i - 1];
        const x1 = fpr[i];
        const y0 = tpr[i - 1];
        const y1 = tpr[i];
        const ratio = x1 === x0 ? 0 : (x - x0) / (x1 - x0);
        return y0 + ratio * (y1 - y0);
      }
    }
    return 1;
  });

  return { grid, values };
}

export function buildRocData(results, diagnosticsMap) {
  const top = results.slice(0, 3).filter((item) => diagnosticsMap[item.id]?.rocCurve);
  if (!top.length) return [];
  const { grid } = interpolateRoc(diagnosticsMap[top[0].id].rocCurve);
  return grid.map((fpr, index) => {
    const row = { fpr: Number(fpr.toFixed(2)), baseline: Number(fpr.toFixed(2)) };
    top.forEach((item) => {
      const interp = interpolateRoc(diagnosticsMap[item.id].rocCurve);
      row[item.name] = Number((interp.values[index] ?? 0).toFixed(3));
    });
    return row;
  });
}

// Pair normalization lives here so chart components can stay focused on presentation.
export function normalizeActualVsPredictedPairs(diagnostics) {
  const actual = Array.isArray(diagnostics?.actualVsPredicted?.actual)
    ? diagnostics.actualVsPredicted.actual
    : [];
  const predicted = Array.isArray(diagnostics?.actualVsPredicted?.predicted)
    ? diagnostics.actualVsPredicted.predicted
    : [];

  if (!actual.length || !predicted.length) return [];

  const size = Math.min(actual.length, predicted.length);
  const pairs = [];
  for (let index = 0; index < size; index += 1) {
    const actualValue = Number(actual[index]);
    const predictedValue = Number(predicted[index]);
    if (Number.isNaN(actualValue) || Number.isNaN(predictedValue)) continue;
    pairs.push({
      sample: index + 1,
      actual: actualValue,
      predicted: predictedValue,
      residual: actualValue - predictedValue,
    });
  }
  return pairs;
}

export function buildPredictedCurveData(diagnostics) {
  return normalizeActualVsPredictedPairs(diagnostics);
}

// Aggregate dense series before they reach the chart so the visual stays readable.
export function buildAggregatedPredictedSampleData(diagnostics, targetBuckets = 48) {
  const pairs = normalizeActualVsPredictedPairs(diagnostics);
  if (!pairs.length) return [];

  const bucketSize = Math.max(1, Math.ceil(pairs.length / targetBuckets));
  const aggregated = [];

  for (let index = 0; index < pairs.length; index += bucketSize) {
    const bucket = pairs.slice(index, index + bucketSize);
    if (!bucket.length) continue;

    const startSample = bucket[0].sample;
    const endSample = bucket[bucket.length - 1].sample;

    const actualValues = bucket.map((item) => item.actual);
    const predictedValues = bucket.map((item) => item.predicted);

    const actualMean = actualValues.reduce((sum, value) => sum + value, 0) / actualValues.length;
    const predictedMean = predictedValues.reduce((sum, value) => sum + value, 0) / predictedValues.length;

    const actualMin = Math.min(...actualValues);
    const actualMax = Math.max(...actualValues);

    aggregated.push({
      bucketLabel: startSample === endSample ? `${startSample}` : `${startSample}-${endSample}`,
      sampleStart: startSample,
      sampleEnd: endSample,
      actual: Number(actualMean.toFixed(3)),
      predicted: Number(predictedMean.toFixed(3)),
      actualMin: Number(actualMin.toFixed(3)),
      actualMax: Number(actualMax.toFixed(3)),
      rangeBase: Number(actualMin.toFixed(3)),
      rangeSpan: Number((actualMax - actualMin).toFixed(3)),
      pointCount: bucket.length,
    });
  }

  return aggregated;
}

export function buildPredictedScatterData(diagnostics) {
  const pairs = normalizeActualVsPredictedPairs(diagnostics);
  const maxResidualMagnitude = pairs.length
    ? Math.max(...pairs.map((item) => Math.abs(item.residual)), 1e-6)
    : 1e-6;

  const points = pairs.map((item) => {
    const residualMagnitude = Math.abs(item.residual);
    const idealDistance = residualMagnitude / Math.sqrt(2);
    const residualRatio = residualMagnitude / maxResidualMagnitude;

    return {
      sample: item.sample,
      actual: item.actual,
      predicted: item.predicted,
      residual: item.residual,
      idealDistance,
      residualMagnitude,
      color: getResidualHeatColor(residualRatio),
    };
  });

  if (!points.length) return { points: [], domain: [0, 1] };

  const values = points
    .flatMap((item) => [item.actual, item.predicted])
    .filter((v) => typeof v === 'number' && !Number.isNaN(v));

  const min = Math.min(...values);
  const max = Math.max(...values);
  const padding = min === max ? Math.max(1, Math.abs(min) * 0.05 || 1) : (max - min) * 0.05;

  return {
    points,
    domain: [Number((min - padding).toFixed(6)), Number((max + padding).toFixed(6))],
  };
}

// Confusion-matrix derived stats are reused by both the table and chart views.
export function deriveConfusionStats(labels, matrixValues) {
  return labels.map((label, rowIndex) => {
    const truePositive = matrixValues[rowIndex][rowIndex] || 0;
    const rowTotal = matrixValues[rowIndex].reduce((sum, value) => sum + value, 0);
    const columnTotal = matrixValues.reduce((sum, row) => sum + (row[rowIndex] || 0), 0);
    const precision = columnTotal > 0 ? truePositive / columnTotal : 0;
    const recall = rowTotal > 0 ? truePositive / rowTotal : 0;
    const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

    return {
      label,
      support: rowTotal,
      precision,
      recall,
      f1,
    };
  });
}
