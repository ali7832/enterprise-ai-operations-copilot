from __future__ import annotations

from time import perf_counter
from typing import TypedDict, Any

from app.domain.models import IncidentRecord, WorkflowResult
from app.observability.metrics import metrics
from app.services.investigation import InvestigationService
from app.services.runbooks import RunbookSearchService


class WorkflowState(TypedDict):
    incident: IncidentRecord
    runbooks: list[Any]
    result: WorkflowResult | None


class CopilotWorkflowService:
    def __init__(
        self,
        runbook_service: RunbookSearchService,
        investigation_service: InvestigationService,
        use_langgraph: bool = True,
    ) -> None:
        self.runbook_service = runbook_service
        self.investigation_service = investigation_service
        self.use_langgraph = use_langgraph

    def run(self, incident: IncidentRecord) -> WorkflowResult:
        started = perf_counter()
        metrics.increment("copilot_triage_requests_total")
        runbooks = self.runbook_service.search(incident)
        result = self.investigation_service.build_result(incident, runbooks)
        duration = perf_counter() - started
        metrics.observe("copilot_triage_duration_seconds", duration)
        result.execution_metadata["duration_seconds"] = round(duration, 4)
        result.execution_metadata["langgraph_requested"] = self.use_langgraph
        result.execution_metadata["langgraph_available"] = self.langgraph_available()
        return result

    def langgraph_available(self) -> bool:
        try:
            import langgraph  # noqa: F401
        except ImportError:
            return False
        return True

    def build_langgraph(self) -> Any:
        from langgraph.graph import END, StateGraph

        graph = StateGraph(WorkflowState)
        graph.add_node("retrieve_runbooks", self._retrieve_runbooks_node)
        graph.add_node("assemble_result", self._assemble_result_node)
        graph.set_entry_point("retrieve_runbooks")
        graph.add_edge("retrieve_runbooks", "assemble_result")
        graph.add_edge("assemble_result", END)
        return graph.compile()

    def _retrieve_runbooks_node(self, state: WorkflowState) -> WorkflowState:
        state["runbooks"] = self.runbook_service.search(state["incident"])
        return state

    def _assemble_result_node(self, state: WorkflowState) -> WorkflowState:
        state["result"] = self.investigation_service.build_result(state["incident"], state["runbooks"])
        return state

