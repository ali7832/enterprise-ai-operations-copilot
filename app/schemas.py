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


class CopilotResponse(BaseModel):
    incident_id: str
    severity: str
    incident_summary: str
    runbooks: list[RunbookResponse]
    action_plan: list[str]
    escalation_targets: list[str]
    leadership_update: str
    execution_metadata: dict[str, str | int | float | bool]


class HealthResponse(BaseModel):
    status: str
    app_name: str
    environment: str
    langgraph_enabled: bool

