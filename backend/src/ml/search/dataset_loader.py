"""Dataset loading and model-context validation helpers."""

import pandas as pd

from src.ml.models.model_specs import PROBLEM_TYPES
from src.ml.models.registry import get_model_config
from src.ml.search.cross_validation import build_scoring


def load_numeric_dataset(dataset_path, target_column, problem_type):
    """Load a CSV dataset and enforce the numeric-only constraint used by Ockham."""
    if problem_type not in PROBLEM_TYPES:
        raise ValueError(f"Unsupported problem_type: {problem_type}")

    df = pd.read_csv(dataset_path)

    if target_column not in df.columns:
        raise ValueError(f"Target column '{target_column}' not found in dataset.")

    X = df.drop(columns=[target_column])
    y = df[target_column]

    if X.empty:
        raise ValueError("Dataset has no feature columns after removing target.")

    non_numeric_columns = X.select_dtypes(exclude=["number"]).columns.tolist()
    if non_numeric_columns:
        raise ValueError(
            "Dataset contains non-numeric feature columns. "
            "Please preprocess the dataset before sending it to Ockham. "
            f"Non-numeric columns: {non_numeric_columns}"
        )

    if problem_type == "classification" and y.nunique() < 2:
        raise ValueError("Classification target must have at least 2 classes.")

    if problem_type == "regression" and not pd.api.types.is_numeric_dtype(y):
        raise ValueError("Regression target must be numeric.")

    return X, y


def prepare_model_context(problem_type, model_id):
    """Resolve the registry config and scoring context for one model search."""
    model_config = get_model_config(model_id)

    if model_config.problem_type != problem_type:
        raise ValueError(f"Model '{model_id}' is not a {problem_type} model.")

    primary_metric, scoring = build_scoring(model_config)
    search_params = model_config.get_search_params()

    if not search_params:
        raise ValueError(f"Model '{model_id}' has no search_params configured.")

    return model_config, primary_metric, scoring, search_params
