# Profiler fields used by MissingValueAgent

Use only fields present in each column payload. Do not invent unavailable statistics.

## Identity and role fields

- `column_name`: use cautiously for semantic hints such as target labels, event dates, cancellation reasons or conditional fields.
- `effective_type`: primary compatibility field for choosing an operation.
- `semantic_type`: semantic interpretation from earlier agents when available.
- `recommended_role`: role/risk signal from earlier agents.
- `is_target`: target columns must not be imputed; missing labels usually require row removal or review.
- `was_dropped`: dropped columns must not receive missing-value treatment.

## Missingness fields

- `missing_count`: raw count of missing values. Never use alone without `row_count` or `missing_ratio`.
- `missing_ratio`: primary severity signal for missingness.
- `row_count`: denominator context and row-removal impact.
- `is_mostly_missing`: high-level signal that simple imputation or row removal may be unsafe.

## Numeric distribution fields

- `mean`: useful for regular numeric distributions, but sensitive to outliers.
- `median`: robust numeric center.
- `std`: spread signal.
- `skewness`: use to distinguish mean vs median imputation.
- `kurtosis`: tail-risk context when available.
- `outlier_count_iqr`: raw outlier count; prefer paired ratio.
- `outlier_ratio_iqr`: robust outlier pressure signal.
- `outlier_count_zscore`: raw z-score outlier count; prefer paired ratio.
- `outlier_ratio_zscore`: z-score outlier pressure signal.

## Categorical and boolean fields

- `unique_count`: cardinality context.
- `unique_ratio`: identifier/free-text/categorical context.
- `top_1_ratio`: dominance of most frequent category; useful for mode imputation risk.
- `rare_value_ratio`: rare-category context.
- `is_low_cardinality_categorical`: categorical context flag.

## How to use these fields

- Use ratios before counts.
- Use `missing_ratio` plus `row_count` before recommending row removal.
- Use `skewness` and outlier ratios before choosing mean vs median.
- Use `top_1_ratio` and semantic hints before choosing mode vs constant imputation.
- Use `column_name` as a hint, never as the only reason.
