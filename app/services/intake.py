from __future__ import annotations

from hashlib import sha1
from uuid import uuid4

from app.domain.models import IncidentRecord
from app.schemas import IncidentRequest


SEVERITY_RULES = (
    ("sev1", {"outage", "all customers", "security", "production down", "login blocked", "payment outage"}),
    ("sev2", {"degraded", "latency", "timeouts", "partial outage", "backlog"}),
)


class IncidentIntakeService:
    def normalize(self, request: IncidentRequest) -> IncidentRecord:
        severity = self._infer_severity(request)
        normalized_tags = sorted({tag.lower().strip() for tag in request.tags if tag.strip()})
        dedupe_source = f"{request.service_name}:{request.environment}:{request.title.lower().strip()}"
        dedupe_key = sha1(dedupe_source.encode("utf-8")).hexdigest()[:12]
        return IncidentRecord(
            incident_id=f"inc-{uuid4().hex[:12]}",
            title=request.title.strip(),
            description=request.description.strip(),
            service_name=request.service_name.strip(),
            environment=request.environment.strip(),
            reporter=request.reporter.strip(),
            severity=severity,
            impact_summary=request.impact_summary.strip(),
            affected_regions=[region.strip() for region in request.affected_regions if region.strip()],
            tags=normalized_tags,
            dedupe_key=dedupe_key,
        )

    def _infer_severity(self, request: IncidentRequest) -> str:
        haystack = f"{request.title} {request.description} {request.impact_summary}".lower()
        for severity, terms in SEVERITY_RULES:
            if any(term in haystack for term in terms):
                return severity.upper()
        return "SEV3"
