"""Missing-value specialist agent powered by the Ockham missing-values skill."""

from ..contracts.agent_decision import AgentDecisionBatch
from .base_specialist_agent import SkillDrivenSpecialistAgent


class MissingValueAgent(SkillDrivenSpecialistAgent):
    agent_name = "MissingValueAgent"
    skill_name = "missing-values"
    stage = "imputation"
    state_attribute = "missing_value_decisions"
    output_model = AgentDecisionBatch
    batch_size = 5
    max_attempts_per_batch = 3
