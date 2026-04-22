import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Database, Square } from 'lucide-react';
import ModelGlyph from '@/features/experiments/components/ModelGlyph';

const LIVE_STEP_LABELS = {
  queue: 'Queued',
  preparing: 'Preparing',
  optuna_search: 'Optuna Search',
  scheduling: 'Scheduling',
  ranking: 'Ranking',
  llm_judging: 'AI Judgment',
  finalizing: 'Finalizing',
  dashboard_loading: 'Loading Dashboard',
  cancelling: 'Cancelling',
  cancelled: 'Cancelled',
  completed: 'Completed',
  failed: 'Failed',
};

function getCurvePath(sx, sy, tx, ty) {
  const dx = tx - sx;
  const dy = ty - sy;
  const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
  const mx = (sx + tx) / 2;
  const my = (sy + ty) / 2;
  const perp = dist * 0.3;
  const nx = -dy / dist;
  const ny = dx / dist;
  const cx = mx + nx * perp * 0.8;
  const cy = my + ny * perp * 0.8;
  return `M ${sx} ${sy} Q ${cx} ${cy} ${tx} ${ty}`;
}

function DataParticle({ pathId, color, duration, delay, size = 4 }) {
  return (
    <circle r={size / 2} fill={color} opacity={0.92}>
      <animateMotion dur={`${duration}s`} begin={`${delay}s`} repeatCount="indefinite" keyPoints="0;1" keyTimes="0;1" calcMode="spline" keySplines="0.4 0 0.6 1">
        <mpath href={`#${pathId}`} />
      </animateMotion>
    </circle>
  );
}

function SvgDefs() {
  return (
    <defs>
      <filter id="glow-blue" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      <filter id="glow-strong" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="6" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      <radialGradient id="source-grad" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#0A49C2" stopOpacity="0.45" /><stop offset="65%" stopColor="#18C8C4" stopOpacity="0.14" /><stop offset="100%" stopColor="#7C3AED" stopOpacity="0" /></radialGradient>
    </defs>
  );
}

function orderModels(models) {
  const priority = { training: 0, done: 1, pending: 2 };
  return [...models].sort((a, b) => {
    const pa = priority[a.status] ?? 99;
    const pb = priority[b.status] ?? 99;
    if (pa !== pb) return pa - pb;
    return String(a.name).localeCompare(String(b.name));
  });
}



function parseStartedAtMs(value) {
  if (!value) return null;
  const parsedValue = new Date(value).getTime();
  return Number.isNaN(parsedValue) ? null : parsedValue;
}

function formatElapsedMs(elapsedMs = 0) {
  const safeElapsedMs = Math.max(elapsedMs || 0, 0);
  const totalSeconds = Math.floor(safeElapsedMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export default function LiveTrainingState({
  experimentId = '',
  trainingModels = [],
  problemType,
  progress = 0,
  liveStep = null,
  liveMessage = '',
  startedAt = null,
  elapsedMs = 0,
  timerStartMs = null,
  onCancel = null,
  isCancelling = false,
}) {
  const svgRef = useRef(null);
  const [svgSize, setSvgSize] = useState({ w: 900, h: 560 });
  const [nodePositions, setNodePositions] = useState([]);
  const [tick, setTick] = useState(0);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const normalizedModels = useMemo(() => orderModels(trainingModels || []), [trainingModels]);
  const doneCount = normalizedModels.filter((m) => m.status === 'done').length;
  const activeModels = normalizedModels.filter((m) => m.status === 'training');
  const pendingCount = normalizedModels.filter((m) => m.status === 'pending').length;
  const totalCount = normalizedModels.length;
  const computedProgress = totalCount > 0 ? (doneCount / totalCount) * 100 : 0;
  const displayProgress = Math.max(progress || 0, computedProgress);
  const stepLabel = LIVE_STEP_LABELS[liveStep] || 'Live Training';
  const resolvedTimerStartMs = timerStartMs || parseStartedAtMs(startedAt);
  const computedElapsedMs = resolvedTimerStartMs ? Math.max(nowMs - resolvedTimerStartMs, 0) : 0;
  const displayElapsedMs = Math.max(computedElapsedMs, elapsedMs || 0);
  const elapsed = formatElapsedMs(displayElapsedMs);


  useEffect(() => {
    const updateNow = () => setNowMs(Date.now());

    updateNow();

    const intervalId = window.setInterval(updateNow, 1000);
    window.addEventListener('focus', updateNow);
    document.addEventListener('visibilitychange', updateNow);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', updateNow);
      document.removeEventListener('visibilitychange', updateNow);
    };
  }, [experimentId, timerStartMs]);

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return undefined;
    const obs = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setSvgSize({ w: width || 900, h: height || 560 });
    });
    obs.observe(el);
    setSvgSize({ w: el.clientWidth || 900, h: el.clientHeight || 560 });
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const iv = setInterval(() => setTick((t) => t + 1), 1600);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    if (!totalCount) return;
    const { w, h } = svgSize;
    const cx = w / 2;
    const cy = h / 2;
    const radius = Math.min(w, h) * 0.34;
    const start = -150;
    const end = 150;
    const span = end - start;

    const positions = normalizedModels.map((m, i) => {
      const t = totalCount === 1 ? 0.5 : i / (totalCount - 1);
      const angle = (start + t * span) * Math.PI / 180;
      return { ...m, x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius };
    });
    setNodePositions(positions);
  }, [svgSize, normalizedModels, totalCount]);

  const { w, h } = svgSize;
  const srcX = w / 2;
  const srcY = h / 2;
  const NODE_R = 28;

  return (
    <div className="flex flex-1 flex-col overflow-hidden rounded-[32px] border border-white/[0.08] bg-[#0b1020] shadow-[0_24px_64px_rgba(5,11,28,0.35)]">
      <div className="flex flex-shrink-0 flex-wrap items-start justify-between gap-4 px-8 pt-7 pb-4">
        <div>
          <div className="mb-1 flex items-center gap-2.5"><motion.div className="h-2 w-2 rounded-full bg-cyan-400" animate={{ opacity: [1, 0.2, 1], scale: [1, 1.5, 1] }} transition={{ duration: 1.1, repeat: Infinity }} /><span className="text-xs font-bold uppercase tracking-widest text-cyan-300">Live Training</span></div>
          <h2 className="font-heading text-2xl font-extrabold text-white">Training {totalCount} Model{totalCount !== 1 ? 's' : ''}</h2>
          <p className="mt-0.5 text-sm text-white/40">{doneCount} of {totalCount} complete · {problemType === 'regression' ? 'Regression' : 'Classification'}</p>
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
          <div className="text-right"><p className="font-heading text-3xl font-extrabold text-white">{Math.round(displayProgress)}%</p><p className="mt-0.5 text-xs text-white/30">complete</p></div>
        </div>
      </div>
      <div className="mb-4 grid flex-shrink-0 gap-3 px-8 md:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-300/80">Current Step</div>
          <div className="mt-1 text-sm font-semibold text-white">{stepLabel}</div>
          <div className="mt-1 text-xs leading-5 text-white/50">{liveMessage || 'Preparing benchmark execution.'}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-300/80">Elapsed Time</div>
          <div className="mt-1 font-heading text-2xl font-extrabold text-white">{elapsed}</div>
          <div className="mt-1 text-xs leading-5 text-white/50">Continuous timer since the experiment started.</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-300/80">Live Queue</div>
          <div className="mt-1 text-sm font-semibold text-white">{activeModels.length} training · {pendingCount} pending</div>
          <div className="mt-1 text-xs leading-5 text-white/50">{activeModels.length ? activeModels.map((model) => model.name).join(', ') : 'No active model right now.'}</div>
        </div>
      </div>
      <div className="mb-2 flex-shrink-0 px-8"><div className="h-0.5 overflow-hidden rounded-full bg-white/10"><motion.div className="h-full rounded-full" style={{ background: 'linear-gradient(90deg, #0A49C2, #18C8C4, #7C3AED)' }} initial={{ width: '0%' }} animate={{ width: `${displayProgress}%` }} transition={{ duration: 0.6, ease: 'easeOut' }} /></div></div>
      <div className="relative flex-1" ref={svgRef}>
        <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
          <SvgDefs />
          <circle cx={srcX} cy={srcY} r={82} fill="url(#source-grad)" />
          {nodePositions.map((node) => {
            const pathId = `path-${node.id}`;
            const isDone = node.status === 'done';
            const isTraining = node.status === 'training';
            const d = getCurvePath(srcX, srcY, node.x, node.y);
            const pathColor = isDone ? '#34D399' : isTraining ? (node.color || '#18C8C4') : 'rgba(255,255,255,0.08)';
            return (
              <g key={node.id}>
                <path id={pathId} d={d} fill="none" />
                <motion.path d={d} fill="none" stroke={pathColor} strokeWidth={isTraining ? 1.6 : 1} strokeOpacity={isTraining ? 0.85 : isDone ? 0.58 : 0.14} animate={isTraining ? { strokeDashoffset: [0, -22], strokeOpacity: [0.55, 0.9, 0.55] } : { strokeOpacity: isDone ? 0.58 : 0.14 }} transition={isTraining ? { duration: 1.1, repeat: Infinity, ease: 'linear' } : { duration: 0.35 }} strokeDasharray={isTraining ? '6 8' : undefined} filter={isTraining ? 'url(#glow-blue)' : undefined} />
                {(isTraining || isDone) && [0,1,2].map((j) => <DataParticle key={`${node.id}-${j}-${tick}`} pathId={pathId} color={isDone ? '#34D399' : (node.color || '#18C8C4')} duration={isDone ? 1.5 : 1.05} delay={j * (isDone ? 0.36 : 0.22)} size={isDone ? 5 : 6} />)}
              </g>
            );
          })}
          <g filter="url(#glow-strong)"><circle cx={srcX} cy={srcY} r={NODE_R} fill="#111827" stroke="#18C8C4" strokeWidth={1.5} strokeOpacity={0.85} /></g>
          <motion.circle cx={srcX} cy={srcY} r={NODE_R} fill="none" stroke="#18C8C4" strokeWidth={1.4} animate={{ r: [NODE_R, NODE_R + 16, NODE_R], opacity: [0.75, 0, 0.75] }} transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }} />
          <foreignObject x={srcX - 14} y={srcY - 14} width={28} height={28}><div xmlns="http://www.w3.org/1999/xhtml" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}><Database style={{ width: 18, height: 18, color: '#18C8C4' }} /></div></foreignObject>
          {nodePositions.map((node) => {
            const isDone = node.status === 'done';
            const isTraining = node.status === 'training';
            const color = node.color || '#4361EE';
            const bgFill = isDone ? '#09231b' : isTraining ? '#10182c' : '#111218';
            const borderColor = isDone ? '#34D399' : isTraining ? color : 'rgba(255,255,255,0.12)';
            const isLeft = node.x < srcX;
            const lx = isLeft ? node.x - NODE_R - 10 : node.x + NODE_R + 10;
            const anchor = isLeft ? 'end' : 'start';
            const shortName = node.name.length > 22 ? `${node.name.slice(0, 21)}…` : node.name;
            return (
              <g key={`node-${node.id}`}>
                {isTraining ? <motion.circle cx={node.x} cy={node.y} r={NODE_R + 2} fill="none" stroke={color} strokeWidth={1} animate={{ r: [NODE_R + 2, NODE_R + 18, NODE_R + 2], opacity: [0.6, 0, 0.6] }} transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }} /> : null}
                {isDone ? <motion.circle cx={node.x} cy={node.y} r={NODE_R} fill="none" stroke="#34D399" strokeWidth={1.5} initial={{ r: NODE_R, opacity: 0.8 }} animate={{ r: NODE_R + 20, opacity: 0 }} transition={{ duration: 0.7, ease: 'easeOut' }} /> : null}
                <circle cx={node.x} cy={node.y} r={NODE_R} fill={bgFill} stroke={borderColor} strokeWidth={1.5} filter={isTraining ? 'url(#glow-blue)' : undefined} />
                <foreignObject x={node.x - 14} y={node.y - 14} width={28} height={28}><div xmlns="http://www.w3.org/1999/xhtml" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}><ModelGlyph iconKey={node.iconKey} color={isDone ? '#34D399' : isTraining ? color : 'rgba(255,255,255,0.24)'} size={16} strokeWidth={1.75} /></div></foreignObject>
                <text x={lx} y={node.y - 5} fill={isDone ? '#34D399' : isTraining ? '#ffffff' : 'rgba(255,255,255,0.3)'} fontSize={11} fontFamily="Inter, sans-serif" fontWeight={isTraining || isDone ? '600' : '400'} textAnchor={anchor}>{shortName}</text>
                <text x={lx} y={node.y + 8} fill={isDone ? 'rgba(52,211,153,0.65)' : isTraining ? `${color}cc` : 'rgba(255,255,255,0.14)'} fontSize={9} fontFamily="Inter, sans-serif" fontWeight="500" letterSpacing="0.08em" textAnchor={anchor}>{isDone ? '✓ COMPLETE' : isTraining ? 'TRAINING…' : 'QUEUED'}</text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="flex flex-shrink-0 items-center gap-2 px-8 py-4 text-xs text-white/20"><motion.div className="h-1.5 w-1.5 rounded-full bg-cyan-400" animate={{ opacity: [1, 0.1, 1] }} transition={{ duration: 1.4, repeat: Infinity }} />Ockham engine · {liveMessage || `Distributing data across ${totalCount} model pipeline${totalCount !== 1 ? 's' : ''}`}</div>
    </div>
  );
}
