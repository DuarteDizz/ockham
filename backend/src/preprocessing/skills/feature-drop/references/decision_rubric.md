# Decision rubric

Follow this order exactly. This agent is a conservative structural gate, not a predictive feature selector.

## 1. Respect backend policy first

- If the column is the target, return `operation=null` and `requires_user_review=false` unless the payload explicitly asks for review.
- If `protected_from_drop=true` and `allowed_drop_reasons` is empty, return `operation=null`.
- If `protected_from_drop=true` but `allowed_drop_reasons` contains a reason, only drop when the profiler/context evidence strongly supports that reason.
- Prefer the reason classes in `allowed_drop_reasons`; do not invent a new drop reason that is not supported by the payload.

## 2. Drop direct structural invalidity

Use `drop_column` when there is direct deterministic evidence:

- `is_constant=true`.
- `allowed_drop_reasons` contains `constant_column`.

Rationale: constant columns carry no variation for model training. Do not generalize this into arbitrary low-variance feature selection unless the payload provides a supported structural flag.

## 3. Handle mostly missing columns conservatively

Use `drop_column` when:

- `is_mostly_missing=true`; or
- `missing_ratio >= 0.95`; or
- `allowed_drop_reasons` contains `mostly_missing`;

and there is no semantic evidence that missingness itself is meaningful.

Use `operation=null` with `requires_user_review=true` when:

- the column name/semantic type suggests meaningful absence;
- the column is business-sensitive;
- the column is mostly missing but may be useful as a flag in a future operation;
- the evidence is only high missingness without clear business context.

Do not recommend row removal here. Row-level missing handling belongs to the MissingValueAgent.

## 4. Drop confirmed identifiers and row-level technical keys

Use `drop_column` when identifier evidence is strong, such as:

- `semantic_type=identifier`;
- `recommended_role=drop` and identifier-related `allowed_drop_reasons`;
- `is_identifier_candidate=true` with very high `unique_ratio`;
- `allowed_drop_reasons` contains `identifier`, `identifier_name`, `column_role_identifier` or `near_unique_text_or_identifier` and the column is not a protected categorical feature.

Use `operation=null` with `requires_user_review=true` when:

- the column could be a reusable business code, asset code, SKU, product code, location code, equipment code or account segment;
- `unique_ratio` is high but `is_high_cardinality_categorical=true` and identifier evidence is not decisive;
- the column is categorical by semantics and could be handled by EncodingAgent.

High cardinality is not sufficient for dropping. High cardinality plus row-level uniqueness and identifier semantics is the relevant signal.

## 5. Drop high-risk leakage candidates

Use `drop_column` when:

- `semantic_type=leakage_candidate` and `risk_level=high`; or
- `allowed_drop_reasons` contains `leakage_candidate` or `column_role_leakage_candidate` and the reason/evidence indicates information unavailable at prediction time.

Use `operation=null` with `requires_user_review=true` when:

- `risk_level` is `medium` or unclear;
- the feature may be available at prediction time depending on the business process;
- the evidence is name-based but not structurally confirmed.

Leakage decisions should be cautious but firm: clear post-event, outcome-derived or target-proxy features are more dangerous than ordinary noisy features.

## 6. Drop unsupported long free text only when current pipeline cannot use it

Use `drop_column` when all are true:

- `semantic_type=free_text` or `is_free_text_candidate=true`;
- the text is long enough to be unsuitable for categorical encoding, for example `avg_length >= 80` or `max_length >= 200`;
- `allowed_drop_reasons` contains `unsupported_long_free_text` or equivalent free-text reason.

Use `operation=null` with `requires_user_review=true` when:

- the text may be valuable for future NLP/text-featurization;
- the text is short enough to be a category or code;
- free-text evidence is weak.

Do not drop ordinary short text categories here. Let EncodingAgent handle them.

## 7. Preserve useful categorical, boolean, datetime and numeric features

Return `operation=null` when the column is a normal feature candidate, including:

- low-cardinality categorical features;
- boolean features;
- high-cardinality categoricals that do not look like identifiers;
- ordinary numeric measures;
- datetime features without clear leakage evidence;
- ordinal features.

Do not drop because of:

- low correlation;
- unknown predictive value;
- skewness or outliers;
- many unique numeric values;
- categorical cardinality alone;
- expected encoding/scaling complexity.

## 8. Handle mixed evidence with review

If evidence points in both directions, prefer:

```json
{
  "operation": null,
  "requires_user_review": true
}
```

Common mixed cases:

- `unique_ratio` is high but the column may be a reusable business code;
- missingness is very high but the field may represent optional business state;
- leakage is plausible from the name but availability at prediction time is unknown;
- free text is unsupported today but may be valuable.

## 9. Evidence expectations by decision

For `drop_column`, include at least the relevant subset of:

- `allowed_drop_reasons`
- `protected_from_drop`
- `semantic_type`
- `recommended_role`
- `risk_level`
- `missing_ratio`
- `is_constant`
- `is_mostly_missing`
- `unique_ratio`
- `is_identifier_candidate`
- `is_free_text_candidate`
- `avg_length`
- `max_length`

For `operation=null`, include the evidence that justifies preserving or reviewing the column.
