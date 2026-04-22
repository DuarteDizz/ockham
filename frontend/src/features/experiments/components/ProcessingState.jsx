import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, LoaderCircle } from 'lucide-react';
import useOckhamStore from '@/features/workspace/state/WorkspaceContext';
import LiveTrainingState from './LiveTrainingState';
import AIJudgingState from './AIJudgingState';

export default function ProcessingState() {
  const store = useOckhamStore();
  const liveStep = store.liveTrainingMeta?.liveStep;
  const showAiJudging = ['ranking', 'llm_judging', 'dashboard_loading'].includes(liveStep);

  return (
    <div className="relative flex h-full overflow-hidden px-4 pb-6 md:px-6 animate-fade-in">
      {showAiJudging ? (
        <AIJudgingState
          results={store.results}
          trainingModels={store.trainingProgress}
          problemType={store.problemType}
          liveMessage={store.liveTrainingMeta?.liveMessage}
          liveStep={liveStep}
          sessionKey={store.experimentId || store.liveTrainingMeta?.startedAt || 'judging'}
          onCancel={store.cancelLiveTraining}
          isCancelling={store.isCancellingExperiment}
        />
      ) : (
        <LiveTrainingState
          experimentId={store.experimentId}
          trainingModels={store.trainingProgress}
          problemType={store.problemType}
          progress={store.liveTrainingMeta?.progress ?? 0}
          liveStep={liveStep}
          liveMessage={store.liveTrainingMeta?.liveMessage}
          startedAt={store.liveTrainingMeta?.startedAt}
          elapsedMs={store.liveElapsedMs}
          timerStartMs={store.liveTimerStartMs}
          onCancel={store.cancelLiveTraining}
          isCancelling={store.isCancellingExperiment}
        />
      )}

      {store.isCancellingExperiment ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center rounded-[32px] bg-slate-950/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[28px] border border-white/10 bg-[#0b1020]/96 px-6 py-6 text-center shadow-[0_24px_64px_rgba(5,11,28,0.4)]">
            {store.cancelOverlayPhase === 'confirmed' ? (
              <>
                <motion.div
                  initial={{ scale: 0.86, opacity: 0.4 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.24, ease: 'easeOut' }}
                  className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-emerald-400/28 bg-emerald-400/10"
                >
                  <CheckCircle2 className="h-5 w-5 text-emerald-300" />
                </motion.div>
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-emerald-300">Cancellation confirmed</p>
                <h3 className="mt-2 text-xl font-heading font-extrabold text-white">Run fully stopped</h3>
                <p className="mt-2 text-sm leading-6 text-white/74">
                  Ockham confirmed the cancellation. You can safely start a new benchmark now.
                </p>
              </>
            ) : (
              <>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1.1, repeat: Infinity, ease: 'linear' }}
                  className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-cyan-400/25 bg-cyan-400/10"
                >
                  <LoaderCircle className="h-5 w-5 text-cyan-300" />
                </motion.div>
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-cyan-300">Cancelling run</p>
                <h3 className="mt-2 text-xl font-heading font-extrabold text-white">Stopping active services</h3>
                <p className="mt-2 text-sm leading-6 text-white/74">
                  Ockham is stopping the current workers and waiting for the backend to confirm that the experiment has fully stopped.
                </p>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
