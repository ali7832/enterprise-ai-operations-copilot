from __future__ import annotations

from app.domain.models import IncidentRecord, RunbookDocument
from app.repositories.base import RunbookRepository


class RunbookSearchService:
    def __init__(self, repository: RunbookRepository, max_results: int = 3) -> None:
        self.repository = repository
        self.max_results = max_results

    def search(self, incident: IncidentRecord) -> list[RunbookDocument]:
        search_repository = getattr(self.repository, "search", None)
        if callable(search_repository):
            return search_repository(incident, self.max_results)
        incident_terms = self._extract_terms(incident)
        scored: list[tuple[int, RunbookDocument]] = []
        for runbook in self.repository.list_all():
            score = len(incident_terms & self._runbook_terms(runbook))
            if incident.severity in runbook.severity_levels:
                score += 2
            if incident.service_name.lower() == runbook.service_name.lower():
                score += 3
            scored.append((score, runbook))
        ranked = [item for score, item in sorted(scored, key=lambda pair: pair[0], reverse=True) if score > 0]
        return ranked[: self.max_results]

    def _extract_terms(self, incident: IncidentRecord) -> set[str]:
        raw = " ".join(
            [
                incident.title,
                incident.description,
                incident.service_name,
                incident.impact_summary,
                " ".join(incident.tags),
            ]
        ).lower()
        return {token.strip(".,:;!?") for token in raw.split() if token}

    def _runbook_terms(self, runbook: RunbookDocument) -> set[str]:
        raw = " ".join([runbook.title, runbook.service_name, runbook.summary, " ".join(runbook.keywords)]).lower()
        return {token.strip(".,:;!?") for token in raw.split() if token}
