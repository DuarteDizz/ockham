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
- `alternatives_considered`: array of relevant alternatives with `reason_not_selected`
- `params`: object; use `{}` when no parameters are required
- `requires_user_review`: boolean

## Operation-specific params

- `drop_rows_missing`: `{"scope":"missing_in_column"}`
- `constant_imputer`: include `fill_value` when a placeholder is chosen, for example `{"fill_value":"__MISSING__"}`
- `mean_imputer`, `median_imputer`, `most_frequent_imputer`: use `{}` unless the runtime contract provides explicit parameters

## Required evidence by operation

For `drop_rows_missing`, evidence must include:

- `missing_count`
- `missing_ratio`
- `row_count`
- `effective_type`
- why row removal is safer than imputation

For numeric imputers, evidence should include available distribution signals such as:

- `skewness`
- `outlier_ratio_iqr`
- `outlier_ratio_zscore`
- `mean`
- `median`

For categorical, text-like categorical or boolean imputers, evidence should include available concentration signals such as:

- `unique_count`
- `unique_ratio`
- `top_1_ratio`
- `rare_value_ratio`

Do not write Markdown or explanatory prose outside the JSON object.
Do not use string aliases for null operations.
