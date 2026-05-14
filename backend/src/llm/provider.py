from loguru import logger

from src.llm.model_factory import build_langchain_chat_model
from src.llm.prompts import build_ranking_prompt, build_repair_prompt
from src.llm.runtime_config import EffectiveLlmConfig, llm_runtime_config_store
from src.llm.text_utils import read_message_text, shorten_text


def get_llm_provider_name(config: EffectiveLlmConfig | None = None) -> str:
    config = config or llm_runtime_config_store.get_effective_config()
    return f"{config.provider}_json"


def build_ollama_chat_model():
    """Backward-compatible helper used by older call sites.

    The active provider can still be changed at runtime; the historical name is
    kept so existing imports do not break.
    """
    return build_langchain_chat_model()


def invoke_llm_ranking(prompt_payload: dict[str, str]):
    prompt = build_ranking_prompt()
    config = llm_runtime_config_store.get_effective_config()
    llm = build_langchain_chat_model(config)
    chain = prompt | llm

    logger.info(
        "LLM provider invoke starting. provider={} mode=ranking model={} base_url={} timeout={} temperature={} payload_keys={} prompt_variables={} has_api_key={}",
        get_llm_provider_name(config),
        config.model,
        config.base_url,
        config.timeout_seconds,
        config.temperature,
        sorted(prompt_payload.keys()),
        sorted(prompt.input_variables),
        config.has_api_key,
    )

    message = chain.invoke(prompt_payload)
    message_text = read_message_text(message)

    logger.info(
        "LLM provider invoke completed. provider={} mode=ranking model={} message_type={} content_chars={} preview={}",
        get_llm_provider_name(config),
        config.model,
        type(message).__name__,
        len(message_text),
        shorten_text(message_text),
    )

    return message


def invoke_llm_ranking_repair(prompt_payload: dict[str, str]):
    prompt = build_repair_prompt()
    config = llm_runtime_config_store.get_effective_config()
    llm = build_langchain_chat_model(config)
    chain = prompt | llm

    logger.info(
        "LLM provider invoke starting. provider={} mode=repair model={} base_url={} timeout={} temperature={} payload_keys={} prompt_variables={} has_api_key={}",
        get_llm_provider_name(config),
        config.model,
        config.base_url,
        config.timeout_seconds,
        config.temperature,
        sorted(prompt_payload.keys()),
        sorted(prompt.input_variables),
        config.has_api_key,
    )

    message = chain.invoke(prompt_payload)
    message_text = read_message_text(message)

    logger.info(
        "LLM provider invoke completed. provider={} mode=repair model={} message_type={} content_chars={} preview={}",
        get_llm_provider_name(config),
        config.model,
        type(message).__name__,
        len(message_text),
        shorten_text(message_text),
    )

    return message


# Compatibility aliases for the current ranking client.
LLM_PROVIDER_NAME = "runtime_llm_json"
invoke_ollama_ranking = invoke_llm_ranking
invoke_ollama_ranking_repair = invoke_llm_ranking_repair
