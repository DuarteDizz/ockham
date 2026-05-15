# Decision rubric

This rubric converts deterministic profiler and role evidence into one encoding decision per column.

Use the order below. Earlier safety rules override later encoding preferences.

## 1. Eligibility and safety gate

Return `operation=null` when any of the following is true:

- `recommended_role` is `target` or `drop`;
- `semantic_type` is `identifier`, `target_proxy`, `leakage_candidate`, `free_text`, `datetime_feature` or `numeric_feature`;
- `is_identifier_candidate=true` and there is no strong evidence that the column is a reusable categorical feature;
- `risk_level=high` and the risk is related to leakage, target proxy or identifier behavior;
- `effective_type` is `numeric` or `numeric_like_text` and `semantic_type` is not categorical, ordinal or boolean.

Use `requires_user_review=true` when evidence is mixed, especially when a column has useful-looking labels but also near-identifier behavior.

Do not encode target, dropped, leakage-risk or identifier columns.

## 2. Free text and text-like safety

For `effective_type=text`, distinguish short repeated labels from free text.

Prefer categorical encoding only when most evidence points to repeated labels:

- low or moderate `unique_count`;
- low `unique_ratio`;
- short `avg_length` and `max_length`;
- repeated categories through `top_1_ratio`/`top_5_ratio`;
- `semantic_type` in `categorical_feature`, `ordinal_feature`, `boolean_feature` or `high_cardinality_categorical`.

Return `operation=null` with `requires_user_review=true` when text looks like free-form natural language, notes, descriptions, comments, logs or long identifiers.

## 3. Boolean and strictly binary features

Use `label_encoder` when:

- `semantic_type=boolean_feature` or `effective_type=boolean`;
- or `unique_count=2` and the values represent a true binary state;
- the column is not target, identifier or leakage-risk.

Use params `{}` unless the runtime provides a supported mapping contract.

Use `one_hot_encoder` instead of `label_encoder` when binary labels are nominal and explicit indicators are safer for interpretability.

Set `requires_user_review=true` when the binary values may represent an encoded target/proxy or business-sensitive state.

## 4. True ordinal categorical features

Use `ordinal_encoder` only when ordinal semantics are credible.

Strong evidence:

- `semantic_type=ordinal_feature`;
- known ordered labels such as low/medium/high, small/medium/large, bronze/silver/gold, junior/pleno/senior;
- ratings, risk bands, priority levels or maturity levels;
- ordered numeric-like categories intentionally classified as ordinal by earlier agents.

Do not use `ordinal_encoder` for:

- cities, products, departments, teams, names, suppliers, routes, equipment tags or other nominal classes;
- arbitrary alphanumeric codes;
- categories that are only alphabetically sortable;
- high-cardinality identifiers.

If the order is plausible but not explicit, return `operation=null` or use a nominal encoder with `requires_user_review=true`.

## 5. Low-cardinality nominal categoricals

Use `one_hot_encoder` when:

- the column is a valid nominal categorical feature;
- `is_low_cardinality_categorical=true` or `unique_count` is small enough to avoid dimensional explosion;
- `unique_ratio` is low;
- category labels are repeated and not row-specific;
- no ordinal relationship is credible.

Default thresholds:

- strong one-hot fit: `unique_count <= 15` and `unique_ratio` clearly low;
- acceptable one-hot fit: `unique_count <= 30` when row count is sufficient and the column is clearly nominal;
- above that, consider frequency or hashing unless interpretability demands explicit indicators.

Include cardinality evidence in the decision.

## 6. Medium-cardinality categorical features

Use `frequency_encoder` when:

- the column is a valid categorical feature;
- one-hot would create too many columns;
- the feature is not near-unique;
- category frequency itself is a useful deterministic signal;
- `unique_count` is moderate/high or `is_high_cardinality_categorical=true`;
- interpretability should remain better than hashing.

Caution:

- frequency encoding can map different categories with the same frequency to the same value;
- frequency values may create a numeric relationship that is not semantic;
- set `requires_user_review=true` if the feature is business-critical or near identifier-like.

## 7. Very high-cardinality categorical features

Use `hashing_encoder` when:

- the column is a legitimate reusable categorical signal;
- cardinality is very high;
- one-hot expansion is impractical;
- frequency encoding is too lossy or unstable;
- fixed-dimensional output is more important than direct interpretability.

Do not use `hashing_encoder` for row identifiers or near-unique keys. Hashing an ID still lets the model memorize rows or entities and does not solve leakage.

Use `requires_user_review=true` when `unique_ratio` is high, `rare_value_ratio` is high, or the distinction between high-cardinality category and identifier is ambiguous.

## 8. Target-aware encoding

Use `target_encoder` only in exceptional cases.

Required evidence:

- the feature is high-cardinality categorical;
- it is not an identifier, target proxy or leakage candidate;
- one-hot is impractical;
- frequency/hash encoding is clearly less appropriate;
- leakage-safe fitting is available in the training pipeline.

Because target encoding uses target information, set `requires_user_review=true` unless the payload explicitly proves leakage-safe cross-fitting or equivalent fit-only-on-training behavior.

Never recommend `target_encoder` for low-cardinality categoricals, target proxies, post-event fields or identifiers.

## 9. Near-unique and identifier-like columns

Use `operation=null` when:

- `unique_ratio` is very high;
- `unique_count` is close to row count;
- `top_1_ratio` is very low;
- `rare_value_ratio` is high;
- labels look like IDs, hashes, UUIDs, document numbers, account numbers, tickets, orders, invoices, serials, tags or transaction keys.

If the column might be a reusable entity/category rather than a row ID, keep `operation=null` and set `requires_user_review=true` instead of choosing a risky encoding.

## 10. Confidence guidance

Use high confidence (`>=0.85`) only when role, type, cardinality and distribution evidence agree.

Use medium confidence (`0.65` to `0.84`) when the encoding is plausible but cardinality or semantic evidence is not perfect.

Use low confidence (`<0.65`) with `requires_user_review=true` when:

- high-cardinality vs identifier is ambiguous;
- ordinal semantics are plausible but not explicit;
- text may be free-form;
- target encoding seems useful but leakage safety is not proven.

## 11. Evidence discipline

Every decision must include:

- `effective_type`;
- `semantic_type`;
- `recommended_role`;
- `unique_count`;
- `unique_ratio`;
- at least one distribution field: `top_1_ratio`, `top_5_ratio`, `rare_value_ratio` or `normalized_entropy`;
- `is_identifier_candidate` when available.

For text-like columns, also include `avg_length` and `max_length` when available.

For high-cardinality choices, include why one-hot was rejected.

For ordinal choices, include the evidence that the categories are ordered.
