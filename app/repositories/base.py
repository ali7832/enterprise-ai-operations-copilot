from __future__ import annotations

from typing import Protocol

from app.domain.models import IncidentRecord, RunbookDocument


class IncidentRepository(Protocol):
    def save(self, incident: IncidentRecord) -> None:
        ...


class RunbookRepository(Protocol):
    def list_all(self) -> list[RunbookDocument]:
        ...

