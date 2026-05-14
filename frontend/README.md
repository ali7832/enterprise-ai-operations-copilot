# SignalDesk AI Frontend

Premium SaaS-style product page and workspace for enterprise issue response.

## What Changed

- the top of the page now explains the product like a real end-user SaaS offering
- developer-facing controls were removed from the main experience
- the AI story is now outcome-based and user-facing
- the live workspace sits lower on the page after the value proposition is clear
- the workspace now calls the backend triage route and the backend assistant route to generate a richer response brief and follow-up answers

## Local Run

```bash
npm install
npm run dev
```

The dev server runs on `http://127.0.0.1:4173` and proxies backend routes to `http://127.0.0.1:8000`.

For the managed AI follow-up experience to use a live model, the backend must expose `/api/v1/copilot/assistant` with valid provider configuration. If that route is unavailable, the UI falls back to the structured triage output.
