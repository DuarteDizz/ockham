# Decision rubric

Use this rubric as a deterministic-policy guide. Base every classification on fields present in the column payload. Do not assume unavailable sample values.

## 1. Target protection

Return:

- `semantic_type=target`
- `recommended_role=target`
- `risk_level=low`

when any of the following is true:

- `is_target=true`
- `column_name` exactly matches `target_column`

Target protection overrides all other rules.

## 2. Structural invalidity

### Constant columns

If `is_constant=true` or `unique_count <= 1`:

- `recommended_role=drop`
- `risk_level=high`
- `semantic_type` should reflect the best known physical/semantic type when obvious, otherwise `unknown`

Rationale: constant columns carry no variation for supervised learning.

### Mostly missing columns

If `is_mostly_missing=true` or `missing_ratio >= 0.95`:

- prefer `recommended_role=review`
- use `risk_level=high`
- use `drop` only when the column is also structurally invalid, unsupported free text, identifier-like, or clearly not meaningful

Do not drop a mostly missing column solely because it is sparse if the name suggests meaningful absence, event state or business process.

## 3. Leakage and post-event risk

Use `semantic_type=leakage_candidate` when the column may contain target-derived, future, final-state or post-event information.

Strong name signals include, but are not limited to:

- English: `target`, `label`, `outcome`, `result`, `actual`, `final`, `prediction`, `predicted`, `score_model`, `approved`, `approval_result`, `chargeback`, `fraud_confirmed`, `defaulted`, `churned`, `cancelled`, `canceled`, `closed`, `resolved`, `settled`, `completed`, `failure_date`, `event_date`, `resolution_date`, `closed_at`, `updated_after`, `post_event`.
- Portuguese: `alvo`, `classe`, `rotulo`, `rótulo`, `resultado`, `valor_real`, `realizado`, `final`, `previsto`, `aprovado`, `inadimplente`, `cancelado`, `cancelamento`, `encerrado`, `resolvido`, `concluido`, `concluído`, `falha`, `data_falha`, `data_cancelamento`, `data_encerramento`, `data_resolucao`, `data_resolução`, `pos_evento`, `pós_evento`.

Recommended role:

- `drop` when leakage evidence is strong and direct.
- `review` when leakage is plausible but business context is needed.

Risk:

- `high` for direct target/post-event evidence.
- `medium` for ambiguous name-only signals.

Do not classify a column as leakage only because it is predictive-looking. Leakage is about availability at prediction time, not usefulness.

## 4. Identifier and key detection

Use `semantic_type=identifier` when a column appears to identify rows, entities, transactions, accounts or events rather than describe a reusable feature.

Strong identifier evidence:

- `unique_ratio >= 0.98`, especially with `unique_count` close to `row_count`.
- `column_name` is exactly or nearly: `id`, `index`, `row_id`, `uuid`, `guid`, `key`, `pk`, `cpf`, `cnpj`, `email`, `phone`, `telefone`, `celular`, `account`, `conta`, `cliente_id`, `customer_id`, `user_id`, `usuario_id`, `order_id`, `pedido_id`, `transaction_id`, `transacao_id`, `ticket_id`, `asset_id`, `equipamento_id`, `tag_id`, `serial`, `serial_number`, `codigo`, `código`, `cod`, `sku`.
- `unique_pattern_count` is high or `top_pattern_ratio` shows repeated code-like structures combined with high uniqueness.

Recommended role:

- `drop` for pure row/entity identifiers.
- `review` for business keys that might encode group signal, such as product SKU, postal/ZIP code, asset tag or equipment code.

Risk:

- `high` when near-unique and key-like.
- `medium` when high-cardinality but not clearly a pure identifier.

Important: numeric-looking identifiers remain identifiers. Do not classify as `numeric_measure` just because `numeric_parse_ratio` is high or `inferred_type=numeric_like_text`.

## 5. Datetime classification

Use `semantic_type=datetime_feature` when:

- `inferred_type=datetime`, or
- `inferred_type=datetime_like_text` with strong `datetime_parse_ratio`, typically `>= 0.95`, or
- the column name is date/time-like and profiler parse evidence supports it.

Recommended role:

- `feature` for ordinary timestamps available at prediction time, such as creation date, birth date, reference date, installation date, order date or measurement date.
- `review` or `drop` if the datetime appears post-event or target-derived. In that case, prefer `semantic_type=leakage_candidate` over `datetime_feature`.

Risk:

- `low` for normal dates.
- `medium/high` for post-event timestamps or ambiguous temporal availability.

## 6. Boolean classification

Use `semantic_type=boolean_feature` when:

- `inferred_type=boolean`, or
- `unique_count <= 2` and the column is not target, not identifier and not leakage.

Recommended role is usually `feature`, except for target/leakage/identifier cases.

Do not convert boolean-like target columns into features.

## 7. Categorical versus high-cardinality categorical versus free text

### Low-cardinality categorical

Use `semantic_type=categorical_feature` when most of the following hold:

- `inferred_type` is `text`, `categorical`, `boolean`, `numeric_like_text`, or object-like.
- `unique_count <= 30` or `unique_ratio <= 0.05`.
- values appear short: `avg_length < 40` and `max_length < 120` when these fields exist.
- not near-unique and not identifier-like.

Recommended role is usually `feature`.

### High-cardinality categorical

Use `semantic_type=high_cardinality_categorical` when:

- labels are short or code-like, and
- `unique_count > 30` or `unique_ratio > 0.05`, and
- identifier evidence is not strong enough for `identifier`.

Recommended role is usually `feature` or `review`, not automatic drop. High cardinality is an encoding challenge, not automatically invalidity.

### Free text

Use `semantic_type=free_text` when:

- `avg_length >= 80` or `max_length >= 200`, or
- high cardinality combines with long strings and high entropy, or
- the name suggests comments, notes, description, observation, message, review, resumo, descrição, observacao, observação, comentario, comentário or texto.

Recommended role:

- `review` when text may be useful but text processing is not confirmed.
- `drop` only for clearly unsupported long free text in the current pipeline.

## 8. Numeric measure versus ordinal versus code

### Numeric measure

Use `semantic_type=numeric_measure` when:

- `inferred_type=numeric` or strong numeric parse evidence exists, and
- the column represents a magnitude, count, amount, duration, rate, percentage, measurement or continuous/discrete quantity, and
- it is not target, ID/code, leakage or ordinal scale.

Name signals include: `valor`, `amount`, `price`, `cost`, `custo`, `quantity`, `quantidade`, `qtd`, `count`, `total`, `idade`, `age`, `tempo`, `duration`, `rate`, `taxa`, `percentual`, `score` when continuous, `volume`, `peso`, `weight`, `height`, `distancia`, `distance`.

### Ordinal feature

Use `semantic_type=ordinal_feature` when:

- `unique_count <= 10` or `unique_ratio` is very low, and
- values are integer-like or ordered categories, and
- name/context suggests order: `score`, `rating`, `rank`, `nivel`, `nível`, `level`, `grau`, `grade`, `classe`, `class`, `criticidade`, `severity`, `prioridade`, `priority`, `faixa`, `tier`, `stage`, `estagio`, `estágio`.

Do not use `ordinal_feature` for arbitrary numeric codes.

### Numeric-like code

If the column parses as numeric but name/pattern suggests code, ID, ZIP/postal code, SKU, account, asset tag, equipment, order or transaction key:

- use `identifier` if near-unique.
- use `high_cardinality_categorical` or `categorical_feature` if reused across rows.
- do not use `numeric_measure`.

## 9. Unknown and review

Use `semantic_type=unknown` only when the profiler evidence is insufficient or contradictory.

Use `recommended_role=review` when:

- leakage is plausible but not proven.
- a column may be a useful business key rather than a pure identifier.
- a free-text column may be valuable but the current pipeline may not support it.
- type evidence conflicts, such as high numeric parse ratio with ID-like naming.

Prefer review over destructive drop when business meaning is unclear.
