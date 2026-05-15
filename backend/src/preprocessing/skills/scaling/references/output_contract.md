# Output contract

Return one JSON object only. Do not write Markdown or explanatory prose outside the JSON object.

The top-level object must contain:

- `agent_name`: exact agent name from `output_contract.agent_name`.
- `decisions`: array with exactly one decision per `output_contract.expected_columns` item.
- `warnings`: array of strings. Use `[]` when there are no warnings.

Each decision must include:

- `column_name`: exact source name from `output_contract.expected_columns`.
- `operation`: one allowed operation from `output_contract.allowed_operations`, or JSON literal `null`.
- `confidence`: number from `0.0` to `1.0`.
- `reason`: concise technical reason grounded in profiler evidence.
- `evidence`: object containing concrete profiler fields used in the decision.
- `alternatives_considered`: array of objects with `operation` and `reason_not_selected`.
- `params`: object. Use `{}` for all currently supported scaling operations unless runtime metadata explicitly provides supported parameters.
- `requires_user_review`: boolean.

## Valid operations

Use only:

- `standard_scaler`
- `robust_scaler`
- `minmax_scaler`
- `maxabs_scaler`
- JSON literal `null`

Do not return string aliases for null operations.

## Required evidence by operation

For `standard_scaler`, include evidence such as:

- `effective_type`;
- `semantic_type`;
- `std` or `variance`;
- `skewness`;
- `outlier_ratio_iqr` or `outlier_ratio_zscore`;
- `zero_ratio` or `is_sparse` when available.

For `robust_scaler`, include evidence such as:

- `effective_type`;
- `outlier_ratio_iqr`;
- `outlier_ratio_zscore`;
- `skewness`;
- `kurtosis`;
- quantile evidence such as `p75`, `p95`, `p99`;
- mean-vs-median gap when available.

For `minmax_scaler`, include evidence such as:

- `effective_type`;
- `min`;
- `max`;
- `is_bounded_0_1`;
- `is_bounded_0_100`;
- tail evidence showing that range is not dominated by outliers.

For `maxabs_scaler`, include evidence such as:

- `effective_type`;
- `is_sparse`;
- `sparsity_score`;
- `zero_ratio`;
- `min`;
- `max`;
- `negative_ratio`.

For `operation=null`, include evidence explaining why scaling is unsafe or unnecessary, such as:

- target/drop role;
- semantic type not eligible;
- binary/boolean feature;
- ordinal numeric candidate;
- no meaningful variance;
- already normalized range;
- conflicting evidence requiring review.

## Review requirement

Set `requires_user_review=true` when the decision depends on ambiguous semantics, especially when numeric dtype conflicts with code-like, ordinal-like or ID-like evidence.

Do not mark routine distribution-based scaler choices for review when evidence is clear.

## Example shape

```json
{
  "agent_name": "ScalingAgent",
  "decisions": [
    {
      "column_name": "transaction_value",
      "operation": "robust_scaler",
      "confidence": 0.88,
      "reason": "Continuous numeric feature with material skew and IQR outlier pressure; robust scaling is safer than mean/variance scaling.",
      "evidence": {
        "effective_type": "numeric",
        "semantic_type": "numeric_feature",
        "skewness": 2.4,
        "outlier_ratio_iqr": 0.07,
        "zero_ratio": 0.0
      },
      "alternatives_considered": [
        {
          "operation": "standard_scaler",
          "reason_not_selected": "Mean and variance are likely influenced by tail/outlier pressure."
        }
      ],
      "params": {},
      "requires_user_review": false
    }
  ],
  "warnings": []
}
```
