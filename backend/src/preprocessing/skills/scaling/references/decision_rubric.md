# Decision rubric

This skill selects one supported scaling operation per column or returns `operation=null`. It does not create features, clip outliers, transform distributions, select features or choose model families.

## Allowed operations

- `standard_scaler`
- `robust_scaler`
- `minmax_scaler`
- `maxabs_scaler`
- `null`

## Required output reminder

Always return:

```json
{
  "agent_name": "ScalingAgent",
  "decisions": [],
  "warnings": []
}
```

Never return column-keyed maps, shorthand operation maps, single decision objects, or echoed input payloads.

## Step 1 — Eligibility gate

Return `operation=null` when any condition is true:

- `recommended_role` is `target` or `drop`;
- `is_target=true`;
- `semantic_type` is `identifier`, `target`, `target_proxy`, `leakage_candidate`, `categorical_feature`, `boolean_feature`, `free_text`, `datetime_feature` or `ordinal_feature`;
- `effective_type` is not `numeric` or accepted numeric-like;
- `is_ordinal_numeric_candidate=true`;
- `unique_count <= 2` or the feature is effectively binary;
- evidence suggests code-like numeric text rather than continuous magnitude.

Scaling is a numerical conditioning step, not a semantic correction step.

## Step 2 — Sparse and zero-dominated numeric features

Choose `maxabs_scaler` when the feature is eligible numeric and sparse/zero preservation is important.

Strong evidence:

- `is_sparse=true`;
- `zero_ratio >= 0.80`;
- zero is a meaningful baseline.

Use `maxabs_scaler` before centering scalers for these columns.

## Step 3 — Outlier-heavy or skewed continuous features

Choose `robust_scaler` when the feature is eligible continuous numeric and outlier or heavy-tail pressure is materially present.

Strong evidence:

- material `outlier_ratio_iqr` or `outlier_ratio_zscore`;
- `abs(skewness) >= 1.0`;
- high positive `kurtosis`;
- meaningful gap between `mean` and `median`;
- upper-tail spread, such as `p99` much greater than `p75` or `p95`.

Do not select `robust_scaler` from raw outlier counts alone.

## Step 4 — Bounded numeric ranges

Choose `minmax_scaler` when:

- the feature is eligible numeric;
- the range is naturally bounded or domain-constrained;
- `is_bounded_0_1=true`, `is_bounded_0_100=true`, or `min`/`max` show a stable finite range;
- outlier/tail pressure is not material;
- the feature is not binary or a small ordinal scale.

Return `operation=null` when the feature is already normalized and scaling would not materially improve conditioning.

Avoid `minmax_scaler` when outliers or heavy tails dominate the range.

## Step 5 — Regular continuous numeric features

Choose `standard_scaler` when:

- the feature is eligible continuous numeric;
- it is not sparse or zero-dominated;
- it is not already normalized or bounded in a way that makes `minmax_scaler` better;
- it does not have material outlier or heavy-tail evidence;
- it has non-trivial spread.

This is the default for regular continuous numeric measures only after the earlier rules are checked.

## Step 6 — Low value or unsafe scaling

Return `operation=null` when:

- the feature has no meaningful variance/spread;
- the feature is binary;
- the feature is an ordinal code or small numeric rating;
- evidence is contradictory and scaling could encode a wrong semantic assumption.

If uncertainty is material, set `requires_user_review=true` and explain the conflict.

## Cardinality interpretation

Do not use high `unique_ratio` as evidence that a continuous numeric measure should be categorical.

Use `unique_count` and `unique_ratio` only to block scaling for binary, small ordinal, numeric category, identifier-like or code-like columns.

Do not return `operation=null` for a valid numeric measure only because it has many unique values.

## Confidence guidance

Use high confidence (`0.85-0.95`) when semantic role, dtype and distribution evidence clearly support one scaler.

Use medium confidence (`0.65-0.84`) when scaling is reasonable but evidence is mild or incomplete.

Use low confidence (`<0.65`) with `requires_user_review=true` when semantic and numeric evidence conflict.
