# Output contract

Return one JSON object only. The top-level object must contain:

- agent_name
- decisions
- warnings

Each decision must use the exact column_name from output_contract.expected_columns, include confidence, reason, evidence, alternatives_considered, params and requires_user_review.

Do not write Markdown or explanatory prose outside the JSON object.
