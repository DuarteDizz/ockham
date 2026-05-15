# Output contract

Return one JSON object only. Do not write Markdown or explanatory prose outside the JSON object.

Use this compact top-level shape:

```json
{
  "decisions": [
    {
      "column_name": "<exact expected column name>",
      "operation": "<allowed operation or null>",
      "confidence": 0.84,
      "reason": "Short technical reason grounded in profiler evidence.",
      "evidence": {}
    }
  ]
}
```

`agent_name`, `warnings`, `alternatives_considered`, `params` and `requires_user_review` are optional. The backend fills safe defaults when they are omitted.

## Required fields per decision

- `column_name`: exact source name from the expected column list.
- `operation`: one allowed operation for this agent, or JSON literal `null`.
- `confidence`: number from `0.0` to `1.0`.
- `reason`: concise technical reason grounded in profiler evidence.
- `evidence`: object containing concrete profiler fields used in the decision.

## Invalid output shapes

Do not return a column-keyed map.

Do not return `operations` instead of `decisions`.

Do not echo the input payload.

Invalid top-level keys include:

- `columns`
- `output_contract`
- `allowed_operations`
- `operation_null_meaning`
- `skill`
- `task`

## Column coverage requirement

The `decisions` array must contain exactly one decision for every expected column.

Do not omit columns. Do not rename columns. Do not return unknown columns.
