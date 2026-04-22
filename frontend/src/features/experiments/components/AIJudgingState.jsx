import React, { useMemo, useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Brain, CheckCircle2, Square } from 'lucide-react';

function buildFallbackCandidates(trainingModels = []) {
  return trainingModels.map((item, index) => ({
    id: item.id,
    name: item.name || item.id,
    displayRank: index + 1,
    metricValue: null,
    metricLabel: 'Training Status',
    trainingTime: null,
    status: item.status || 'done',
  }));
}

function buildJudgingCandidates(results = [], trainingModels = [], problemType = 'classification') {
  if (Array.isArray(results) && results.length) {
    const primaryMetricLabel = results[0]?.primaryMetricLabel || (problemType === 'regression' ? 'R² Score' : 'Accuracy');

    return results.map((item, index) => ({
      id: item.id,
      name: item.name,
      displayRank: item.display_rank || item.ockham_rank || item.performance_rank || index + 1,
      metricValue: typeof item.metrics?.[primaryMetricLabel] === 'number'
        ? item.metrics[primaryMetricLabel]
        : typeof item.bestScore === 'number'
          ? item.bestScore
          : null,
      metricLabel: primaryMetricLabel,
      trainingTime: item.training_time,
      status: index === 0 ? 'recommended' : 'evaluated',
    }));
  }

  return buildFallbackCandidates(trainingModels);
}

function buildReasoningSteps(candidates = [], liveMessage = '') {
  if (!candidates.length) {
    return [
      {
        id: 'ranking',
        text: 'Consolidating trained model outputs...',
        detail: liveMessage || 'Reading benchmark outputs and ranking the trained candidates.',
      },
      {
        id: 'llm_judging',
        text: 'Ockham AI is reviewing the benchmark evidence...',
        detail: 'Preparing the final judgment across quality, stability, and execution cost.',
      },
      {
        id: 'dashboard_loading',
        text: 'Preparing winner diagnostics and populating the dashboard...',
        detail: 'Hydrating the winning model diagnostics before the dashboard is released.',
      },
    ];
  }

  const leader = candidates[0];
  const metricSummary = candidates
    .filter((item) => typeof item.metricValue === 'number')
    .map((item) => `${item.name}: ${item.metricValue.toFixed(4)}`)
    .join(' · ');

  return [
    {
      id: 'ranking',
      text: `Consolidating trained results for ${candidates.length} models...`,
      detail: candidates.map((item) => item.name).join(', '),
    },
    {
      id: 'llm_judging',
      text: 'Ockham AI is reviewing the benchmark evidence...',
      detail: metricSummary || liveMessage || 'Balancing performance, stability, and execution cost across the trained models.',
    },
    {
      id: 'dashboard_loading',
      text: 'Preparing winner diagnostics and populating the dashboard...',
      detail: leader ? `${leader.name} is leading the final recommendation.` : 'Hydrating the winning model diagnostics before the dashboard is released.',
    },
  ];
}

function getVisibleStepCount(liveStep) {
  if (liveStep === 'dashboard_loading' || liveStep === 'completed') return 3;
  if (liveStep === 'llm_judging') return 2;
  return 1;
}

function getCompletedStepCount(liveStep) {
  if (liveStep === 'completed') return 3;
  if (liveStep === 'dashboard_loading') return 2;
  if (liveStep === 'llm_judging') return 1;
  return 0;
}

function getActiveStepIndex(liveStep) {
  if (liveStep === 'dashboard_loading') return 2;
  if (liveStep === 'llm_judging') return 1;
  return 0;
}

function TokenStream({ text, tokenKey }) {
  const [displayedText, setDisplayedText] = useState('');

  useEffect(() => {
    setDisplayedText('');

    let index = 0;
    const timer = window.setInterval(() => {
      index += 1;
      setDisplayedText(text.slice(0, index));

      if (index >= text.length) {
        window.clearInterval(timer);
      }
    }, 18);

    return () => window.clearInterval(timer);
  }, [text, tokenKey]);

  return (
    <span>
      {displayedText}
      <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse align-middle bg-cyan-300/80" />
    </span>
  );
}

function SummaryCard({ label, value, detail = '', tone = 'default' }) {
  const className = tone === 'primary'
    ? 'bg-cyan-400/[0.07]'
    : 'bg-white/[0.04]';

  return (
    <div className={`rounded-2xl px-4 py-3 ${className}`}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-300/80">{label}</div>
      <div className="mt-1 text-sm font-semibold text-white">{value}</div>
      {detail ? <div className="mt-1 text-xs leading-5 text-white/50">{detail}</div> : null}
    </div>
  );
}

export default function AIJudgingState({
  results = [],
  trainingModels = [],
  problemType = 'classification',
  liveMessage = '',
  liveStep = 'ranking',
  sessionKey = 'judging',
  onCancel = null,
  isCancelling = false,
}) {
  const candidates = useMemo(
    () => buildJudgingCandidates(results, trainingModels, problemType),
    [problemType, results, trainingModels],
  );

  const steps = useMemo(
    () => buildReasoningSteps(candidates, liveMessage),
    [candidates, liveMessage],
  );

  const visibleStepCount = getVisibleStepCount(liveStep);
  const completedStepCount = getCompletedStepCount(liveStep);
  const activeStepIndex = getActiveStepIndex(liveStep);
  const leadingCandidate = candidates[0];
  const leadingMetric = typeof leadingCandidate?.metricValue === 'number'
    ? `${leadingCandidate.metricLabel} · ${leadingCandidate.metricValue.toFixed(4)}`
    : 'Evidence consolidated for final recommendation';

  return (
    <div className="flex flex-1 flex-col overflow-hidden rounded-[32px] border border-white/[0.08] bg-[#0b1020] shadow-[0_24px_64px_rgba(5,11,28,0.35)]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-14 left-1/4 h-56 w-56 rounded-full bg-primary/12 blur-3xl" />
        <div className="absolute right-0 top-1/3 h-64 w-64 rounded-full bg-cyan-400/10 blur-3xl" />
      </div>

      <div className="relative z-10 flex flex-shrink-0 flex-wrap items-start justify-between gap-4 px-8 pt-7 pb-4">
        <div>
          <div className="mb-1 flex items-center gap-2.5">
            <motion.div
              className="h-2 w-2 rounded-full bg-cyan-400"
              animate={{ opacity: [1, 0.2, 1], scale: [1, 1.5, 1] }}
              transition={{ duration: 1.1, repeat: Infinity }}
            />
            <span className="text-xs font-bold uppercase tracking-widest text-cyan-300">AI Judgment</span>
          </div>
          <h2 className="font-heading text-2xl font-extrabold text-white">Ockham AI is reviewing the trained models</h2>
          <p className="mt-0.5 text-sm text-white/40">LLM reasoning over benchmark evidence before the final recommendation</p>
        </div>

        <div className="flex items-start gap-3">
          {onCancel ? (
            <button
              type="button"
              onClick={onCancel}
              disabled={isCancelling}
              className="inline-flex items-center gap-2 rounded-2xl border border-rose-400/45 bg-rose-500/18 px-4 py-2.5 text-sm font-semibold text-rose-50 shadow-[0_10px_30px_rgba(244,63,94,0.16)] transition hover:bg-rose-500/26 hover:border-rose-300/60 hover:text-white disabled:cursor-not-allowed disabled:opacity-65"
            >
              <Square className="h-3.5 w-3.5" />
              {isCancelling ? 'Cancelling...' : 'Cancel run'}
            </button>
          ) : null}

          <motion.div
            className="flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/[0.08] px-3.5 py-2"
            animate={{ opacity: [0.72, 1, 0.72] }}
            transition={{ duration: 1.8, repeat: Infinity }}
          >
            <Brain className="h-3.5 w-3.5 text-cyan-300" />
            <span className="text-xs font-semibold text-cyan-100">Thinking...</span>
          </motion.div>
        </div>
      </div>

      <div className="mb-4 grid flex-shrink-0 gap-3 px-8 md:grid-cols-3">
        <SummaryCard label="Models in review" value={`${candidates.length} candidates`} detail="Consolidating all benchmark outputs for the final pass." />
        <SummaryCard label="Current leader" value={leadingCandidate?.name || 'Waiting for consolidated evidence'} detail="Best candidate at the current reasoning step." tone="primary" />
        <SummaryCard label="Focus" value={leadingMetric} detail={liveMessage || 'Balancing quality, stability, and execution cost.'} />
      </div>

      <div className="mb-2 flex-shrink-0 px-8">
        <div className="h-0.5 overflow-hidden rounded-full bg-white/10">
          <motion.div
            className="h-full rounded-full"
            style={{ background: 'linear-gradient(90deg, #0A49C2, #18C8C4, #7C3AED)' }}
            initial={{ width: '0%' }}
            animate={{ width: `${steps.length ? (completedStepCount / steps.length) * 100 : 0}%` }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
          />
        </div>
      </div>

      <div className="relative z-10 flex flex-1 overflow-hidden px-8 pb-6">
        <div className="flex w-full flex-col gap-3 overflow-y-auto rounded-[28px] bg-white/[0.025] p-4">
          <AnimatePresence initial={false}>
            {steps.slice(0, visibleStepCount).map((step, index) => {
              const isDone = index < completedStepCount;
              const isActive = index === activeStepIndex && !isDone;

              let cardClassName = 'bg-white/[0.04]';
              if (isActive) {
                cardClassName = 'bg-cyan-400/[0.07]';
              }

              return (
                <motion.div
                  key={`${sessionKey}:${step.id}`}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.35 }}
                  className={`rounded-2xl border px-4 py-4 transition-colors ${cardClassName}`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={[
                        'mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full',
                        isDone && 'bg-emerald-500/15',
                        isActive && 'bg-cyan-400/12',
                        !isActive && !isDone && 'bg-white/8',
                      ].filter(Boolean).join(' ')}
                    >
                      {isDone ? (
                        <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                      ) : isActive ? (
                        <motion.div
                          className="h-2 w-2 rounded-full bg-cyan-300"
                          animate={{ scale: [1, 1.4, 1] }}
                          transition={{ duration: 0.8, repeat: Infinity }}
                        />
                      ) : (
                        <div className="h-2 w-2 rounded-full bg-white/35" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-medium leading-snug ${isDone ? 'text-white/80' : isActive ? 'text-white' : 'text-white/72'}`}>
                        {isActive ? <TokenStream text={step.text} tokenKey={`${sessionKey}:${step.id}`} /> : step.text}
                      </p>
                      {step.detail ? (
                        <p className={`mt-1.5 text-xs font-mono leading-5 ${isDone ? 'text-slate-300/90' : isActive ? 'text-slate-300' : 'text-slate-400/90'}`}>
                          {step.detail}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>

      <div className="flex flex-shrink-0 items-center gap-2 px-8 py-4 text-xs text-white/20">
        <motion.div
          className="h-1.5 w-1.5 rounded-full bg-cyan-400"
          animate={{ opacity: [1, 0.1, 1] }}
          transition={{ duration: 1.4, repeat: Infinity }}
        />
        Ockham AI engine · Evaluating model quality with LLM reasoning
      </div>
    </div>
  );
}
