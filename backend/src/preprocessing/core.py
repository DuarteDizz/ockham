from loguru import logger
from strands.multiagent import GraphBuilder

from src.config.settings import settings
from src.llm.model_factory import build_strands_model

from .agents.casting import CastingAgent
from .agents.column_role import ColumnRoleAgent
from .agents.datetime_features import DatetimeFeatureAgent
from .agents.encoding import EncodingAgent
from .agents.feature_drop import FeatureDropAgent
from .agents.missing_values import MissingValueAgent
from .agents.plan_judge import PlanJudgeAgent
from .agents.plan_merger import PlanMergerAgent
from .agents.scaling import ScalingAgent
from .state import PreprocessingState


def build_preprocessing_graph_pipeline(state: PreprocessingState | None = None):
    """Build the Strands multi-agent preprocessing workflow.

    The model is resolved by the backend runtime LLM configuration. Ollama is the
    default provider, but users may switch to an OpenAI/OpenAI-compatible provider
    through the secure backend config endpoint.
    """
    state = state or PreprocessingState()
    logger.info("Building the preprocessing multi-agent graph pipeline.")

    model = build_strands_model()
    max_retries = settings.preprocessing_agent_max_retries

    builder = GraphBuilder()

    builder.add_node(
        ColumnRoleAgent(
            name="column_role",
            model=model,
            state=state,
            description="Classifies column roles and semantic risks from deterministic profiles.",
        ),
        "column_role",
    )

    builder.add_node(
        CastingAgent(
            name="casting",
            model=model,
            state=state,
            description="Recommends type casting operations.",
        ),
        "casting",
    )

    builder.add_node(
        FeatureDropAgent(
            name="feature_drop",
            model=model,
            state=state,
            description="Recommends feature removal for risky or unsupported columns.",
        ),
        "feature_drop",
    )

    builder.add_node(
        MissingValueAgent(
            name="missing_values",
            model=model,
            state=state,
            description="Recommends missing value imputation steps.",
        ),
        "missing_values",
    )

    builder.add_node(
        DatetimeFeatureAgent(
            name="datetime_features",
            model=model,
            state=state,
            description="Recommends datetime feature extraction steps.",
        ),
        "datetime_features",
    )

    builder.add_node(
        EncodingAgent(
            name="encoding",
            model=model,
            state=state,
            description="Recommends categorical encoding steps.",
        ),
        "encoding",
    )

    builder.add_node(
        ScalingAgent(
            name="scaling",
            model=model,
            state=state,
            description="Recommends numeric scaling steps.",
        ),
        "scaling",
    )

    builder.add_node(
        PlanMergerAgent(
            name="plan_merger",
            state=state,
            description="Merges agent decisions into one preprocessing plan.",
        ),
        "plan_merger",
    )

    builder.add_node(
        PlanJudgeAgent(
            name="plan_judge",
            model=model,
            state=state,
            description="Validates and reviews the merged preprocessing plan.",
        ),
        "plan_judge",
    )

    builder.add_edge("column_role", "casting")
    builder.add_edge("casting", "feature_drop")
    builder.add_edge("feature_drop", "missing_values")
    builder.add_edge("missing_values", "datetime_features")
    builder.add_edge("datetime_features", "encoding")
    builder.add_edge("encoding", "scaling")
    builder.add_edge("scaling", "plan_merger")
    builder.add_edge("plan_merger", "plan_judge")

    builder.add_edge(
        "plan_judge",
        "plan_judge",
        condition=lambda _: state.judge_decision == "revise" and state.judge_retries < max_retries,
    )

    builder.set_entry_point("column_role")
    builder.set_execution_timeout(600)

    logger.info("Preprocessing graph pipeline built successfully.")
    return builder.build(), state
