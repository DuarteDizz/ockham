# Output contract

Return one JSON object only. The top-level object must contain:

- `agent_name`: exact agent name from `output_contract.agent_name`
- `decisions`: array with exactly one decision per `output_contract.expected_columns` item
- `warnings`: array of strings

Each decision must include:

- `column_name`: exact source name from `output_contract.expected_columns`
- `operation`: one allowed operation from `output_contract.allowed_operations`, or JSON literal `null`
- `confidence`: number from 0.0 to 1.0
- `reason`: concise technical reason grounded in profiler evidence
- `evidence`: object containing concrete profiler fields used in the decision
- `alternatives_considered`: array of relevant alternatives with `operation` and `reason_not_selected`
- `params`: object; use `{}` when no parameters are required
- `requires_user_review`: boolean


## No-op cast rule

If the cast target is the same as the column's current `effective_type` or `inferred_type`, return `operation=null`. Do not return no-op cast steps such as `cast_numeric` for an already numeric column.

## Decision-specific expectations

For `cast_numeric`:

- `evidence` must include `numeric_parse_ratio`, `semantic_type`, `effective_type` and at least one signal that identifier/code risk was considered.
- `reason` must explain why the column is a numeric measure rather than a code.

For `cast_datetime`:

- `evidence` must include `datetime_parse_ratio`, `semantic_type` and `effective_type`.
- `reason` must explain why the column is a temporal feature and not a period code, ID or leakage proxy.

For `cast_boolean`:

- `evidence` must include `semantic_type`, `unique_count` and the boolean-like signal available in the payload.
- `reason` must explain why boolean semantics are safer than categorical semantics.

For `cast_categorical`:

- `evidence` must include `semantic_type`, `unique_count`, `unique_ratio` and text/cardinality evidence.
- `reason` must explain why the values are reusable labels rather than identifiers or free text.

For `cast_text`:

- `evidence` must include `semantic_type` and text-length evidence such as `avg_length` or `max_length`.
- `reason` must explain why free-text representation is safer than categorical representation.

For `operation=null`:

- `reason` must state whether no cast is needed, casting is unsafe, the column is protected, or review is required.
- Use `requires_user_review=true` when casting is plausible but risky.

## Strict formatting rules

Do not write Markdown or explanatory prose outside the JSON object.
Do not use string aliases for null operations.
Do not invent operations or parameters.
Use exact column names from the expected columns list.
