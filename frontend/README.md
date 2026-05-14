# Enterprise AI Operations Copilot Frontend

React frontend for the enterprise AI guidance workspace.

## What It Shows

This UI is framed as a user-facing enterprise AI tool instead of a dense operator cockpit. A user can describe a business or system issue in plain language, receive AI-assisted triage guidance, review likely owners and dependencies, and copy stakeholder-ready updates.

## Local Run

```bash
npm install
npm run dev
```

The dev server runs on `http://127.0.0.1:4173` and proxies backend routes to `http://127.0.0.1:8000`.

If you want to point the frontend at another backend, use the API Base field inside the UI.

## Demo Behavior

If the backend is unavailable, the frontend falls back to demo data so the product still walks through the same interview-ready flow.
