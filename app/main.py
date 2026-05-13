from __future__ import annotations

from app.api.routes import build_router
from app.core.config import Settings
from app.integrations.opensearch_store import OpenSearchRunbookStore
from app.integrations.postgres_store import (
    PostgresIncidentRepository,
    PostgresTimelineRepository,
    PostgresWorkflowRunStore,
)
from app.integrations.redis_cache import RedisWorkflowCache
from app.repositories.base import IncidentRepository, RunbookRepository, TimelineRepository, WorkflowRunSink
from app.repositories.jsonl import CompositeSink, JsonlSink
from app.repositories.memory import FixtureRunbookRepository, InMemoryIncidentRepository, InMemoryTimelineRepository
from app.services.enrichment import IncidentEnrichmentService
from app.services.intake import IncidentIntakeService
from app.services.investigation import InvestigationService
from app.services.runbooks import RunbookSearchService
from app.services.stakeholder import StakeholderUpdateService
from app.services.workflow import CopilotWorkflowService


def _build_incident_repository(settings: Settings) -> IncidentRepository:
    if settings.use_postgres_persistence:
        return PostgresIncidentRepository(settings.postgres_dsn)
    return InMemoryIncidentRepository()


def _build_timeline_repository(settings: Settings) -> TimelineRepository:
    if settings.use_postgres_persistence:
        return PostgresTimelineRepository(settings.postgres_dsn)
    return InMemoryTimelineRepository()


def _build_runbook_repository(settings: Settings) -> RunbookRepository:
    if settings.use_opensearch_runbooks:
        return OpenSearchRunbookStore(
            url=settings.opensearch_url,
            index_name=settings.opensearch_runbook_index,
            fixture_path=settings.runbook_fixture_path,
        )
    return FixtureRunbookRepository(settings.runbook_fixture_path)


def _build_workflow_sink(settings: Settings) -> WorkflowRunSink:
    jsonl_sink = JsonlSink(settings.workflow_runs_path)
    if settings.use_postgres_persistence:
        return CompositeSink(jsonl_sink, PostgresWorkflowRunStore(settings.postgres_dsn))
    return jsonl_sink


def create_app() -> object:
    from fastapi import FastAPI

    settings = Settings.from_env()
    incident_repository = _build_incident_repository(settings)
    timeline_repository = _build_timeline_repository(settings)
    runbook_repository = _build_runbook_repository(settings)
    intake_service = IncidentIntakeService()
    enrichment_service = IncidentEnrichmentService()
    investigation_service = InvestigationService()
    stakeholder_update_service = StakeholderUpdateService()
    runbook_service = RunbookSearchService(runbook_repository, settings.max_runbook_results)
    workflow_cache = RedisWorkflowCache(settings.redis_url) if settings.use_redis_cache else None
    workflow_service = CopilotWorkflowService(
        runbook_service=runbook_service,
        enrichment_service=enrichment_service,
        investigation_service=investigation_service,
        stakeholder_update_service=stakeholder_update_service,
        timeline_repository=timeline_repository,
        use_langgraph=settings.use_langgraph,
        workflow_sink=_build_workflow_sink(settings),
        workflow_cache=workflow_cache,
        workflow_cache_ttl_seconds=settings.workflow_cache_ttl_seconds,
    )

    app = FastAPI(title=settings.app_name)
    app.include_router(
        build_router(
            intake_service=intake_service,
            workflow_service=workflow_service,
            incident_repository=incident_repository,
            timeline_repository=timeline_repository,
            runbook_repository=runbook_repository,
            app_name=settings.app_name,
            app_env=settings.app_env,
            backend_summary={
                "storage": settings.storage_backend,
                "runbooks": settings.runbook_backend,
                "cache": settings.cache_backend,
            },
        )
    )
    return app


def main() -> None:
    import uvicorn

    settings = Settings.from_env()
    uvicorn.run("app.main:create_app", factory=True, host="0.0.0.0", port=settings.app_port, reload=False)


if __name__ == "__main__":
    main()
