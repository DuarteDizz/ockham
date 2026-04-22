import React, { useEffect, useMemo, useState } from 'react';

import {
  Area,
  Brush,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Activity, Binary, Radar as RadarIcon, Waves } from 'lucide-react';

import { ConfusionMatrixPanel } from '@/features/ranking/components/ConfusionMatrixPanel';
import {
  AggregatedPredictedSampleTooltip,
  ChartLegend,
  CustomTooltip,
  Panel,
  Placeholder,
  RegressionScatterTooltip,
} from '@/features/ranking/components/ComparisonChartShared';
import {
  buildAggregatedPredictedSampleData,
  buildCapabilityProfile,
  buildCrossValidationData,
  buildLearningData,
  buildPredictedCurveData,
  buildPredictedScatterData,
  buildRocData,
  buildValidationData,
} from '@/features/ranking/support/comparisonData';
import {
  CHART_COLORS,
  compactModelName,
  shortenAxisLabel,
} from '@/features/ranking/support/chartConstants';
import useOckhamStore from '@/features/workspace/state/WorkspaceContext';

export default function ComparisonChart({ results, problemType, rankingMode = 'ockham' }) {
  const { diagnosticsByModel, loadDiagnostics, experimentId } = useOckhamStore();
  const [selectedValidationParam, setSelectedValidationParam] = useState('');
  const [predictedViewMode, setPredictedViewMode] = useState('actual-vs-predicted');

  const hasResults = Array.isArray(results) && results.length > 0;
  const topResults = hasResults ? results.slice(0, 5) : [];
  const best = hasResults ? results[0] : null;

  useEffect(() => {
    if (!experimentId || !best?.id) return;
    loadDiagnostics(best.id, null, experimentId, {
      requireComplete: false,
      expectedProblemType: problemType,
    });
  }, [experimentId, best?.id, loadDiagnostics, problemType]);

  const diagnosticsMap = useMemo(() => {
    if (!topResults.length) return {};
    return Object.fromEntries(
      topResults.map((item) => {
        const key = experimentId ? `${experimentId}:${item.id}:__default__` : item.id;
        return [item.id, diagnosticsByModel[key] || item.embeddedDiagnostics || null];
      }),
    );
  }, [topResults, experimentId, diagnosticsByModel]);

  const defaultBestDiagnostics = best ? (diagnosticsMap[best.id] || best.embeddedDiagnostics || null) : null;
  const effectiveValidationParam = selectedValidationParam || defaultBestDiagnostics?.selectedValidationParam || '';
  const bestDiagnosticsKey = best && experimentId ? `${experimentId}:${best.id}:${effectiveValidationParam || '__default__'}` : '';
  const bestDiagnostics = bestDiagnosticsKey ? (diagnosticsByModel[bestDiagnosticsKey] || defaultBestDiagnostics) : null;

  useEffect(() => {
    setSelectedValidationParam('');
    setPredictedViewMode('actual-vs-predicted');
  }, [best?.id]);

  useEffect(() => {
    const next = defaultBestDiagnostics?.selectedValidationParam || '';
    if (next && !selectedValidationParam) setSelectedValidationParam(next);
  }, [defaultBestDiagnostics, selectedValidationParam]);

  useEffect(() => {
    if (!experimentId || !best?.id || !effectiveValidationParam) return;
    loadDiagnostics(best.id, effectiveValidationParam, experimentId, {
      requireComplete: true,
      expectedProblemType: problemType,
    });
  }, [experimentId, best?.id, effectiveValidationParam, loadDiagnostics, problemType]);

  const capabilityData = useMemo(
    () => (best ? buildCapabilityProfile(best, results, problemType, rankingMode) : []),
    [best, results, problemType, rankingMode],
  );

  const crossValidationData = useMemo(
    () => buildCrossValidationData(results, diagnosticsMap),
    [results, diagnosticsMap],
  );

  const crossValidationSeries = useMemo(
    () => topResults.filter((item) => crossValidationData.some((row) => row[item.name] != null)),
    [topResults, crossValidationData],
  );

  const learningData = useMemo(() => buildLearningData(bestDiagnostics), [bestDiagnostics]);
  const validationData = useMemo(() => buildValidationData(bestDiagnostics), [bestDiagnostics]);
  const rocData = useMemo(() => buildRocData(topResults, diagnosticsMap), [topResults, diagnosticsMap]);
  const predictedCurveData = useMemo(() => buildPredictedCurveData(bestDiagnostics), [bestDiagnostics]);
  const aggregatedPredictedSampleData = useMemo(
    () => buildAggregatedPredictedSampleData(bestDiagnostics),
    [bestDiagnostics],
  );
  const predictedScatter = useMemo(() => buildPredictedScatterData(bestDiagnostics), [bestDiagnostics]);

  const crossValidationLegend = crossValidationSeries.map((model) => ({
    key: model.id,
    label: compactModelName(model.name),
    title: model.name,
    color: model.accent || '#4361EE',
  }));

  const learningLegend = [
    { key: 'train', label: 'Training', color: CHART_COLORS.primary },
    { key: 'validation', label: 'Validation', color: CHART_COLORS.amber },
  ];

  const validationLegend = [
    { key: 'train', label: 'Training', color: CHART_COLORS.primary },
    { key: 'validation', label: 'Validation', color: CHART_COLORS.amber },
  ];

  const rocLegend = [
    { key: 'baseline', label: 'Baseline', color: CHART_COLORS.slate },
    ...topResults
      .filter((model) => diagnosticsMap[model.id]?.rocCurve)
      .slice(0, 3)
      .map((model) => ({
        key: model.id,
        label: compactModelName(model.name),
        title: model.name,
        color: model.accent || '#4361EE',
      })),
  ];

  const regressionLegend = predictedViewMode === 'actual-vs-predicted'
    ? [
        { key: 'ideal', label: 'Ideal fit', color: CHART_COLORS.slate },
        { key: 'points', label: 'Samples', color: CHART_COLORS.primaryMuted },
      ]
    : [
        { key: 'range', label: 'Actual range', color: CHART_COLORS.slateSoft },
        { key: 'actual', label: 'Actual mean', color: CHART_COLORS.primaryMuted },
        { key: 'predicted', label: 'Predicted', color: CHART_COLORS.cyan },
      ];

  if (!hasResults) return null;

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Panel
        title="Capability Profile"
        subtitle={rankingMode === 'ockham'
          ? 'Compact snapshot of why the winner is viable in Ockham mode.'
          : 'Compact snapshot of the selected winner across key decision signals.'}
        icon={RadarIcon}
      >
        <div className="h-[300px] md:h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={capabilityData} outerRadius="66%">
              <defs>
                <linearGradient id="capabilityRadarGradient" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor={CHART_COLORS.cyan} stopOpacity={0.26} />
                  <stop offset="55%" stopColor={CHART_COLORS.primaryMuted} stopOpacity={0.16} />
                  <stop offset="100%" stopColor={CHART_COLORS.primary} stopOpacity={0.08} />
                </linearGradient>
              </defs>
              <PolarGrid stroke="rgba(220,231,238,0.95)" />
              <PolarAngleAxis
                dataKey="subject"
                tick={{ fill: CHART_COLORS.axisSecondary, fontSize: 11 }}
              />
              <PolarRadiusAxis
                tick={{ fill: CHART_COLORS.axis, fontSize: 10 }}
                domain={[0, 100]}
              />
              <Tooltip
                formatter={(value) => [`${Number(value).toFixed(1)} / 100`, 'Capability score']}
                content={<CustomTooltip />}
              />
              <Radar
                name="Capability score"
                dataKey="value"
                stroke={CHART_COLORS.primary}
                fill="url(#capabilityRadarGradient)"
                fillOpacity={1}
                strokeWidth={2.4}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <Panel
        title="Cross-validation Stability"
        subtitle="Top models remain stable across folds, which supports reliable model selection."
        icon={Activity}
      >
        {crossValidationData.length ? (
          <>
            <ChartLegend items={crossValidationLegend} />
            <div className="h-[340px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={crossValidationData} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
                  <XAxis
                    dataKey="fold"
                    stroke={CHART_COLORS.axis}
                    tick={{ fontSize: 11 }}
                    minTickGap={20}
                  />
                  <YAxis
                    stroke={CHART_COLORS.axis}
                    tick={{ fontSize: 11 }}
                    width={44}
                    domain={['auto', 'auto']}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  {crossValidationSeries.map((model) => (
                    <Line
                      key={model.id}
                      type="monotone"
                      dataKey={model.name}
                      stroke={model.accent || '#4361EE'}
                      strokeWidth={2.4}
                      dot={{ r: 3 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </>
        ) : (
          <Placeholder text="Cross-validation fold scores unavailable for the leading models." />
        )}
      </Panel>

      <Panel
        title="Learning Curve"
        subtitle="Training and cross-validation score should converge as the sample size grows."
        icon={Waves}
      >
        {learningData.length ? (
          <>
            <ChartLegend items={learningLegend} />
            <div className="h-[340px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={learningData} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
                  <XAxis
                    dataKey="size"
                    stroke={CHART_COLORS.axis}
                    tick={{ fontSize: 11 }}
                    minTickGap={22}
                  />
                  <YAxis
                    stroke={CHART_COLORS.axis}
                    tick={{ fontSize: 11 }}
                    width={44}
                    domain={['auto', 'auto']}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="Train" name="Training Score" stroke={CHART_COLORS.primary} strokeWidth={2.5} dot={false} />
                  <Line type="monotone" dataKey="Validation" name="Cross-validation Score" stroke={CHART_COLORS.amber} strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </>
        ) : (
          <Placeholder text="Learning curve unavailable for this model." />
        )}
      </Panel>

      <Panel
        title="Validation Curve"
        subtitle="Inspect how validation performance changes across the selected hyperparameter."
        icon={Binary}
        actions={bestDiagnostics?.availableValidationParams?.length ? (
          <select
            value={effectiveValidationParam}
            onChange={(e) => setSelectedValidationParam(e.target.value)}
            className="rounded-full border border-white/60 bg-white/80 px-3 py-1.5 text-xs font-semibold text-foreground outline-none"
          >
            {bestDiagnostics.availableValidationParams.map((param) => (
              <option key={param} value={param}>{param}</option>
            ))}
          </select>
        ) : null}
      >
        {validationData.length ? (
          <>
            <ChartLegend items={validationLegend} />
            <div className="h-[340px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={validationData} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
                  <XAxis
                    dataKey="param"
                    stroke={CHART_COLORS.axis}
                    tick={{ fontSize: 11 }}
                    minTickGap={24}
                    interval="preserveStartEnd"
                    tickFormatter={(value) => shortenAxisLabel(value, 14)}
                  />
                  <YAxis
                    stroke={CHART_COLORS.axis}
                    tick={{ fontSize: 11 }}
                    width={44}
                    domain={['auto', 'auto']}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="Train" name="Training Score" stroke={CHART_COLORS.primary} strokeWidth={2.4} dot={false} />
                  <Line type="monotone" dataKey="Validation" name="Validation Score" stroke={CHART_COLORS.amber} strokeWidth={2.4} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </>
        ) : (
          <Placeholder text="Validation curve unavailable for this model." />
        )}
      </Panel>

      {problemType === 'classification' ? (
        <>
          <Panel
            title="ROC Curve"
            subtitle="AUC-consistent ROC curves for the leading classification models."
            icon={Activity}
          >
            {rocData.length ? (
              <>
                <ChartLegend items={rocLegend} />
                <div className="h-[340px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={rocData} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
                      <XAxis
                        dataKey="fpr"
                        stroke={CHART_COLORS.axis}
                        domain={[0, 1]}
                        tick={{ fontSize: 11 }}
                        tickFormatter={(value) => Number(value).toFixed(1)}
                      />
                      <YAxis
                        stroke={CHART_COLORS.axis}
                        domain={[0, 1]}
                        tick={{ fontSize: 11 }}
                        width={44}
                        tickFormatter={(value) => Number(value).toFixed(1)}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Line type="monotone" dataKey="baseline" name="Random Guessing" stroke={CHART_COLORS.axis} strokeDasharray="5 5" dot={false} />
                      {topResults
                        .filter((model) => diagnosticsMap[model.id]?.rocCurve)
                        .slice(0, 3)
                        .map((model) => {
                          const auc = diagnosticsMap[model.id]?.rocCurve?.auc;
                          return (
                            <Line
                              key={model.id}
                              type="monotone"
                              dataKey={model.name}
                              name={`${model.name}${auc != null ? ` (AUC ${auc.toFixed(3)})` : ''}`}
                              stroke={model.accent || '#4361EE'}
                              strokeWidth={2.4}
                              dot={false}
                            />
                          );
                        })}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </>
            ) : (
              <Placeholder text="ROC curve is available only for binary classifiers with probability or decision scores." />
            )}
          </Panel>

          <Panel
            title="Confusion Matrix"
            subtitle="Heatmap view of the best classification model's prediction outcomes."
            icon={Binary}
          >
            <ConfusionMatrixPanel diagnostics={bestDiagnostics} />
          </Panel>
        </>
      ) : (
        <Panel
          title="Regression Diagnostics"
          subtitle={predictedViewMode === 'actual-vs-predicted'
            ? 'Compare actual values against model predictions on real experiment outputs, with residual distance encoded by color.'
            : 'Visualize actual and predicted traces across the sampled observations.'}
          icon={Activity}
          className="lg:col-span-2"
          actions={(predictedCurveData.length || predictedScatter.points.length) ? (
            <div className="flex flex-wrap gap-1 rounded-full border border-white/60 bg-white/60 p-1">
              {[
                { key: 'actual-vs-predicted', label: 'Actual vs Predicted' },
                { key: 'predicted-vs-sample', label: 'Predicted vs Sample' },
              ].map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setPredictedViewMode(option.key)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${predictedViewMode === option.key ? 'bg-white text-ockham-navy shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          ) : null}
        >
          <ChartLegend items={regressionLegend} />

          {predictedViewMode === 'actual-vs-predicted' ? (
            predictedScatter.points.length ? (
              <div className="h-[360px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
                    <XAxis
                      type="number"
                      dataKey="actual"
                      name="Actual"
                      stroke={CHART_COLORS.axis}
                      domain={predictedScatter.domain}
                      tick={{ fontSize: 11 }}
                      tickFormatter={(value) => Number(value).toFixed(1)}
                    />
                    <YAxis
                      type="number"
                      dataKey="predicted"
                      name="Predicted"
                      stroke={CHART_COLORS.axis}
                      domain={predictedScatter.domain}
                      tick={{ fontSize: 11 }}
                      width={44}
                      tickFormatter={(value) => Number(value).toFixed(1)}
                    />
                    <Tooltip cursor={{ strokeDasharray: '3 3' }} content={<RegressionScatterTooltip />} />
                    <ReferenceLine
                      segment={[
                        { x: predictedScatter.domain[0], y: predictedScatter.domain[0] },
                        { x: predictedScatter.domain[1], y: predictedScatter.domain[1] },
                      ]}
                      stroke={CHART_COLORS.slate}
                      strokeWidth={2}
                      strokeDasharray="4 4"
                    />
                    <Scatter name="Predicted vs Actual" data={predictedScatter.points} opacity={0.75}>
                      {predictedScatter.points.map((point, index) => (
                        <Cell key={`predicted-vs-actual-${point.sample}-${index}`} fill={point.color} />
                      ))}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <Placeholder text="Actual vs Predicted unavailable for this model." />
            )
          ) : (
            aggregatedPredictedSampleData.length ? (
              <div className="h-[380px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={aggregatedPredictedSampleData}
                    margin={{ top: 8, right: 16, left: 0, bottom: 24 }}
                  >
                    <defs>
                      <linearGradient id="actualRangeGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={CHART_COLORS.primaryMuted} stopOpacity={0.22} />
                        <stop offset="60%" stopColor={CHART_COLORS.cyan} stopOpacity={0.12} />
                        <stop offset="100%" stopColor={CHART_COLORS.cyan} stopOpacity={0.03} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />

                    <XAxis
                      dataKey="bucketLabel"
                      stroke={CHART_COLORS.axis}
                      tick={{ fontSize: 11 }}
                      minTickGap={28}
                      interval="preserveStartEnd"
                    />

                    <YAxis
                      stroke={CHART_COLORS.axis}
                      tick={{ fontSize: 11 }}
                      width={44}
                      domain={['auto', 'auto']}
                    />

                    <Tooltip content={<AggregatedPredictedSampleTooltip />} />

                    <Area
                      type="monotone"
                      dataKey="rangeBase"
                      stackId="actual-band"
                      stroke="none"
                      fill="transparent"
                      activeDot={false}
                      isAnimationActive={false}
                      legendType="none"
                    />

                    <Area
                      type="monotone"
                      dataKey="rangeSpan"
                      stackId="actual-band"
                      name="Actual range"
                      stroke="none"
                      fill="url(#actualRangeGradient)"
                      fillOpacity={1}
                      activeDot={false}
                      isAnimationActive={false}
                    />

                    <Line
                      type="monotone"
                      dataKey="predicted"
                      name="Predicted"
                      stroke={CHART_COLORS.cyan}
                      strokeWidth={2.6}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />

                    <Scatter
                      data={aggregatedPredictedSampleData}
                      dataKey="actual"
                      name="Actual mean"
                      fill={CHART_COLORS.primaryMuted}
                      shape={(props) => {
                        const { cx, cy } = props;
                        return (
                          <circle
                            cx={cx}
                            cy={cy}
                            r={3}
                            fill={CHART_COLORS.primaryMuted}
                            fillOpacity={0.82}
                          />
                        );
                      }}
                    />

                    <Brush
                      dataKey="bucketLabel"
                      height={20}
                      stroke={CHART_COLORS.primary}
                      travellerWidth={10}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <Placeholder text="Predicted vs Sample unavailable for this model." />
            )
          )}
        </Panel>
      )}
    </div>
  );
}
