from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import os


@dataclass(frozen=True)
class Settings:
    app_env: str = "local"
    app_name: str = "enterprise-ai-operations-copilot"
    app_port: int = 8000
    use_langgraph: bool = True
    postgres_dsn: str = "postgresql://copilot:copilot@localhost:5432/copilot"
    redis_url: str = "redis://localhost:6379/0"
    opensearch_url: str = "http://localhost:9200"
    runbook_fixture_path: str = "fixtures/runbooks.json"
    incident_fixture_path: str = "fixtures/sample_incident.json"
    max_runbook_results: int = 3
    prometheus_enabled: bool = True
    grafana_enabled: bool = True
    aws_region: str = "us-east-1"
    aws_ecs_cluster: str = "enterprise-ai-ops"
    aws_rds_instance: str = "enterprise-ai-ops-db"
    aws_opensearch_domain: str = "enterprise-ai-ops-search"
    aws_elasticache_cluster: str = "enterprise-ai-ops-cache"

    @classmethod
    def from_env(cls) -> "Settings":
        return cls(
            app_env=os.getenv("APP_ENV", cls.app_env),
            app_name=os.getenv("APP_NAME", cls.app_name),
            app_port=int(os.getenv("APP_PORT", cls.app_port)),
            use_langgraph=os.getenv("USE_LANGGRAPH", "true").lower() == "true",
            postgres_dsn=os.getenv("POSTGRES_DSN", cls.postgres_dsn),
            redis_url=os.getenv("REDIS_URL", cls.redis_url),
            opensearch_url=os.getenv("OPENSEARCH_URL", cls.opensearch_url),
            runbook_fixture_path=os.getenv("RUNBOOK_FIXTURE_PATH", cls.runbook_fixture_path),
            incident_fixture_path=os.getenv("INCIDENT_FIXTURE_PATH", cls.incident_fixture_path),
            max_runbook_results=int(os.getenv("MAX_RUNBOOK_RESULTS", cls.max_runbook_results)),
            prometheus_enabled=os.getenv("PROMETHEUS_ENABLED", "true").lower() == "true",
            grafana_enabled=os.getenv("GRAFANA_ENABLED", "true").lower() == "true",
            aws_region=os.getenv("AWS_REGION", cls.aws_region),
            aws_ecs_cluster=os.getenv("AWS_ECS_CLUSTER", cls.aws_ecs_cluster),
            aws_rds_instance=os.getenv("AWS_RDS_INSTANCE", cls.aws_rds_instance),
            aws_opensearch_domain=os.getenv("AWS_OPENSEARCH_DOMAIN", cls.aws_opensearch_domain),
            aws_elasticache_cluster=os.getenv("AWS_ELASTICACHE_CLUSTER", cls.aws_elasticache_cluster),
        )

    def fixture_path(self, relative_path: str) -> Path:
        return Path(relative_path)

