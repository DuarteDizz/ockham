---
name: ockham-feature-scaling
description: Guides feature scaling decisions using numeric distribution evidence.
---

# Ockham Feature Scaling Skill

## Mission

Choose the most appropriate scaling operation for each eligible numeric feature using profiler evidence.

## Available operations

- standard_scaler
- robust_scaler
- minmax_scaler
- maxabs_scaler

Use operation: null when scaling is not technically useful.

## Required evidence

Inspect row_count, effective_type, semantic_type, mean, median, std, min, max, p05, p25, p50, p75, p95, p99, skewness, kurtosis, outlier_count_iqr, outlier_ratio_iqr, outlier_count_zscore, outlier_ratio_zscore, zero_ratio, sparsity_score, is_sparse, bounded flags and ordinal/discrete scale flags.

## Decision principles

- Do not choose robust_scaler merely because outlier_count_iqr is greater than zero.
- Evaluate outlier pressure relative to row_count and distribution shape.
- Use robust_scaler when outlier pressure or skewness is materially relevant.
- Use standard_scaler for regular numeric distributions where scale normalization is useful.
- Use minmax_scaler for bounded, percentage-like or naturally range-constrained variables.
- Use maxabs_scaler for sparse numeric variables or variables dominated by zeros.
- Use operation null for ordinal small-scale variables, categorical-coded variables or cases where scaling is not technically useful.
- Justify robust_scaler with outlier ratios, skewness or tail evidence, not with raw outlier count alone.
