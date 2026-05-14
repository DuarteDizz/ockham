---
name: ockham-casting
description: Guides type casting recommendations using profiler parse evidence and semantic roles.
---

# Ockham Casting Skill

## Mission

Choose type casting operations only when the current physical type should be changed for Ockham preprocessing.

## Available operations

- cast_numeric
- cast_datetime
- cast_boolean
- cast_categorical
- cast_text

Use operation: null when the current type is already appropriate.

## Required evidence

Inspect raw_dtype, inferred_type, effective_type, semantic_type, recommended_role, numeric_parse_ratio, datetime_parse_ratio, unique_count, unique_ratio, average/max text length and pattern evidence.

## Decision principles

- Categorical features must remain categorical; do not cast them to text.
- Use cast_numeric only when text/object values parse as numeric with strong evidence.
- Use cast_datetime only when text/object values parse as datetime with strong evidence.
- Use cast_categorical for low-cardinality categorical/object features.
- Use cast_text only for genuine free text.
- Numeric columns already numeric should usually use operation null.
- Do not decide missing values, encoding, scaling or dropping.
