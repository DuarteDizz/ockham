"""Model search parameter specifications and model configuration records."""

from dataclasses import dataclass, field

import numpy as np

PROBLEM_TYPES = {"classification", "regression"}


@dataclass(frozen=True)
class ChoiceParam:
    """Discrete search parameter represented by an explicit list of values."""

    choices: tuple
    validation_values: tuple = ()

    def suggest(self, trial, name):
        values = list(self.choices)
        if len(values) == 1:
            return values[0]
        return trial.suggest_categorical(name, values)

    def grid_candidates(self):
        return list(self.choices)

    def validation_candidates(self, sample_count=7):
        if self.validation_values:
            return list(self.validation_values)
        return list(self.choices)

    def contains(self, value):
        return value in self.choices

    def to_dict(self):
        payload = {"kind": "choice", "choices": list(self.choices)}
        if self.validation_values:
            payload["validation_values"] = list(self.validation_values)
        return payload


@dataclass(frozen=True)
class IntRangeParam:
    """Integer search parameter with optional validation samples."""

    low: int
    high: int
    step: int = 1
    log: bool = False
    validation_values: tuple = ()

    def suggest(self, trial, name):
        return trial.suggest_int(
            name,
            low=self.low,
            high=self.high,
            step=self.step,
            log=self.log,
        )

    def grid_candidates(self):
        return list(range(self.low, self.high + 1, self.step))

    def validation_candidates(self, sample_count=7):
        if self.validation_values:
            return list(self.validation_values)

        values = np.linspace(self.low, self.high, num=sample_count)
        return sorted({int(round(value)) for value in values})

    def contains(self, value):
        try:
            int_value = int(value)
        except Exception:
            return False

        if int_value < self.low or int_value > self.high:
            return False
        return (int_value - self.low) % self.step == 0

    def to_dict(self):
        payload = {
            "kind": "int_range",
            "low": self.low,
            "high": self.high,
            "step": self.step,
            "log": self.log,
        }
        if self.validation_values:
            payload["validation_values"] = list(self.validation_values)
        return payload


@dataclass(frozen=True)
class FloatRangeParam:
    """Float search parameter with linear or logarithmic sampling."""

    low: float
    high: float
    step: float | None = None
    log: bool = False
    validation_values: tuple = ()

    def suggest(self, trial, name):
        if self.step is not None:
            return trial.suggest_float(
                name,
                low=self.low,
                high=self.high,
                step=self.step,
                log=self.log,
            )
        return trial.suggest_float(name, low=self.low, high=self.high, log=self.log)

    def grid_candidates(self):
        return None

    def validation_candidates(self, sample_count=7):
        if self.validation_values:
            return list(self.validation_values)

        if self.log and self.low > 0 and self.high > 0:
            values = np.geomspace(self.low, self.high, num=sample_count)
        else:
            values = np.linspace(self.low, self.high, num=sample_count)
        return [float(value) for value in values]

    def contains(self, value):
        try:
            float_value = float(value)
        except Exception:
            return False
        return self.low <= float_value <= self.high

    def to_dict(self):
        payload = {
            "kind": "float_range",
            "low": self.low,
            "high": self.high,
            "log": self.log,
        }
        if self.step is not None:
            payload["step"] = self.step
        if self.validation_values:
            payload["validation_values"] = list(self.validation_values)
        return payload


PARAM_SPEC_TYPES = (ChoiceParam, IntRangeParam, FloatRangeParam)


def choices(*values, validation_values=None):
    validation_values_tuple = () if validation_values is None else tuple(validation_values)
    return ChoiceParam(choices=tuple(values), validation_values=validation_values_tuple)


def int_range(low, high, step=1, log=False, validation_values=None):
    validation_values_tuple = () if validation_values is None else tuple(validation_values)
    return IntRangeParam(
        low=low,
        high=high,
        step=step,
        log=log,
        validation_values=validation_values_tuple,
    )


def float_range(low, high, step=None, log=False, validation_values=None):
    validation_values_tuple = () if validation_values is None else tuple(validation_values)
    return FloatRangeParam(
        low=low,
        high=high,
        step=step,
        log=log,
        validation_values=validation_values_tuple,
    )


def serialize_search_params(search_params):
    """Convert parameter specs into plain dictionaries for API responses."""
    if isinstance(search_params, dict):
        serialized_params = {}
        for name, param in search_params.items():
            if isinstance(param, PARAM_SPEC_TYPES):
                serialized_params[name] = param.to_dict()
            else:
                serialized_params[name] = param
        return serialized_params

    if isinstance(search_params, list):
        serialized_spaces = []
        for space in search_params:
            if isinstance(space, dict):
                serialized_spaces.append(serialize_search_params(space))
        return serialized_spaces

    return search_params


@dataclass(frozen=True)
class ModelConfig:
    """Registry record describing one model family supported by Ockham."""

    id: str
    name: str
    category: str
    problem_type: str
    primary_metric: str

    estimator: object = None
    builder: object = None
    default_params: dict = field(default_factory=dict)
    search_spaces: tuple = field(default_factory=tuple)
    search_backend: str = "optuna_cv"
    secondary_metrics: tuple = ()
    simplicity_score: float = 1
    interpretability_score: float = 1
    scalability_score: float = 1

    def __post_init__(self):
        if self.problem_type not in PROBLEM_TYPES:
            raise ValueError(f"Unsupported problem_type: {self.problem_type}")

        if self.estimator is None and self.builder is None:
            raise ValueError(f"Model '{self.id}' has neither estimator nor builder configured.")

        if not self.search_spaces:
            raise ValueError(f"Model '{self.id}' must define at least one search space.")

    def build_estimator(self):
        """Build a fresh estimator with the model default parameters applied."""
        params = dict(self.default_params)
        if self.builder is not None:
            return self.builder(**params)
        return self.estimator(**params)

    def get_search_params(self):
        """Return one search space dict or a list of alternative spaces."""
        spaces = [dict(space) for space in self.search_spaces]
        if len(spaces) == 1:
            return spaces[0]
        return spaces

    def to_dict(self):
        record = {
            "id": self.id,
            "name": self.name,
            "category": self.category,
            "problem_type": self.problem_type,
            "default_params": dict(self.default_params),
            "search_params": serialize_search_params(self.get_search_params()),
            "search_backend": self.search_backend,
            "primary_metric": self.primary_metric,
            "secondary_metrics": list(self.secondary_metrics),
            "simplicity_score": self.simplicity_score,
            "interpretability_score": self.interpretability_score,
            "scalability_score": self.scalability_score,
        }

        if self.estimator is not None:
            record["estimator"] = self.estimator
        if self.builder is not None:
            record["builder"] = self.builder
        return record
