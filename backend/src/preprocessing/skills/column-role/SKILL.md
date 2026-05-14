---
name: ockham-column-role
description: Classifies dataset columns into semantic types and preprocessing roles.
---

# Ockham Column Role Skill

## Mission

Classify every listed column. This is schema classification, not feature selection and not relevance ranking.

## Allowed labels

recommended_role: feature, target, drop, review
semantic_type: identifier, free_text, numeric_measure, categorical_feature, boolean_feature, datetime_feature, high_cardinality_categorical, leakage_candidate, ordinal_feature, target, unknown
risk_level: low, medium, high

## Required reasoning

Use profiler evidence such as inferred_type, raw_dtype, missing_ratio, unique_count, unique_ratio, parse ratios, text length, entropy and target_column.

## Decision principles

- The declared target column must be classified as target.
- Near-unique identifier-like columns should be identifier and usually drop/review.
- Low-cardinality object/text columns are usually categorical_feature, not free_text.
- Long high-cardinality text is free_text or review.
- Numeric columns are numeric_measure unless evidence indicates ordinal scale, identifier coding or leakage.
- Include every column even if it looks weak for prediction.

## Output contract

Return JSON with agent_name, decisions and warnings. Each decision must include column_name, semantic_type, recommended_role, risk_level, confidence, reason and evidence.
