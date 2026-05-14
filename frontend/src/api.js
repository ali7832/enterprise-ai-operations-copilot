import { demoIncident, demoTimeline, demoTriage } from "./demoData";

const JSON_HEADERS = {
  "Content-Type": "application/json"
};

export function getApiBase() {
  return localStorage.getItem("eaoc-api-base") || "";
}

export function setApiBase(value) {
  localStorage.setItem("eaoc-api-base", value);
}

async function request(path, options = {}) {
  const base = getApiBase().replace(/\/$/, "");
  const url = base ? `${base}${path}` : path;
  const response = await fetch(url, {
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

export async function searchRunbooks(serviceName, severity) {
  const params = new URLSearchParams();
  if (serviceName) {
    params.set("service_name", serviceName);
  }
  if (severity) {
    params.set("severity", severity);
  }
  const data = await request(`/api/v1/runbooks/search?${params.toString()}`);
  return data.items || [];
}

export async function runTriage(payload) {
  return request("/api/v1/copilot/triage", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function demoSnapshot() {
  return {
    liveMode: false,
    health: {
      status: "demo",
      app_name: "Enterprise AI Operations Copilot",
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
