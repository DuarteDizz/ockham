from src.preprocessing.operation_registry import (
    CAST_EFFECTIVE_TYPES,
    get_operation_registry_payload,
    get_operations_by_stage,
)


def test_operation_registry_exposes_canonical_frontend_payload():
    payload = get_operation_registry_payload()

    operation_ids = {operation["id"] for operation in payload["operations"]}

    assert payload["version"]
    assert "standard_scaler" in operation_ids
    assert "one_hot_encoder" in operation_ids
    assert "drop_rows_missing" in operation_ids
    assert payload["cast_target_type_by_operation"] == CAST_EFFECTIVE_TYPES
    assert "numeric" in payload["compatible_operations_by_type"]
    row_drop = next(operation for operation in payload["operations"] if operation["id"] == "drop_rows_missing")
    assert row_drop["exclusive_group"] == "missing_value_strategy"
    assert row_drop["default_params"] == {"scope": "missing_in_column"}


def test_stage_helpers_are_derived_from_registry_specs():
    encoding_operations = get_operations_by_stage("encoding")

    assert encoding_operations["one_hot_encoder"] == "One-hot encoder"
    assert "standard_scaler" not in encoding_operations
