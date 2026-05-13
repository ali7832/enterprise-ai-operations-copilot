from __future__ import annotations

from pydantic import BaseModel, Field


class IncidentRequest(BaseModel):
    title: str
    description: str
    service_name: str
    environment: str = "production"
    reporter: str
    impact_summary: str
    affected_regions: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)


class IntakeResponse(BaseModel):
    incident_id: str
    severity: str
    dedupe_key: str
    normalized_tags: list[str]


class RunbookResponse(BaseModel):
    runbook_id: str
    title: str
    service_name: str
    summary: str
    immediate_actions: list[str]
    escalation_targets: list[str]


class DependencyResponse(BaseModel):
    dependency_name: str
    dependency_type: str
    criticality: str


class EnrichedContextResponse(BaseModel):
    severity_score: int
    affected_capability: str
    blast_radius: str
    likely_owners: list[str]
    stakeholder_channels: list[str]
    dependencies: list[DependencyResponse]


class StakeholderUpdateResponse(BaseModel):
    audience: str
    title: str
    body: str
    delivery_channel: str


class CopilotResponse(BaseModel):
    incident_id: str
    severity: str
    incident_summary: str
    enriched_context: EnrichedContextResponse
    runbooks: list[RunbookResponse]
    action_plan: list[str]
    escalation_targets: list[str]
    leadership_update: str
    stakeholder_updates: list[StakeholderUpdateResponse]
    execution_metadata: dict[str, str | int | float | bool]


class HealthResponse(BaseModel):
    status: str
    app_name: str
    environment: str
    langgraph_enabled: bool
    backend_summary: dict[str, str]


class IncidentRecordResponse(BaseModel):
    incident_id: str
    title: str
    service_name: str
    environment: str
    reporter: str
    severity: str
    impact_summary: str
    affected_regions: list[str]
    tags: list[str]
    dedupe_key: str
    created_at: str


class IncidentListResponse(BaseModel):
    items: list[IncidentRecordResponse]


class RunbookSearchResponse(BaseModel):
    items: list[RunbookResponse]


class TimelineEventResponse(BaseModel):
    incident_id: str
    event_type: str
    actor: str
    summary: str
    created_at: str


class IncidentTimelineResponse(BaseModel):
    items: list[TimelineEventResponse]
