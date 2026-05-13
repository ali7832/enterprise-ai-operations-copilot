from __future__ import annotations

from app.api.routes import build_router
from app.core.config import Settings
from app.repositories.memory import FixtureRunbookRepository, InMemoryIncidentRepository
from app.services.intake import IncidentIntakeService
from app.services.investigation import InvestigationService
from app.services.runbooks import RunbookSearchService
from app.services.workflow import CopilotWorkflowService


def create_app() -> object:
    from fastapi import FastAPI

    settings = Settings.from_env()
    incident_repository = InMemoryIncidentRepository()
    runbook_repository = FixtureRunbookRepository(settings.runbook_fixture_path)
    intake_service = IncidentIntakeService()
    investigation_service = InvestigationService()
    runbook_service = RunbookSearchService(runbook_repository, settings.max_runbook_results)
    workflow_service = CopilotWorkflowService(
        runbook_service=runbook_service,
        investigation_service=investigation_service,
        use_langgraph=settings.use_langgraph,
    )

    app = FastAPI(title=settings.app_name)
    app.include_router(
        build_router(
            intake_service=intake_service,
            workflow_service=workflow_service,
            incident_repository=incident_repository,
            app_name=settings.app_name,
            app_env=settings.app_env,
        )
    )
    return app


def main() -> None:
    import uvicorn

    settings = Settings.from_env()
    uvicorn.run("app.main:create_app", factory=True, host="0.0.0.0", port=settings.app_port, reload=False)


if __name__ == "__main__":
    main()

