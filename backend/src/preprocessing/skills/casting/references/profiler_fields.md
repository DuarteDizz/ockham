# Profiler fields used by CastingAgent

Use only fields present in each column payload. The deterministic profiler and prior agents are the source of evidence.

## Identity and role fields

- `column_name`: original source column name. Use it exactly in the output.
- `raw_dtype`: physical dtype observed by Pandas or the ingestion layer.
- `inferred_type`: deterministic initial type inference from the profiler.
- `effective_type`: current effective type after prior casting decisions, when any.
- `semantic_type`: semantic role inferred by ColumnRoleAgent.
- `recommended_role`: prior role decision, such as feature, target, drop or review.
- `risk_level`: prior risk signal. Treat high-risk columns conservatively.

## Parser evidence

- `numeric_parse_ratio`: share of observed non-missing text-like values that can be parsed as numeric.
  - Use this only as representation evidence.
  - It does not prove that the column is a numeric measure.
  - IDs, document numbers and codes may parse as numeric but must not be cast to numeric when semantic evidence says otherwise.

- `datetime_parse_ratio`: share of observed non-missing text-like values that can be parsed as datetime.
  - Use this only as representation evidence.
  - It does not prove that the column is a safe temporal feature.
  - Period codes, IDs and post-event timestamps require caution.

## Cardinality evidence

- `unique_count`: number of distinct non-missing values.
- `unique_ratio`: `unique_count / row_count` or equivalent ratio.
- `is_low_cardinality_categorical`: deterministic flag indicating repeated, category-like labels.
- `is_high_cardinality_categorical`: deterministic flag indicating many distinct category-like values.

Use cardinality to distinguish repeated categories from identifiers and free text. Do not treat high cardinality as automatic drop or automatic text conversion.

## Text-shape evidence

- `avg_length`: average length of non-missing string values.
- `max_length`: maximum length of non-missing string values.

Use these to distinguish short labels/codes from longer free-text fields. Long text supports `cast_text`; short repeated labels support `cast_categorical`.

## Evidence interpretation rules

- Parser ratios must be combined with semantic role.
- Semantic role must override raw parser success when there is identifier, code or leakage risk.
- Physical dtype alone is not enough: object/string can represent category, free text, numeric-like text, datetime-like text, boolean-like text or identifiers.
- Categorical dtype can still represent an identifier if values are near-unique.
- Numeric dtype can still represent ordinal labels or codes and may not need casting.
- Boolean dtype should generally remain boolean.

## Recommended evidence by operation

For `cast_numeric`, include:

- `raw_dtype`;
- `effective_type`;
- `semantic_type`;
- `numeric_parse_ratio`;
- relevant code/identifier risk evidence such as `unique_ratio` and column-name pattern when applicable.

For `cast_datetime`, include:

- `raw_dtype`;
- `effective_type`;
- `semantic_type`;
- `datetime_parse_ratio`;
- ambiguity or leakage risk evidence when applicable.

For `cast_boolean`, include:

- `semantic_type`;
- `unique_count`;
- `unique_ratio`;
- boolean-like evidence when present in the payload.

For `cast_categorical`, include:

- `semantic_type`;
- `unique_count`;
- `unique_ratio`;
- `avg_length`;
- `max_length`;
- `is_low_cardinality_categorical` or `is_high_cardinality_categorical` when present.

For `cast_text`, include:

- `semantic_type`;
- `avg_length`;
- `max_length`;
- high-cardinality/free-text evidence.
