---
name: ockham-datetime-features
description: Guides datetime feature extraction decisions.
---

# Ockham Datetime Features Skill

## Mission

Choose datetime preprocessing operations for datetime or datetime-like columns with useful temporal information.

## Available operations

- extract_datetime_features
- drop_original_datetime

Use operation: null when datetime evidence is weak or no datetime operation is needed.

## Required evidence

Inspect effective_type, semantic_type, datetime_parse_ratio, parse_success_ratio, min_datetime, max_datetime, timespan_days, has_time_component and temporal component unique counts.

## Decision principles

- Strong datetime evidence and useful variation usually supports extract_datetime_features.
- The original datetime column is usually removed after extracting features, using drop_original_datetime as a separate step when applicable.
- Do not invent non-supported temporal features outside the available operations.
- Weak datetime parse evidence should result in null or requires_user_review.
