from __future__ import annotations

from collections import defaultdict
from threading import Lock


class MetricsRegistry:
    def __init__(self) -> None:
        self._counters: dict[str, float] = defaultdict(float)
        self._latency_sum: dict[str, float] = defaultdict(float)
        self._latency_count: dict[str, float] = defaultdict(float)
        self._lock = Lock()

    def increment(self, name: str, value: float = 1.0) -> None:
        with self._lock:
            self._counters[name] += value

    def observe(self, name: str, value: float) -> None:
        with self._lock:
            self._latency_sum[f"{name}_sum"] += value
            self._latency_count[f"{name}_count"] += 1

    def render(self) -> str:
        lines: list[str] = []
        with self._lock:
            for name, value in sorted(self._counters.items()):
                lines.append(f"# TYPE {name} counter")
                lines.append(f"{name} {value}")
            for name, value in sorted(self._latency_sum.items()):
                base = name.removesuffix("_sum")
                count_value = self._latency_count[f"{base}_count"]
                lines.append(f"# TYPE {base} summary")
                lines.append(f"{base}_sum {value}")
                lines.append(f"{base}_count {count_value}")
        return "\n".join(lines) + "\n"


metrics = MetricsRegistry()

