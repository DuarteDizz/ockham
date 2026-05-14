"""Scaling specialist agent powered by the Ockham feature-scaling skill."""

from ..contracts.agent_decision import AgentDecisionBatch
from .base_specialist_agent import SkillDrivenSpecialistAgent


class ScalingAgent(SkillDrivenSpecialistAgent):
    agent_name = "ScalingAgent"
    skill_name = "scaling"
    stage = "scaling"
    state_attribute = "scaling_decisions"
    output_model = AgentDecisionBatch
    batch_size = 3
    max_attempts_per_batch = 3
