# Enterprise AI Operations Copilot

Private, interview-focused enterprise application inspired by large-account operations environments. This build is designed to feel like a real internal AI product for enterprise teams rather than a generic portfolio demo.

## What This System Does

Enterprise AI Operations Copilot helps teams:

- describe an incident or business issue in plain language
- generate structured AI-assisted triage guidance
- identify likely owners and related dependencies
- produce next-step recommendations that are easy to act on
- draft stakeholder-facing updates for leadership and support teams
- review recent incident history and timeline context from one workspace

## Stack

- FastAPI for the API layer
- LangGraph-compatible workflow orchestration
- PostgreSQL, Redis, and OpenSearch as optional runtime backends
- React and Vite for the frontend
- Docker Compose for the local stack
- Prometheus and Grafana for observability

## Quickstart

1. Copy `.env.example` to `.env`.
2. Start the backend dependencies if you want the full stack.
3. Run the API.
4. Run the React frontend.

```bash
docker compose up -d --build
python -m app.main
cd frontend
npm install
npm run dev
```

By default the frontend talks to the backend on the same origin. If you run the frontend separately, set the backend URL in the API Base field inside the UI.

## Main User Flow

- user describes an issue in the workspace
- the system produces triage guidance, likely owners, and related dependency context
- the workspace surfaces recommended next actions and helpful runbook guidance
- stakeholder-ready messaging can be copied directly from the same flow
- recent incidents and timeline context remain visible for follow-up

## Product Direction

The current frontend is intentionally simpler and more user-facing than the earlier operator-console direction. It is meant to feel like an AI help product that enterprise teams can actually understand and use during fast-moving issue response.
