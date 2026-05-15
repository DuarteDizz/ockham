import unittest

from src.experiments.ranking.llm_parser import parse_llm_decision
from src.ml.contracts import (
    ExecutionProfile,
    FeatureUsageContext,
    ModelSearchResult,
    OckhamEvidenceItem,
    OperationalContext,
    PerformanceEvidence,
    PrimaryMetricEvidence,
    ScoreContext,
    StructuralProfile,
)


def make_item(model_id: str) -> OckhamEvidenceItem:
    result = ModelSearchResult(
        model_id=model_id,
        model_name=model_id,
        category="linear",
        problem_type="classification",
        primary_metric="accuracy",
        best_score=0.9,
        best_params={},
        metrics_mean={"accuracy": 0.9},
        metrics_std={"accuracy": 0.01},
    )
    return OckhamEvidenceItem(
        result=result,
        score_context=ScoreContext(None, None, 0.9, 1, 0.0, 0.0),
        performance_evidence=PerformanceEvidence(
            primary_metric=PrimaryMetricEvidence("accuracy", 0.9, 0.01, 1.0),
            metrics_mean={"accuracy": 0.9},
            metrics_std={"accuracy": 0.01},
            cv_folds=5,
            cv_primary_fold_scores=[0.9, 0.91, 0.89],
        ),
        structural_profile=StructuralProfile(0.8, 0.7, 0.6),
        execution_profile=ExecutionProfile(0.8, 0.7, 0.6, 0.5, 0.4),
        feature_usage_context=FeatureUsageContext(5, 0.5, 0.5, 0.5, 5, 10),
        operational_context=OperationalContext(0.1, 0.1, 1.0, 0.2),
    )


class ResponseParserTests(unittest.TestCase):
    def test_parse_llm_decision_accepts_known_aliases(self):
        message = """
```json
{"chosen_model_id": "candidate_b", "ranking": ["candidate_b", "candidate_a"]}
```
"""
        evidence_items = [make_item("model_a"), make_item("model_b")]
        candidate_id_map = {"candidate_a": "model_a", "candidate_b": "model_b"}

        decision = parse_llm_decision(message, evidence_items, candidate_id_map)

        self.assertEqual(decision.recommended_model_id, "model_b")
        self.assertEqual(decision.ranked_model_ids, ["model_b", "model_a"])


if __name__ == "__main__":
    unittest.main()
