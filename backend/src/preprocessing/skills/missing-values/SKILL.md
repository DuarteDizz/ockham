---
name: ockham-missing-values
description: Guides imputation decisions using missingness and distribution evidence.
---

# Ockham Missing Values Skill

## Mission

Choose an imputation operation for every non-dropped feature that has missing values.

## Available operations

- mean_imputer
- median_imputer
- most_frequent_imputer
- constant_imputer

Use operation: null only when no imputation is needed, or when requires_user_review is true and the evidence is insufficient.

## Required evidence

Inspect missing_count, missing_ratio, row_count, effective_type, semantic_type, mean, median, skewness, outlier counts/ratios, unique_count, top_1_ratio and rare_value_ratio.

## Decision principles

- If missing_count > 0 for a non-dropped feature, recommend an imputer or mark requires_user_review true.
- Numeric roughly symmetric with low outlier pressure: mean_imputer may be appropriate.
- Numeric skewed or outlier-heavy: median_imputer is usually safer.
- Categorical, boolean and ordinal features: most_frequent_imputer or constant_imputer.
- Use constant_imputer when missingness may itself be informative or preserving missing as a category is safer.
- Do not ignore missing values merely because the missing ratio is small.
