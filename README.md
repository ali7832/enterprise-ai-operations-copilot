# Enterprise AI Operations Copilot

Private, interview-focused enterprise application inspired by large-account operations environments. This project is designed to feel like an internal AI operations product built with business stakeholders, incident responders, service owners, and support teams rather than a generic portfolio demo.

## What This System Does

Enterprise AI Operations Copilot helps operations teams intake an incident, retrieve relevant runbooks, assemble service context, and produce a structured triage plan with recommended actions, escalation guidance, and stakeholder-facing summaries.

## Target Stack

- FastAPI for the API layer
- LangGraph for workflow orchestration
- PostgreSQL for incident and workflow records
- Redis for caching and short-lived workflow coordination
- OpenSearch for runbook and operational search
- Docker for local runtime
- AWS deployment design for ECS, RDS, ElastiCache, and OpenSearch
- Grafana and Prometheus for observability

## Product Story

This is intentionally framed as a stakeholder-grade internal tool for enterprise operations teams:

- Incident managers need faster first-response triage.
- Service owners need consistent runbook retrieval.
- Support and operations leaders need clearer escalation summaries.
- Platform teams need auditability, metrics, and deployment discipline.

## Core Capabilities

- Incident intake with severity, impacted capability, and dedupe key generation
- Deterministic triage workflow with LangGraph-compatible orchestration
- Runbook retrieval against operational playbooks
- AI-ready investigation summary and action plan assembly
- Stakeholder update generation for operations leadership
- Prometheus-friendly metrics endpoint
- Grafana dashboard provisioning
- AWS-oriented deployment design and Docker Compose local stack

## Repository Layout

```text
app/
  api/              API route construction
  core/             runtime configuration
  domain/           core models and prompt scaffolding
  integrations/     PostgreSQL, Redis, and OpenSearch adapters
  observability/    metrics collection and exposition
  repositories/     repository interfaces and local fixture-backed repo
  services/         intake, retrieval, investigation, and workflow logic
docs/               architecture and deployment notes
fixtures/           sample runbooks and incidents
infra/              Prometheus, Grafana, and Postgres bootstrap
scripts/            local helper scripts
tests/              unit tests for core workflow logic
```

## Quickstart

1. Create a virtual environment.
2. Install dependencies from `pyproject.toml`.
3. Copy `.env.example` to `.env`.
4. Start the local stack with Docker Compose.
5. Run the API.

```bash
docker compose up --build
python -m app.main
```

## Example API Calls

Health:

```bash
curl http://localhost:8000/health
```

Incident intake:

```bash
curl -X POST http://localhost:8000/api/v1/incidents/intake \
  -H 'Content-Type: application/json' \
  -d @fixtures/sample_incident.json
```

Copilot triage:

```bash
curl -X POST http://localhost:8000/api/v1/copilot/triage \
  -H 'Content-Type: application/json' \
  -d @fixtures/sample_incident.json
```

Metrics:

```bash
curl http://localhost:8000/metrics
```

## Key Design Decisions

- The workflow layer is written so it can execute deterministically in pure Python while also exposing a LangGraph-compatible builder when the dependency is installed.
- Runbook retrieval is abstracted behind a repository boundary so the local fixture-backed flow can later be replaced with OpenSearch-backed retrieval.
- Observability is first-class. Metrics are exposed directly, and Grafana provisioning is checked into the repo from day one.
- The product story stays grounded in enterprise operations work: triage discipline, escalation clarity, auditability, and internal service ownership.

## AWS Deployment Shape

- ECS/Fargate for the API and workflow service
- RDS PostgreSQL for durable incident and copilot workflow records
- ElastiCache Redis for low-latency coordination and caching
- Amazon OpenSearch Service for runbook and event retrieval
- CloudWatch plus Prometheus/Grafana integration for metrics and dashboards

See [docs/architecture.md](docs/architecture.md) and [docs/deployment.md](docs/deployment.md).

## Interview Positioning

This project is a newly built private demonstration application inspired by enterprise operations environments. It should be discussed honestly as interview-targeted software that reflects credible workflow patterns, stakeholder needs, and operational tradeoffs.

