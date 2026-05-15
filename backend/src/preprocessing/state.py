from dataclasses import dataclass, field
from typing import Any, Literal


@dataclass
class PreprocessingState:
    dataset_id: str = ""
    problem_type: str = "classification"
    target_column: str | None = None

    dataset_profile: dict[str, Any] = field(default_factory=dict)

    column_role_decisions: dict[str, Any] = field(default_factory=dict)
    casting_decisions: dict[str, Any] = field(default_factory=dict)
    feature_drop_decisions: dict[str, Any] = field(default_factory=dict)
    missing_value_decisions: dict[str, Any] = field(default_factory=dict)
    datetime_decisions: dict[str, Any] = field(default_factory=dict)
    encoding_decisions: dict[str, Any] = field(default_factory=dict)
    scaling_decisions: dict[str, Any] = field(default_factory=dict)

    merged_plan: dict[str, Any] = field(default_factory=dict)
    validation_result: dict[str, Any] = field(default_factory=dict)
    final_plan: dict[str, Any] = field(default_factory=dict)

    judge_decision: Literal["approve", "revise", "reject"] | None = None
    judge_reason: str = ""
    judge_user_message: str | None = None
    judge_retries: int = 0

    def reset_for_new_run(self) -> None:
        """Clear transient fields before a fresh preprocessing plan run."""
        self.column_role_decisions = {}
        self.casting_decisions = {}
        self.feature_drop_decisions = {}
        self.missing_value_decisions = {}
        self.datetime_decisions = {}
        self.encoding_decisions = {}
        self.scaling_decisions = {}
        self.merged_plan = {}
        self.validation_result = {}
        self.final_plan = {}
        self.judge_decision = None
        self.judge_reason = ""
        self.judge_user_message = None
        self.judge_retries = 0
