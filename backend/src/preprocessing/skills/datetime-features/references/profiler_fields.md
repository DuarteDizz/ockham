# Datetime Features Profiler Fields

The `DatetimeFeatureAgent` must use only fields supplied in the profile view. These fields are deterministic outputs from Ockham profilers and prior agent decisions.

## Identity and role fields

### `column_name`

Exact dataset column name. Never rename it.

### `effective_type`

Current working type after casting decisions. Datetime operations are normally valid only for:

- `datetime`
- `datetime_like_text`

### `semantic_type`

Column role from `ColumnRoleAgent` or deterministic fallback. Useful values include:

- `datetime_feature`
- `leakage_candidate`
- `identifier`
- `free_text`
- `categorical_feature`
- `numeric_measure`

Do not extract datetime features from identifiers, free text or leakage candidates.

### `recommended_role`

Upstream role recommendation. Do not transform target/drop columns.

### `risk_level`

Upstream risk flag. High risk should push toward review unless evidence is very clear.

## Parse evidence

### `datetime_parse_ratio`

Share of values parseable as datetime during type inference. This is evidence of parseability, not proof of safe feature semantics.

### `parse_success_ratio`

Share of values successfully represented in the datetime profiler. Low values indicate weak or unreliable datetime evidence.

### `min_datetime` / `max_datetime`

Observed minimum and maximum parsed datetimes. Use for plausibility and range checks.

### `timespan_days`

Difference in days between min and max datetime. Use to assess temporal variation.

Guidance:

- `0` or near-zero: extraction usually weak unless time component varies.
- larger spans: extraction may be useful if available at prediction time.

## Component variation fields

### `year_unique_count`

Number of distinct years. Use to decide if year extraction has signal.

### `month_unique_count`

Number of distinct months. `12` suggests full yearly seasonality; low values may still be useful in short-period datasets.

### `day_unique_count`

Number of distinct day-of-month values. Use cautiously; it can be noisy.

### `weekday_unique_count`

Number of distinct weekdays. Values near `7` indicate weekday/weekend patterns may be useful.

### `hour_unique_count`

Number of distinct hours. Use `hour` only when this is greater than 1 and `has_time_component=true`.

### `has_time_component`

Whether any timestamp has non-midnight time values. If false, do not include `hour`.

## Monotonicity fields

### `is_monotonic_increasing` / `is_monotonic_decreasing`

Flags for sorted temporal order. These can indicate a natural process, but also ingestion order, row index behavior or temporal leakage risk.

Do not reject monotonic dates automatically. Use name, role and risk evidence.

## General profile fields

### `unique_count` / `unique_ratio`

Use to distinguish repeated calendar timestamps from near-unique raw timestamps. Near-unique raw timestamps often need extraction or removal rather than raw use.

## Do not overuse

- Do not use parse ratio alone to extract features.
- Do not use monotonicity alone to drop a column.
- Do not use `timespan_days` alone to decide usefulness.
- Do not infer production availability without evidence; use review when uncertain.
