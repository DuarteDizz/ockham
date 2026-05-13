import math
import re
import unicodedata
from typing import Any

import pandas as pd

from src.preprocessing.column_context import ColumnAnalysisContext


def compute_text_stats(context: ColumnAnalysisContext) -> dict[str, Any]:
    if context.observed_text_series is None:
        return {"is_text_empty": True}

    text_series = normalize_text_series(context.observed_text_series)

    if text_series.empty:
        return {
            "is_text_empty": True,
            "top_1_ratio": None,
            "top_5_ratio": None,
            "rare_value_ratio": None,
            "entropy": None,
            "normalized_entropy": None,
            "avg_length": None,
            "median_length": None,
            "max_length": None,
            "numeric_parse_ratio": context.numeric_parse_ratio,
            "datetime_parse_ratio": context.datetime_parse_ratio,
            "unique_pattern_count": 0,
            "top_pattern_ratio": None,
            "avg_digit_ratio": None,
            "avg_alpha_ratio": None,
            "avg_special_char_ratio": None,
            "masked_top_distribution": {},
            "masked_top_patterns": {},
        }

    value_ratios = text_series.value_counts(normalize=True)
    unique_count = int(text_series.nunique())

    lengths = text_series.str.len()

    entropy = compute_entropy(value_ratios)
    normalized_entropy = compute_normalized_entropy(entropy, unique_count)

    return {
        "top_1_ratio": float(value_ratios.iloc[0]),
        "top_5_ratio": float(value_ratios.head(5).sum()),
        "rare_value_ratio": float((value_ratios < 0.01).mean()),

        "entropy": float(entropy),
        "normalized_entropy": float(normalized_entropy),

        "avg_length": float(lengths.mean()),
        "median_length": float(lengths.median()),
        "max_length": int(lengths.max()),

        "numeric_parse_ratio": context.numeric_parse_ratio,
        "datetime_parse_ratio": context.datetime_parse_ratio,

        **compute_pattern_statistics(text_series),

        "masked_top_distribution": {
            f"VALUE_{index + 1:03d}": float(ratio)
            for index, ratio in enumerate(value_ratios.head(10))
        },
    }


def normalize_text_series(series: pd.Series) -> pd.Series:
    text_series = series.dropna().astype(str).str.strip()
    text_series = text_series[text_series != ""]

    return text_series.map(normalize_text_value)


def normalize_text_value(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    normalized = "".join(
        char for char in normalized
        if not unicodedata.combining(char)
    )
    normalized = normalized.lower().strip()
    normalized = re.sub(r"\s+", " ", normalized)

    return normalized


def compute_entropy(value_ratios: pd.Series) -> float:
    return -sum(
        probability * math.log2(probability)
        for probability in value_ratios
        if probability > 0
    )


def compute_normalized_entropy(entropy: float, unique_count: int) -> float:
    if unique_count <= 1:
        return 0.0

    return float(entropy / math.log2(unique_count))


def compute_pattern_statistics(series: pd.Series) -> dict[str, Any]:
    patterns = series.map(to_shape_pattern)
    pattern_ratios = patterns.value_counts(normalize=True)

    return {
        "unique_pattern_count": int(patterns.nunique()),
        "top_pattern_ratio": float(pattern_ratios.iloc[0])
        if not pattern_ratios.empty
        else None,
        "avg_digit_ratio": float(series.map(digit_ratio).mean()),
        "avg_alpha_ratio": float(series.map(alpha_ratio).mean()),
        "avg_special_char_ratio": float(series.map(special_char_ratio).mean()),
        "masked_top_patterns": {
            f"PATTERN_{index + 1:03d}": {
                "shape": pattern,
                "ratio": float(ratio),
            }
            for index, (pattern, ratio) in enumerate(pattern_ratios.head(5).items())
        },
    }


def to_shape_pattern(value: str) -> str:
    pattern = []

    for char in value:
        if char.isalpha():
            pattern.append("A")
        elif char.isdigit():
            pattern.append("9")
        elif char.isspace():
            pattern.append(" ")
        else:
            pattern.append(char)

    compact_pattern = "".join(pattern)
    compact_pattern = re.sub(r"A+", "A", compact_pattern)
    compact_pattern = re.sub(r"9+", "9", compact_pattern)

    return compact_pattern[:80]


def digit_ratio(value: str) -> float:
    if not value:
        return 0.0

    return sum(char.isdigit() for char in value) / len(value)


def alpha_ratio(value: str) -> float:
    if not value:
        return 0.0

    return sum(char.isalpha() for char in value) / len(value)


def special_char_ratio(value: str) -> float:
    if not value:
        return 0.0

    return sum(
        (not char.isalnum()) and (not char.isspace())
        for char in value
    ) / len(value)