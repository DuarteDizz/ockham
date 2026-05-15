from src.experiments.ranking.llm_client import rank_models_with_llm
from src.ml.contracts import OckhamEvidenceItem

WINNER_SUMMARY = (
    "Recommended in Ockham mode because its overall tradeoff between predictive evidence, "
    "execution evidence, and structural complexity was the most defensible."
)


def build_llm_summary(rank: int, total_items: int) -> str:
    if rank == 1:
        return WINNER_SUMMARY

    if rank == total_items:
        return "Placed last because the overall tradeoff was the least defensible in this candidate set."

    return "Placed below the winner after global comparison of predictive, execution, and structural tradeoffs."


def apply_ockham_ranking(
    evidence_items: list[OckhamEvidenceItem],
) -> list[dict]:
    if not evidence_items:
        return []

    ranking_result = rank_models_with_llm(evidence_items)
    decision = ranking_result.decision
    items_by_model_id = {item.result.model_id: item for item in evidence_items}
    ranked_items: list[dict] = []
    total_items = len(decision.ranked_model_ids)

    for rank, model_id in enumerate(decision.ranked_model_ids, start=1):
        ranked_item = items_by_model_id[model_id].to_dict()
        ranked_item["ockham_components"] = {
            **(ranked_item.get("ockham_components") or {}),
            "ranking_source": "llm",
            "ranking_provider": ranking_result.provider,
            "ranking_status": ranking_result.status,
            "ranking_error": ranking_result.error,
            "llm_summary": build_llm_summary(rank, total_items),
        }
        ranked_item["ockham_rank"] = int(rank)
        ranked_item["is_ockham_recommended"] = model_id == decision.recommended_model_id
        ranked_items.append(ranked_item)

    return ranked_items
