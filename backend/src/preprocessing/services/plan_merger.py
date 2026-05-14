from collections import defaultdict
from typing import Any

from loguru import logger

from ..operation_registry import CAST_EFFECTIVE_TYPES, STAGE_ORDER
from ..schemas import ColumnPreprocessingPlan, PreprocessingPlan, PreprocessingStep

STAGE_PRIORITY = STAGE_ORDER


def _safe_column_lookup(dataset_profile: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {
        column.get("column_name"): column
        for column in dataset_profile.get("columns", [])
        if column.get("column_name")
    }


def _read_role_decisions(batch: dict[str, Any]) -> dict[str, dict[str, Any]]:
    decisions = batch.get("decisions", []) if isinstance(batch, dict) else []
    return {decision.get("column_name"): decision for decision in decisions if decision.get("column_name")}


def _read_step_decisions(decision_batches: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)

    for batch in decision_batches:
        if not isinstance(batch, dict):
            continue
        source_agent = batch.get("agent_name")
        for decision in batch.get("decisions", []) or []:
            column_name = decision.get("column_name")
            operation = decision.get("operation")
            if not column_name or not operation:
                continue
            grouped[column_name].append({**decision, "source_agent": source_agent})

    return grouped


def _safe_float(value: Any, default: float = 0.0) -> float:
    try:
        if value is None:
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def _append_required_imputer_if_missing(
    *,
    column_name: str,
    profile: dict[str, Any],
    role_decision: dict[str, Any],
    decisions: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Preserve agent output without injecting deterministic imputation.

    Missing-value treatment is a specialist-agent decision. The merger should
    only merge valid decisions already produced by the agentic flow.
    """
    return decisions

def _normalize_steps(column_name: str, decisions: list[dict[str, Any]]) -> list[PreprocessingStep]:
    if any(decision.get("operation") == "drop_column" for decision in decisions):
        drop_decision = next(
            decision for decision in decisions if decision.get("operation") == "drop_column"
        )
        return [
            PreprocessingStep(
                id=f"step_{column_name}_drop_column",
                operation="drop_column",
                stage="column_action",
                params=drop_decision.get("params") or {},
                source_agent=drop_decision.get("source_agent"),
                confidence=drop_decision.get("confidence"),
                reason=drop_decision.get("reason"),
                evidence=drop_decision.get("evidence") or {},
                requires_user_review=bool(drop_decision.get("requires_user_review", False)),
            )
        ]

    unique_decisions: list[dict[str, Any]] = []
    seen: set[tuple[str, str]] = set()
    for decision in decisions:
        marker = (decision.get("stage"), decision.get("operation"))
        if marker in seen:
            continue
        seen.add(marker)
        unique_decisions.append(decision)

    unique_decisions.sort(key=lambda item: STAGE_PRIORITY.get(item.get("stage"), 99))

    return [
        PreprocessingStep(
            id=f"step_{column_name}_{decision.get('operation')}",
            operation=decision.get("operation"),
            stage=decision.get("stage"),
            params=decision.get("params") or {},
            source_agent=decision.get("source_agent"),
            confidence=decision.get("confidence"),
            reason=decision.get("reason"),
            evidence=decision.get("evidence") or {},
            requires_user_review=bool(decision.get("requires_user_review", False)),
        )
        for decision in unique_decisions
    ]


def _infer_effective_type(profile: dict[str, Any], role_decision: dict[str, Any], steps: list[PreprocessingStep]) -> str | None:
    for step in steps:
        if step.operation in CAST_EFFECTIVE_TYPES:
            return CAST_EFFECTIVE_TYPES[step.operation]

    semantic_type = role_decision.get("semantic_type")
    if semantic_type in {"numeric_measure", "numeric"}:
        return "numeric"
    if semantic_type in {"categorical_feature", "high_cardinality_categorical"}:
        return "categorical"
    if semantic_type == "boolean_feature":
        return "boolean"
    if semantic_type == "datetime_feature":
        return "datetime"
    if semantic_type == "free_text":
        return "text"

    return profile.get("inferred_type")


def merge_agent_decisions(
    *,
    dataset_id: str,
    problem_type: str,
    target_column: str | None,
    dataset_profile: dict[str, Any],
    column_role_decisions: dict[str, Any],
    decision_batches: list[dict[str, Any]],
) -> dict[str, Any]:
    """Merge specialist agent decisions into one graph-ready preprocessing plan."""
    role_by_column = _read_role_decisions(column_role_decisions)
    steps_by_column = _read_step_decisions(decision_batches)
    profile_by_column = _safe_column_lookup(dataset_profile)

    columns: list[ColumnPreprocessingPlan] = []

    for column_name, column_profile in profile_by_column.items():
        role_decision = role_by_column.get(column_name, {})
        role = role_decision.get("recommended_role", "feature")

        if column_name == target_column:
            role = "target"

        raw_step_decisions = steps_by_column.get(column_name, [])
        if role not in {"target", "drop"}:
            raw_step_decisions = _append_required_imputer_if_missing(
                column_name=column_name,
                profile=column_profile,
                role_decision=role_decision,
                decisions=raw_step_decisions,
            )

        steps = _normalize_steps(column_name, raw_step_decisions)
        if role in {"target", "drop"} and not any(step.operation == "drop_column" for step in steps):
            steps = [] if role == "target" else [
                PreprocessingStep(
                    id=f"step_{column_name}_drop_column",
                    operation="drop_column",
                    stage="column_action",
                    source_agent="ColumnRoleAgent",
                    confidence=role_decision.get("confidence"),
                    reason=role_decision.get("reason"),
                    evidence=role_decision.get("evidence") or {},
                )
            ]

        column_plan = ColumnPreprocessingPlan(
            column_name=column_name,
            raw_dtype=column_profile.get("raw_dtype"),
            inferred_type=column_profile.get("inferred_type"),
            effective_type=_infer_effective_type(column_profile, role_decision, steps),
            semantic_type=role_decision.get("semantic_type"),
            role=role,
            steps=steps,
        )
        columns.append(column_plan)

    plan = PreprocessingPlan(
        dataset_id=dataset_id,
        problem_type=problem_type,
        target_column=target_column,
        columns=columns,
    )

    logger.info(
        "Merged preprocessing plan. dataset_id={} columns={} target_column={}",
        dataset_id,
        len(columns),
        target_column,
    )
    return plan.model_dump()
