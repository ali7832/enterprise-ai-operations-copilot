# Deployment Notes

## Local

- `docker compose up --build`
- API on port `8000`
- Prometheus on port `9090`
- Grafana on port `3000`
- PostgreSQL on port `5432`
- Redis on port `6379`
- OpenSearch on port `9200`

## AWS Reference Shape

### Compute

- Deploy the API and workflow service to ECS on Fargate.
- Use separate task definitions for API traffic and async background execution if workflow volume grows.

### Data

- RDS PostgreSQL stores incidents, triage runs, workflow audit notes, and reviewer actions.
- ElastiCache Redis supports workflow dedupe, TTL caches, and coordination metadata.
- Amazon OpenSearch Service stores runbooks, incident summaries, and searchable operational notes.

### Networking

- Place ECS, RDS, Redis, and OpenSearch inside a private VPC.
- Put the public API behind an ALB with WAF and private service discovery for internal components.

### Observability

- Scrape Prometheus metrics from the service.
- Route logs to CloudWatch.
- Mirror dashboard panels in Grafana for local and cloud parity.

## Rollout Strategy

1. Internal pilot with one operations domain.
2. Validate severity normalization and runbook relevance.
3. Add analyst feedback capture.
4. Expand to multi-service runbook collections.
5. Add LLM-backed summarization only after deterministic outputs are trusted.

