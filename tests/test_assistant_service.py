from __future__ import annotations

import unittest

from app.core.config import Settings
from app.services.assistant import CopilotAssistantService


class CopilotAssistantServiceTests(unittest.TestCase):
    def test_fallback_reply_uses_incident_context(self) -> None:
        service = CopilotAssistantService(Settings())

        reply = service.respond(
            messages=[{"role": "user", "content": "What should I tell leadership?"}],
            incident_context={"title": "Payments API latency spike"},
            triage_context={
                "severity": "SEV2",
                "likely_owners": ["Payments Platform", "Release Operations"],
                "action_plan": ["Freeze rollout", "Check auth-gateway saturation"],
                "leadership_update": "Mitigation is active and the next checkpoint is in fifteen minutes.",
            },
            provider_label="Demo",
            api_base_url="",
            api_key="",
            model="",
            system_prompt="",
            temperature=0.2,
            max_tokens=400,
        )

        self.assertFalse(reply.used_live_model)
        self.assertIn("Payments API latency spike", reply.answer)
        self.assertIn("Freeze rollout", reply.answer)
        self.assertEqual(reply.provider, "Demo")


if __name__ == "__main__":
    unittest.main()
