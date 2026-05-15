from typing import Any

from loguru import logger

from ..operation_registry import (
    STAGE_ORDER,
    get_all_operation_names,
    get_operation_stage,
    get_operations_by_stage,
)
from ..schemas import ValidationIssue, ValidationResult

CASTING_OPERATIONS = set(get_operations_by_stage("casting"))
IMPUTATION_OPERATIONS = set(get_operations_by_stage("imputation"))
DATETIME_OPERATIONS = set(get_operations_by_stage("datetime"))
ENCODING_OPERATIONS = set(get_operations_by_stage("encoding"))
SCALING_OPERATIONS = set(get_operations_by_stage("scaling"))
COLUMN_ACTION_OPERATIONS = set(get_operations_by_stage("column_action"))
ROW_FILTER_OPERATIONS = {"drop_rows_missing"}
VALID_OPERATIONS = get_all_operation_names()


def validate_preprocessing_plan(plan: dict[str, Any]) -> dict[str, Any]:
    """Validate a preprocessing plan with deterministic guardrails."""
    errors: list[ValidationIssue] = []
    warnings: list[ValidationIssue] = []

    target_column = plan.get("target_column")
    feature_count = 0
    row_filter_missing_ratios: list[tuple[str | None, str | None, float]] = []

    for column_plan in plan.get("columns", []):
        column_name = column_plan.get("column_name")
        role = column_plan.get("role", "feature")
        steps = column_plan.get("steps", []) or []

        if role == "feature":
            feature_count += 1

        if column_name == target_column and role == "feature":
            errors.append(
                ValidationIssue(
                    column_name=column_name,
                    message="Target column cannot remain as a feature in the preprocessing plan.",
                )
            )

        operations = [step.get("operation") for step in steps]
        if "drop_column" in operations and len(operations) > 1:
            errors.append(
                ValidationIssue(
                    column_name=column_name,
                    operation="drop_column",
                    message="A dropped column cannot contain additional transformation steps.",
                )
            )

        if role == "target":
            invalid_target_operations = [
                operation for operation in operations if operation not in ROW_FILTER_OPERATIONS
            ]
            if invalid_target_operations:
                errors.append(
                    ValidationIssue(
                        column_name=column_name,
                        message=(
                            "Target columns cannot receive preprocessing transformations; "
                            "only drop_rows_missing is allowed to remove unlabeled rows."
                        ),
                    )
                )

        previous_stage_order = -1
        seen_operations: set[str] = set()

        for step in steps:
            operation = step.get("operation")
            stage = step.get("stage")
            effective_type = column_plan.get("effective_type") or column_plan.get("inferred_type")

            if operation not in VALID_OPERATIONS:
                errors.append(
                    ValidationIssue(
                        column_name=column_name,
                        operation=operation,
                        message=f"Unknown preprocessing operation: {operation}.",
                    )
                )
                continue

            expected_stage = get_operation_stage(operation)
            if expected_stage and stage != expected_stage:
                errors.append(
                    ValidationIssue(
                        column_name=column_name,
                        operation=operation,
                        message=(
                            f"Operation {operation} belongs to stage {expected_stage}, "
                            f"but the plan step uses stage {stage}."
                        ),
                    )
                )

            if operation in seen_operations:
                warnings.append(
                    ValidationIssue(
                        column_name=column_name,
                        operation=operation,
                        severity="warning",
                        message="Repeated operation detected in the same column plan.",
                    )
                )
            seen_operations.add(operation)

            stage_order = STAGE_ORDER.get(stage, previous_stage_order)
            if stage_order < previous_stage_order:
                errors.append(
                    ValidationIssue(
                        column_name=column_name,
                        operation=operation,
                        message="Preprocessing steps are not in the expected stage order.",
                    )
                )
            previous_stage_order = stage_order

            if operation == "drop_rows_missing":
                evidence = step.get("evidence") or {}
                try:
                    missing_ratio = float(evidence.get("missing_ratio") or 0.0)
                except (TypeError, ValueError):
                    missing_ratio = 0.0
                row_filter_missing_ratios.append((column_name, operation, missing_ratio))

            if operation in SCALING_OPERATIONS and effective_type not in {"numeric", "numeric_like_text"}:
                errors.append(
                    ValidationIssue(
                        column_name=column_name,
                        operation=operation,
                        message="Scaling operations can only be applied to numeric features.",
                    )
                )

            if operation in ENCODING_OPERATIONS and effective_type not in {
                "categorical",
                "text",
                "boolean",
                "object",
            }:
                warnings.append(
                    ValidationIssue(
                        column_name=column_name,
                        operation=operation,
                        severity="warning",
                        message="Encoding operation was applied to a column that is not clearly categorical.",
                    )
                )

            if operation in DATETIME_OPERATIONS and effective_type not in {
                "datetime",
                "datetime_like_text",
            }:
                warnings.append(
                    ValidationIssue(
                        column_name=column_name,
                        operation=operation,
                        severity="warning",
                        message="Datetime operation was applied to a column that is not clearly datetime-like.",
                    )
                )

    if row_filter_missing_ratios:
        estimated_upper_bound = min(1.0, sum(ratio for _, _, ratio in row_filter_missing_ratios))
        if len(row_filter_missing_ratios) > 1 or estimated_upper_bound > 0.05:
            warnings.append(
                ValidationIssue(
                    severity="warning",
                    message=(
                        "The plan removes rows with missing values. Review the cumulative row-loss impact, "
                        f"especially because the missing-ratio upper bound is {estimated_upper_bound:.1%}."
                    ),
                )
            )

    if feature_count == 0:
        errors.append(ValidationIssue(message="The preprocessing plan drops or excludes all features."))

    validation = ValidationResult(is_valid=not errors, errors=errors, warnings=warnings)
    logger.debug(
        "Preprocessing plan validation completed. valid={} errors={} warnings={}",
        validation.is_valid,
        len(errors),
        len(warnings),
    )
    return validation.model_dump()
