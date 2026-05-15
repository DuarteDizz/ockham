# Decision rubric

This skill selects one supported casting operation per column or returns `operation=null`. It does not impute missing values, encode categories, scale numeric values, create datetime features, drop columns or perform feature selection.

## Allowed operations

- `cast_numeric`
- `cast_datetime`
- `cast_boolean`
- `cast_categorical`
- `cast_text`
- `null`

## Step 1 — Safety gate

Return `operation=null` when any condition is true:

- `recommended_role` is `target` or `drop`;
- `semantic_type` is `target`, `identifier`, `target_proxy` or `leakage_candidate`;
- the column is already in the correct `effective_type` for its semantic role;
- the proposed cast target equals `effective_type` or `inferred_type`;
- the evidence is contradictory and casting may lose information.

Casting must never be used to repair a bad semantic classification. If the role evidence says the column is an identifier or leakage candidate, do not cast it into a feature type.

## Step 2 — Preserve code and identifier semantics

Return `operation=null` or set `requires_user_review=true` when numeric or datetime parsing succeeds but the column appears to be a code/key.

Risk signals include:

- column name contains id, uuid, cpf, cnpj, account, customer, client, user, order, invoice, ticket, sku, code, codigo, cod, tag, serial, zip, cep or index;
- `unique_ratio` is very high, especially near 1.0;
- `unique_count` is close to `row_count`;
- values may contain leading zeros;
- values are fixed-width tokens;
- semantic role from ColumnRoleAgent is not `numeric_measure` or `datetime_feature`.

High parseability is not enough. A column like `000123`, `12345678901`, `2024010001` or `88045000` can parse as numeric but must usually remain categorical/text/identifier.

## Step 3 — Boolean casting

Choose `cast_boolean` when:

- `semantic_type=boolean_feature`, or role evidence strongly indicates a flag;
- observed non-missing values represent exactly two states or boolean-like labels;
- `unique_count <= 2`, excluding missing values;
- the labels express yes/no, true/false, active/inactive, pass/fail or equivalent binary state;
- the column is not a numeric measure, ordinal score, ID or nominal class.

Return `operation=null` when the column is already boolean.

Set `requires_user_review=true` when there are two values but the semantic meaning is nominal rather than boolean, such as `male/female`, `A/B`, `urban/rural` or business classes without true/false semantics.

## Step 4 — Numeric casting

Choose `cast_numeric` when:

- current `effective_type` is text-like or `numeric_like_text`;
- `numeric_parse_ratio >= 0.98`;
- semantic evidence says the column is a numeric measure;
- the column name and cardinality do not suggest identifier/code semantics;
- any non-parseable values are compatible with missing/dirty numeric data.

Typical safe examples:

- price, amount, quantity, cost, revenue, age, duration, weight, temperature, pressure, distance;
- numeric values stored as strings due to CSV ingestion;
- numeric-like text where formatting is consistently numeric after cleaning.

Use `requires_user_review=true` when:

- `0.90 <= numeric_parse_ratio < 0.98`;
- values include currency symbols, percent signs, thousands separators or locale-specific decimal separators;
- the column may need cleaning before casting;
- semantic signals conflict with parse evidence.

Do not choose `cast_numeric` for:

- IDs/codes/document numbers;
- zip/CEP/postal codes;
- ordinal labels or ratings unless explicitly treated as numeric measures;
- mixed semantic content;
- booleans encoded as 0/1 when `cast_boolean` is more semantically correct.

## Step 5 — Datetime casting

Choose `cast_datetime` when:

- current `effective_type` is text-like or `datetime_like_text`;
- `datetime_parse_ratio >= 0.95`;
- semantic evidence says the column is a temporal feature;
- the date format appears coherent enough for deterministic conversion;
- the column is not a leakage candidate or post-event target proxy.

Typical safe examples:

- created_at, event_date, start_date, measurement_timestamp, data_inicio;
- date strings with consistent ISO-like or clearly parseable formats.

Use `requires_user_review=true` when:

- `0.80 <= datetime_parse_ratio < 0.95`;
- day/month ambiguity is likely;
- formats are mixed;
- values may be fiscal periods, batch numbers, IDs or compact codes rather than actual dates;
- date semantics may be post-outcome leakage, such as resolved_at, closed_at, cancelled_at or failure_date in a prediction problem.

Do not choose `cast_datetime` only because a parser can coerce a subset of values.

## Step 6 — Categorical casting

Choose `cast_categorical` when:

- current `effective_type` is text/object-like;
- semantic evidence says the column is categorical, ordinal or a reusable business class;
- values are repeated labels rather than natural language;
- `is_low_cardinality_categorical=true`, low `unique_count`, or low `unique_ratio` supports categorical structure;
- `avg_length` and `max_length` do not suggest free text;
- there is no identifier or leakage evidence.

High-cardinality categories require caution:

- choose `cast_categorical` only if role evidence clearly says the values are reusable categories;
- set `requires_user_review=true` when the same evidence could also indicate identifier-like values.

Do not choose `cast_categorical` for near-unique row keys, free text comments, document numbers or raw descriptions.

## Step 7 — Text casting

Choose `cast_text` when:

- semantic evidence says `free_text`;
- the column contains comments, descriptions, messages, notes, addresses or long unstructured strings;
- text length metrics support natural-language/free-text structure;
- preserving text representation is safer than forcing categorical treatment.

Do not cast short repeated category labels to text. They should remain or become categorical.

## Step 8 — No cast needed

Return `operation=null` when:

- current type is already appropriate;
- a supported cast would be a no-op, such as `numeric -> numeric`, `categorical -> categorical`, `datetime -> datetime`, `boolean -> boolean` or `text -> text`;
- no supported cast safely improves representation;
- the right downstream handling belongs to another agent;
- the evidence is insufficient.

If evidence is insufficient but the risk is material, set `requires_user_review=true` and explain the conflict.

## Confidence guidance

Use high confidence, `0.85-0.95`, when dtype, parser evidence and semantic role all agree.

Use medium confidence, `0.65-0.84`, when the cast is reasonable but some evidence is incomplete or mildly ambiguous.

Use low confidence, `<0.65`, with `requires_user_review=true` when parser evidence and semantic role conflict, or when information loss is plausible.

## Alternatives considered

Always include meaningful alternatives.

Examples:

- For `cast_numeric`, explain why `cast_categorical` or `operation=null` was rejected despite possible code-like representation.
- For `cast_datetime`, explain why `cast_text` or `operation=null` was rejected.
- For `cast_boolean`, explain why `cast_categorical` was not preferred.
- For `cast_categorical`, explain why `cast_text` and `cast_numeric` were not selected.
- For `operation=null`, explain why casting is unnecessary or unsafe.
