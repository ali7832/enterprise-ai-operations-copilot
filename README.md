# Enterprise AI Operations Copilot

Private, interview-focused enterprise application inspired by large-account operations environments. The current frontend direction presents the product as a premium SaaS-style enterprise response platform rather than an internal operator console.

## Product Demo Video


https://github.com/user-attachments/assets/393ba4b8-adf5-485f-839f-7de42826c277


## What This System Does

Enterprise AI Operations Copilot helps teams:

- describe an issue in plain language
- generate a structured response brief
- identify likely owners and likely solution paths
- produce next-step recommendations that are easy to act on
- draft stakeholder-facing updates for leadership and customer-facing teams
- continue the same issue flow through follow-up AI assistance

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

## Main Product Flow

- the user describes the issue in plain language
- the triage workflow creates structured guidance, likely owners, and recommended actions
- the assistant route can turn that context into a richer response brief and follow-up guidance
- the workspace keeps communication-ready output and issue history visible in one place

## Frontend Direction

The current frontend is designed to feel like a real end-user AI SaaS product:

- premium landing-page presentation first
- product value explained before the workspace appears
- no developer-facing controls in the main user journey
- outcome-based AI messaging instead of infrastructure messaging
- the actual issue workspace lower on the page, after the product story is clear
