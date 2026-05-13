from __future__ import annotations

import json
from pathlib import Path

from app.domain.models import IncidentRecord, RunbookDocument
from app.repositories.base import IncidentRepository, RunbookRepository


class InMemoryIncidentRepository(IncidentRepository):
    def __init__(self) -> None:
        self._items: list[IncidentRecord] = []

    def save(self, incident: IncidentRecord) -> None:
        self._items.append(incident)

    @property
    def items(self) -> list[IncidentRecord]:
        return list(self._items)


class FixtureRunbookRepository(RunbookRepository):
    def __init__(self, fixture_path: str) -> None:
        self.fixture_path = Path(fixture_path)

    def list_all(self) -> list[RunbookDocument]:
        data = json.loads(self.fixture_path.read_text())
        return [RunbookDocument(**item) for item in data]

