
from app.domain.models import IncidentTimelineEvent


class InMemoryTimelineRepository:
    def __init__(self):
        self.events = []

    def append(self, event: IncidentTimelineEvent):
        self.events.append(event)
        return event

    def list_for_incident(self, incident_id: str):
        return [event for event in self.events if event.incident_id == incident_id]

from app.domain.models import RunbookDocument


class FixtureRunbookRepository:
    def __init__(self, fixture_path: str | None = None):
        self.fixture_path = fixture_path
        self.runbooks = [
            RunbookDocument(
                runbook_id="rb-001",
                title="High Severity Incident Response",
                service_name="enterprise-ai-platform",
                severity_levels=["sev1", "sev2", "critical", "high"],
                keywords=["incident", "latency", "outage", "api", "platform"],
                summary="Standard runbook for enterprise AI operations incidents.",
                immediate_actions=[
                    "Confirm incident severity",
                    "Check service health",
                    "Review recent deployments",
                    "Notify stakeholders",
                ],
                escalation_targets=["SRE Lead", "Platform Owner", "Incident Commander"],
            )
        ]

    def list(self):
        return self.runbooks

    def search(self, incident):
        return self.runbooks

    def get(self, runbook_id: str):
        for runbook in self.runbooks:
            if runbook.runbook_id == runbook_id:
                return runbook
        return None

from app.domain.models import RunbookDocument


class FixtureRunbookRepository:
    def __init__(self, fixture_path: str | None = None):
        self.fixture_path = fixture_path
        self.runbooks = [
            RunbookDocument(
                runbook_id="rb-001",
                title="High Severity Incident Response",
                service_name="enterprise-ai-platform",
                severity_levels=["sev1", "sev2", "critical", "high"],
                keywords=["incident", "latency", "outage", "api", "platform"],
                summary="Standard runbook for enterprise AI operations incidents.",
                immediate_actions=[
                    "Confirm incident severity",
                    "Check service health",
                    "Review recent deployments",
                    "Notify stakeholders",
                ],
                escalation_targets=["SRE Lead", "Platform Owner", "Incident Commander"],
            )
        ]

    def list(self):
        return self.runbooks

    def search(self, incident):
        return self.runbooks

    def get(self, runbook_id: str):
        for runbook in self.runbooks:
            if runbook.runbook_id == runbook_id:
                return runbook
        return None

from app.domain.models import IncidentRecord


class InMemoryIncidentRepository:
    def __init__(self):
        self.incidents = {}

    def save(self, incident: IncidentRecord):
        self.incidents[incident.incident_id] = incident
        return incident

    def get(self, incident_id: str):
        return self.incidents.get(incident_id)

    def list(self):
        return list(self.incidents.values())

    def find_by_dedupe_key(self, dedupe_key: str):
        for incident in self.incidents.values():
            if incident.dedupe_key == dedupe_key:
                return incident
        return None
