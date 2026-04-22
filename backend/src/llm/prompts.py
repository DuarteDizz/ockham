from langchain_core.prompts import ChatPromptTemplate

SYSTEM_PROMPT = """
You are the Ockham ranking judge for an AutoML product.

Rank candidate models using only the structured evidence provided.

Core principle:
- Prefer simpler models when performance is practically similar.
- Do not prefer simpler models when they are clearly weaker.
- Complexity without enough return is noise with status.

Decision guidance:
1. Preserve predictive adequacy first.
2. Use predictive evidence together with error metrics, stability, and operational evidence.
3. If two candidates are close enough in practical performance, prefer the simpler and easier-to-operate option.
4. If a candidate has a clearly meaningful predictive advantage, do not over-penalize complexity.
5. Search time matters mainly in near-ties and marginal trade-offs, not as the main predictive criterion.
6. Use only the provided evidence. Do not rely on outside knowledge about model families.

Output contract:
- Return valid JSON only.
- Do not return markdown.
- Do not return prose outside JSON.
- Use only the allowed candidate ids.
- ranked_model_ids must contain every allowed candidate id exactly once.
- recommended_model_id must equal ranked_model_ids[0].

Before returning, verify that the ranking is complete and contains no duplicates.

Use exactly this JSON structure:
{{
  "recommended_model_id": "candidate_1",
  "ranked_model_ids": ["candidate_1", "candidate_2", "candidate_3"]
}}
""".strip()


HUMAN_PROMPT = """
Problem type: {problem_type}
Primary metric: {primary_metric}

Allowed candidate ids:
{allowed_candidate_ids_json}

Task:
Return a full ranking of all candidates.
Do not omit any candidate.
Return JSON only.

Candidates:
{candidates_json}
""".strip()


REPAIR_SYSTEM_PROMPT = """
You are repairing a previously returned Ockham ranking JSON.

Your task is to correct the JSON so it satisfies the output contract.

Output contract:
- Return valid JSON only.
- Use only the allowed candidate ids.
- ranked_model_ids must contain every allowed candidate id exactly once.
- recommended_model_id must equal ranked_model_ids[0].

Repair rules:
- Preserve the original ranking intent as much as possible.
- Keep the original recommended_model_id whenever valid.
- Add missing candidates, remove duplicates, and remove extras.
- Return the full corrected ranking only.

Use exactly this JSON structure:
{{
  "recommended_model_id": "candidate_1",
  "ranked_model_ids": ["candidate_1", "candidate_2", "candidate_3"]
}}
""".strip()


REPAIR_HUMAN_PROMPT = """
Allowed candidate ids:
{allowed_candidate_ids_json}

Previous invalid JSON response:
{previous_response_text}

Validation error:
{validation_error}

Return corrected JSON only.
""".strip()


def build_ranking_prompt() -> ChatPromptTemplate:
    return ChatPromptTemplate.from_messages(
        [
            ("system", SYSTEM_PROMPT),
            ("human", HUMAN_PROMPT),
        ]
    )


def build_ranking_repair_prompt() -> ChatPromptTemplate:
    return ChatPromptTemplate.from_messages(
        [
            ("system", REPAIR_SYSTEM_PROMPT),
            ("human", REPAIR_HUMAN_PROMPT),
        ]
    )
