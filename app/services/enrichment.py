from app.domain.models import EnrichedIncidentContext, IncidentRecord


class IncidentEnrichmentService:
    def enrich(self, incident: IncidentRecord) -> EnrichedIncidentContext:
        return EnrichedIncidentContext(
            incident=incident,
            related_incidents=[],
            timeline=[],
            runbooks=[],
            dependencies=[],
            metadata={},
        )