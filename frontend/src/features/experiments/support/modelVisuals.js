export const MODEL_VISUALS = {
  'linear-regression': { accent: '#4F7CFF', iconKey: 'linear-regression' },
  'polynomial-regression': { accent: '#8B5CF6', iconKey: 'polynomial-regression' },
  'lasso-regression': { accent: '#6D5EF6', iconKey: 'lasso-regression' },
  'ridge-regression': { accent: '#14B8A6', iconKey: 'ridge-regression' },
  'decision-tree-regression': { accent: '#F59E0B', iconKey: 'decision-tree-regression' },
  'random-forest-regression': { accent: '#A855F7', iconKey: 'random-forest-regression' },
  'xgboost-regression': { accent: '#6366F1', iconKey: 'xgboost-regression' },
  svr: { accent: '#0EA5E9', iconKey: 'svr' },
  'logistic-regression': { accent: '#0A49C2', iconKey: 'logistic-regression' },
  'naive-bayes-classifier': { accent: '#F97316', iconKey: 'naive-bayes-classifier' },
  'knn-classifier': { accent: '#3B82F6', iconKey: 'knn-classifier' },
};

export function getDefaultVisual(category = '') {
  const categoryLabel = String(category).toLowerCase();

  if (categoryLabel.includes('neighbor')) {
    return { accent: '#3B82F6', iconKey: 'knn-classifier' };
  }

  if (categoryLabel.includes('probabilistic')) {
    return { accent: '#F97316', iconKey: 'naive-bayes-classifier' };
  }

  if (categoryLabel.includes('boost')) {
    return { accent: '#6366F1', iconKey: 'xgboost-regression' };
  }

  if (categoryLabel.includes('forest')) {
    return { accent: '#A855F7', iconKey: 'random-forest-regression' };
  }

  if (categoryLabel.includes('tree')) {
    return { accent: '#F59E0B', iconKey: 'decision-tree-regression' };
  }

  if (categoryLabel.includes('lasso')) {
    return { accent: '#6D5EF6', iconKey: 'lasso-regression' };
  }

  if (categoryLabel.includes('ridge')) {
    return { accent: '#14B8A6', iconKey: 'ridge-regression' };
  }

  if (categoryLabel.includes('logistic')) {
    return { accent: '#0A49C2', iconKey: 'logistic-regression' };
  }

  if (categoryLabel.includes('support')) {
    return { accent: '#0EA5E9', iconKey: 'svr' };
  }

  if (categoryLabel.includes('poly')) {
    return { accent: '#8B5CF6', iconKey: 'polynomial-regression' };
  }

  return { accent: '#4F7CFF', iconKey: 'linear-regression' };
}

export function getModelVisual(modelId, category = '') {
  return MODEL_VISUALS[modelId] || getDefaultVisual(category);
}
