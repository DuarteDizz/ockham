"""JSON extraction helpers for local-model Ockham agents."""

from __future__ import annotations

import json
from typing import Any

from strands.agent import AgentResult


def extract_text_from_result(result: AgentResult) -> str:
    message = getattr(result, "message", None)
    if message is None:
        return str(result)
    if isinstance(message, str):
        return message

    content = getattr(message, "content", None)
    if content is None and isinstance(message, dict):
        content = message.get("content", [])
    if isinstance(content, str):
        return content

    chunks: list[str] = []
    for block in content or []:
        if isinstance(block, dict):
            text = block.get("text") or block.get("content") or ""
            if text:
                chunks.append(str(text))
        else:
            text = getattr(block, "text", None)
            if text:
                chunks.append(str(text))
    return "".join(chunks).strip()


def parse_json_values(text: str, *, agent_name: str) -> list[Any]:
    if not text or not text.strip():
        raise ValueError(f"{agent_name} returned an empty response.")
    cleaned = text.strip()
    decoder = json.JSONDecoder()
    values: list[Any] = []
    for index, char in enumerate(cleaned):
        if char not in "[{":
            continue
        try:
            parsed, _ = decoder.raw_decode(cleaned[index:])
            values.append(parsed)
        except json.JSONDecodeError:
            continue
    if not values:
        raise ValueError(f"{agent_name} did not return parseable JSON. Response: {cleaned[:500]}")
    return values


def extract_nested_candidates(value: Any) -> list[Any]:
    candidates = [value]
    if isinstance(value, dict):
        for key in ("system", "response", "result", "output"):
            nested = value.get(key)
            if isinstance(nested, dict):
                candidates.append(nested)
        system = value.get("system")
        if isinstance(system, dict) and isinstance(system.get("response"), dict):
            candidates.append(system["response"])

    expanded: list[Any] = []
    for candidate in candidates:
        if isinstance(candidate, dict):
            for key in ("decisions", "columns", "features", "items"):
                nested = candidate.get(key)
                if isinstance(nested, (list, dict)):
                    expanded.append({"decisions": nested} if key != "decisions" else candidate)
            expanded.append(candidate)
        else:
            expanded.append(candidate)
    return expanded
