"""Encoding specialist agent powered by the Ockham encoding skill."""

from ..contracts.agent_decision import AgentDecisionBatch
from .base_specialist_agent import SkillDrivenSpecialistAgent


class EncodingAgent(SkillDrivenSpecialistAgent):
    agent_name = "EncodingAgent"
    skill_name = "encoding"
    stage = "encoding"
    state_attribute = "encoding_decisions"
    output_model = AgentDecisionBatch
    batch_size = 5
    max_attempts_per_batch = 3
