import asyncio
from collections.abc import AsyncIterator, Iterator
from dataclasses import dataclass
from queue import Queue
from threading import Thread
from typing import Any

from .state import PreprocessingState

STEPS = {
    "column_role": ("1/9 · Column Role Agent", "Classifying column roles."),
    "casting": ("2/9 · Casting Agent", "Checking type conversions."),
    "feature_drop": ("3/9 · Feature Drop Agent", "Finding risky columns."),
    "missing_values": ("4/9 · Missing Values Agent", "Planning missing-value handling."),
    "datetime_features": ("5/9 · Datetime Agent", "Planning datetime features."),
    "encoding": ("6/9 · Encoding Agent", "Planning categorical encoding."),
    "scaling": ("7/9 · Scaling Agent", "Planning numeric scaling."),
    "plan_merger": ("8/9 · Plan Merger", "Merging agent decisions."),
    "plan_judge": ("9/9 · Plan Judge", "Reviewing the preprocessing plan."),
}

_SENTINEL = object()


def _read(value: Any, *keys: str) -> Any:
    for key in keys:
        if isinstance(value, dict) and key in value:
            return value[key]
        if hasattr(value, key):
            found = getattr(value, key)
            if found is not None:
                return found
    return None


@dataclass
class PreprocessingPipelineSession:
    graph: Any
    state: PreprocessingState

    def _detail(self, node_id: str) -> str | None:
        if node_id == "column_role" and self.state.column_role_decisions:
            count = len(self.state.column_role_decisions.get("decisions", []) or [])
            return f"Classified {count} column(s)."
        if node_id == "casting" and self.state.casting_decisions:
            count = len(self.state.casting_decisions.get("decisions", []) or [])
            return f"Recommended casting for {count} column(s)."
        if node_id == "feature_drop" and self.state.feature_drop_decisions:
            count = len(self.state.feature_drop_decisions.get("decisions", []) or [])
            return f"Recommended dropping {count} column(s)."
        if node_id == "missing_values" and self.state.missing_value_decisions:
            count = len(self.state.missing_value_decisions.get("decisions", []) or [])
            return f"Recommended missing-value handling for {count} column(s)."
        if node_id == "datetime_features" and self.state.datetime_decisions:
            count = len(self.state.datetime_decisions.get("decisions", []) or [])
            return f"Recommended datetime steps for {count} column operation(s)."
        if node_id == "encoding" and self.state.encoding_decisions:
            count = len(self.state.encoding_decisions.get("decisions", []) or [])
            return f"Recommended encoding for {count} column(s)."
        if node_id == "scaling" and self.state.scaling_decisions:
            count = len(self.state.scaling_decisions.get("decisions", []) or [])
            return f"Recommended scaling for {count} column(s)."
        if node_id == "plan_merger" and self.state.merged_plan:
            count = len(self.state.merged_plan.get("columns", []) or [])
            return f"Merged plan contains {count} column(s)."
        if node_id == "plan_judge":
            return {
                "approve": "The preprocessing plan was approved.",
                "revise": "The preprocessing plan needs another pass.",
                "reject": "The preprocessing plan was rejected.",
            }.get(self.state.judge_decision)
        return None

    async def iter_events_async(self) -> AsyncIterator[dict[str, Any]]:
        result = None
        stream_async = getattr(self.graph, "stream_async", None)

        yield {
            "kind": "status",
            "node": "graph",
            "phase": "start",
            "label": "Agentic preprocessing flow",
            "message": "Preparing the multi-agent graph.",
        }

        if callable(stream_async):
            async for event in stream_async("Generate the preprocessing plan."):
                node_id = _read(event, "node", "node_id")
                event_type = _read(event, "type")
                if node_id in STEPS and isinstance(event_type, str) and "node" in event_type:
                    phase = (
                        "start"
                        if event_type.endswith("_start")
                        else "stop"
                        if event_type.endswith("_stop")
                        else None
                    )
                    if phase:
                        label, message = STEPS[node_id]
                        payload = {
                            "kind": "status",
                            "node": node_id,
                            "phase": phase,
                            "label": label,
                            "message": message,
                        }
                        if phase == "stop":
                            detail = self._detail(node_id)
                            if detail:
                                payload["detail"] = detail
                        yield payload
                if (event_result := _read(event, "result")) is not None:
                    result = event_result
        else:
            invoke_async = getattr(self.graph, "invoke_async", None)
            result = await (
                invoke_async("Generate the preprocessing plan.")
                if callable(invoke_async)
                else asyncio.to_thread(self.graph, "Generate the preprocessing plan.")
            )

        yield {
            "kind": "status",
            "node": "graph",
            "phase": "stop",
            "label": "Agentic preprocessing flow",
            "message": "Multi-agent graph finished.",
        }

        if self.state.judge_decision == "reject":
            yield {
                "kind": "rejected",
                "message": self.state.judge_user_message or self.state.judge_reason,
            }
            return

        yield {
            "kind": "final",
            "plan": self.state.final_plan or self.state.merged_plan,
            "validation_result": self.state.validation_result,
            "raw_result": result,
        }

    def iter_events(self) -> Iterator[dict[str, Any]]:
        queue: Queue[Any] = Queue()

        async def produce() -> None:
            try:
                async for event in self.iter_events_async():
                    queue.put(event)
            except BaseException as exc:
                queue.put(exc)
            finally:
                queue.put(_SENTINEL)

        worker = Thread(target=lambda: asyncio.run(produce()), daemon=True)
        worker.start()

        while True:
            item = queue.get()
            if item is _SENTINEL:
                break
            if isinstance(item, BaseException):
                raise item
            yield item
