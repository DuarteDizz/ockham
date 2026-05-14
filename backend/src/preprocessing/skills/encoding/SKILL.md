---
name: ockham-encoding
description: Guides categorical encoding decisions.
---

# Ockham Encoding Skill

## Mission

Choose an encoding operation for categorical-like features that remain in the pipeline.

## Available operations

- one_hot_encoder
- ordinal_encoder
- label_encoder
- frequency_encoder
- target_encoder
- hashing_encoder

Use operation: null when encoding is not needed or the column should not be encoded.

## Required evidence

Inspect effective_type, semantic_type, unique_count, unique_ratio, top_1_ratio, top_5_ratio, rare_value_ratio, normalized_entropy, low/high-cardinality flags, ordinal evidence, identifier evidence and dropped state.

## Decision principles

- Low-cardinality nominal categorical features usually use one_hot_encoder.
- Genuine ordinal features use ordinal_encoder.
- Avoid label_encoder for nominal categories without ordinal semantics.
- Higher-cardinality categorical features usually use frequency_encoder or hashing_encoder.
- Identifiers should not be encoded by default.
- Do not encode dropped columns or target columns.
