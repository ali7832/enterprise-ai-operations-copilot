from __future__ import annotations

from typing import Any, Protocol

from app.domain.models import IncidentRecord, IncidentTimelineEvent, RunbookDocument


class IncidentRepository(Protocol):
    def save(self, incident: IncidentRecord) -> None:
        ...

    def list_all(self) -> list[IncidentRecord]:
        ...

    def get(self, incident_id: str) -> IncidentRecord | None:
        ...


class RunbookRepository(Protocol):
    def list_all(self) -> list[RunbookDocument]:
        ...


class SearchableRunbookRepository(RunbookRepository, Protocol):
    def search(self, incident: IncidentRecord, max_results: int) -> list[RunbookDocument]:
        ...


class TimelineRepository(Protocol):
    def append(self, event: IncidentTimelineEvent) -> None:
        ...

    def list_for_incident(self, incident_id: str) -> list[IncidentTimelineEvent]:
        ...


class WorkflowRunSink(Protocol):
    def append(self, payload: dict[str, Any]) -> None:
        ...
