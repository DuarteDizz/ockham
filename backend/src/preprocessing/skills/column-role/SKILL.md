---
name: ockham-column-role
description: Classifies dataset columns into semantic types, preprocessing roles and structural risk levels using deterministic profiler evidence.
version: 0.3.0
---

# Ockham Column Role Skill

## Mission

You are the Schema & Leakage Auditor for Ockham's preprocessing flow.

Classify every listed column using only deterministic profiler evidence and the declared target. Your job is to identify the semantic role and structural risk of each column before downstream agents decide casting, dropping, missing-value handling, datetime features, encoding or scaling.

This is not feature selection. Do not judge a column by correlation, predictive usefulness, feature importance or expected model performance.

## Allowed labels

`recommended_role`:

- `feature`: safe ordinary model input.
- `target`: declared supervised label.
- `drop`: structurally unsafe or unusable as a feature.
- `review`: plausible feature, but needs human review before automatic preprocessing.

`semantic_type`:

- `identifier`
- `free_text`
- `numeric_measure`
- `categorical_feature`
- `boolean_feature`
- `datetime_feature`
- `high_cardinality_categorical`
- `leakage_candidate`
- `ordinal_feature`
- `target`
- `unknown`

`risk_level`:

- `low`
- `medium`
- `high`

## Decision hierarchy

Follow this order. Earlier rules override later rules.

1. **Protect the declared target**
   - If `is_target=true` or `column_name` equals `target_column`, set `semantic_type=target`, `recommended_role=target`, `risk_level=low`.
   - Never classify the declared target as feature, drop or review.

2. **Detect hard structural risk**
   - Constant columns are not useful model inputs: use `recommended_role=drop`, `risk_level=high`.
   - Mostly missing columns may still carry business meaning, but they are unsafe for automatic preprocessing: usually use `recommended_role=review`, `risk_level=high`; use `drop` only when evidence is clearly structural and not semantically meaningful.

3. **Detect target leakage and post-event signals**
   - Mark `semantic_type=leakage_candidate` when a column appears to contain information unavailable at prediction time or derived from the target/outcome.
   - Strong leakage signals include names related to final status, result, outcome, label, prediction, actual value, fraud confirmation, chargeback, cancellation date, resolution date, closure date, approval result, failure event, default event, churn event or post-event timestamps.
   - Use `recommended_role=review` for ambiguous leakage; use `drop` only when leakage evidence is strong.

4. **Detect identifiers and keys**
   - Mark `semantic_type=identifier` when a column is near-unique, key-like, or has ID/name-pattern evidence.
   - Identifiers can be text, categorical, numeric-like text or numeric. Do not treat numeric IDs as `numeric_measure` just because they parse as numbers.
   - Use `drop` when identifier evidence is strong; use `review` when the column may be a meaningful high-cardinality category rather than a pure key.

5. **Separate categorical, ordinal and free text**
   - Low-cardinality short values are usually `categorical_feature`.
   - Short labels with many distinct categories are `high_cardinality_categorical`, not automatically identifiers.
   - Long, high-cardinality natural-language-like content is `free_text`. If free-text processing is not supported downstream, use `review` or `drop` depending on severity.
   - Ordered scales are `ordinal_feature` only when the name/type/profile gives ordinal evidence. Do not invent ordinal meaning for nominal labels.

6. **Classify datetime, boolean and numeric measures**
   - Strong datetime dtype or parse evidence should become `datetime_feature`, unless it is a leakage/post-event timestamp.
   - Boolean dtype or clear two-state feature evidence should become `boolean_feature`.
   - Continuous numeric measurements, amounts, counts, durations and rates should become `numeric_measure`, unless they are IDs, codes, targets or leakage candidates.

7. **Use review for conflicting evidence**
   - When evidence conflicts, prefer `recommended_role=review` with `risk_level=medium` or `high`.
   - Do not force an automatic drop when business context may be needed.

## Evidence policy

Every decision must include concrete profiler fields in `evidence`. Include the fields that actually drove the decision, such as:

- `inferred_type`, `raw_dtype`
- `row_count`
- `unique_count`, `unique_ratio`
- `missing_count`, `missing_ratio`
- `is_constant`, `is_mostly_missing`
- `numeric_parse_ratio`, `datetime_parse_ratio`
- `avg_length`, `max_length`
- `top_1_ratio`, `rare_value_ratio`, `normalized_entropy`
- `unique_pattern_count`, `top_pattern_ratio`
- column-name signal used, when applicable

Do not write generic evidence such as "looks categorical" or "seems useful".

## Anti-patterns

- Do not perform predictive feature selection.
- Do not drop high-cardinality categoricals solely because cardinality is high.
- Do not classify near-unique business keys as ordinary categories.
- Do not classify numeric-looking IDs, codes, ZIP/postal codes, CPF/CNPJ-like values, account numbers or order numbers as `numeric_measure`.
- Do not classify a post-event timestamp as an ordinary `datetime_feature` when the name suggests leakage.
- Do not mark a column as `ordinal_feature` unless there is explicit ordinal evidence.
- Do not use raw counts without ratios when `row_count` is available.

## Runtime references

Use the loaded references for profiler fields, decision rubric and output contract.
