# Profiler fields used by EncodingAgent

Use only fields present in each column payload. Do not invent statistics.

## Role and safety fields

- `effective_type`: current effective type after previous stages. Encoding is normally relevant for `categorical`, `text` and `boolean`.
- `semantic_type`: role inferred by earlier agents. Use this to separate nominal, ordinal, boolean, identifier, free text, leakage and numeric semantics.
- `recommended_role`: target/drop/feature guidance from earlier role analysis. Do not encode target or drop columns.
- `risk_level`: safety signal. High risk should usually lead to `operation=null` or `requires_user_review=true`.
- `is_identifier_candidate`: deterministic signal that the column may behave like an identifier. Treat this as a blocking or review signal.

## Cardinality fields

- `unique_count`: number of distinct observed values. Use it to estimate output dimensionality and high-cardinality risk.
- `unique_ratio`: distinct values divided by row count. High values indicate identifier-like or sparse category behavior.
- `is_low_cardinality_categorical`: deterministic flag that a categorical feature has manageable cardinality.
- `is_high_cardinality_categorical`: deterministic flag that a categorical feature has many levels.

Use cardinality with semantics. High cardinality alone does not prove identifier behavior; low cardinality alone does not prove a feature is useful.

## Distribution fields

- `top_1_ratio`: share of the most common category. Very high values indicate dominance; very low values with high cardinality can indicate near-unique behavior.
- `top_5_ratio`: combined share of top categories. Useful for deciding whether most data is concentrated in a few levels.
- `rare_value_ratio`: share of rare category levels. High values increase one-hot instability and may indicate identifier-like data.
- `normalized_entropy`: dispersion of category distribution. High entropy with high cardinality can indicate many evenly distributed categories.

## Text-shape fields

- `avg_length`: average string length. Long values may indicate free text or descriptions rather than category labels.
- `max_length`: maximum string length. Very long values should make the agent cautious about categorical encoding.

## Recommended usage by operation

- `label_encoder`: use role/type evidence for boolean or strictly binary features.
- `ordinal_encoder`: use `semantic_type` and ordered-label evidence. Cardinality alone is insufficient.
- `one_hot_encoder`: use low cardinality, low identifier risk and nominal semantics.
- `frequency_encoder`: use high-cardinality categorical evidence and category-frequency distribution fields.
- `hashing_encoder`: use very high cardinality plus acceptable interpretability loss; do not use for identifiers.
- `target_encoder`: use only with high-cardinality categorical evidence and leakage-safety caution.
- `operation=null`: use for identifiers, leakage candidates, unsupported free text, numeric measures, datetime columns or ambiguous unsafe cases.
