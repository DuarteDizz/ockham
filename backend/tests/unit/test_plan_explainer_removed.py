from src.preprocessing.pipeline import STEPS
from src.preprocessing.state import PreprocessingState


def test_plan_explainer_removed_from_runtime_steps():
    assert "plan_explainer" not in STEPS
    assert len(STEPS) == 9
    assert list(STEPS)[-1] == "plan_judge"


def test_state_no_longer_tracks_plan_explanation():
    state = PreprocessingState()
    assert not hasattr(state, "explanation")
