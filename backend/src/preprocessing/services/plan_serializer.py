from typing import Any


def summarize_plan(plan: dict[str, Any]) -> dict[str, Any]:
    columns = plan.get("columns", []) or []
    dropped = []
    transformed = []

    for column in columns:
        steps = column.get("steps", []) or []
        if any(step.get("operation") == "drop_column" for step in steps):
            dropped.append(column.get("column_name"))
        elif steps:
            transformed.append(column.get("column_name"))

    return {
        "column_count": len(columns),
        "dropped_column_count": len(dropped),
        "transformed_column_count": len(transformed),
        "dropped_columns": dropped,
        "transformed_columns": transformed,
    }
