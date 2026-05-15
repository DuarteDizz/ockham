# Profiler fields used by FeatureDropAgent

Use only fields present in each column payload. Do not invent unavailable statistics.

## Policy and role fields

- `column_name`: use only as a weak semantic hint, never as the sole reason.
- `semantic_type`: prior semantic classification from ColumnRoleAgent or fallback inference.
- `recommended_role`: prior role recommendation such as feature, drop, review or target.
- `risk_level`: structural/leakage risk signal. High risk can justify drop when aligned with evidence.
- `protected_from_drop`: backend policy flag. If true, default to `operation=null` unless a strong supported reason exists.
- `allowed_drop_reasons`: deterministic list of structural reasons that the backend policy permits the agent to use.

Use `allowed_drop_reasons` as the primary guardrail. The model may explain a reason, but the reason should be grounded in this field and in the profiler/context evidence.

## Missingness fields

- `missing_count`: raw number of missing values. Do not use without `row_count` or `missing_ratio`.
- `missing_ratio`: primary severity measure for missingness.
- `is_mostly_missing`: deterministic high-missingness flag.
- `row_count`: denominator context for assessing impact.

Interpretation:

- `missing_ratio >= 0.95` or `is_mostly_missing=true` can justify `drop_column` when missingness is not semantically meaningful.
- High missingness may still require review when absence may encode business state.
- Row removal is not handled by this agent.

## Constancy and variation fields

- `is_constant`: direct evidence that the column has no variation.

Interpretation:

- `is_constant=true` is strong automatic-drop evidence.
- Do not perform broad low-variance feature selection unless a deterministic structural flag/reason is present.

## Cardinality and identifier fields

- `unique_count`: number of distinct observed values.
- `unique_ratio`: distinct values divided by row count or non-missing count.
- `is_identifier_candidate`: deterministic identifier or near-identifier risk flag.
- `is_low_cardinality_categorical`: protects useful small-cardinality categories from being dropped.
- `is_high_cardinality_categorical`: signals categorical complexity, not automatic invalidity.

Interpretation:

- High `unique_ratio` plus identifier semantics supports `drop_column`.
- High cardinality alone is not enough to drop.
- Low-cardinality categoricals should usually be preserved for EncodingAgent.
- High-cardinality categoricals may need EncodingAgent, review or future handling, not automatic removal.

## Free-text fields

- `is_free_text_candidate`: deterministic flag that the column may be free-form text.
- `avg_length`: average string length.
- `max_length`: maximum string length.

Interpretation:

- Long free text can be dropped only if the current pipeline does not support text featurization and the payload contains a supported drop reason.
- Short text labels may be categorical; do not drop them here.

## Leakage fields

- `semantic_type=leakage_candidate`: prior signal that the column may contain future/outcome-derived information.
- `risk_level`: severity of leakage risk.
- `allowed_drop_reasons`: should contain leakage-related support before automatic removal.

Interpretation:

- Clear high-risk leakage should be dropped.
- Ambiguous leakage should use `operation=null` with `requires_user_review=true`.
- Do not assume leakage from a suspicious name alone when the payload does not support it.

## Fields not available to this agent

Do not rely on fields that are not in the feature-drop payload. In particular, do not invent:

- correlation with target;
- model feature importance;
- mutual information;
- duplicate content hashes;
- train/test performance;
- post-drop model impact.

Those belong to later modeling/evaluation components or future deterministic profilers.
