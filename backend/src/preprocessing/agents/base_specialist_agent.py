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
        self.skill = skill_loader.load(self.skill_name)
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
        allowed_operations = get_agent_allowed_operations(self.agent_name)
        operations_block = "\n".join(f"- {operation}" for operation in allowed_operations) or "- None"
        expected_block = "\n".join(f"- {column}" for column in expected_columns) or "- None"
        output_example = self._output_example()

        return f"""
STRICT OCKHAM SKILL EXECUTION CONTRACT

You are executing the internal Ockham skill: {self.skill.name}.
Return only a valid JSON object parseable by Python json.loads.

The ONLY valid column names are:
{expected_block}

Allowed operations for this agent:
{operations_block}

{output_example}

Rules:
- Analyze every valid column listed above exactly once.
- Do not invent, translate, rename, pluralize or omit columns.
- Use only the payload below as evidence.
- Use the skill instructions in your system prompt as your expert reasoning rubric.
- Evidence must contain concrete profiler statistics from the matching column payload.
- alternatives_considered must mention relevant operation alternatives and why they were not selected.
- If evidence is insufficient or ambiguous, set requires_user_review=true instead of guessing.
- Return operation as one allowed operation or JSON literal null.
- Never use string aliases such as "null", "keep", "skip", "no_operation" or "null_operation_meaning".
- Do not write prose, markdown, code fences, EDA, model recommendations or code snippets.

INPUT PAYLOAD JSON:
{json.dumps(payload, ensure_ascii=False, indent=2)}

NOW RETURN THE JSON OBJECT ONLY.
The first character must be {{ and the last character must be }}.
""".strip()

    def _build_repair_task(
        self,
        *,
        payload: dict[str, Any],
        expected_columns: list[str],
        validation_error: str,
    ) -> str:
        return f"""
REPAIR YOUR PREVIOUS {self.agent_name} OUTPUT

Your previous response violated the Ockham contract:
{validation_error}

Return a corrected JSON object only.
The ONLY columns you must analyze now are:
{chr(10).join(f'- {column}' for column in expected_columns)}

Use the same skill instructions and this payload:
{json.dumps(payload, ensure_ascii=False, indent=2)}

Do not explain. Do not use markdown. Return JSON only.
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

    def _parse_output(self, result: AgentResult) -> dict[str, Any]:
        raw_text = extract_text_from_result(result)
        last_error: Exception | None = None
        for value in parse_json_values(raw_text, agent_name=self.agent_name):
            for candidate in extract_nested_candidates(value):
                try:
                    output = self.output_model.model_validate(candidate)
                    payload = output.model_dump()
                    if payload.get("decisions"):
                        return payload
                except Exception as error:
                    last_error = error
        if last_error:
            raise last_error
        raise ValueError(f"{self.agent_name} did not return a decision payload.")

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
                    result = await self.executor.invoke_async(task_text)
                    last_result = result
                    parsed = self._parse_output(result)
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
