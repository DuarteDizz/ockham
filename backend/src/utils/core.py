import numpy as np


def clamp(value, lo=0.0, hi=1.0):
    return max(lo, min(hi, float(value)))


def to_jsonable(value):
    if isinstance(value, (np.integer, np.floating)):
        return value.item()

    if isinstance(value, np.ndarray):
        return value.tolist()

    if isinstance(value, dict):
        return {str(key): to_jsonable(item) for key, item in value.items()}

    if isinstance(value, (list, tuple)):
        return [to_jsonable(item) for item in value]

    return value
