from __future__ import annotations

from app.domain.models import IncidentRecord, RunbookDocument, WorkflowResult
from app.domain.prompts import LEADERSHIP_UPDATE_TEMPLATE


class InvestigationService:
    def build_result(self, incident: IncidentRecord, runbooks: list[RunbookDocument]) -> WorkflowResult:
        action_plan = self._action_plan(incident, runbooks)
        escalation_targets = self._escalation_targets(runbooks)
        summary = self._incident_summary(incident, runbooks)
        leadership_update = LEADERSHIP_UPDATE_TEMPLATE.format(
            service_name=incident.service_name,
            environment=incident.environment,
            severity=incident.severity,
            impact_summary=incident.impact_summary,
            posture="Immediate triage active with runbook-backed containment steps.",
            next_actions="; ".join(action_plan[:3]),
            escalation_targets=", ".join(escalation_targets) if escalation_targets else "Primary service owner",
        )
        return WorkflowResult(
            incident_id=incident.incident_id,
            severity=incident.severity,
            incident_summary=summary,
            runbooks=runbooks,
            action_plan=action_plan,
            escalation_targets=escalation_targets,
            leadership_update=leadership_update,
            execution_metadata={
                "workflow_mode": "deterministic",
                "runbook_count": len(runbooks),
                "service_name": incident.service_name,
            },
        )

    def _incident_summary(self, incident: IncidentRecord, runbooks: list[RunbookDocument]) -> str:
        runbook_titles = ", ".join(runbook.title for runbook in runbooks) if runbooks else "no matching runbooks"
        return (
            f"{incident.severity} incident affecting {incident.service_name} in {incident.environment}. "
            f"Impact: {incident.impact_summary}. Retrieved context: {runbook_titles}."
        )

    def _action_plan(self, incident: IncidentRecord, runbooks: list[RunbookDocument]) -> list[str]:
        steps = [
            f"Confirm blast radius for {incident.service_name} across {', '.join(incident.affected_regions) or 'all active regions'}.",
            "Create or update the incident channel and assign an incident commander.",
        ]
        for runbook in runbooks:
            steps.extend(runbook.immediate_actions[:2])
        steps.append("Publish a concise internal status update after initial containment checks.")
        deduped: list[str] = []
        for step in steps:
            if step not in deduped:
                deduped.append(step)
        return deduped[:6]

    def _escalation_targets(self, runbooks: list[RunbookDocument]) -> list[str]:
        targets: list[str] = []
        for runbook in runbooks:
            for target in runbook.escalation_targets:
                if target not in targets:
                    targets.append(target)
        return targets[:4]

