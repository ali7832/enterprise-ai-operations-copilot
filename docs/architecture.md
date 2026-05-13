# Architecture

## System Intent

Enterprise AI Operations Copilot is an internal-style operations product that helps enterprise teams handle early incident triage consistently. The main product value is not raw LLM novelty. It is operational discipline:

- faster intake normalization
- repeatable runbook retrieval
- clearer escalation guidance
- better stakeholder updates
- measurable workflow behavior

## Logical Components

### API Layer

- Accepts incident intake requests
- Exposes copilot triage endpoint
- Publishes Prometheus-compatible metrics

### Workflow Layer

- Uses a deterministic triage flow today
- Provides a LangGraph-compatible workflow builder for future graph-native execution
- Separates retrieval, analysis, and output assembly into explicit workflow stages

### Knowledge Layer

- Runbooks live behind a repository interface
- Local fixture-backed retrieval supports development and demos
- OpenSearch can replace the fixture-backed implementation without changing workflow logic

### Persistence Layer

- PostgreSQL stores normalized incidents, workflow outputs, and review notes
- Redis supports short-lived cache keys, dedupe support, and workflow coordination

### Observability Layer

- Prometheus scrapes application metrics
- Grafana dashboards show intake volume, workflow latency, and severity trends

## Data Flow

1. A user submits an incident payload.
2. The intake service normalizes severity and dedupe keys.
3. The workflow retrieves likely runbooks.
4. The investigation service assembles action items and escalation guidance.
5. Metrics are emitted for request volume and workflow duration.
6. The result can be persisted and surfaced to internal operators.

## Why This Is A Good Private Project

- It feels like an internal platform capability, not a showcase chatbot.
- It maps well to stakeholder conversations across operations, support, and platform teams.
- It supports technical follow-up on retrieval, orchestration, observability, and production rollout.

