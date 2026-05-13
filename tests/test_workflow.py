from __future__ import annotations

import unittest

from app.repositories.memory import FixtureRunbookRepository
from app.schemas import IncidentRequest
from app.services.intake import IncidentIntakeService
from app.services.investigation import InvestigationService
from app.services.runbooks import RunbookSearchService
from app.services.workflow import CopilotWorkflowService


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
            investigation_service=InvestigationService(),
            use_langgraph=True,
        )

        result = workflow.run(incident)

        self.assertEqual(result.severity, "SEV2")
        self.assertGreaterEqual(len(result.runbooks), 1)
        self.assertGreaterEqual(len(result.action_plan), 3)
        self.assertIn("payments-api", result.incident_summary)


if __name__ == "__main__":
    unittest.main()

