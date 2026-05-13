from __future__ import annotations

import json
from collections.abc import Sequence

from app.domain.models import IncidentRecord, IncidentTimelineEvent


def _normalize_json_list(value: object) -> list[str]:
    if isinstance(value, list):
        return [str(item) for item in value]
    if isinstance(value, str):
        decoded = json.loads(value)
        if isinstance(decoded, list):
            return [str(item) for item in decoded]
    return []


class PostgresIncidentRepository:
    def __init__(self, dsn: str) -> None:
        self.dsn = dsn

    def _connect(self) -> object:
        try:
            import psycopg
        except ImportError as exc:
            raise RuntimeError("psycopg is required for PostgreSQL persistence.") from exc
        return psycopg.connect(self.dsn)

    def save(self, incident: IncidentRecord) -> None:
        with self._connect() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    insert into incidents (
                        incident_id, title, description, service_name, environment,
                        reporter, severity, impact_summary, affected_regions, tags,
                        dedupe_key, created_at
                    )
                    values (%s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb, %s::jsonb, %s, %s)
                    on conflict (incident_id) do update set
                        title = excluded.title,
                        description = excluded.description,
                        service_name = excluded.service_name,
                        environment = excluded.environment,
                        reporter = excluded.reporter,
                        severity = excluded.severity,
                        impact_summary = excluded.impact_summary,
                        affected_regions = excluded.affected_regions,
                        tags = excluded.tags,
                        dedupe_key = excluded.dedupe_key,
                        created_at = excluded.created_at
                    """,
                    (
                        incident.incident_id,
                        incident.title,
                        incident.description,
                        incident.service_name,
                        incident.environment,
                        incident.reporter,
                        incident.severity,
                        incident.impact_summary,
                        json.dumps(incident.affected_regions),
                        json.dumps(incident.tags),
                        incident.dedupe_key,
                        incident.created_at,
                    ),
                )
            connection.commit()

    def list_all(self) -> list[IncidentRecord]:
        with self._connect() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    select incident_id, title, description, service_name, environment,
                           reporter, severity, impact_summary, affected_regions, tags,
                           dedupe_key, created_at
                    from incidents
                    order by created_at desc
                    """,
                )
                rows = cursor.fetchall()
        return [self._to_incident(row) for row in rows]

    def get(self, incident_id: str) -> IncidentRecord | None:
        with self._connect() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    select incident_id, title, description, service_name, environment,
                           reporter, severity, impact_summary, affected_regions, tags,
                           dedupe_key, created_at
                    from incidents
                    where incident_id = %s
                    """,
                    (incident_id,),
                )
                row = cursor.fetchone()
        return self._to_incident(row) if row else None

    def _to_incident(self, row: Sequence[object]) -> IncidentRecord:
        return IncidentRecord(
            incident_id=str(row[0]),
            title=str(row[1]),
            description=str(row[2]),
            service_name=str(row[3]),
            environment=str(row[4]),
            reporter=str(row[5]),
            severity=str(row[6]),
            impact_summary=str(row[7]),
            affected_regions=_normalize_json_list(row[8]),
            tags=_normalize_json_list(row[9]),
            dedupe_key=str(row[10]),
            created_at=str(row[11]),
        )


class PostgresTimelineRepository:
    def __init__(self, dsn: str) -> None:
        self.dsn = dsn

    def _connect(self) -> object:
        try:
            import psycopg
        except ImportError as exc:
            raise RuntimeError("psycopg is required for PostgreSQL persistence.") from exc
        return psycopg.connect(self.dsn)

    def append(self, event: IncidentTimelineEvent) -> None:
        with self._connect() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    insert into incident_timeline_events (
                        incident_id, event_type, actor, summary, created_at
                    )
                    values (%s, %s, %s, %s, %s)
                    """,
                    (event.incident_id, event.event_type, event.actor, event.summary, event.created_at),
                )
            connection.commit()

    def list_for_incident(self, incident_id: str) -> list[IncidentTimelineEvent]:
        with self._connect() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    select incident_id, event_type, actor, summary, created_at
                    from incident_timeline_events
                    where incident_id = %s
                    order by created_at asc
                    """,
                    (incident_id,),
                )
                rows = cursor.fetchall()
        return [
            IncidentTimelineEvent(
                incident_id=str(row[0]),
                event_type=str(row[1]),
                actor=str(row[2]),
                summary=str(row[3]),
                created_at=str(row[4]),
            )
            for row in rows
        ]


class PostgresWorkflowRunStore:
    def __init__(self, dsn: str) -> None:
        self.dsn = dsn

    def _connect(self) -> object:
        try:
            import psycopg
        except ImportError as exc:
            raise RuntimeError("psycopg is required for PostgreSQL persistence.") from exc
        return psycopg.connect(self.dsn)

    def append(self, payload: dict[str, object]) -> None:
        with self._connect() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    insert into copilot_runs (
                        incident_id,
                        workflow_mode,
                        runbook_count,
                        duration_seconds,
                        cache_hit,
                        execution_metadata
                    )
                    values (%s, %s, %s, %s, %s, %s::jsonb)
                    """,
                    (
                        str(payload.get("incident_id", "")),
                        str(payload.get("workflow_mode", "deterministic")),
                        int(payload.get("runbook_count", 0)),
                        float(payload.get("duration_seconds", 0.0)),
                        bool(payload.get("cache_hit", False)),
                        json.dumps(payload),
                    ),
                )
            connection.commit()
