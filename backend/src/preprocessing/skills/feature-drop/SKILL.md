---
name: ockham-feature-drop
description: Conservative structural column removal skill.
---

# Ockham Feature Drop Skill

## Mission

Decide whether a column should be removed for structural preprocessing reasons. This skill is not feature selection.

## Available operations

- drop_column

Use operation: null when the column should continue to downstream agents.

## Required evidence

Inspect semantic_type, recommended_role, risk_level, missing_ratio, unique_ratio, is_constant, is_mostly_missing, identifier evidence, free-text evidence and potential leakage evidence.

## Decision principles

- Default to operation null.
- Use drop_column only for structural invalidity: identifier, constant, mostly missing, leakage candidate, unsupported long free text, duplicate/operationally invalid evidence or explicit drop role.
- Never drop a low-cardinality categorical feature because it has few unique values.
- Never drop ordinary numeric features because they appear weak or have many unique values.
- Do not judge predictive importance, correlation or business usefulness.
- If evidence is ambiguous, set operation null and requires_user_review true.
