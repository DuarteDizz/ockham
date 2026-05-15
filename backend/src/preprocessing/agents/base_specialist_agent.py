"""Base classes for skill-driven Ockham preprocessing agents."""

from __future__ import annotations

import json
from typing import Any

from loguru import logger
from pydantic import BaseModel
from strands import Agent
from strands.agent import AgentResult
from strands.models import Model
from strands.multiagent.base import MultiAgentBase, MultiAgentResult, NodeResult, Status
from strands.telemetry.metrics import EventLoopMetrics
from strands.types.content import ContentBlock, Message

from ..contracts.agent_decision import AgentDecisionBatch, ColumnRoleDecisionBatch
from ..contracts.json_parser import extract_nested_candidates, extract_text_from_result, parse_json_values
from ..contracts.ollama_structured_output import (
    apply_ollama_structured_output_schema,
    build_specialist_agent_json_schema,
)
from ..contracts.validation import (
    add_backend_metadata,
    validate_column_role_output,
    validate_operation_output,
)
from ..operation_registry import get_agent_allowed_operations, get_agent_stage
from ..profile_views.builder import ProfileViewBuilder
from ..skills.loader import skill_loader
from ..state import PreprocessingState


class SkillDrivenSpecialistAgent(MultiAgentBase):
    """Reusable Strands agent wrapper driven by an internal Ockham skill."""

    agent_name: str = "SpecialistAgent"
    skill_name: str = ""
    stage: str | None = None
    state_attribute: str = ""
    output_model: type[BaseModel] = AgentDecisionBatch
    batch_size: int = 5
    max_attempts_per_batch: int = 2

    def __init__(
        self,
        state: PreprocessingState,
        name: str,
        model: Model,
        description: str,
        system_prompt: str = "",
    ):
        super().__init__()
        self.state = state
        self.model = model
        self.skill = skill_loader.load(self.skill_name)
        self._last_raw_response = ""
        self.executor = Agent(
            name=name,
            model=model,
            description=description,
            system_prompt=system_prompt or self.skill.render_system_prompt(),
        )

    def build_task(self) -> str:
        columns = self._select_columns()
        expected_columns = [column["column_name"] for column in columns if column.get("column_name")]
        payload = self._build_payload(columns=columns, expected_columns=expected_columns)
        return self._build_strict_task(payload=payload, expected_columns=expected_columns)

    def _select_columns(self) -> list[dict[str, Any]]:
        return ProfileViewBuilder(self.state).for_agent(self.agent_name)

    def _build_payload(
        self,
        *,
        columns: list[dict[str, Any]],
        expected_columns: list[str],
    ) -> dict[str, Any]:
        return {
            "skill": {
                "name": self.skill.name,
                "description": self.skill.description,
                "version": self.skill.version,
                "stage": self.stage,
            },
            "task": f"Use the {self.skill.name} skill to produce one specialist decision for each listed column.",
            "output_contract": {
                "agent_name": self.agent_name,
                "expected_columns": expected_columns,
                "must_return_exactly_one_decision_per_expected_column": True,
                "allowed_operations": get_agent_allowed_operations(self.agent_name),
                "operation_null_meaning": "The column was analyzed and no operation from this stage is technically needed.",
            },
            "columns": columns,
        }

    def _build_strict_task(self, *, payload: dict[str, Any], expected_columns: list[str]) -> str:
        """Build the model-facing task with a compact output contract."""
        if self.agent_name == "ColumnRoleAgent":
            return self._build_column_role_task(payload=payload, expected_columns=expected_columns)
        return self._build_operation_task(payload=payload, expected_columns=expected_columns)

    def _build_column_role_task(self, *, payload: dict[str, Any], expected_columns: list[str]) -> str:
        expected_json = json.dumps(expected_columns, ensure_ascii=False)
        return f"""
OCKHAM COLUMN ROLE CLASSIFICATION

Return only valid JSON. No markdown. No prose. No code fences.

Expected columns, exactly:
{expected_json}

Required output shape:
{{
  "decisions": [
    {{
      "column_name": "<one expected column>",
      "semantic_type": "numeric_measure|categorical_feature|boolean_feature|datetime_feature|free_text|identifier|high_cardinality_categorical|leakage_candidate|ordinal_feature|target|unknown",
      "recommended_role": "feature|target|drop|review",
      "risk_level": "low|medium|high",
      "confidence": 0.84,
      "reason": "Short reason grounded in profiler evidence.",
      "evidence": {{}}
    }}
  ]
}}

Rules:
- Analyze every expected column exactly once.
- Use recommended_role, not role.
- Do not include operation, params, requires_user_review or alternatives_considered.
- Do not echo the input payload.
- Use only the profile fields in INPUT PAYLOAD JSON as evidence.

INPUT PAYLOAD JSON:
{json.dumps(payload, ensure_ascii=False, indent=2)}

RETURN ONLY THE JSON OBJECT.
""".strip()

    def _build_operation_task(self, *, payload: dict[str, Any], expected_columns: list[str]) -> str:
        allowed_operations = get_agent_allowed_operations(self.agent_name)
        expected_json = json.dumps(expected_columns, ensure_ascii=False)
        operations_json = json.dumps(allowed_operations, ensure_ascii=False)
        return f"""
OCKHAM {self.agent_name} OPERATION DECISION

Return only valid JSON. No markdown. No prose. No code fences.

Expected columns, exactly:
{expected_json}

Allowed operations:
{operations_json}

Required output shape:
{{
  "decisions": [
    {{
      "column_name": "<one expected column>",
      "operation": "<one allowed operation or null>",
      "confidence": 0.84,
      "reason": "Short reason grounded in profiler evidence.",
      "evidence": {{}}
    }}
  ]
}}

Rules:
- Analyze every expected column exactly once.
- Return operation as one allowed operation or JSON literal null.
- Do not use string aliases such as "null", "keep", "skip" or "no_operation".
- Do not include ColumnRole fields as the decision contract.
- Do not echo the input payload.
- Use only the profile fields in INPUT PAYLOAD JSON as evidence.

INPUT PAYLOAD JSON:
{json.dumps(payload, ensure_ascii=False, indent=2)}

RETURN ONLY THE JSON OBJECT.
""".strip()

    def _build_repair_task(
        self,
        *,
        payload: dict[str, Any],
        expected_columns: list[str],
        validation_error: str,
    ) -> str:
        """Build a compact repair prompt without resending profiler payload."""
        del payload
        if self.agent_name == "ColumnRoleAgent":
            return self._build_column_role_repair_task(
                expected_columns=expected_columns,
                validation_error=validation_error,
            )
        return self._build_operation_repair_task(
            expected_columns=expected_columns,
            validation_error=validation_error,
        )

    def _previous_response_excerpt(self, *, limit: int = 3000) -> str:
        previous_response = (getattr(self, "_last_raw_response", "") or "").strip()
        if len(previous_response) > limit:
            return previous_response[:limit] + "..."
        return previous_response

    def _build_column_role_repair_task(self, *, expected_columns: list[str], validation_error: str) -> str:
        expected_json = json.dumps(expected_columns, ensure_ascii=False)
        previous_response = self._previous_response_excerpt()
        return f"""
REPAIR ColumnRoleAgent OUTPUT

The previous response was invalid:
{validation_error}

Convert the previous response to this compact JSON shape. Do not re-analyze.
Expected columns: {expected_json}

Required shape:
{{
  "decisions": [
    {{
      "column_name": "<one expected column>",
      "semantic_type": "numeric_measure|categorical_feature|boolean_feature|datetime_feature|free_text|identifier|high_cardinality_categorical|leakage_candidate|ordinal_feature|target|unknown",
      "recommended_role": "feature|target|drop|review",
      "risk_level": "low|medium|high",
      "confidence": 0.84,
      "reason": "Short reason.",
      "evidence": {{}}
    }}
  ]
}}

Do not include operation, params, requires_user_review or alternatives_considered.
Use recommended_role, not role.
Return JSON only.

Previous invalid response:
{previous_response}
""".strip()

    def _build_operation_repair_task(self, *, expected_columns: list[str], validation_error: str) -> str:
        expected_json = json.dumps(expected_columns, ensure_ascii=False)
        operations_json = json.dumps(get_agent_allowed_operations(self.agent_name), ensure_ascii=False)
        previous_response = self._previous_response_excerpt()
        return f"""
REPAIR {self.agent_name} OUTPUT

The previous response was invalid:
{validation_error}

Convert the previous response to this compact JSON shape. Do not re-analyze.
Expected columns: {expected_json}
Allowed operations: {operations_json}

Required shape:
{{
  "decisions": [
    {{
      "column_name": "<one expected column>",
      "operation": "<one allowed operation or null>",
      "confidence": 0.84,
      "reason": "Short reason.",
      "evidence": {{}}
    }}
  ]
}}

Use decisions, not operations.
Do not include output_contract, columns, skill, task, allowed_operations or operation_null_meaning.
Return JSON only.

Previous invalid response:
{previous_response}
""".strip()

    def _output_example(self) -> str:
        return f"""
Output shape example only. Use real column names from the valid list, not placeholders.

{{
  "agent_name": "{self.agent_name}",
  "decisions": [
    {{
      "column_name": "<copy_exact_column_name>",
      "operation": "<one_allowed_operation_or_null>",
      "confidence": 0.84,
      "reason": "Technical reason based on profiler evidence.",
      "evidence": {{}},
      "alternatives_considered": [
        {{
          "operation": null,
          "reason_not_selected": "Brief reason based on profiler evidence."
        }}
      ],
      "params": {{}},
      "requires_user_review": false
    }}
  ],
  "warnings": []
}}
""".strip()

    def _build_output_schema(self, expected_columns: list[str]) -> dict[str, Any]:
        """Build a compact native Ollama JSON Schema for this agent and batch."""
        return build_specialist_agent_json_schema(
            agent_name=self.agent_name,
            expected_columns=expected_columns,
            allowed_operations=get_agent_allowed_operations(self.agent_name),
        )

    def _parse_output(self, result: AgentResult, expected_columns: list[str] | None = None) -> dict[str, Any]:
        raw_text = extract_text_from_result(result)
        self._last_raw_response = raw_text
        expected_columns = expected_columns or []
        last_error: Exception | None = None

        for value in parse_json_values(raw_text, agent_name=self.agent_name):
            for candidate in self._prioritize_output_candidates(value, expected_columns=expected_columns):
                try:
                    output = self.output_model.model_validate(candidate)
                    payload = output.model_dump()
                    if payload.get("decisions"):
                        payload.setdefault("agent_name", self.agent_name)
                        payload.setdefault("warnings", [])
                        return payload
                except Exception as error:
                    last_error = error

        if last_error:
            raise last_error
        raise ValueError(f"{self.agent_name} did not return a decision payload.")

    def _prioritize_output_candidates(self, value: Any, *, expected_columns: list[str]) -> list[Any]:
        candidates: list[Any] = []

        def add(candidate: Any) -> None:
            if candidate is None:
                return
            if not self._is_plausible_output_candidate(candidate, expected_columns=expected_columns):
                return
            if not any(candidate is existing or candidate == existing for existing in candidates):
                candidates.append(candidate)

        for candidate in extract_nested_candidates(value):
            coerced = self._coerce_candidate(candidate, expected_columns=expected_columns)
            add(coerced)

        return candidates

    def _coerce_candidate(self, candidate: Any, *, expected_columns: list[str]) -> Any:
        if isinstance(candidate, dict):
            if "operations" in candidate and "decisions" not in candidate:
                normalized = dict(candidate)
                normalized["decisions"] = normalized.pop("operations")
                return normalized

            if "column_name" in candidate and candidate.get("column_name") in set(expected_columns):
                # Accept a single-decision object only when it refers to an expected column.
                # Coverage validation will still reject it for multi-column batches.
                return {"decisions": [candidate]}

        return candidate

    def _is_plausible_output_candidate(self, candidate: Any, *, expected_columns: list[str]) -> bool:
        if isinstance(candidate, list):
            return all(isinstance(item, dict) for item in candidate)
        if not isinstance(candidate, dict):
            return False

        if "decisions" in candidate or "operations" in candidate:
            return True

        expected = set(expected_columns)
        if expected and any(key in expected for key in candidate.keys()):
            return True

        if len(expected) == 1 and candidate.get("column_name") in expected:
            return True

        return False

    def _validate_and_normalize(self, payload: dict[str, Any], expected_columns: list[str]) -> dict[str, Any]:
        if self.agent_name == "ColumnRoleAgent":
            validate_column_role_output(payload, expected_columns=expected_columns)
            return add_backend_metadata(payload, agent_name=self.agent_name, stage=None)

        stage = self.stage or get_agent_stage(self.agent_name)
        if not stage:
            raise ValueError(f"No stage configured for {self.agent_name}.")
        validate_operation_output(
            payload,
            agent_name=self.agent_name,
            stage=stage,
            expected_columns=expected_columns,
        )
        return add_backend_metadata(payload, agent_name=self.agent_name, stage=stage)

    def _collect_valid_decisions(
        self,
        payload: dict[str, Any],
        expected_columns: list[str],
    ) -> dict[str, dict[str, Any]]:
        expected = set(expected_columns)
        collected: dict[str, dict[str, Any]] = {}
        for decision in payload.get("decisions", []) or []:
            if not isinstance(decision, dict):
                continue
            column_name = decision.get("column_name")
            if column_name in expected and column_name not in collected:
                collected[column_name] = dict(decision)
        return collected

    def _idle_result(self) -> AgentResult:
        return AgentResult(
            stop_reason="end_turn",
            message=Message(role="assistant", content=[{"text": f"{self.agent_name}: no eligible columns."}]),
            metrics=EventLoopMetrics(),
            state="completed",
        )

    async def invoke_async(
        self,
        task: str | list[ContentBlock],
        invocation_state: dict[str, Any] | None = None,
        **kwargs: Any,
    ) -> MultiAgentResult:
        columns = self._select_columns()
        if not columns:
            payload = {"agent_name": self.agent_name, "decisions": [], "warnings": []}
            if self.state_attribute:
                setattr(self.state, self.state_attribute, payload)
            result = self._idle_result()
            return MultiAgentResult(status=Status.COMPLETED, results={self.executor.name: NodeResult(result=result)})

        all_decisions: list[dict[str, Any]] = []
        all_warnings: list[str] = []
        last_result: AgentResult | None = None

        for batch_index in range(0, len(columns), self.batch_size):
            batch_columns = columns[batch_index : batch_index + self.batch_size]
            expected_columns = [column["column_name"] for column in batch_columns if column.get("column_name")]
            by_name = {column["column_name"]: column for column in batch_columns if column.get("column_name")}
            accepted: dict[str, dict[str, Any]] = {}
            pending = list(expected_columns)
            validation_error = ""

            for attempt in range(self.max_attempts_per_batch):
                attempt_columns = [by_name[name] for name in pending if name in by_name]
                payload = self._build_payload(columns=attempt_columns, expected_columns=pending)
                if attempt == 0:
                    task_text = self._build_strict_task(payload=payload, expected_columns=pending)
                else:
                    task_text = self._build_repair_task(
                        payload=payload,
                        expected_columns=pending,
                        validation_error=validation_error,
                    )
                try:
                    schema = self._build_output_schema(pending)
                    with apply_ollama_structured_output_schema(self.model, schema):
                        result = await self.executor.invoke_async(task_text)
                    last_result = result
                    parsed = self._parse_output(result, expected_columns=pending)
                    normalized = self._validate_and_normalize(parsed, pending)
                    accepted.update(self._collect_valid_decisions(normalized, pending))
                    all_warnings.extend([str(item) for item in normalized.get("warnings", []) or []])
                except Exception as error:
                    validation_error = str(error)
                    logger.warning(
                        "{} batch {} attempt {} failed. error={}",
                        self.agent_name,
                        (batch_index // self.batch_size) + 1,
                        attempt + 1,
                        error,
                    )

                pending = [column for column in expected_columns if column not in accepted]
                if not pending:
                    break

            if pending:
                raise ValueError(
                    f"{self.agent_name} did not classify all columns in batch {(batch_index // self.batch_size) + 1}. "
                    f"Missing columns: {pending}. Last validation error: {validation_error}"
                )
            all_decisions.extend(accepted[column] for column in expected_columns if column in accepted)

        output_payload = {
            "agent_name": self.agent_name,
            "decisions": all_decisions,
            "warnings": all_warnings,
        }
        expected_all = [column["column_name"] for column in columns if column.get("column_name")]
        output_payload = self._validate_and_normalize(output_payload, expected_all)
        if self.state_attribute:
            setattr(self.state, self.state_attribute, output_payload)

        result = last_result or self._idle_result()
        if result.state == "failed":
            logger.error("{} failed to run.", self.agent_name)
            raise ValueError(f"Agent {self.executor.name} failed to run")

        logger.debug("{} completed successfully. decisions={}", self.agent_name, len(all_decisions))
        return MultiAgentResult(status=Status.COMPLETED, results={self.executor.name: NodeResult(result=result)})


class ColumnRoleSkillAgent(SkillDrivenSpecialistAgent):
    """Specialized base for the schema-classification agent."""

    agent_name = "ColumnRoleAgent"
    skill_name = "column-role"
    stage = None
    state_attribute = "column_role_decisions"
    output_model = ColumnRoleDecisionBatch

    def _output_example(self) -> str:
        return """
Output shape example only. Use real column names from the valid list, not placeholders.

{
  "agent_name": "ColumnRoleAgent",
  "decisions": [
    {
      "column_name": "<copy_exact_column_name>",
      "semantic_type": "numeric_measure",
      "recommended_role": "feature",
      "risk_level": "low",
      "confidence": 0.87,
      "reason": "Technical classification reason based on profiler evidence.",
      "evidence": {}
    }
  ],
  "warnings": []
}
""".strip()

    def _build_payload(
        self,
        *,
        columns: list[dict[str, Any]],
        expected_columns: list[str],
    ) -> dict[str, Any]:
        return {
            "skill": {
                "name": self.skill.name,
                "description": self.skill.description,
                "version": self.skill.version,
                "stage": "column_role",
            },
            "task": "Classify every listed column. This is not feature selection.",
            "target_column": self.state.target_column,
            "output_contract": {
                "agent_name": "ColumnRoleAgent",
                "expected_columns": expected_columns,
                "must_return_exactly_one_decision_per_expected_column": True,
                "allowed_recommended_roles": ["feature", "target", "drop", "review"],
                "allowed_semantic_types": [
                    "identifier",
                    "free_text",
                    "numeric_measure",
                    "categorical_feature",
                    "boolean_feature",
                    "datetime_feature",
                    "high_cardinality_categorical",
                    "leakage_candidate",
                    "ordinal_feature",
                    "target",
                    "unknown",
                ],
                "allowed_risk_levels": ["low", "medium", "high"],
            },
            "columns": columns,
        }
