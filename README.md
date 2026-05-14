# Enterprise AI Operations Copilot

Private, interview-focused enterprise application inspired by large-account operations environments. This build is designed to feel like a real internal AI operations product for incident responders, service owners, and support leaders rather than a generic portfolio demo.

## What This System Does

Enterprise AI Operations Copilot helps operations teams:

- intake an incident
- retrieve relevant runbooks
- assemble service context
- produce a structured triage plan
- draft stakeholder-facing updates
- collaborate with a configurable model-backed copilot from the same workspace

## Stack

- FastAPI for the API layer
- LangGraph-compatible workflow orchestration
- PostgreSQL, Redis, and OpenSearch as optional runtime backends
- React and Vite for the operator UI
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

By default the frontend talks to the backend on the same origin. If you run the frontend separately, set the backend URL in the model routing drawer inside the UI.

## AI Assistant Routing

The assistant route accepts any OpenAI-compatible chat completion endpoint.

Typical options:

- OpenAI: `https://api.openai.com/v1`
- OpenRouter: `https://openrouter.ai/api/v1`
- local gateway: `http://localhost:11434/v1`

Set these through `.env` or in the UI drawer:

- `AI_PROVIDER_LABEL`
- `AI_API_BASE_URL`
- `AI_API_KEY`
- `AI_MODEL`
- `AI_SYSTEM_PROMPT`

If no live model is configured, the assistant still responds in grounded demo mode so the workspace remains interview-safe and runnable.

## Main User Flows

- operator creates or pastes an incident
- workflow generates triage context and likely owners
- retrieved runbooks and action plans stay visible in the workspace
- operator asks the assistant for summaries, rollback guidance, customer messaging, or executive updates
- stakeholder-ready comms remain alongside the operational record

## Product Direction

The current UI is intentionally more cinematic and operator-focused than a traditional dashboard. It draws from modern AI product marketing cues while staying usable as a working incident surface.
