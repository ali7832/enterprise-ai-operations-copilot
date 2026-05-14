from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
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
    actor: str
    summary: str
    created_at: str = field(default_factory=lambda: datetime.now(UTC).isoformat())


@dataclass(slots=True)
class ServiceDependency:
    dependency_name: str
    dependency_type: str
    criticality: str


@dataclass(slots=True)
class EnrichedIncidentContext:
    incident: IncidentRecord
    severity_score: int
    affected_capability: str
    blast_radius: str
    likely_owners: list[str]
    dependencies: list[ServiceDependency] = field(default_factory=list)
    stakeholder_channels: list[str] = field(default_factory=list)


@dataclass(slots=True)
class StakeholderUpdate:
    audience: str
    title: str
    body: str
    delivery_channel: str


@dataclass(slots=True)
class AIReasoningOutput:
    incident_summary: str
    action_plan: list[str]
    escalation_targets: list[str]
    stakeholder_updates: list[StakeholderUpdate]
    provider: str
    confidence: float = 0.7


@dataclass(slots=True)
class WorkflowResult:
    incident_id: str
    severity: str
    incident_summary: str
    enriched_context: EnrichedIncidentContext
    runbooks: list[RunbookDocument]
    action_plan: list[str]
    escalation_targets: list[str]
    leadership_update: str
    stakeholder_updates: list[StakeholderUpdate]
    execution_metadata: dict[str, Any]
