import { demoIncident, demoTimeline, demoTriage } from "./demoData";

const JSON_HEADERS = {
  "Content-Type": "application/json"
};

async function request(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      ...JSON_HEADERS,
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  const contentType = response.headers.get("content-type") || "";
  return contentType.includes("application/json") ? response.json() : response.text();
}

export async function loadHealth() {
  return request("/health");
}

export async function loadIncidents() {
  const data = await request("/api/v1/incidents");
  return data.items || [];
}

export async function loadTimeline(incidentId) {
  if (!incidentId) {
    return [];
  }

  const data = await request(`/api/v1/incidents/${incidentId}/timeline`);
  return data.items || [];
}

export async function runTriage(payload) {
  return request("/api/v1/copilot/triage", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function runAssistant({ messages, incidentContext, triageContext }) {
  return request("/api/v1/copilot/assistant", {
    method: "POST",
    body: JSON.stringify({
      messages,
      incident_context: incidentContext || {},
      triage_context: triageContext || {},
      provider_label: "",
      api_base_url: "",
      api_key: "",
      model: "",
      system_prompt:
        "You are an enterprise issue response assistant. Turn the problem into a clear response brief, practical next steps, likely solution guidance, and clean stakeholder messaging.",
      temperature: 0.2,
      max_tokens: 700
    })
  });
}

export function demoSnapshot() {
  return {
    liveMode: false,
    health: {
      status: "demo",
      app_name: "SignalDesk AI",
      environment: "demo",
      langgraph_enabled: false,
      backend_summary: {
        storage: "demo",
        runbooks: "fixtures",
        cache: "disabled"
      }
    },
    incidents: [demoIncident],
    timeline: demoTimeline,
    runbooks: demoTriage.runbooks
  };
}

export { demoIncident, demoTriage };
