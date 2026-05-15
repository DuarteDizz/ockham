# Output contract

Return one JSON object only. The top-level object must contain:

- `agent_name`: exactly `"ColumnRoleAgent"`
- `decisions`: array with exactly one decision per `output_contract.expected_columns` item
- `warnings`: array of strings

Each decision must include:

- `column_name`: exact source name from `output_contract.expected_columns`
- `semantic_type`: one value from `output_contract.allowed_semantic_types`
- `recommended_role`: one value from `output_contract.allowed_recommended_roles`
- `risk_level`: one value from `output_contract.allowed_risk_levels`
- `confidence`: number from `0.0` to `1.0`
- `reason`: concise technical classification reason grounded in profiler evidence
- `evidence`: object containing concrete profiler fields used in the classification

## Evidence requirements

Every `evidence` object must include at least:

- `inferred_type`
- `unique_count` or `unique_ratio` when available
- `missing_ratio` when available

Add the fields that drove the decision, for example:

- `raw_dtype`
- `row_count`
- `missing_count`
- `is_constant`
- `is_mostly_missing`
- `numeric_parse_ratio`
- `datetime_parse_ratio`
- `avg_length`
- `max_length`
- `top_1_ratio`
- `rare_value_ratio`
- `normalized_entropy`
- `unique_pattern_count`
- `top_pattern_ratio`
- `name_signal`

## Confidence guidance

- `0.90-1.00`: direct target, constant, clear ID, clear dtype or strong deterministic evidence.
- `0.75-0.89`: strong but not perfect multi-field evidence.
- `0.55-0.74`: plausible classification with ambiguity; usually pair with `recommended_role=review` when risk matters.
- `<0.55`: evidence is weak or conflicting; use `semantic_type=unknown` or `recommended_role=review`.

## Forbidden output

- Do not include `operation` for ColumnRoleAgent decisions.
- Do not include Markdown or prose outside the JSON object.
- Do not omit a column from `output_contract.expected_columns`.
- Do not add decisions for columns that were not provided.
- Do not use labels outside the allowed enums.
