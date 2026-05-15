# Datetime Features Output Contract

Return one JSON object only. The top-level object must contain:

- `agent_name`
- `decisions`
- `warnings`

Do not write Markdown or explanatory prose outside the JSON object.

## Top-level shape

```json
{
  "agent_name": "DatetimeFeatureAgent",
  "decisions": [],
  "warnings": []
}
```

## Decision shape

Each decision must use the exact column name from `output_contract.expected_columns`.

```json
{
  "column_name": "created_at",
  "operation": "extract_datetime_features",
  "confidence": 0.87,
  "reason": "The column has strong datetime evidence and meaningful month/weekday variation without explicit leakage signals.",
  "evidence": {
    "effective_type": "datetime",
    "semantic_type": "datetime_feature",
    "parse_success_ratio": 1.0,
    "datetime_parse_ratio": 1.0,
    "timespan_days": 730,
    "month_unique_count": 12,
    "weekday_unique_count": 7,
    "has_time_component": false
  },
  "alternatives_considered": [
    {
      "operation": "drop_original_datetime",
      "reason_not_selected": "Derived components preserve useful calendar signal more safely than retaining only a raw timestamp."
    }
  ],
  "params": {
    "components": ["year", "month", "day", "weekday"],
    "drop_original": true
  },
  "requires_user_review": false
}
```

## Allowed operations

- `extract_datetime_features`
- `drop_original_datetime`
- `null`

Use JSON literal `null`, not the string `"null"`.

## Required evidence fields

Include all available fields relevant to the decision:

- `effective_type`
- `semantic_type`
- `recommended_role`
- `risk_level`
- `datetime_parse_ratio`
- `parse_success_ratio`
- `min_datetime`
- `max_datetime`
- `timespan_days`
- `has_time_component`
- `year_unique_count`
- `month_unique_count`
- `day_unique_count`
- `weekday_unique_count`
- `hour_unique_count`
- `is_monotonic_increasing`
- `is_monotonic_decreasing`
- `unique_count`
- `unique_ratio`

Do not fabricate missing evidence. If a field is unavailable, omit it or set it to `null` only when it was explicitly present as null in the payload.

## Params by operation

### `extract_datetime_features`

Recommended params:

```json
{
  "components": ["year", "month", "day", "weekday"],
  "drop_original": true
}
```

Allowed component names:

- `year`
- `quarter`
- `month`
- `day`
- `weekday`
- `hour`

Only include components justified by variation evidence. Do not include unsupported components such as holidays, lags, rolling windows, business calendars or time-since-target.

### `drop_original_datetime`

Recommended params:

```json
{
  "reason_code": "raw_datetime_not_model_ready"
}
```

Use a concise `reason_code`, such as:

- `low_temporal_variation`
- `raw_datetime_not_model_ready`
- `possible_ingestion_timestamp`
- `possible_post_event_timestamp`
- `unsafe_temporal_feature`

### `null`

Use empty params:

```json
{}
```

If null is chosen because of ambiguity or risk, set `requires_user_review=true`.

## Required warnings

Add a warning when:

- a datetime-like column has weak parse evidence;
- a timestamp may be post-event or unavailable at prediction time;
- a monotonic timestamp looks like ingestion/order metadata;
- extraction is skipped due to insufficient supported operation coverage.
