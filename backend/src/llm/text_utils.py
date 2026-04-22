"""Small text helpers shared across the LLM integration."""

from typing import Any


def shorten_text(value: Any, max_length: int = 240) -> str:
    if value is None:
        return ""

    text = str(value).replace("\r", " ").replace("\n", " ").strip()
    if len(text) <= max_length:
        return text

    return f"{text[: max_length - 3]}..."


def read_message_text(message: Any) -> str:
    if message is None:
        return ""

    if isinstance(message, str):
        return message

    content = message.content if hasattr(message, "content") else message

    if isinstance(content, str):
        return content

    if isinstance(content, list):
        parts: list[str] = []

        for item in content:
            if isinstance(item, dict) and item.get("text"):
                parts.append(str(item["text"]))
            else:
                parts.append(str(item))

        return "\n".join(parts)

    return str(content)
