# Profiler fields used by ColumnRoleAgent

Use only fields present in each column payload. Do not invent statistics, sample values or target relationships.

## Identity and target fields

- `column_name`: exact source column name. Never modify it. Use it for name-pattern signals such as ID, date, status, label, result, comment or code.
- `target_column`: declared target column for the experiment.
- `is_target`: true when this column is the declared target.

## Physical and inferred type fields

- `raw_dtype`: physical dtype observed by pandas or the input backend. Useful for distinguishing bool/category/numeric/datetime/string-like columns.
- `inferred_type`: deterministic initial inference. Expected values may include `numeric`, `datetime`, `boolean`, `categorical`, `numeric_like_text`, `datetime_like_text`, `text` or `empty`.

Interpretation rules:

- `raw_dtype` and `inferred_type` are evidence, not final semantic truth.
- `numeric_like_text` may be a real number, an ID, a code, a ZIP/postal code, a SKU or an account number. Use name/cardinality evidence before assigning `numeric_measure`.
- `categorical` means the physical dtype is categorical or the system already has categorical evidence; it does not automatically mean the column is safe to encode.

## Dataset scale and missingness

- `row_count`: total dataset rows. Use it to interpret ratios and counts.
- `missing_count`: number of missing values in the column.
- `missing_ratio`: share of missing values in the column.
- `is_mostly_missing`: deterministic structural flag for high missingness.
- `is_constant`: deterministic structural flag for no variation.

Use ratios before raw counts when possible.

## Cardinality and concentration

- `unique_count`: number of distinct non-missing values.
- `unique_ratio`: `unique_count / non_missing_count` or equivalent profiler ratio.
- `top_1_ratio`: share of the most frequent value.
- `top_5_ratio`: share covered by top five values.
- `rare_value_ratio`: share of observations in rare categories.
- `normalized_entropy`: distribution spread across categories; higher values usually mean less concentration.

Interpretation rules:

- High `unique_ratio` plus ID-like naming is strong identifier evidence.
- High cardinality alone is not enough to drop a feature.
- Low `unique_count` or low `unique_ratio` with short strings usually supports `categorical_feature`.
- High `top_1_ratio` may indicate quasi-constant behavior, but do not drop unless the structural rule is met or risk is clear.

## Text shape and pattern fields

- `avg_length`: average string length.
- `max_length`: maximum string length.
- `unique_pattern_count`: number of distinct structural patterns, when available.
- `top_pattern_ratio`: share of the dominant structural pattern, when available.

Interpretation rules:

- Long strings plus high cardinality usually support `free_text`.
- Short strings with repeated patterns may be categories, codes or identifiers.
- Pattern evidence should be combined with `unique_ratio` and `column_name`.

## Parse evidence

- `numeric_parse_ratio`: share of values parseable as numeric.
- `datetime_parse_ratio`: share of values parseable as datetime.

Interpretation rules:

- Strong parse evidence supports casting, but semantic classification still comes first.
- A high `numeric_parse_ratio` does not override ID/code evidence.
- A high `datetime_parse_ratio` does not override leakage/post-event evidence.
