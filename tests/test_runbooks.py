from __future__ import annotations

import unittest

from app.domain.models import IncidentRecord, RunbookDocument
from app.repositories.base import RunbookRepository
from app.schemas import IncidentRequest
from app.services.intake import IncidentIntakeService
from app.services.runbooks import RunbookSearchService


class SearchableRepository(RunbookRepository):
    def __init__(self) -> None:
        self.calls: list[tuple[str, int]] = []

    def list_all(self) -> list[RunbookDocument]:
        return []

    def search(self, incident: IncidentRecord, max_results: int) -> list[RunbookDocument]:
        self.calls.append((incident.incident_id, max_results))
        return [
            RunbookDocument(
                runbook_id="rb-123",
                title="Payments timeout triage",
                service_name=incident.service_name,
                severity_levels=[incident.severity],
                keywords=["payments", "timeouts"],
                summary="Triage payment timeout incidents.",
                immediate_actions=["Validate upstream gateway health."],
                escalation_targets=["payments-oncall"],
            )
        ]


class RunbookSearchServiceTests(unittest.TestCase):
    def test_repository_search_is_used_when_available(self) -> None:
        repository = SearchableRepository()
        incident = IncidentIntakeService().normalize(
            IncidentRequest(
                title="Payments timeout",
                description="Checkout is timing out.",
                service_name="payments-api",
                environment="production",
                reporter="nora",
                impact_summary="Checkout is degraded.",
                affected_regions=["us-east-1"],
                tags=["payments", "timeouts"],
            )
        )

        results = RunbookSearchService(repository, max_results=2).search(incident)

        self.assertEqual(len(results), 1)
        self.assertEqual(repository.calls, [(incident.incident_id, 2)])


if __name__ == "__main__":
    unittest.main()
