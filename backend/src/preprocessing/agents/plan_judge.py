import json
from typing import Any

from loguru import logger
from pydantic import BaseModel, Field, field_validator
from strands import Agent
from strands.agent import AgentResult
from strands.models import Model
from strands.multiagent.base import MultiAgentBase, MultiAgentResult, NodeResult, Status
from strands.telemetry.metrics import EventLoopMetrics
from strands.types.content import ContentBlock, Message

from ..contracts.json_parser import extract_text_from_result, parse_json_values
from ..contracts.ollama_structured_output import (
    apply_ollama_structured_output_schema,
    build_ollama_json_schema,
)
from ..operation_registry import normalize_string_list
from ..prompts import plan_judge_prompt
from ..services.plan_serializer import summarize_plan
from ..services.plan_validator import validate_preprocessing_plan
from ..state import PreprocessingState


class PlanJudgeOutput(BaseModel):
    decision: str = ""
    reason: str = ""
    revised_plan: dict[str, Any] | None = None
    user_message: str | None = None
    warnings: list[str] = Field(default_factory=list)

    @field_validator("decision", mode="before")
    @classmethod
    def normalize_decision(cls, value: object) -> str:
        if isinstance(value, dict):
            value = value.get("decision")
        return str(value or "").strip().lower()

    @field_validator("warnings", mode="before")
    @classmethod
    def normalize_warnings(cls, value: object) -> list[str]:
        return normalize_string_list(value)


class PlanJudgeAgent(MultiAgentBase):
    """Review the merged preprocessing plan before it is exposed to the UI."""

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
        system_prompt = plan_judge_prompt
        self.executor = Agent(
            name=name,
            model=model,
            description=description,
            system_prompt=system_prompt,
        )

    @staticmethod
    def _issue_messages(validation_result: dict[str, Any], key: str) -> list[str]:
        issues = validation_result.get(key, []) if isinstance(validation_result, dict) else []
        messages: list[str] = []
        for issue in issues:
            if not isinstance(issue, dict):
                continue
            column = issue.get("column_name")
            operation = issue.get("operation")
            message = issue.get("message")
            parts = [part for part in [column, operation, message] if part]
            if parts:
                messages.append(" | ".join(str(part) for part in parts))
        return messages

    @staticmethod
    def _is_validation_valid(validation_result: dict[str, Any]) -> bool:
        if not isinstance(validation_result, dict):
            return False
        return bool(validation_result.get("is_valid"))

    def _apply_deterministic_guardrails(self, output: PlanJudgeOutput) -> PlanJudgeOutput:
        """Prevent the judge from approving a deterministically invalid plan."""
        active_validation = self.state.validation_result

        if output.revised_plan:
            self.state.merged_plan = output.revised_plan
            active_validation = validate_preprocessing_plan(output.revised_plan)
            self.state.validation_result = active_validation

        validation_is_valid = self._is_validation_valid(active_validation)
        validation_errors = self._issue_messages(active_validation, "errors")

        if output.decision == "approve" and not validation_is_valid:
            output.decision = "reject"
            output.reason = (
                "PlanJudgeAgent cannot approve a plan that failed deterministic validation. "
                + "; ".join(validation_errors[:5])
            ).strip()
            output.user_message = (
                "The preprocessing plan failed technical validation and cannot be safely approved."
            )
            output.revised_plan = None
            return output

        if output.decision == "revise" and not output.revised_plan:
            output.decision = "reject"
            output.reason = (
                "PlanJudgeAgent requested revision but did not provide a revised_plan. "
                "A revision decision must include a minimal repaired plan."
            )
            output.user_message = (
                "The preprocessing plan needs changes, but no safe automatic revision was produced."
            )
            return output

        if output.decision == "revise" and output.revised_plan and validation_is_valid:
            output.reason = output.reason or "A revised plan was produced and passed deterministic validation."

        return output

    @staticmethod
    def _plan_judge_candidates(value: Any) -> list[Any]:
        """Return likely PlanJudgeOutput payloads from plain JSON responses."""
        candidates: list[Any] = [value]
        if isinstance(value, dict):
            arguments = value.get("arguments")
            if isinstance(arguments, dict):
                candidates.append(arguments)

            for key in ("response", "result", "output", "data"):
                nested = value.get(key)
                if isinstance(nested, dict):
                    candidates.append(nested)

            system = value.get("system")
            if isinstance(system, dict):
                response = system.get("response")
                if isinstance(response, dict):
                    candidates.append(response)

        return candidates

    def _parse_output(self, result: AgentResult) -> PlanJudgeOutput:
        raw_text = extract_text_from_result(result)
        last_error: Exception | None = None

        for value in parse_json_values(raw_text, agent_name="PlanJudgeAgent"):
            for candidate in self._plan_judge_candidates(value):
                try:
                    output = PlanJudgeOutput.model_validate(candidate)
                    if output.decision:
                        return output
                except Exception as error:
                    last_error = error

        if last_error:
            raise last_error
        raise ValueError("PlanJudgeAgent did not return a valid judge decision payload.")

    def build_task(self) -> str:
        validation_result = self.state.validation_result or {}
        payload = {
            "dataset_id": self.state.dataset_id,
            "target_column": self.state.target_column,
            "plan_summary": summarize_plan(self.state.merged_plan),
            "merged_plan": self.state.merged_plan,
            "validation_result": validation_result,
            "validation_error_messages": self._issue_messages(validation_result, "errors"),
            "validation_warning_messages": self._issue_messages(validation_result, "warnings"),
            "judge_retries": self.state.judge_retries,
            "hard_rules": [
                "Never approve a plan when validation_result.is_valid is false.",
                "Never allow target imputation, target scaling or target encoding.",
                "Only drop_rows_missing is allowed on target columns.",
                "Never allow additional steps after drop_column.",
                "Never invent unsupported operations or stages.",
                "Use revise only with a revised_plan; otherwise reject.",
            ],
            "output_contract": {
                "allowed_decisions": ["approve", "revise", "reject"],
                "decision_must_be_plain_string": True,
                "warnings_must_be_list_of_strings": True,
                "revise_requires_revised_plan": True,
            },
        }
        self._last_payload = payload
        return (
            "STRICT OCKHAM PLAN JUDGE CONTRACT\n\n"
            "Return only one JSON object parseable by Python json.loads.\n"
            "Do not use tool calls, markdown, commentary, examples or JSON fences.\n"
            "The JSON object must contain: decision, reason, revised_plan, user_message, warnings.\n"
            "The decision field must be one plain string: approve, revise or reject.\n"
            "Do not nest decision inside another object.\n"
            "warnings must be a list of strings.\n"
            "Never approve when validation_result.is_valid is false.\n"
            "If decision is revise, revised_plan must be present.\n\n"
            "VALID OUTPUT SHAPE:\n"
            '{"decision":"approve","reason":"Plan passed deterministic validation.","revised_plan":null,"user_message":null,"warnings":[]}\n\n'
            "INPUT PAYLOAD JSON:\n"
            + json.dumps(payload, ensure_ascii=False, indent=2)
        )

    async def invoke_async(
        self,
        task: str | list[ContentBlock],
        invocation_state: dict[str, Any] | None = None,
        **kwargs: Any,
    ) -> MultiAgentResult:
        task = self.build_task()
        result = AgentResult(
            stop_reason="end_turn",
            message=Message(role="assistant", content=[{"text": "Agent not executed."}]),
            metrics=EventLoopMetrics(),
            state="failed",
        )
        schema = build_ollama_json_schema(PlanJudgeOutput)

        for attempt in range(2):
            try:
                with apply_ollama_structured_output_schema(self.model, schema):
                    result = await self.executor.invoke_async(task)
                output = self._parse_output(result)

                if output.decision not in {"approve", "revise", "reject"}:
                    raise ValueError(
                        "PlanJudgeAgent returned invalid decision "
                        f"'{output.decision}'. Expected one of: approve, revise, reject."
                    )

                output = self._apply_deterministic_guardrails(output)

                self.state.judge_decision = output.decision
                self.state.judge_reason = output.reason
                self.state.judge_user_message = output.user_message

                if output.decision == "approve":
                    self.state.final_plan = self.state.merged_plan
                elif output.decision == "revise":
                    self.state.judge_retries += 1
                else:
                    self.state.judge_decision = "reject"
                break
            except Exception as error:
                logger.warning(
                    "PlanJudgeAgent returned invalid output on attempt {}. error={}",
                    attempt + 1,
                    error,
                )
                if attempt == 1:
                    raise
                task = (
                    "YOUR PREVIOUS PLAN JUDGE OUTPUT WAS INVALID.\n"
                    f"Validation error: {error}\n\n"
                    "Return only one JSON object. No markdown. No tool call. No copied input.\n"
                    "Required shape:\n"
                    '{"decision":"approve|revise|reject","reason":"...","revised_plan":null,"user_message":null,"warnings":[]}\n\n'
                    "decision must be exactly one plain string: approve, revise or reject.\n"
                    "warnings must be a list of strings.\n"
                    "Never approve a deterministically invalid plan.\n"
                    "If decision is revise, revised_plan must be present.\n\n"
                    "Validation result and plan summary:\n"
                    + json.dumps(
                        {
                            "validation_result": self._last_payload.get("validation_result"),
                            "validation_error_messages": self._last_payload.get("validation_error_messages"),
                            "validation_warning_messages": self._last_payload.get("validation_warning_messages"),
                            "plan_summary": self._last_payload.get("plan_summary"),
                        },
                        ensure_ascii=False,
                        indent=2,
                    )
                )

        if result.state == "failed":
            logger.error("Plan judge agent failed to run.")
            raise ValueError(f"Agent {self.executor.name} failed to run")

        logger.debug("Plan judge agent completed successfully.")
        return MultiAgentResult(
            status=Status.COMPLETED,
            results={self.executor.name: NodeResult(result=result)},
        )
