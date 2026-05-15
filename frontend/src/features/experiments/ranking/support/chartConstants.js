export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export const CHART_COLORS = {
  grid: '#DCE7EE',
  axis: '#6B7280',
  axisSecondary: '#4B5563',
  primary: '#0A49C2',
  primaryMuted: '#1D4ED8',
  cyan: '#18C8C4',
  amber: '#F59E0B',
  amberSoft: '#FBBF24',
  green: '#10B981',
  red: '#EF4444',
  slate: '#94A3B8',
  slateSoft: '#CBD5E1',
};

export function compactModelName(name = '') {
  return name
    .replace(' Regression', '')
    .replace(' Classifier', '')
    .replace('Random Forest', 'RF')
    .replace('Decision Tree', 'Tree')
    .replace('Linear Regression', 'Linear')
    .replace('Polynomial Regression', 'Poly')
    .replace('Logistic Regression', 'Logistic')
    .replace('Naive Bayes', 'Bayes');
}

export function shortenAxisLabel(value, maxLength = 12) {
  const text = String(value ?? '');
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1)}…`;
}

export function shortenCapabilityLabel(subject = '') {
  const map = {
    Interpretability: 'Interpret.',
    Simplicity: 'Simplicity',
    Scalability: 'Scale',
    Stability: 'Stability',
    'Feature Efficiency': 'Feature Use',
    'Feature Usage': 'Feature Use',
    'Operational Efficiency': 'Operational',
    Operational: 'Operational',
    Generalization: 'Generaliz.',
    Predictive: 'Predictive',
    Parsimony: 'Parsimony',
  };

  return map[subject] || subject;
}

export function toPercent(value) {
  if (value == null || Number.isNaN(value)) return 0;
  return clamp(value * 100, 0, 100);
}

export function getMetricValue(result, key) {
  if (key === 'MSE' && result.metrics?.MSE == null && typeof result.metrics?.RMSE === 'number') {
    return result.metrics.RMSE ** 2;
  }
  return result.metrics?.[key];
}

export function normalizeRelativeTime(results, key) {
  const values = results
    .map((result) => result[key])
    .filter((value) => typeof value === 'number' && !Number.isNaN(value));

  return (value) => {
    if (typeof value !== 'number' || Number.isNaN(value)) return 50;
    if (values.length <= 1) return clamp(100 / (1 + Math.abs(value)), 0, 100);
    const min = Math.min(...values);
    const max = Math.max(...values);
    if (max === min) return 100;
    return clamp(((max - value) / (max - min)) * 100, 0, 100);
  };
}

export function hexToRgb(hex) {
  const normalized = hex.replace('#', '');
  const value = normalized.length === 3
    ? normalized.split('').map((char) => char + char).join('')
    : normalized;

  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16),
  };
}

export function mixColor(from, to, ratio) {
  const start = hexToRgb(from);
  const end = hexToRgb(to);
  const weight = clamp(ratio, 0, 1);

  const channel = (key) => Math.round(start[key] + (end[key] - start[key]) * weight)
    .toString(16)
    .padStart(2, '0');

  return `#${channel('r')}${channel('g')}${channel('b')}`;
}

export function getResidualHeatColor(ratio) {
  if (ratio <= 0.5) {
    return mixColor(CHART_COLORS.cyan, CHART_COLORS.amber, ratio / 0.5);
  }
  return mixColor(CHART_COLORS.amber, CHART_COLORS.red, (ratio - 0.5) / 0.5);
}


export function getConfusionCellTone(isDiagonal, intensity) {
  if (isDiagonal) {
    return {
      background: `linear-gradient(135deg, rgba(10,73,194,${0.08 + intensity * 0.12}) 0%, rgba(24,200,196,${0.06 + intensity * 0.16}) 100%)`,
      border: `rgba(10,73,194,${0.16 + intensity * 0.28})`,
      valueColor: intensity > 0.32 ? CHART_COLORS.primary : 'rgba(10,73,194,0.72)',
      metaColor: 'rgba(10,73,194,0.58)',
    };
  }

  const hasError = intensity > 0.04;
  return {
    background: hasError
      ? `linear-gradient(135deg, rgba(245,158,11,${0.05 + intensity * 0.10}) 0%, rgba(239,68,68,${0.04 + intensity * 0.12}) 100%)`
      : 'rgba(255,255,255,0.62)',
    border: hasError
      ? `rgba(245,158,11,${0.12 + intensity * 0.22})`
      : 'rgba(203,213,225,0.72)',
    valueColor: hasError
      ? `rgba(180,83,9,${0.70 + intensity * 0.24})`
      : 'rgba(51,65,85,0.34)',
    metaColor: hasError ? 'rgba(180,83,9,0.52)' : 'rgba(100,116,139,0.48)',
  };
}
