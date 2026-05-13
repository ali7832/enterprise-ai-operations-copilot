from __future__ import annotations

import json
from dataclasses import asdict, is_dataclass
from pathlib import Path
from typing import Any


class JsonlSink:
    def __init__(self, path: str) -> None:
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)

    def append(self, payload: Any) -> None:
        serializable = asdict(payload) if is_dataclass(payload) else payload
        with self.path.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(serializable) + "\n")


class CompositeSink:
    def __init__(self, *sinks: Any) -> None:
        self.sinks = [sink for sink in sinks if sink is not None]

    def append(self, payload: Any) -> None:
        for sink in self.sinks:
            sink.append(payload)
