# Profiler fields used by ScalingAgent

Use only fields present in each column payload. Do not invent missing metrics.

## Identity and eligibility fields

- `column_name`: use to detect code/ID naming patterns only as supporting evidence, never as the only signal.
- `effective_type`: primary eligibility signal. Scaling is only for numeric or accepted numeric-like features.
- `inferred_type`: secondary dtype signal from deterministic profiling.
- `semantic_type`: block scaling for identifiers, targets, categorical features, booleans, free text, datetime features and ordinal features.
- `recommended_role`: block scaling for target/drop/review-only structural roles when present.
- `is_ordinal_numeric_candidate`: block scaling by default because numeric values likely represent ordered labels, not continuous magnitude.
- `unique_count` and `unique_ratio`: identify binary/small-cardinality numeric codes and possible identifiers.
- `row_count`: denominator for interpreting raw counts.

## Spread and regularity fields

- `mean`, `median`: compare to detect skew or tail pressure.
- `std`, `variance`: determine whether there is meaningful spread and whether standard scaling is useful.
- `min`, `max`: range evidence for boundedness and MaxAbs reasoning.
- `p01`, `p05`, `p25`, `p50`, `p75`, `p95`, `p99`: quantile evidence for tails, boundedness and robust scaling.

## Shape and outlier fields

- `skewness`: use `abs(skewness) >= 1.0` as a strong sign of asymmetry when available.
- `kurtosis`: high values support heavy-tail evidence.
- `outlier_count_iqr`, `outlier_ratio_iqr`: prefer the ratio over the raw count.
- `outlier_count_zscore`, `outlier_ratio_zscore`: prefer the ratio over the raw count.

Do not use raw outlier counts alone. Counts must be interpreted with `row_count` or the corresponding ratio.

## Sparse and zero-dominance fields

- `zero_ratio`: high values, especially `>= 0.80`, support `maxabs_scaler` or no scaling for binary features.
- `sparsity_score`: high values support `maxabs_scaler`.
- `is_sparse`: direct signal for `maxabs_scaler`.
- `negative_ratio`: helps interpret whether MaxAbs scaling should preserve sign structure and whether 0 is a meaningful baseline.

## Boundedness fields

- `is_bounded_0_1`: supports `minmax_scaler` or `operation=null` if already normalized.
- `is_bounded_0_100`: supports `minmax_scaler` for percentages/scores when the feature is continuous.
- `min`, `max`, `p01`, `p99`: use together to determine whether range is natural or dominated by extremes.

## Missingness fields

- `missing_ratio`, `missing_count`: scaling should assume missing values are handled by the missing-values stage. Mention missingness only if it affects confidence or review status.

## Fields not sufficient by themselves

- `raw_dtype`: not enough to decide scaling.
- `outlier_count_iqr`: not enough without a ratio or row count.
- `unique_count`: not enough to classify a variable as ordinal, categorical or identifier without semantic evidence.
- `min` and `max`: not enough to choose `minmax_scaler` if outliers dominate the range.
