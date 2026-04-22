from loguru import logger
from langchain_ollama import ChatOllama

from src.config import settings
from src.llm.prompts import build_ranking_prompt, build_repair_prompt
from src.llm.text_utils import read_message_text, shorten_text


LLM_PROVIDER_NAME = "ollama_json"


def build_ollama_chat_model() -> ChatOllama:
    return ChatOllama(
        base_url=settings.ollama_base_url,
        model=settings.ollama_model,
        temperature=settings.ollama_temperature,
        timeout=settings.ollama_timeout_seconds,
        format="json",
    )


def invoke_ollama_ranking(
    prompt_payload: dict[str, str],
):
    prompt = build_ranking_prompt()
    llm = build_ollama_chat_model()
    chain = prompt | llm

    logger.info(
        "LLM provider invoke starting. provider={} mode=ranking model={} base_url={} timeout={} temperature={} payload_keys={} prompt_variables={}",
        LLM_PROVIDER_NAME,
        settings.ollama_model,
        settings.ollama_base_url,
        settings.ollama_timeout_seconds,
        settings.ollama_temperature,
        sorted(prompt_payload.keys()),
        sorted(prompt.input_variables),
    )

    message = chain.invoke(prompt_payload)
    message_text = read_message_text(message)

    logger.info(
        "LLM provider invoke completed. provider={} mode=ranking model={} message_type={} content_chars={} preview={}",
        LLM_PROVIDER_NAME,
        settings.ollama_model,
        type(message).__name__,
        len(message_text),
        shorten_text(message_text),
    )

    return message


def invoke_ollama_ranking_repair(
    prompt_payload: dict[str, str],
):
    prompt = build_repair_prompt()
    llm = build_ollama_chat_model()
    chain = prompt | llm

    logger.info(
        "LLM provider invoke starting. provider={} mode=repair model={} base_url={} timeout={} temperature={} payload_keys={} prompt_variables={}",
        LLM_PROVIDER_NAME,
        settings.ollama_model,
        settings.ollama_base_url,
        settings.ollama_timeout_seconds,
        settings.ollama_temperature,
        sorted(prompt_payload.keys()),
        sorted(prompt.input_variables),
    )

    message = chain.invoke(prompt_payload)
    message_text = read_message_text(message)

    logger.info(
        "LLM provider invoke completed. provider={} mode=repair model={} message_type={} content_chars={} preview={}",
        LLM_PROVIDER_NAME,
        settings.ollama_model,
        type(message).__name__,
        len(message_text),
        shorten_text(message_text),
    )

    return message