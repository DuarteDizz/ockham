import pytest

pytest.importorskip("strands")

from src.preprocessing.agents.plan_judge import PlanJudgeAgent, PlanJudgeOutput
from src.preprocessing.state import PreprocessingState


def make_invalid_state() -> PreprocessingState:
    state = PreprocessingState(dataset_id="dataset_1", target_column="target")
    state.merged_plan = {
        "dataset_id": "dataset_1",
        "target_column": "target",
        "columns": [
            {
                "column_name": "target",
                "role": "target",
                "effective_type": "numeric",
                "steps": [{"operation": "median_imputer", "stage": "imputation"}],
            }
        ],
    }
    state.validation_result = {
        "is_valid": False,
        "errors": [
            {
                "column_name": "target",
                "operation": "median_imputer",
                "message": "Target columns cannot receive preprocessing transformations.",
            }
        ],
        "warnings": [],
    }
    return state


def test_plan_judge_cannot_approve_invalid_validation_result():
    agent = PlanJudgeAgent.__new__(PlanJudgeAgent)
    agent.state = make_invalid_state()

    output = agent._apply_deterministic_guardrails(
        PlanJudgeOutput(decision="approve", reason="Looks fine.")
    )

    assert output.decision == "reject"
    assert "cannot approve" in output.reason
    assert agent.state.final_plan == {}


def test_plan_judge_revision_requires_revised_plan():
    agent = PlanJudgeAgent.__new__(PlanJudgeAgent)
    agent.state = make_invalid_state()

    output = agent._apply_deterministic_guardrails(
        PlanJudgeOutput(decision="revise", reason="Needs revision.")
    )

    assert output.decision == "reject"
    assert "did not provide a revised_plan" in output.reason


def make_result_with_text(text: str):
    class Result:
        message = {"content": [{"text": text}]}

    return Result()


def test_plan_judge_parses_plain_json_output():
    agent = PlanJudgeAgent.__new__(PlanJudgeAgent)
    result = make_result_with_text(
        '{"decision":"approve","reason":"valid","revised_plan":null,"user_message":null,"warnings":[]}'
    )

    output = agent._parse_output(result)

    assert output.decision == "approve"
    assert output.reason == "valid"
    assert output.warnings == []


def test_plan_judge_parses_tool_like_arguments_without_tool_forcing():
    agent = PlanJudgeAgent.__new__(PlanJudgeAgent)
    result = make_result_with_text(
        '{"name":"PlanJudgeOutput","arguments":{"decision":"reject","reason":"unsafe","warnings":["bad"]}}'
    )

    output = agent._parse_output(result)

    assert output.decision == "reject"
    assert output.reason == "unsafe"
    assert output.warnings == ["bad"]
