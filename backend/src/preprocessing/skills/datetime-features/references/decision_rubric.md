# Datetime Features Decision Rubric

This rubric governs the `DatetimeFeatureAgent`. Use only deterministic profiler fields and prior agent outputs in the payload.

## Valid operations

- `extract_datetime_features`
- `drop_original_datetime`
- `null`

## Required decision order

### 1. Exclude unsafe roles first

Return `operation=null` and usually `requires_user_review=true` when any of the following is true:

- `recommended_role` is `target` or the column is the target column.
- The column was already dropped.
- `semantic_type` is `identifier`, `free_text`, `leakage_candidate`, `target_proxy`, `operational_metadata`, or another non-feature role.
- The column name strongly suggests post-event information and the payload does not prove it is available at prediction time.

Suspicious post-event name patterns include, but are not limited to:

- `closed_at`, `resolved_at`, `finished_at`, `completed_at`
- `cancelled_at`, `churn_date`, `termination_date`
- `failure_date`, `repair_date`, `maintenance_completed_at`
- `payment_date`, `settlement_date`, `delivery_date` when predicting whether the event happens
- `outcome_date`, `result_date`, `approval_date`, `decision_date`

Do not classify all event dates as leakage. The question is whether the timestamp would be known at prediction time.

### 2. Validate datetime evidence

Strong datetime evidence usually requires:

- `effective_type` in `datetime` or `datetime_like_text`, or `semantic_type=datetime_feature`; and
- `parse_success_ratio` or `datetime_parse_ratio` high enough to trust parsing; and
- non-empty `min_datetime`/`max_datetime` where available.

Weak evidence:

- low parse ratios;
- many unparsable strings;
- free-text-like columns that merely contain some date-looking values;
- identifiers or codes with date-like substrings.

For weak evidence, prefer `operation=null` with review if the column might still matter.

### 3. Evaluate temporal variation

Useful extraction requires variation. Consider:

- `timespan_days`
- `year_unique_count`
- `month_unique_count`
- `day_unique_count`
- `weekday_unique_count`
- `hour_unique_count`
- `unique_count` and `unique_ratio`
- `has_time_component`

Guidance:

- If `timespan_days` is 0 or near 0 and component unique counts are 1, extraction is usually not useful.
- If `month_unique_count`, `weekday_unique_count` or `hour_unique_count` show variation, extraction may be useful.
- Do not include `hour` when `has_time_component=false` or `hour_unique_count <= 1`.
- If only year varies in a narrow period, be cautious: year may act as a temporal split proxy rather than reusable signal.

### 4. Check monotonic/index-like behavior

If `is_monotonic_increasing` or `is_monotonic_decreasing` is true, the column may be:

- a natural event timestamp;
- a row ingestion timestamp;
- a temporal index used for splitting;
- a proxy for data collection order.

Monotonicity is not automatically bad. But if the column looks like ingestion/order metadata (`created_at`, `inserted_at`, `loaded_at`, `snapshot_date`, `extract_date`, `batch_date`), prefer review or `drop_original_datetime` unless extraction is clearly useful and safe.

### 5. Choose `extract_datetime_features`

Use this operation when:

- datetime evidence is strong;
- the column is a valid feature;
- there is meaningful component variation;
- there is no strong leakage/post-event risk;
- calendar components can represent signal without using future information.

Recommended params pattern:

```json
{
  "components": ["year", "month", "day", "weekday"],
  "drop_original": true
}
```

Include `hour` only when `has_time_component=true` and `hour_unique_count > 1`.

Avoid adding components that have no variation.

### 6. Choose `drop_original_datetime`

Use this operation when:

- the raw datetime should not remain as a feature;
- extraction is not useful, too risky or too low-variation;
- the column is datetime-like but should be removed from model input rather than transformed.

Examples:

- a constant snapshot date;
- an ingestion timestamp with no stable predictive meaning;
- a row-order timestamp that should not become a numeric proxy;
- a datetime-like column marked for review where retaining the raw value would be unsafe.

### 7. Use `null`

Use `operation=null` when:

- no datetime operation is needed;
- the column is handled by another stage;
- evidence is insufficient;
- the safest answer is human review.

If the reason is risk or ambiguity, set `requires_user_review=true`.

## Confidence calibration

- `0.90–1.00`: Strong datetime evidence, clear role, clear variation, no leakage signs.
- `0.75–0.89`: Good evidence but mild ambiguity in component usefulness or production availability.
- `0.55–0.74`: Mixed evidence, weak parse ratio, low variation or ambiguous timestamp semantics. Usually review.
- `<0.55`: Unsafe or insufficient evidence. Prefer `null` with review.

## Alternatives to mention

For each decision, include alternatives considered when relevant:

- `extract_datetime_features` vs `drop_original_datetime`
- `extract_datetime_features` vs `null`
- `drop_original_datetime` vs `null`
- why unsupported options such as lags, rolling windows or cyclical encoders were not selected
