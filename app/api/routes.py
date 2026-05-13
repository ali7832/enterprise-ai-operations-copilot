from __future__ import annotations

from app.observability.metrics import metrics
from app.schemas import CopilotResponse, HealthResponse, IncidentRequest, IntakeResponse, RunbookResponse
from app.services.intake import IncidentIntakeService
from app.services.workflow import CopilotWorkflowService
from app.repositories.memory import InMemoryIncidentRepository


def build_router(
    intake_service: IncidentIntakeService,
    workflow_service: CopilotWorkflowService,
    incident_repository: InMemoryIncidentRepository,
    app_name: str,
    app_env: str,
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
        return CopilotResponse(
            incident_id=result.incident_id,
            severity=result.severity,
            incident_summary=result.incident_summary,
            runbooks=runbooks,
            action_plan=result.action_plan,
            escalation_targets=result.escalation_targets,
            leadership_update=result.leadership_update,
            execution_metadata={k: str(v) for k, v in result.execution_metadata.items()},
        )

    return router

