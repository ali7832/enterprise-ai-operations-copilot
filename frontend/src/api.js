import { demoIncident, demoTimeline, demoTriage } from "./demoData";

const JSON_HEADERS = {
  "Content-Type": "application/json"
};

const ASSISTANT_STORAGE_KEY = "eaoc-assistant-config";

const DEFAULT_ASSISTANT_CONFIG = {
  providerLabel: "OpenAI-compatible",
  apiBaseUrl: "",
  apiKey: "",
  model: "",
  systemPrompt:
    "You are an enterprise incident copilot. Keep answers clear, operator-friendly, and grounded in the incident context.",
  temperature: 0.2,
  maxTokens: 700
};

export function getApiBase() {
  return localStorage.getItem("eaoc-api-base") || "";
}

export function setApiBase(value) {
  localStorage.setItem("eaoc-api-base", value);
}

export function getAssistantConfig() {
  const saved = localStorage.getItem(ASSISTANT_STORAGE_KEY);
  if (!saved) {
    return DEFAULT_ASSISTANT_CONFIG;
  }

  try {
    return {
      ...DEFAULT_ASSISTANT_CONFIG,
      ...JSON.parse(saved)
    };
  } catch {
    return DEFAULT_ASSISTANT_CONFIG;
  }
}

export function setAssistantConfig(config) {
  localStorage.setItem(
    ASSISTANT_STORAGE_KEY,
    JSON.stringify({
      ...DEFAULT_ASSISTANT_CONFIG,
      ...config
    })
  );
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

export async function runAssistant({
  messages,
  incidentContext,
  triageContext,
  config
}) {
  const payload = {
    messages,
    incident_context: incidentContext || {},
    triage_context: triageContext || {},
    provider_label: config.providerLabel,
    api_base_url: config.apiBaseUrl,
    api_key: config.apiKey,
    model: config.model,
    system_prompt: config.systemPrompt,
    temperature: Number(config.temperature || DEFAULT_ASSISTANT_CONFIG.temperature),
    max_tokens: Number(config.maxTokens || DEFAULT_ASSISTANT_CONFIG.maxTokens)
  };

  return request("/api/v1/copilot/assistant", {
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

export { DEFAULT_ASSISTANT_CONFIG, demoIncident, demoTriage };
