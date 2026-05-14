"""Casting specialist agent powered by the Ockham casting skill."""

from ..contracts.agent_decision import AgentDecisionBatch
from .base_specialist_agent import SkillDrivenSpecialistAgent


class CastingAgent(SkillDrivenSpecialistAgent):
    agent_name = "CastingAgent"
    skill_name = "casting"
    stage = "casting"
    state_attribute = "casting_decisions"
    output_model = AgentDecisionBatch
    batch_size = 5
    max_attempts_per_batch = 3
