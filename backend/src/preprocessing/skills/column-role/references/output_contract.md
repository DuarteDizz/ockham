# Output contract

Return one JSON object only. Do not write Markdown or explanatory prose outside the JSON object.

Use this compact top-level shape:

```json
{
  "decisions": [
    {
      "column_name": "<exact expected column name>",
      "semantic_type": "numeric_measure",
      "recommended_role": "feature",
      "risk_level": "low",
      "confidence": 0.84,
      "reason": "Short classification reason grounded in profiler evidence.",
      "evidence": {}
    }
  ]
}
```

`agent_name` and `warnings` are optional. The backend fills safe defaults when they are omitted.

## Required fields per decision

- `column_name`: exact source name from the expected column list.
- `semantic_type`: one supported semantic type.
- `recommended_role`: `feature`, `target`, `drop` or `review`.
- `risk_level`: `low`, `medium` or `high`.
- `confidence`: number from `0.0` to `1.0`.
- `reason`: concise classification reason grounded in profiler evidence.
- `evidence`: object containing concrete profiler fields used in the decision.

## Invalid fields for ColumnRoleAgent

Do not return:

- `operation`
- `params`
- `requires_user_review`
- `alternatives_considered`

Use `recommended_role`, not `role`.

## Invalid output shapes

Do not return a column-keyed map.

Do not echo the input payload.

Invalid top-level keys include:

- `columns`
- `output_contract`
- `allowed_operations`
- `skill`
- `task`

## Column coverage requirement

The `decisions` array must contain exactly one decision for every expected column.

Do not omit columns. Do not rename columns. Do not return unknown columns.
