from __future__ import annotations

from app.domain.models import IncidentRecord


class PostgresIncidentStore:
    def __init__(self, dsn: str) -> None:
        self.dsn = dsn

    def save(self, incident: IncidentRecord) -> None:
        try:
            import psycopg
        except ImportError as exc:
            raise RuntimeError("psycopg is required for PostgreSQL persistence.") from exc

        with psycopg.connect(self.dsn) as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    insert into incidents (
                        incident_id, title, description, service_name, environment,
                        reporter, severity, impact_summary, affected_regions, tags,
                        dedupe_key, created_at
                    )
                    values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
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
                        incident.affected_regions,
                        incident.tags,
                        incident.dedupe_key,
                        incident.created_at,
                    ),
                )
            connection.commit()

