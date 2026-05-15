# Output contract

Return one JSON object only. The top-level object must contain:

- `agent_name`: exact agent name from `output_contract.agent_name`
- `decisions`: array with exactly one decision per `output_contract.expected_columns` item
- `warnings`: array of strings

Each decision must include:

- `column_name`: exact source name from `output_contract.expected_columns`
- `operation`: `drop_column` or JSON literal `null`
- `confidence`: number from `0.0` to `1.0`
- `reason`: concise technical reason grounded in profiler/context evidence
- `evidence`: object containing concrete fields used in the decision
- `alternatives_considered`: array of relevant alternatives with `reason_not_selected`
- `params`: object; use `{}` when no parameters are required
- `requires_user_review`: boolean

## Evidence requirements

For `drop_column`, `evidence` should include the specific structural reason and the fields that prove it. Use fields present in the payload, such as:

- `allowed_drop_reasons`
- `protected_from_drop`
- `semantic_type`
- `recommended_role`
- `risk_level`
- `is_constant`
- `is_mostly_missing`
- `missing_ratio`
- `unique_ratio`
- `is_identifier_candidate`
- `is_free_text_candidate`
- `avg_length`
- `max_length`

For `operation=null`, `evidence` should explain why the feature is kept or sent to review, for example:

- protected by backend policy;
- ordinary numeric/categorical/datetime feature;
- high cardinality without identifier evidence;
- ambiguous leakage;
- potentially valuable free text;
- meaningful missingness.

## Alternative requirements

`alternatives_considered` should compare the chosen action against the realistic alternative:

- If `drop_column` is selected, include `operation: null` and explain why keeping the column is less safe.
- If `operation=null` is selected, include `operation: "drop_column"` and explain why automatic removal is not justified.

## Review requirements

Use `requires_user_review=true` when the evidence is ambiguous, business-sensitive or potentially risky but not strong enough for automatic removal.

Do not write Markdown or explanatory prose outside the JSON object.
Do not use string aliases for null operations.
Do not invent operations beyond `drop_column` and JSON literal `null`.
