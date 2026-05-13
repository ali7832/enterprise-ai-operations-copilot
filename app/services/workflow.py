from __future__ import annotations

from dataclasses import asdict
from time import perf_counter
from typing import TypedDict, Any

from app.domain.models import (
    EnrichedIncidentContext,
    IncidentRecord,
    IncidentTimelineEvent,
    RunbookDocument,
    ServiceDependency,
    StakeholderUpdate,
    WorkflowResult,
)
from app.observability.metrics import metrics
from app.repositories.base import TimelineRepository, WorkflowRunSink
from app.services.enrichment import IncidentEnrichmentService
from app.services.investigation import InvestigationService
from app.services.runbooks import RunbookSearchService
from app.services.stakeholder import StakeholderUpdateService


class WorkflowState(TypedDict):
    incident: IncidentRecord
    context: EnrichedIncidentContext | None
    runbooks: list[Any]
    stakeholder_updates: list[Any]
    result: WorkflowResult | None


class CopilotWorkflowService:
    def __init__(
        self,
        runbook_service: RunbookSearchService,
        enrichment_service: IncidentEnrichmentService,
        investigation_service: InvestigationService,
        stakeholder_update_service: StakeholderUpdateService,
        timeline_repository: TimelineRepository,
        use_langgraph: bool = True,
        workflow_sink: WorkflowRunSink | None = None,
        workflow_cache: Any | None = None,
        workflow_cache_ttl_seconds: int = 900,
    ) -> None:
        self.runbook_service = runbook_service
        self.enrichment_service = enrichment_service
        self.investigation_service = investigation_service
        self.stakeholder_update_service = stakeholder_update_service
        self.timeline_repository = timeline_repository
        self.use_langgraph = use_langgraph
        self.workflow_sink = workflow_sink
        self.workflow_cache = workflow_cache
        self.workflow_cache_ttl_seconds = workflow_cache_ttl_seconds

    def run(self, incident: IncidentRecord) -> WorkflowResult:
        started = perf_counter()
        metrics.increment("copilot_triage_requests_total")
        self._append_timeline(incident, "workflow_started", "copilot", "Incident triage workflow started.")
        cached_result = self._load_cached_result(incident)
        if cached_result is not None:
            duration = perf_counter() - started
            metrics.increment("copilot_triage_cache_hits_total")
            metrics.observe("copilot_triage_duration_seconds", duration)
            cached_result.execution_metadata["duration_seconds"] = round(duration, 4)
            self._append_timeline(
                incident,
                "workflow_cache_hit",
                "copilot",
                f"Cached triage result reused for dedupe key {incident.dedupe_key}.",
            )
            self._append_timeline(
                incident,
                "workflow_completed",
                "copilot",
                f"Workflow completed from cache in {round(duration, 4)} seconds.",
            )
            self._persist_run(cached_result)
            return cached_result

        metrics.increment("copilot_triage_cache_misses_total")
        context = self.enrichment_service.enrich(incident)
        self._append_timeline(
            incident,
            "context_enriched",
            "copilot",
            f"Incident context enriched with blast radius {context.blast_radius}.",
        )
        runbooks = self.runbook_service.search(incident)
        self._append_timeline(
            incident,
            "runbooks_retrieved",
            "copilot",
            f"Retrieved {len(runbooks)} runbooks for {incident.service_name}.",
        )
        stakeholder_updates = self.stakeholder_update_service.build_updates(
            context=context,
            action_plan=self._draft_action_plan(context, runbooks),
            escalation_targets=self._draft_escalation_targets(runbooks),
        )
        result = self.investigation_service.build_result(context, runbooks, stakeholder_updates)
        duration = perf_counter() - started
        metrics.observe("copilot_triage_duration_seconds", duration)
        result.execution_metadata["duration_seconds"] = round(duration, 4)
        result.execution_metadata["langgraph_requested"] = self.use_langgraph
        result.execution_metadata["langgraph_available"] = self.langgraph_available()
        result.execution_metadata["cache_hit"] = False
        self._append_timeline(
            incident,
            "workflow_completed",
            "copilot",
            f"Workflow completed in {round(duration, 4)} seconds.",
        )
        self._store_cached_result(incident, result)
        self._persist_run(result)
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
        graph.add_node("enrich_context", self._enrich_context_node)
        graph.add_node("retrieve_runbooks", self._retrieve_runbooks_node)
        graph.add_node("prepare_updates", self._prepare_updates_node)
        graph.add_node("assemble_result", self._assemble_result_node)
        graph.set_entry_point("enrich_context")
        graph.add_edge("enrich_context", "retrieve_runbooks")
        graph.add_edge("retrieve_runbooks", "prepare_updates")
        graph.add_edge("prepare_updates", "assemble_result")
        graph.add_edge("assemble_result", END)
        return graph.compile()

    def _append_timeline(self, incident: IncidentRecord, event_type: str, actor: str, summary: str) -> None:
        self.timeline_repository.append(
            IncidentTimelineEvent(
                incident_id=incident.incident_id,
                event_type=event_type,
                actor=actor,
                summary=summary,
            )
        )

    def _draft_action_plan(self, context: EnrichedIncidentContext, runbooks: list[Any]) -> list[str]:
        return self.investigation_service._action_plan(context, runbooks)

    def _draft_escalation_targets(self, runbooks: list[Any]) -> list[str]:
        return self.investigation_service._escalation_targets(runbooks)

    def _enrich_context_node(self, state: WorkflowState) -> WorkflowState:
        state["context"] = self.enrichment_service.enrich(state["incident"])
        return state

    def _retrieve_runbooks_node(self, state: WorkflowState) -> WorkflowState:
        state["runbooks"] = self.runbook_service.search(state["incident"])
        return state

    def _prepare_updates_node(self, state: WorkflowState) -> WorkflowState:
        context = state["context"]
        assert context is not None
        state["stakeholder_updates"] = self.stakeholder_update_service.build_updates(
            context=context,
            action_plan=self._draft_action_plan(context, state["runbooks"]),
            escalation_targets=self._draft_escalation_targets(state["runbooks"]),
        )
        return state

    def _assemble_result_node(self, state: WorkflowState) -> WorkflowState:
        context = state["context"]
        assert context is not None
        state["result"] = self.investigation_service.build_result(
            context,
            state["runbooks"],
            state["stakeholder_updates"],
        )
        return state

    def _persist_run(self, result: WorkflowResult) -> None:
        if self.workflow_sink:
            self.workflow_sink.append(result.execution_metadata | {"incident_id": result.incident_id})

    def _load_cached_result(self, incident: IncidentRecord) -> WorkflowResult | None:
        if self.workflow_cache is None:
            return None
        payload = self.workflow_cache.get_json(self._cache_key(incident))
        if payload is None:
            return None
        return self._result_from_cache(incident, payload)

    def _store_cached_result(self, incident: IncidentRecord, result: WorkflowResult) -> None:
        if self.workflow_cache is None:
            return
        self.workflow_cache.set_json(
            self._cache_key(incident),
            self._result_to_cache_payload(result),
            ttl_seconds=self.workflow_cache_ttl_seconds,
        )

    def _cache_key(self, incident: IncidentRecord) -> str:
        return f"copilot:triage:{incident.dedupe_key}"

    def _result_to_cache_payload(self, result: WorkflowResult) -> dict[str, Any]:
        context_payload = asdict(result.enriched_context)
        context_payload.pop("incident", None)
        return {
            "incident_summary": result.incident_summary,
            "context": context_payload,
            "runbooks": [asdict(item) for item in result.runbooks],
            "action_plan": list(result.action_plan),
            "escalation_targets": list(result.escalation_targets),
            "leadership_update": result.leadership_update,
            "stakeholder_updates": [asdict(item) for item in result.stakeholder_updates],
            "execution_metadata": dict(result.execution_metadata),
        }

    def _result_from_cache(self, incident: IncidentRecord, payload: dict[str, Any]) -> WorkflowResult:
        context_payload = dict(payload.get("context", {}))
        dependencies = [
            ServiceDependency(
                service_name=str(item.get("service_name", incident.service_name)),
                dependency_name=str(item.get("dependency_name", "")),
                dependency_type=str(item.get("dependency_type", "")),
                criticality=str(item.get("criticality", "")),
            )
            for item in payload.get("context", {}).get("dependencies", [])
        ]
        context = EnrichedIncidentContext(
            incident=incident,
            severity_score=int(context_payload.get("severity_score", 0)),
            affected_capability=str(context_payload.get("affected_capability", "")),
            blast_radius=str(context_payload.get("blast_radius", "")),
            likely_owners=[str(item) for item in context_payload.get("likely_owners", [])],
            dependencies=dependencies,
            stakeholder_channels=[str(item) for item in context_payload.get("stakeholder_channels", [])],
        )
        metadata = dict(payload.get("execution_metadata", {}))
        metadata["cache_hit"] = True
        return WorkflowResult(
            incident_id=incident.incident_id,
            severity=incident.severity,
            incident_summary=str(payload.get("incident_summary", "")),
            enriched_context=context,
            runbooks=[
                RunbookDocument(
                    runbook_id=str(item.get("runbook_id", "")),
                    title=str(item.get("title", "")),
                    service_name=str(item.get("service_name", "")),
                    severity_levels=[str(level) for level in item.get("severity_levels", [])],
                    keywords=[str(keyword) for keyword in item.get("keywords", [])],
                    summary=str(item.get("summary", "")),
                    immediate_actions=[str(action) for action in item.get("immediate_actions", [])],
                    escalation_targets=[str(target) for target in item.get("escalation_targets", [])],
                )
                for item in payload.get("runbooks", [])
            ],
            action_plan=[str(item) for item in payload.get("action_plan", [])],
            escalation_targets=[str(item) for item in payload.get("escalation_targets", [])],
            leadership_update=str(payload.get("leadership_update", "")),
            stakeholder_updates=[
                StakeholderUpdate(
                    audience=str(item.get("audience", "")),
                    title=str(item.get("title", "")),
                    body=str(item.get("body", "")),
                    delivery_channel=str(item.get("delivery_channel", "")),
                )
                for item in payload.get("stakeholder_updates", [])
            ],
            execution_metadata=metadata,
        )
