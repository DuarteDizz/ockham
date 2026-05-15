import React, { useMemo } from 'react';
import { CheckCircle2, Circle, Loader2, XCircle } from 'lucide-react';

const AGENT_STEPS = [
  { node: 'column_role', label: '1/9 · Column Role Agent', detail: 'Classifying column roles.' },
  { node: 'casting', label: '2/9 · Casting Agent', detail: 'Checking type conversions.' },
  { node: 'feature_drop', label: '3/9 · Feature Drop Agent', detail: 'Finding risky columns.' },
  { node: 'missing_values', label: '4/9 · Missing Values Agent', detail: 'Planning missing-value handling.' },
  { node: 'datetime_features', label: '5/9 · Datetime Agent', detail: 'Planning datetime features.' },
  { node: 'encoding', label: '6/9 · Encoding Agent', detail: 'Planning categorical encoding.' },
  { node: 'scaling', label: '7/9 · Scaling Agent', detail: 'Planning numeric scaling.' },
  { node: 'plan_merger', label: '8/9 · Plan Merger', detail: 'Merging agent decisions.' },
  { node: 'plan_judge', label: '9/9 · Plan Judge', detail: 'Reviewing the preprocessing plan.' },
];

function deriveStepState(step, events) {
  const stepEvents = events.filter((event) => event.node === step.node);
  const lastEvent = stepEvents.at(-1);

  if (events.some((event) => event.kind === 'error')) {
    const hadStarted = stepEvents.some((event) => event.phase === 'start');
    const hadCompleted = stepEvents.some((event) => event.phase === 'stop');
    if (hadStarted && !hadCompleted) return 'failed';
  }

  if (stepEvents.some((event) => event.phase === 'stop')) return 'completed';
  if (stepEvents.some((event) => event.phase === 'start')) return 'running';
  return 'pending';
}

function StatusIcon({ state }) {
  if (state === 'completed') return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
  if (state === 'running') return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
  if (state === 'failed') return <XCircle className="h-4 w-4 text-red-500" />;
  return <Circle className="h-4 w-4 text-muted-foreground/40" />;
}

export default function AgentRunPanel({ events = [], isRunning = false }) {
  const visible = isRunning || events.length > 0;

  const enrichedSteps = useMemo(
    () => AGENT_STEPS.map((step) => {
      const stepEvents = events.filter((event) => event.node === step.node);
      const lastStop = [...stepEvents].reverse().find((event) => event.phase === 'stop');
      const lastEvent = stepEvents.at(-1);
      return {
        ...step,
        state: deriveStepState(step, events),
        message: lastStop?.detail || lastEvent?.detail || lastEvent?.message || step.detail,
      };
    }),
    [events],
  );

  if (!visible) return null;

  const errorEvent = events.find((event) => event.kind === 'error');
  const completedCount = enrichedSteps.filter((step) => step.state === 'completed').length;

  return (
    <section className="mb-4 rounded-[28px] border border-primary/15 bg-white/75 p-4 shadow-sm backdrop-blur-xl">
      <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-heading text-sm font-extrabold text-foreground">Agentic recommendation run</p>
          <p className="text-xs text-muted-foreground">
            {isRunning ? 'Ockham is building the recommended preprocessing graph.' : 'Agentic flow finished.'}
          </p>
        </div>
        <span className="w-fit rounded-full border border-primary/15 bg-primary/5 px-3 py-1 text-xs font-bold text-primary">
          {completedCount}/{AGENT_STEPS.length} steps completed
        </span>
      </div>

      {errorEvent ? (
        <div className="mb-3 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">
          {errorEvent.message || 'Agentic flow failed.'}
        </div>
      ) : null}

      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
        {enrichedSteps.map((step) => (
          <div
            key={step.node}
            className={`rounded-2xl border px-3 py-2 transition-colors ${
              step.state === 'running'
                ? 'border-primary/30 bg-primary/5'
                : step.state === 'completed'
                  ? 'border-emerald-200 bg-emerald-50/70'
                  : step.state === 'failed'
                    ? 'border-red-200 bg-red-50/70'
                    : 'border-slate-200 bg-white/65'
            }`}
          >
            <div className="flex items-start gap-2">
              <span className="mt-0.5 flex-none"><StatusIcon state={step.state} /></span>
              <div className="min-w-0">
                <p className="truncate text-xs font-extrabold text-foreground">{step.label}</p>
                <p className="mt-0.5 line-clamp-2 text-[11px] font-medium text-muted-foreground">{step.message}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
