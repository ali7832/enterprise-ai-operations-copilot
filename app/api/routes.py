from __future__ import annotations

from app.observability.metrics import metrics
from app.repositories.base import IncidentRepository, RunbookRepository, TimelineRepository
from app.schemas import (
    AssistantRequest,
    AssistantResponse,
    CopilotResponse,
    DependencyResponse,
    EnrichedContextResponse,
    HealthResponse,
    IncidentListResponse,
    IncidentRecordResponse,
    IncidentRequest,
    IncidentTimelineResponse,
    IntakeResponse,
    RunbookResponse,
    RunbookSearchResponse,
    StakeholderUpdateResponse,
    TimelineEventResponse,
)
from app.services.assistant import CopilotAssistantService
from app.services.intake import IncidentIntakeService
from app.services.workflow import CopilotWorkflowService


def build_router(
    intake_service: IncidentIntakeService,
    workflow_service: CopilotWorkflowService,
    assistant_service: CopilotAssistantService,
    incident_repository: IncidentRepository,
    timeline_repository: TimelineRepository,
    runbook_repository: RunbookRepository,
    app_name: str,
    app_env: str,
    backend_summary: dict[str, str],
) -> object:
    from fastapi import APIRouter
    from fastapi.responses import PlainTextResponse

    router = APIRouter()

    @router.get("/health", response_model=HealthResponse)
    def health() -> HealthResponse:
        return HealthResponse(
            status="ok",
            app_name=app_name,
            environment=app_env,
            langgraph_enabled=workflow_service.use_langgraph,
            backend_summary=backend_summary,
        )

    @router.get("/metrics", response_class=PlainTextResponse)
    def metrics_endpoint() -> str:
        return metrics.render()

    @router.post("/api/v1/incidents/intake", response_model=IntakeResponse)
    def intake_incident(request: IncidentRequest) -> IntakeResponse:
        incident = intake_service.normalize(request)
        incident_repository.save(incident)
        metrics.increment("incident_intake_requests_total")
        return IntakeResponse(
            incident_id=incident.incident_id,
            severity=incident.severity,
            dedupe_key=incident.dedupe_key,
            normalized_tags=incident.tags,
        )

    @router.post("/api/v1/copilot/triage", response_model=CopilotResponse)
    def triage_incident(request: IncidentRequest) -> CopilotResponse:
        incident = intake_service.normalize(request)
        incident_repository.save(incident)
        result = workflow_service.run(incident)
        runbooks = [
            RunbookResponse(
                runbook_id=runbook.runbook_id,
                title=runbook.title,
                service_name=runbook.service_name,
                summary=runbook.summary,
                immediate_actions=runbook.immediate_actions,
                escalation_targets=runbook.escalation_targets,
            )
            for runbook in result.runbooks
        ]
        enriched_context = EnrichedContextResponse(
            severity_score=result.enriched_context.severity_score,
            affected_capability=result.enriched_context.affected_capability,
            blast_radius=result.enriched_context.blast_radius,
            likely_owners=result.enriched_context.likely_owners,
            stakeholder_channels=result.enriched_context.stakeholder_channels,
            dependencies=[
                DependencyResponse(
                    dependency_name=dependency.dependency_name,
                    dependency_type=dependency.dependency_type,
                    criticality=dependency.criticality,
                )
                for dependency in result.enriched_context.dependencies
            ],
        )
        return CopilotResponse(
            incident_id=result.incident_id,
            severity=result.severity,
            incident_summary=result.incident_summary,
            enriched_context=enriched_context,
            runbooks=runbooks,
            action_plan=result.action_plan,
            escalation_targets=result.escalation_targets,
            leadership_update=result.leadership_update,
            stakeholder_updates=[
                StakeholderUpdateResponse(
                    audience=update.audience,
                    title=update.title,
                    body=update.body,
                    delivery_channel=update.delivery_channel,
                )
                for update in result.stakeholder_updates
            ],
            execution_metadata={k: str(v) for k, v in result.execution_metadata.items()},
        )

    @router.post("/api/v1/copilot/assistant", response_model=AssistantResponse)
    def assist_operator(request: AssistantRequest) -> AssistantResponse:
        reply = assistant_service.respond(
            messages=[message.model_dump() for message in request.messages],
            incident_context=request.incident_context,
            triage_context=request.triage_context,
            provider_label=request.provider_label,
            api_base_url=request.api_base_url,
            api_key=request.api_key,
            model=request.model,
            system_prompt=request.system_prompt,
            temperature=request.temperature,
            max_tokens=request.max_tokens,
        )
        metrics.increment("copilot_assistant_requests_total")
        return AssistantResponse(
            answer=reply.answer,
            provider=reply.provider,
            model=reply.model,
            used_live_model=reply.used_live_model,
            request_id=reply.request_id,
            warning=reply.warning,
        )

    @router.get("/api/v1/incidents", response_model=IncidentListResponse)
    def list_incidents() -> IncidentListResponse:
        return IncidentListResponse(
            items=[
                IncidentRecordResponse(
                    incident_id=item.incident_id,
                    title=item.title,
                    service_name=item.service_name,
                    environment=item.environment,
                    reporter=item.reporter,
                    severity=item.severity,
                    impact_summary=item.impact_summary,
                    affected_regions=item.affected_regions,
                    tags=item.tags,
                    dedupe_key=item.dedupe_key,
                    created_at=item.created_at,
                )
                for item in incident_repository.list_all()
            ]
        )

    @router.get("/api/v1/incidents/{incident_id}", response_model=IncidentRecordResponse)
    def get_incident(incident_id: str) -> IncidentRecordResponse:
        from fastapi import HTTPException

        item = incident_repository.get(incident_id)
        if item is None:
            raise HTTPException(status_code=404, detail="Incident not found")
        return IncidentRecordResponse(
            incident_id=item.incident_id,
            title=item.title,
            service_name=item.service_name,
            environment=item.environment,
            reporter=item.reporter,
            severity=item.severity,
            impact_summary=item.impact_summary,
            affected_regions=item.affected_regions,
            tags=item.tags,
            dedupe_key=item.dedupe_key,
            created_at=item.created_at,
        )

    @router.get("/api/v1/incidents/{incident_id}/timeline", response_model=IncidentTimelineResponse)
    def get_incident_timeline(incident_id: str) -> IncidentTimelineResponse:
        return IncidentTimelineResponse(
            items=[
                TimelineEventResponse(
                    incident_id=item.incident_id,
                    event_type=item.event_type,
                    actor=item.actor,
                    summary=item.summary,
                    created_at=item.created_at,
                )
                for item in timeline_repository.list_for_incident(incident_id)
            ]
        )

    @router.get("/api/v1/runbooks/search", response_model=RunbookSearchResponse)
    def search_runbooks(service_name: str = "", severity: str = "") -> RunbookSearchResponse:
        items = []
        for runbook in runbook_repository.list_all():
            service_match = not service_name or runbook.service_name.lower() == service_name.lower()
            severity_match = not severity or severity.upper() in runbook.severity_levels
            if service_match and severity_match:
                items.append(
                    RunbookResponse(
                        runbook_id=runbook.runbook_id,
                        title=runbook.title,
                        service_name=runbook.service_name,
                        summary=runbook.summary,
                        immediate_actions=runbook.immediate_actions,
                        escalation_targets=runbook.escalation_targets,
                    )
                )
        return RunbookSearchResponse(items=items)

    return router
