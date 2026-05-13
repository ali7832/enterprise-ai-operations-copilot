from app.domain.models import IncidentRecord, StakeholderUpdate


class StakeholderUpdateService:
    def build_update(self, incident: IncidentRecord, audience: str = "leadership") -> StakeholderUpdate:
        return StakeholderUpdate(
            incident_id=incident.incident_id,
            audience=audience,
            message=f"{incident.severity} incident on {incident.service_name}: {incident.impact_summary}",
        )