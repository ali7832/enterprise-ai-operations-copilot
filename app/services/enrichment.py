from __future__ import annotations

from app.domain.models import EnrichedIncidentContext, IncidentRecord, ServiceDependency


class IncidentEnrichmentService:
    def enrich(self, incident: IncidentRecord) -> EnrichedIncidentContext:
        service = incident.service_name.lower()
        severity_score = self._severity_score(incident.severity)
        return EnrichedIncidentContext(
            incident=incident,
            severity_score=severity_score,
            affected_capability=self._capability_name(service),
            blast_radius=self._blast_radius(incident, severity_score),
            likely_owners=self._likely_owners(service, incident.severity),
            dependencies=self._dependencies(service),
            stakeholder_channels=self._channels(incident.severity),
        )

    def _severity_score(self, severity: str) -> int:
        return {"SEV1": 95, "SEV2": 75, "SEV3": 45, "SEV4": 20}.get(severity.upper(), 40)

    def _capability_name(self, service: str) -> str:
        if "payment" in service or "checkout" in service:
            return "Checkout and payment processing"
        if "identity" in service or "auth" in service or "login" in service:
            return "Authentication and customer access"
        if "search" in service or "inventory" in service:
            return "Catalog discovery and inventory search"
        if "order" in service:
            return "Order lifecycle and downstream fulfillment"
        return "Core enterprise service operations"

    def _blast_radius(self, incident: IncidentRecord, severity_score: int) -> str:
        regions = ", ".join(incident.affected_regions) or "active production regions"
        if severity_score >= 90:
            return f"Critical customer-facing impact across {regions}. Executive visibility required."
        if severity_score >= 70:
            return f"Material production impact in {regions}; rapid containment and support alignment required."
        return f"Limited or emerging impact in {regions}; monitor closely and contain before escalation."

    def _likely_owners(self, service: str, severity: str) -> list[str]:
        owners = ["Incident Commander", "SRE On-Call"]
        if "payment" in service or "checkout" in service:
            owners.extend(["Payments Service Owner", "Database On-Call"])
        elif "identity" in service or "auth" in service:
            owners.extend(["Identity On-Call", "Security Platform Owner"])
        elif "search" in service or "inventory" in service:
            owners.extend(["Search Platform Owner", "Catalog Data Pipeline Owner"])
        elif "order" in service:
            owners.extend(["Order Platform Lead", "Partner Integrations Owner"])
        else:
            owners.append("Platform Owner")
        if severity.upper() == "SEV1":
            owners.append("Customer Communications Lead")
        return list(dict.fromkeys(owners))

    def _dependencies(self, service: str) -> list[ServiceDependency]:
        if "payment" in service or "checkout" in service:
            return [
                ServiceDependency("payment-gateway", "external API", "critical"),
                ServiceDependency("orders-db", "database", "critical"),
                ServiceDependency("fraud-scoring", "internal ML service", "medium"),
            ]
        if "identity" in service or "auth" in service:
            return [
                ServiceDependency("token-service", "internal API", "critical"),
                ServiceDependency("session-store", "cache", "critical"),
            ]
        if "search" in service or "inventory" in service:
            return [
                ServiceDependency("opensearch-cluster", "search index", "critical"),
                ServiceDependency("catalog-ingestion", "data pipeline", "medium"),
            ]
        return [
            ServiceDependency("observability-stack", "monitoring", "medium"),
            ServiceDependency("deployment-system", "release pipeline", "medium"),
        ]

    def _channels(self, severity: str) -> list[str]:
        channels = ["#incident-command", "#customer-support"]
        if severity.upper() in {"SEV1", "SEV2"}:
            channels.append("#exec-updates")
        return channels
