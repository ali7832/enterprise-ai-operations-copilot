from __future__ import annotations

import unittest

from app.repositories.memory import FixtureRunbookRepository
from app.schemas import IncidentRequest
from app.repositories.memory import InMemoryTimelineRepository
from app.services.intake import IncidentIntakeService
from app.services.enrichment import IncidentEnrichmentService
from app.services.investigation import InvestigationService
from app.services.runbooks import RunbookSearchService
from app.services.stakeholder import StakeholderUpdateService
from app.services.workflow import CopilotWorkflowService


class FakeWorkflowCache:
    def __init__(self) -> None:
        self.payloads: dict[str, dict] = {}

    def get_json(self, key: str) -> dict | None:
        return self.payloads.get(key)

    def set_json(self, key: str, payload: dict, ttl_seconds: int = 900) -> None:
        self.payloads[key] = payload


class CopilotWorkflowServiceTests(unittest.TestCase):
    def test_triage_returns_runbooks_and_action_plan(self) -> None:
        intake = IncidentIntakeService()
        incident = intake.normalize(
            IncidentRequest(
                title="Payments API latency causing checkout timeouts",
                description="Enterprise checkout requests are timing out.",
                service_name="payments-api",
                environment="production",
                reporter="nora",
                impact_summary="Payments are degraded for major accounts.",
                affected_regions=["us-east-1"],
                tags=["payments", "latency"],
            )
        )

        workflow = CopilotWorkflowService(
            runbook_service=RunbookSearchService(FixtureRunbookRepository("fixtures/runbooks.json")),
            enrichment_service=IncidentEnrichmentService(),
            investigation_service=InvestigationService(),
            stakeholder_update_service=StakeholderUpdateService(),
            timeline_repository=InMemoryTimelineRepository(),
            use_langgraph=True,
        )

        result = workflow.run(incident)

        self.assertEqual(result.severity, "SEV2")
        self.assertGreaterEqual(len(result.runbooks), 1)
        self.assertGreaterEqual(len(result.action_plan), 3)
        self.assertIn("payments-api", result.incident_summary)
        self.assertEqual(result.enriched_context.blast_radius, "single-region")
        self.assertGreaterEqual(len(result.stakeholder_updates), 2)

    def test_triage_uses_cache_on_repeat_dedupe_key(self) -> None:
        intake = IncidentIntakeService()
        request = IncidentRequest(
            title="Payments API latency causing checkout timeouts",
            description="Enterprise checkout requests are timing out.",
            service_name="payments-api",
            environment="production",
            reporter="nora",
            impact_summary="Payments are degraded for major accounts.",
            affected_regions=["us-east-1"],
            tags=["payments", "latency"],
        )
        first_incident = intake.normalize(request)
        second_incident = intake.normalize(request)
        cache = FakeWorkflowCache()

        workflow = CopilotWorkflowService(
            runbook_service=RunbookSearchService(FixtureRunbookRepository("fixtures/runbooks.json")),
            enrichment_service=IncidentEnrichmentService(),
            investigation_service=InvestigationService(),
            stakeholder_update_service=StakeholderUpdateService(),
            timeline_repository=InMemoryTimelineRepository(),
            workflow_cache=cache,
            use_langgraph=True,
        )

        first_result = workflow.run(first_incident)
        second_result = workflow.run(second_incident)

        self.assertFalse(first_result.execution_metadata["cache_hit"])
        self.assertTrue(second_result.execution_metadata["cache_hit"])
        self.assertEqual(second_result.incident_id, second_incident.incident_id)
        self.assertEqual(second_result.action_plan, first_result.action_plan)


if __name__ == "__main__":
    unittest.main()
