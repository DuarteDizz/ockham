# Output contract

Return one JSON object only. The top-level object must contain:

- `agent_name`: exact agent name from `output_contract.agent_name`
- `decisions`: array with exactly one decision per `output_contract.expected_columns` item
- `warnings`: array of strings

Each decision must include:

- `column_name`: exact source name from `output_contract.expected_columns`
- `operation`: one allowed operation from `output_contract.allowed_operations`, or JSON literal `null`
- `confidence`: number from `0.0` to `1.0`
- `reason`: concise technical reason grounded in profiler evidence
- `evidence`: object containing concrete profiler fields used in the decision
- `alternatives_considered`: array of relevant alternatives with `reason_not_selected`
- `params`: object; use `{}` when no parameters are required
- `requires_user_review`: boolean

## Evidence object expectations

For every encoding decision, include as many of these fields as are available in the payload:

- `effective_type`
- `semantic_type`
- `recommended_role`
- `risk_level`
- `unique_count`
- `unique_ratio`
- `top_1_ratio`
- `top_5_ratio`
- `rare_value_ratio`
- `normalized_entropy`
- `is_low_cardinality_categorical`
- `is_high_cardinality_categorical`
- `is_identifier_candidate`
- `avg_length`
- `max_length`

For `ordinal_encoder`, include the field or value pattern that supports true ordering.

For `frequency_encoder`, `hashing_encoder` or `target_encoder`, include cardinality evidence and why `one_hot_encoder` was not selected.

For `target_encoder`, include the leakage-safety evidence when available. If no leakage-safety evidence is present, set `requires_user_review=true`.

For `operation=null`, include the blocking reason in `reason` and evidence, such as identifier risk, leakage risk, numeric measure, unsupported free text or ambiguous semantics.

## Alternatives

`alternatives_considered` should compare the chosen operation against realistic alternatives.

Examples:

- If choosing `one_hot_encoder`, mention why `ordinal_encoder` or `frequency_encoder` was not selected when relevant.
- If choosing `frequency_encoder`, mention why `one_hot_encoder` was rejected.
- If choosing `hashing_encoder`, mention interpretability/collision tradeoff.
- If choosing `operation=null`, mention why at least one tempting encoder was unsafe.

Do not write Markdown or explanatory prose outside the JSON object.
Do not use string aliases for null operations.
Do not invent fields not supported by JSON.
