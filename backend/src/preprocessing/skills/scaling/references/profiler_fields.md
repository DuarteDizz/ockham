# Profiler fields used by ScalingAgent

Use only fields present in each column payload. Do not invent missing metrics.

The scaling payload is intentionally compact. Every field should support one of four decisions: eligibility, robust scaling, min-max scaling, or sparse/zero-preserving scaling.

## Eligibility fields

- `column_name`: exact source column name. Use name patterns only as supporting evidence.
- `effective_type`: primary eligibility signal. Scaling is only for numeric or accepted numeric-like features.
- `semantic_type`: blocks scaling for identifiers, targets, categorical features, booleans, free text, datetime features and ordinal features.
- `recommended_role`: blocks target/drop/review-only structural roles when present.
- `is_target`: blocks scaling for target columns.
- `is_ordinal_numeric_candidate`: blocks scaling by default because values likely represent ordered labels, not continuous magnitude.
- `unique_count` and `unique_ratio`: identify binary/small-cardinality numeric codes, ordinal candidates and possible identifiers. Do not use high `unique_ratio` as evidence that a continuous numeric measure should be categorical.

## Spread and regularity fields

- `mean`, `median`: compare to detect skew or tail pressure.
- `std`: determines whether there is meaningful spread and whether standard scaling is useful.
- `min`, `max`: range evidence for boundedness and MaxAbs reasoning.
- `p25`, `p75`, `p95`, `p99`: quantile evidence for tails, boundedness and robust scaling.

## Shape and outlier fields

- `skewness`: `abs(skewness) >= 1.0` is a strong sign of asymmetry when available.
- `kurtosis`: high positive values support heavy-tail evidence.
- `outlier_ratio_iqr`: prefer this ratio over raw outlier counts.
- `outlier_ratio_zscore`: prefer this ratio over raw outlier counts.

Do not use raw outlier counts. The compact scaling view intentionally excludes them to reduce noise.

## Sparse and boundedness fields

- `zero_ratio`: high values, especially `>= 0.80`, support `maxabs_scaler` or no scaling for binary features.
- `is_sparse`: direct signal for `maxabs_scaler`.
- `is_bounded_0_1`: supports `minmax_scaler` or `operation=null` if already normalized.
- `is_bounded_0_100`: supports `minmax_scaler` for continuous percentages/scores/rates when outliers are not material.

## Fields intentionally omitted from the compact scaling view

The scaling view intentionally omits fields that are redundant or often distract local models:

- `raw_dtype` and `inferred_type`: `effective_type` is the eligibility signal.
- `missing_count` and `missing_ratio`: missingness is handled by the missing-values stage.
- `variance`: `std` is enough for spread.
- `p01`, `p05`, `p50`: `median`, `p25`, `p75`, `p95` and `p99` are enough for tail/range reasoning.
- `outlier_count_iqr` and `outlier_count_zscore`: ratios are safer than raw counts.
- `negative_ratio` and `sparsity_score`: `zero_ratio` and `is_sparse` are the compact sparse/zero signals.
