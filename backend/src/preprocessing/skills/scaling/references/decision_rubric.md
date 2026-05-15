# Decision rubric

This skill selects one supported scaling operation per column or returns `operation=null`. It does not create new features, clip outliers, transform distributions, select features or choose model families.

## Allowed operations

- `standard_scaler`
- `robust_scaler`
- `minmax_scaler`
- `maxabs_scaler`
- `null`

## Step 1 — Eligibility gate

Return `operation=null` when any condition is true:

- `recommended_role` is `target` or `drop`;
- the column name equals the target column when target information is present;
- `semantic_type` is one of `identifier`, `target`, `target_proxy`, `leakage_candidate`, `categorical_feature`, `boolean_feature`, `free_text`, `datetime_feature` or `ordinal_feature`;
- `effective_type` is not `numeric` or an already accepted numeric-like type;
- `is_ordinal_numeric_candidate=true`;
- `unique_count <= 2` or the feature is effectively binary;
- the evidence suggests code-like numeric text rather than a continuous quantity.

Scaling is a numerical conditioning step, not a semantic correction step.

## Step 2 — Sparse and zero-dominated numeric features

Choose `maxabs_scaler` when the feature is eligible numeric and any strong sparsity signal exists:

- `is_sparse=true`;
- `sparsity_score` is high;
- `zero_ratio >= 0.80`;
- zero is a meaningful baseline and should remain zero after transformation.

Use `maxabs_scaler` before considering `standard_scaler`, `robust_scaler` or `minmax_scaler` for these columns.

Rationale: MaxAbs scaling rescales by maximum absolute value without centering, so it preserves zero entries and sparse structure.

## Step 3 — Bounded numeric ranges

Choose `minmax_scaler` when:

- the feature is eligible numeric;
- the range is naturally bounded or domain-constrained;
- `is_bounded_0_1=true`, `is_bounded_0_100=true`, or the profiler exposes a stable finite range;
- outlier/tail pressure is not material;
- the feature is not binary or a small ordinal scale.

Return `operation=null` when the feature is already normalized and scaling would not materially improve conditioning.

Avoid `minmax_scaler` when:

- `outlier_ratio_iqr` or `outlier_ratio_zscore` is material;
- `abs(skewness) >= 1.0` with strong tail evidence;
- `p99` is far from `p75` or the range is dominated by extremes.

## Step 4 — Outlier-heavy or skewed continuous features

Choose `robust_scaler` when:

- the feature is eligible continuous numeric;
- outlier or heavy-tail pressure is materially present;
- sparsity/zero-dominance does not make `maxabs_scaler` safer.

Strong evidence includes:

- `outlier_ratio_iqr` materially above a small noise level;
- `outlier_ratio_zscore` materially above a small noise level;
- `abs(skewness) >= 1.0`;
- high positive `kurtosis`;
- large gap between `mean` and `median`;
- large upper-tail spread, such as `p99` much greater than `p75` or `p95`.

Do not select `robust_scaler` from raw outlier counts alone. A raw count must be interpreted against `row_count`.

## Step 5 — Regular continuous numeric features

Choose `standard_scaler` when:

- the feature is eligible continuous numeric;
- it is not sparse or zero-dominated;
- it is not already normalized or bounded in a way that makes `minmax_scaler` better;
- it does not have material outlier or heavy-tail evidence;
- it has non-trivial variance/spread.

This is the default for regular continuous numeric measures after all exclusion rules and higher-priority scaler rules have been checked.

## Step 6 — Low value or unsafe scaling

Return `operation=null` when:

- the feature has no meaningful variance;
- the feature is binary;
- the feature is an ordinal code or small numeric rating;
- the evidence is contradictory and scaling could encode a wrong semantic assumption.

If the uncertainty is material, set `requires_user_review=true` and explain the conflict.

## Confidence guidance

Use high confidence, `0.85-0.95`, when type, semantic role and distribution evidence all point to one scaler.

Use medium confidence, `0.65-0.84`, when scaling is reasonable but distribution evidence is incomplete or mild.

Use low confidence, `<0.65`, with `requires_user_review=true` when semantic and numeric evidence conflict.

## Alternatives considered

Always include meaningful alternatives.

Examples:

- For `robust_scaler`, explain why `standard_scaler` was rejected due to outlier or heavy-tail pressure.
- For `maxabs_scaler`, explain why centering scalers were rejected due to sparse/zero-dominated structure.
- For `minmax_scaler`, explain why `standard_scaler` was not preferred for a naturally bounded range.
- For `operation=null`, explain why scaling is unsafe or unnecessary.
