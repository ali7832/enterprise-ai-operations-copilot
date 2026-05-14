from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import os


DEFAULT_AI_SYSTEM_PROMPT = (
    "You are an enterprise incident copilot. Help operators understand the incident, "
    "propose the next safest actions, draft concise stakeholder updates, and stay "
    "grounded in the context you are given. If the context is incomplete, say what is "
    "missing instead of inventing certainty."
)


@dataclass(frozen=True)
class Settings:
    app_env: str = "local"
    app_name: str = "enterprise-ai-operations-copilot"
    app_port: int = 8000
    use_langgraph: bool = True
    postgres_dsn: str = "postgresql://copilot:copilot@localhost:5432/copilot"
    redis_url: str = "redis://localhost:6379/0"
    opensearch_url: str = "http://localhost:9200"
    use_postgres_persistence: bool = False
    use_redis_cache: bool = False
    use_opensearch_runbooks: bool = False
    workflow_cache_ttl_seconds: int = 900
    opensearch_runbook_index: str = "runbooks"
    workflow_runs_path: str = "fixtures/workflow_runs.jsonl"
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
    ai_provider_label: str = "OpenAI-compatible"
    ai_api_base_url: str = ""
    ai_api_key: str = ""
    ai_model: str = ""
    ai_request_timeout_seconds: int = 45
    ai_system_prompt: str = DEFAULT_AI_SYSTEM_PROMPT

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
            use_postgres_persistence=os.getenv("USE_POSTGRES_PERSISTENCE", "false").lower() == "true",
            use_redis_cache=os.getenv("USE_REDIS_CACHE", "false").lower() == "true",
            use_opensearch_runbooks=os.getenv("USE_OPENSEARCH_RUNBOOKS", "false").lower() == "true",
            workflow_cache_ttl_seconds=int(os.getenv("WORKFLOW_CACHE_TTL_SECONDS", cls.workflow_cache_ttl_seconds)),
            opensearch_runbook_index=os.getenv("OPENSEARCH_RUNBOOK_INDEX", cls.opensearch_runbook_index),
            workflow_runs_path=os.getenv("WORKFLOW_RUNS_PATH", cls.workflow_runs_path),
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
            ai_provider_label=os.getenv("AI_PROVIDER_LABEL", cls.ai_provider_label),
            ai_api_base_url=os.getenv("AI_API_BASE_URL", cls.ai_api_base_url),
            ai_api_key=os.getenv("AI_API_KEY", cls.ai_api_key),
            ai_model=os.getenv("AI_MODEL", cls.ai_model),
            ai_request_timeout_seconds=int(os.getenv("AI_REQUEST_TIMEOUT_SECONDS", cls.ai_request_timeout_seconds)),
            ai_system_prompt=os.getenv("AI_SYSTEM_PROMPT", cls.ai_system_prompt),
        )

    def fixture_path(self, relative_path: str) -> Path:
        return Path(relative_path)

    @property
    def storage_backend(self) -> str:
        return "postgres" if self.use_postgres_persistence else "memory"

    @property
    def runbook_backend(self) -> str:
        return "opensearch" if self.use_opensearch_runbooks else "fixtures"

    @property
    def cache_backend(self) -> str:
        return "redis" if self.use_redis_cache else "disabled"
