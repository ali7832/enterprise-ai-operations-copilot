from __future__ import annotations

import unittest

from app.schemas import IncidentRequest
from app.services.intake import IncidentIntakeService


class IncidentIntakeServiceTests(unittest.TestCase):
    def test_sev1_inference_and_dedupe_key(self) -> None:
        request = IncidentRequest(
            title="Identity outage for all customers",
            description="Production down on login and token refresh.",
            service_name="identity-service",
            environment="production",
            reporter="maria",
            impact_summary="All customers are blocked from login.",
            tags=["identity", "outage", "identity"],
            affected_regions=["us-east-1"],
        )

        incident = IncidentIntakeService().normalize(request)

        self.assertEqual(incident.severity, "SEV1")
        self.assertEqual(incident.tags, ["identity", "outage"])
        self.assertEqual(len(incident.dedupe_key), 12)


if __name__ == "__main__":
    unittest.main()

