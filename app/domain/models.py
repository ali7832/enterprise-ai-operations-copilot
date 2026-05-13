from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, UTC
from typing import Any


@dataclass(slots=True)
class IncidentRecord:
    incident_id: str
    title: str
    description: str
    service_name: str
    environment: str
    reporter: str
    severity: str
    impact_summary: str
    affected_regions: list[str]
    tags: list[str]
    dedupe_key: str
    created_at: str = field(default_factory=lambda: datetime.now(UTC).isoformat())


@dataclass(slots=True)
class RunbookDocument:
    runbook_id: str
    title: str
    service_name: str
    severity_levels: list[str]
    keywords: list[str]
    summary: str
    immediate_actions: list[str]
    escalation_targets: list[str]

@dataclass(slots=True)
class IncidentTimelineEvent:
    incident_id: str
    event_type: str
    message: str
    actor: str
    created_at: str = field(default_factory=lambda: datetime.now(UTC).isoformat())

@dataclass(slots=True)
class EnrichedIncidentContext:
    incident: IncidentRecord
    related_incidents: list[IncidentRecord]
    timeline: list[IncidentTimelineEvent]
    runbooks: list[RunbookDocument]
    metadata: dict[str, Any] = field(default_factory=dict)

@dataclass(slots=True)
class ServiceDependency:
    service_name: str
    dependency_type: str
    status: str
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class StakeholderUpdate:
    incident_id: str
    audience: str
    message: str
    created_at: str = field(default_factory=lambda: datetime.now(UTC).isoformat())


@dataclass(slots=True)
class EnrichedIncidentContext:
    incident: IncidentRecord
    related_incidents: list[IncidentRecord]
    timeline: list[IncidentTimelineEvent]
    runbooks: list[RunbookDocument]
    dependencies: list[ServiceDependency] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)
    
@dataclass(slots=True)
class WorkflowResult:
    incident_id: str
    severity: str
    incident_summary: str
    runbooks: list[RunbookDocument]
    action_plan: list[str]
    escalation_targets: list[str]
    leadership_update: str
    execution_metadata: dict[str, Any]

