# Operations Runbook

## Local Startup

1. Start the support services with `docker compose up --build`.
2. Confirm the API is healthy at `GET /health`.
3. Confirm metrics are available at `GET /metrics`.
4. Open Grafana at `http://localhost:3000`.

## Core Operational Flow

1. An incident is submitted through `/api/v1/incidents/intake`.
2. The copilot triage workflow enriches the incident with severity, service domain, and retrieval queries.
3. Runbooks are fetched from the operational knowledge base.
4. The workflow assembles an action plan, escalation recommendation, and leadership update.
5. Metrics are emitted for intake and workflow runs.

## Failure Modes

- PostgreSQL unavailable: workflow results can still be generated in memory, but durable incident storage is degraded.
- Redis unavailable: short-lived caching is bypassed, increasing repeat retrieval cost.
- OpenSearch unavailable: fixture-backed or local lexical retrieval should be used as a fallback path.
- LangGraph unavailable: the deterministic workflow executor continues to run without the orchestration dependency.

## On-Call Review Checklist

- Confirm severity classification is reasonable for the reported blast radius.
- Confirm recommended runbooks align with the affected platform domain.
- Confirm escalation targets include the right operational owner.
- Confirm leadership summary is suitable for internal status updates.
- Confirm metrics show expected workflow latency and success volume.

