"""Feature-drop specialist agent powered by the Ockham feature-drop skill."""

from ..contracts.agent_decision import AgentDecisionBatch
from .base_specialist_agent import SkillDrivenSpecialistAgent


class FeatureDropAgent(SkillDrivenSpecialistAgent):
    agent_name = "FeatureDropAgent"
    skill_name = "feature-drop"
    stage = "column_action"
    state_attribute = "feature_drop_decisions"
    output_model = AgentDecisionBatch
    batch_size = 5
    max_attempts_per_batch = 3
