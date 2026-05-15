# Missing Values Decision Rubric

This rubric is the operational policy for choosing between imputation, explicit missingness preservation, row removal and user review.

## 1. Eligibility gate

1. If `missing_count <= 0` and `missing_ratio <= 0`, return `operation=null`.
2. If `was_dropped=true` or `recommended_role` indicates a dropped column, return `operation=null`.
3. If `is_target=true` and missing values exist:
   - do not use any imputer;
   - prefer `drop_rows_missing` only when row loss is low and row count is sufficient;
   - otherwise return `operation=null` with `requires_user_review=true`.
4. If `missing_ratio >= 0.80`, avoid simple imputation unless preserving missingness as a constant category is clearly safer.

## 2. Row removal policy

`drop_rows_missing` is an alternative to imputation, not a default cleaning step.

Prefer `drop_rows_missing` when all or most are true:

- `missing_ratio <= 0.01`;
- `row_count >= 1000`;
- `missing_count` is small in absolute and relative terms;
- column is target, essential, or difficult to impute honestly;
- missingness does not look semantically informative;
- removal avoids adding artificial signal.

Consider `drop_rows_missing` with `requires_user_review=true` when:

- `0.01 < missing_ratio <= 0.05`;
- `row_count < 1000`;
- there may be cumulative row loss across multiple columns;
- the column is important but the missingness pattern is unclear.

Avoid `drop_rows_missing` when:

- `missing_ratio > 0.05` for a feature column;
- missingness may mean not applicable, not occurred, no event, no cancellation, no failure, not measured, not recorded yet, unknown state or similar;
- the column is low-value and could be imputed or reviewed;
- row-loss impact cannot be estimated from the payload.

Always set `params={"scope":"missing_in_column"}` for `drop_rows_missing`.

## 3. Numeric imputation

Use `mean_imputer` when:

- `effective_type` is `numeric` or `numeric_like_text`;
- missingness is low/moderate;
- distribution is approximately symmetric;
- `abs(skewness) < 1.0` when available;
- outlier pressure is low.

Use `median_imputer` when:

- `effective_type` is `numeric` or `numeric_like_text`;
- `abs(skewness) >= 1.0`; or
- `outlier_ratio_iqr` / `outlier_ratio_zscore` is material; or
- the mean would likely be distorted by heavy tails.

Use `constant_imputer` for numeric columns only when:

- missingness itself is likely informative; or
- neither mean nor median is semantically safe; or
- a sentinel value is explicitly safer and supported by downstream handling.

Set review when numeric missingness is high, semantically ambiguous or likely to distort model training.

## 4. Categorical, text-like categorical and boolean imputation

Use `most_frequent_imputer` when:

- `effective_type` is `categorical`, `text` or `boolean`;
- the column is categorical-like rather than free text;
- missingness is low;
- the mode is a reasonable representative category;
- missingness does not appear informative.

Use `constant_imputer` when:

- missingness may be informative;
- an explicit missing category is safer than forcing the mode;
- `top_1_ratio` is very high and mode imputation would hide the missing pattern;
- categorical distribution is dispersed;
- boolean missing means unknown/not evaluated/not applicable rather than false.

Default constant placeholder: `{"fill_value":"__MISSING__"}` unless the system provides a better standard.

## 5. Informative missingness risk signals

Treat missingness as potentially informative, not proven, when evidence includes:

- column names related to cancellation, failure, event, closure, end date, reason, approval, rejection, payment, claim, inspection, diagnosis or occurrence;
- high missingness in a field that appears conditional on an event;
- categorical/boolean columns where missing may mean unknown/not applicable;
- datetime columns where missing may mean the event never happened.

Do not claim MCAR/MAR/MNAR as facts. Use cautious language in `reason` and `evidence`.

## 6. Evidence requirements

Every decision with missing values must include:

- `missing_count`;
- `missing_ratio`;
- `row_count`;
- `effective_type`;
- relevant distribution or cardinality fields.

For numeric decisions, include when available:

- `skewness`;
- `outlier_ratio_iqr`;
- `outlier_ratio_zscore`;
- `mean` and `median` if useful.

For categorical/boolean decisions, include when available:

- `unique_count`;
- `unique_ratio`;
- `top_1_ratio`;
- `rare_value_ratio`.

For row removal, include:

- why row removal is safer than imputation;
- estimated row-loss evidence from `missing_count`, `missing_ratio` and `row_count`.
