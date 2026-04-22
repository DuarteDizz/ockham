import React from 'react';
import { motion } from 'framer-motion';

const METRIC_CONFIG = {
  'R² Score': { gradient: 'metric-card-gradient-0', iconBg: '#0A49C2', label: 'R² Score', icon: <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><polyline points="2,13 6,8 9,10 13,4 16,6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg> },
  MAE: { gradient: 'metric-card-gradient-1', iconBg: '#0DA9C2', label: 'MAE', icon: <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M3 9h12M9 3l4 6-4 6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg> },
  MSE: { gradient: 'metric-card-gradient-2', iconBg: '#0838B8', label: 'MSE', icon: <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="3" y="7" width="4" height="8" rx="1.5" fill="white" opacity="0.7"/><rect x="9" y="4" width="4" height="11" rx="1.5" fill="white"/></svg> },
  RMSE: { gradient: 'metric-card-gradient-3', iconBg: '#12B981', label: 'RMSE', icon: <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M2 9 Q5 3 9 9 Q13 15 16 9" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none"/></svg> },
  Accuracy: { gradient: 'metric-card-gradient-0', iconBg: '#0A49C2', label: 'Accuracy', icon: <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="6" stroke="white" strokeWidth="1.8"/><path d="M6 9l2 2 4-4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg> },
  Precision: { gradient: 'metric-card-gradient-1', iconBg: '#0DA9C2', label: 'Precision', icon: <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="3" fill="white"/><circle cx="9" cy="9" r="6" stroke="white" strokeWidth="1.5" strokeDasharray="3 2"/></svg> },
  Recall: { gradient: 'metric-card-gradient-2', iconBg: '#0838B8', label: 'Recall', icon: <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M4 9h10M9 4l5 5-5 5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg> },
  'F1-Score': { gradient: 'metric-card-gradient-3', iconBg: '#12B981', label: 'F1-Score', icon: <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M4 14V4h7" stroke="white" strokeWidth="2" strokeLinecap="round"/><path d="M4 9h5" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg> },
  'ROC AUC': { gradient: 'metric-card-gradient-4', iconBg: '#18C8C4', label: 'ROC AUC', icon: <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M2 14 Q5 4 9 9 Q13 14 16 4" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none"/></svg> },
};

function formatMetricValue(key, value) {
  if (typeof value !== 'number') return value;
  if (['R² Score', 'Accuracy', 'Precision', 'Recall', 'F1-Score', 'ROC AUC'].includes(key)) return value.toFixed(3);
  return value.toFixed(2);
}

export default function MetricsOverview({ results, embedded = false }) {
  if (!results || results.length === 0) return null;
  const best = results[0];
  const metrics = Object.entries(best.metrics);

  return (
    <div className={embedded ? 'mt-5 grid grid-cols-2 gap-3 border-t border-border/40 pt-5 sm:grid-cols-4' : 'flex flex-wrap gap-3'}>
      {metrics.map(([key, value], index) => {
        const cfg = METRIC_CONFIG[key] || METRIC_CONFIG.MAE;
        return (
          <motion.div
            key={key}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.06, duration: 0.3 }}
            className={`${embedded ? 'rounded-xl border border-white/80 bg-white/70 px-4 py-3 backdrop-blur-md' : `card-shadow min-w-[145px] flex-1 rounded-2xl border border-border p-4 ${cfg.gradient}`}`}
          >
            <div className="mb-2 flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl shadow-sm" style={{ background: cfg.iconBg }}>
                {cfg.icon}
              </div>
              <span className="text-sm font-semibold text-foreground/80">{cfg.label}</span>
            </div>
            <p className={`font-heading font-extrabold tracking-tight text-foreground ${embedded ? 'text-2xl' : 'text-3xl'}`}>
              {formatMetricValue(key, value)}
            </p>
          </motion.div>
        );
      })}
    </div>
  );
}
