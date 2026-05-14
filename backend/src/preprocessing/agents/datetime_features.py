"""Datetime feature specialist agent powered by the Ockham datetime skill."""

from ..contracts.agent_decision import AgentDecisionBatch
from .base_specialist_agent import SkillDrivenSpecialistAgent


class DatetimeFeatureAgent(SkillDrivenSpecialistAgent):
    agent_name = "DatetimeFeatureAgent"
    skill_name = "datetime-features"
    stage = "datetime"
    state_attribute = "datetime_decisions"
    output_model = AgentDecisionBatch
    batch_size = 5
    max_attempts_per_batch = 3
