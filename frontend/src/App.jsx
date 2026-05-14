import React, { startTransition, useDeferredValue, useEffect, useState } from "react";
import {
  demoIncident,
  demoTriage,
  getApiBase,
  getAssistantConfig,
  loadHealth,
  loadIncidents,
  loadTimeline,
  runAssistant,
  runTriage,
  setApiBase,
  setAssistantConfig
} from "./api";
import { demoPayload } from "./demoData";

const QUICK_PROMPTS = [
  "Summarize the incident for the incident commander.",
  "Draft a customer-safe support update.",
  "What should we verify before rolling back?",
  "Give me a 15-minute executive checkpoint."
];

function buildInitialForm() {
  return {
    title: demoPayload.title,
    description: demoPayload.description,
    service_name: demoPayload.service_name,
    environment: demoPayload.environment,
    reporter: demoPayload.reporter,
    severity: demoPayload.severity,
    impact_summary: demoPayload.impact_summary,
    affected_regions: demoPayload.affected_regions.join(", "),
    tags: demoPayload.tags.join(", ")
  };
}

function toPayload(form) {
  return {
    title: form.title,
    description: form.description,
    service_name: form.service_name,
    environment: form.environment,
    reporter: form.reporter,
    severity: form.severity,
    impact_summary: form.impact_summary,
    affected_regions: form.affected_regions
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
    tags: form.tags
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
  };
}

function toIncidentFromPayload(form) {
  const payload = toPayload(form);
  return {
    ...payload,
    incident_id: `inc-local-${Date.now()}`,
    dedupe_key: `${payload.service_name}|${payload.environment}|${payload.severity}`,
    created_at: new Date().toISOString()
  };
}

function makeTriageContext(result) {
  return {
    incident_id: result?.incident_id || demoTriage.incident_id,
    severity: result?.severity || demoTriage.severity,
    incident_summary: result?.incident_summary || demoTriage.incident_summary,
    likely_owners: result?.enriched_context?.likely_owners || demoTriage.enriched_context.likely_owners,
    blast_radius: result?.enriched_context?.blast_radius || demoTriage.enriched_context.blast_radius,
    action_plan: result?.action_plan || demoTriage.action_plan,
    leadership_update: result?.leadership_update || demoTriage.leadership_update
  };
}

function buildSeedMessages(triageResult) {
  const active = triageResult || demoTriage;
  return [
    {
      role: "assistant",
      content: `I am ready to help with ${active.incident_summary}`
    }
  ];
}

function formatTime(value) {
  if (!value) {
    return "now";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function severityClass(severity) {
  return `severity severity-${(severity || "SEV2").toLowerCase()}`;
}

function MetricTile({ label, value, hint }) {
  return (
    <div className="metric-tile">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{hint}</small>
    </div>
  );
}

function ActivityRow({ label, value, meta }) {
  return (
    <div className="activity-row">
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <small>{meta}</small>
    </div>
  );
}

function MessageBubble({ role, content }) {
  return (
    <article className={`message-bubble message-${role}`}>
      <span className="message-role">{role === "assistant" ? "Copilot" : "Operator"}</span>
      <p>{content}</p>
    </article>
  );
}

function App() {
  const [apiBase, setApiBaseState] = useState(getApiBase());
  const [apiBaseInput, setApiBaseInput] = useState(getApiBase());
  const [assistantConfig, setAssistantConfigState] = useState(getAssistantConfig());
  const [configOpen, setConfigOpen] = useState(false);
  const [liveMode, setLiveMode] = useState(false);
  const [health, setHealth] = useState(null);
  const [incidents, setIncidents] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [selectedIncidentId, setSelectedIncidentId] = useState(null);
  const [triageResult, setTriageResult] = useState(null);
  const [triageMode, setTriageMode] = useState("waiting");
  const [form, setForm] = useState(buildInitialForm);
  const [searchText, setSearchText] = useState("");
  const [assistantMessages, setAssistantMessages] = useState(buildSeedMessages(demoTriage));
  const [assistantInput, setAssistantInput] = useState("");
  const [assistantStatus, setAssistantStatus] = useState("idle");
  const [assistantMeta, setAssistantMeta] = useState({
    provider: "Demo",
    model: "demo-fallback",
    warning: ""
  });

  const deferredSearch = useDeferredValue(searchText);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      try {
        const nextHealth = await loadHealth();
        const nextIncidents = await loadIncidents();
        const nextSelected = nextIncidents[0]?.incident_id || null;
        const nextTimeline = await loadTimeline(nextSelected);

        if (cancelled) {
          return;
        }

        startTransition(() => {
          setLiveMode(true);
          setHealth(nextHealth);
          setIncidents(nextIncidents);
          setSelectedIncidentId(nextSelected);
          setTimeline(nextTimeline);
        });
      } catch {
        if (cancelled) {
          return;
        }
        startTransition(() => {
          setLiveMode(false);
          setHealth({
            status: "demo",
            backend_summary: {
              storage: "memory",
              runbooks: "fixtures",
              cache: "disabled"
            }
          });
          setIncidents([demoIncident]);
          setSelectedIncidentId(demoIncident.incident_id);
          setTimeline([]);
        });
      }
    }

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, [apiBase]);

  useEffect(() => {
    let cancelled = false;

    async function refreshTimeline() {
      if (!selectedIncidentId || !liveMode) {
        return;
      }
      try {
        const nextTimeline = await loadTimeline(selectedIncidentId);
        if (!cancelled) {
          setTimeline(nextTimeline);
        }
      } catch {
        if (!cancelled) {
          setTimeline([]);
        }
      }
    }

    refreshTimeline();
    return () => {
      cancelled = true;
    };
  }, [liveMode, selectedIncidentId]);

  const filteredIncidents = incidents.filter((incident) => {
    const query = deferredSearch.trim().toLowerCase();
    if (!query) {
      return true;
    }
    return [incident.title, incident.service_name, incident.reporter, incident.severity, incident.impact_summary]
      .join(" ")
      .toLowerCase()
      .includes(query);
  });

  const selectedIncident =
    incidents.find((incident) => incident.incident_id === selectedIncidentId) ||
    incidents[0] ||
    demoIncident;
  const activeTriage = triageResult || demoTriage;
  const currentTriageContext = makeTriageContext(activeTriage);
  const liveBadge = liveMode ? "Live stack" : "Demo fallback";
  const runbookCount = activeTriage.runbooks?.length || 0;
  const actionCount = activeTriage.action_plan?.length || 0;
  const statusTone = liveMode ? "tone-live" : "tone-demo";

  function updateForm(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  function updateAssistantConfig(event) {
    const { name, value } = event.target;
    const nextConfig = { ...assistantConfig, [name]: value };
    setAssistantConfigState(nextConfig);
    setAssistantConfig(nextConfig);
  }

  function applyApiBase() {
    const nextBase = apiBaseInput.trim();
    setApiBase(nextBase);
    setApiBaseState(nextBase);
  }

  async function handleTriageSubmit(event) {
    event.preventDefault();
    const payload = toPayload(form);

    try {
      const result = await runTriage(payload);
      const nextIncident = toIncidentFromPayload(form);
      startTransition(() => {
        setTriageResult(result);
        setTriageMode("live");
        setLiveMode(true);
        setIncidents((current) => [nextIncident, ...current].slice(0, 12));
        setSelectedIncidentId(nextIncident.incident_id);
        setAssistantMessages(buildSeedMessages(result));
        setAssistantMeta({
          provider: "Copilot",
          model: "triage-workflow",
          warning: ""
        });
      });
    } catch {
      startTransition(() => {
        setTriageResult(demoTriage);
        setTriageMode("demo");
        setAssistantMessages(buildSeedMessages(demoTriage));
        setAssistantMeta({
          provider: "Demo",
          model: "demo-fallback",
          warning: "The API was unavailable, so the workspace stayed in demo mode."
        });
      });
    }
  }

  async function submitAssistantPrompt(promptOverride) {
    const prompt = (promptOverride || assistantInput).trim();
    if (!prompt) {
      return;
    }

    const nextMessages = [...assistantMessages, { role: "user", content: prompt }];
    setAssistantMessages(nextMessages);
    setAssistantInput("");
    setAssistantStatus("loading");

    try {
      const reply = await runAssistant({
        messages: nextMessages,
        incidentContext: selectedIncident,
        triageContext: currentTriageContext,
        config: assistantConfig
      });

      startTransition(() => {
        setAssistantMessages((current) => [...current, { role: "assistant", content: reply.answer }]);
        setAssistantMeta({
          provider: reply.provider,
          model: reply.model,
          warning: reply.warning || ""
        });
        setAssistantStatus(reply.used_live_model ? "live" : "demo");
      });
    } catch {
      startTransition(() => {
        setAssistantMessages((current) => [
          ...current,
          {
            role: "assistant",
            content:
              "The model endpoint could not be reached from the current backend. The operator workspace is still available, and you can retry after setting a reachable API base and key."
          }
        ]);
        setAssistantMeta({
          provider: "Unavailable",
          model: "n/a",
          warning: "The live assistant route was unreachable."
        });
        setAssistantStatus("error");
      });
    }
  }

  function handleAssistantSubmit(event) {
    event.preventDefault();
    submitAssistantPrompt();
  }

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">EA</div>
          <div>
            <p>Enterprise AI Operations Copilot</p>
            <span>Operator workspace for incidents, guidance, and stakeholder updates</span>
          </div>
        </div>
        <div className="topbar-actions">
          <button className="ghost-button" type="button" onClick={() => setConfigOpen((current) => !current)}>
            Model routing
          </button>
          <div className={`status-pill ${statusTone}`}>{liveBadge}</div>
        </div>
      </header>

      <section className="hero-grid">
        <div className="hero-copy">
          <p className="eyebrow">AI workspace for enterprise response teams</p>
          <h1>Make the first fifteen minutes of every incident feel sharp and calm.</h1>
          <p className="hero-text">
            Intake the issue, generate a triage path, pull relevant runbooks, and collaborate with a model-backed
            copilot from one clean command surface.
          </p>
          <div className="hero-actions">
            <button className="primary-button" type="button" onClick={() => submitAssistantPrompt(QUICK_PROMPTS[0])}>
              Ask for an incident summary
            </button>
            <button className="ghost-button" type="button" onClick={applyApiBase}>
              Refresh backend route
            </button>
          </div>
          <div className="hero-metrics">
            <MetricTile label="Guided steps" value={actionCount} hint="Action plan items ready" />
            <MetricTile label="Runbooks" value={runbookCount} hint="Context retrieved for this case" />
            <MetricTile label="Owners" value={currentTriageContext.likely_owners.length} hint="Teams likely to engage" />
          </div>
        </div>

        <div className="signal-board">
          <div className="signal-head">
            <div>
              <p className="eyebrow">Live response fabric</p>
              <h2>{selectedIncident.title}</h2>
            </div>
            <span className={severityClass(activeTriage.severity)}>{activeTriage.severity}</span>
          </div>
          <div className="signal-mesh" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <div className="activity-stack">
            <ActivityRow label="Affected capability" value={activeTriage.enriched_context.affected_capability} meta="Current blast surface" />
            <ActivityRow label="Blast radius" value={activeTriage.enriched_context.blast_radius} meta="Propagation watch" />
            <ActivityRow label="Response mode" value={triageMode === "live" ? "Workflow + live context" : "Interview-safe demo"} meta="Fallback-aware behavior" />
            <ActivityRow label="Model route" value={assistantConfig.model || "demo-fallback"} meta={assistantConfig.providerLabel} />
          </div>
        </div>
      </section>

      <section className="workspace-grid">
        <div className="panel panel-compose">
          <div className="section-head">
            <div>
              <p className="eyebrow">Incident intake</p>
              <h3>Compose the operational record</h3>
            </div>
            <div className="micro-state">
              <span>Storage</span>
              <strong>{health?.backend_summary?.storage || "memory"}</strong>
            </div>
          </div>

          <form className="incident-form" onSubmit={handleTriageSubmit}>
            <label>
              <span>Title</span>
              <input name="title" value={form.title} onChange={updateForm} />
            </label>
            <label className="full-width">
              <span>Description</span>
              <textarea name="description" value={form.description} onChange={updateForm} rows={5} />
            </label>
            <div className="form-grid">
              <label>
                <span>Service</span>
                <input name="service_name" value={form.service_name} onChange={updateForm} />
              </label>
              <label>
                <span>Environment</span>
                <input name="environment" value={form.environment} onChange={updateForm} />
              </label>
              <label>
                <span>Reporter</span>
                <input name="reporter" value={form.reporter} onChange={updateForm} />
              </label>
              <label>
                <span>Severity</span>
                <select name="severity" value={form.severity} onChange={updateForm}>
                  <option value="SEV1">SEV1</option>
                  <option value="SEV2">SEV2</option>
                  <option value="SEV3">SEV3</option>
                </select>
              </label>
            </div>
            <label className="full-width">
              <span>Impact summary</span>
              <textarea name="impact_summary" value={form.impact_summary} onChange={updateForm} rows={3} />
            </label>
            <div className="form-grid">
              <label>
                <span>Affected regions</span>
                <input name="affected_regions" value={form.affected_regions} onChange={updateForm} />
              </label>
              <label>
                <span>Tags</span>
                <input name="tags" value={form.tags} onChange={updateForm} />
              </label>
            </div>
            <div className="compose-actions">
              <button className="primary-button" type="submit">
                Run AI triage
              </button>
              <div className="helper-note">
                <strong>{triageMode === "live" ? "Live triage completed" : "Ready for demo flow"}</strong>
                <span>The workspace preserves a clean fallback if the API is offline.</span>
              </div>
            </div>
          </form>
        </div>

        <div className="panel panel-assistant">
          <div className="section-head">
            <div>
              <p className="eyebrow">Model-backed assistance</p>
              <h3>Work with the copilot in plain language</h3>
            </div>
            <div className="assistant-badge">
              <strong>{assistantMeta.provider}</strong>
              <span>{assistantMeta.model}</span>
            </div>
          </div>

          <div className="prompt-chips">
            {QUICK_PROMPTS.map((prompt) => (
              <button key={prompt} type="button" className="chip" onClick={() => submitAssistantPrompt(prompt)}>
                {prompt}
              </button>
            ))}
          </div>

          <div className="chat-surface">
            {assistantMessages.map((message, index) => (
              <MessageBubble key={`${message.role}-${index}`} role={message.role} content={message.content} />
            ))}
          </div>

          <form className="assistant-form" onSubmit={handleAssistantSubmit}>
            <textarea
              value={assistantInput}
              onChange={(event) => setAssistantInput(event.target.value)}
              placeholder="Ask for rollback guidance, customer messaging, owner alignment, or the next best checkpoint."
              rows={3}
            />
            <div className="assistant-footer">
              <div className="assistant-state">
                <strong>
                  {assistantStatus === "loading"
                    ? "Thinking"
                    : assistantStatus === "live"
                      ? "Live model response"
                      : assistantStatus === "error"
                        ? "Model route unavailable"
                        : "Ready"}
                </strong>
                <span>{assistantMeta.warning || "Works with any OpenAI-compatible endpoint, including OpenAI, OpenRouter, and local gateways."}</span>
              </div>
              <button className="primary-button" type="submit">
                Send prompt
              </button>
            </div>
          </form>
        </div>
      </section>

      <section className="detail-grid">
        <div className="panel panel-dark">
          <div className="section-head">
            <div>
              <p className="eyebrow">Guided response</p>
              <h3>Action plan and owners</h3>
            </div>
            <div className="micro-state">
              <span>Likely owners</span>
              <strong>{currentTriageContext.likely_owners.join(", ")}</strong>
            </div>
          </div>
          <div className="two-column-list">
            <div>
              <h4>Action plan</h4>
              <ol className="ordered-list">
                {activeTriage.action_plan.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ol>
            </div>
            <div>
              <h4>Stakeholder line</h4>
              <p className="standout-copy">{activeTriage.leadership_update}</p>
              <div className="tag-row">
                {activeTriage.enriched_context.dependencies.map((dependency) => (
                  <span key={dependency.dependency_name} className="dependency-tag">
                    {dependency.dependency_name} · {dependency.criticality}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="section-head">
            <div>
              <p className="eyebrow">Knowledge retrieval</p>
              <h3>Runbooks in view</h3>
            </div>
            <div className="micro-state">
              <span>Runbook backend</span>
              <strong>{health?.backend_summary?.runbooks || "fixtures"}</strong>
            </div>
          </div>
          <div className="runbook-list">
            {activeTriage.runbooks.map((runbook) => (
              <article key={runbook.runbook_id} className="runbook-card">
                <strong>{runbook.title}</strong>
                <span>{runbook.summary}</span>
                <ul>
                  {runbook.immediate_actions.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="section-head">
            <div>
              <p className="eyebrow">Communications</p>
              <h3>Stakeholder updates</h3>
            </div>
            <div className="micro-state">
              <span>Escalations</span>
              <strong>{activeTriage.escalation_targets.join(", ")}</strong>
            </div>
          </div>
          <div className="update-list">
            {activeTriage.stakeholder_updates.map((update) => (
              <article key={`${update.audience}-${update.title}`} className="update-card">
                <span>{update.audience}</span>
                <strong>{update.title}</strong>
                <p>{update.body}</p>
              </article>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="section-head">
            <div>
              <p className="eyebrow">Activity log</p>
              <h3>Incident memory</h3>
            </div>
            <div className="micro-state">
              <span>Selected</span>
              <strong>{selectedIncident.severity}</strong>
            </div>
          </div>
          <div className="search-row">
            <input
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Search incident history"
            />
          </div>
          <div className="incident-list">
            {(filteredIncidents.length ? filteredIncidents : [demoIncident]).map((incident) => (
              <button
                key={incident.incident_id}
                type="button"
                className={`incident-row ${incident.incident_id === selectedIncidentId ? "incident-active" : ""}`}
                onClick={() => setSelectedIncidentId(incident.incident_id)}
              >
                <div>
                  <strong>{incident.title}</strong>
                  <span>{incident.service_name}</span>
                </div>
                <small>{formatTime(incident.created_at)}</small>
              </button>
            ))}
          </div>
          <div className="timeline-list">
            {(timeline.length ? timeline : []).map((item, index) => (
              <article key={`${item.event_type}-${index}`} className="timeline-row">
                <div className="timeline-dot" />
                <div>
                  <strong>{item.actor}</strong>
                  <p>{item.summary}</p>
                  <span>{formatTime(item.created_at)}</span>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {configOpen ? (
        <aside className="config-drawer">
          <div className="drawer-head">
            <div>
              <p className="eyebrow">Model routing</p>
              <h3>Connect any compatible assistant endpoint</h3>
            </div>
            <button type="button" className="ghost-button" onClick={() => setConfigOpen(false)}>
              Close
            </button>
          </div>
          <div className="drawer-grid">
            <label>
              <span>API base</span>
              <input value={apiBaseInput} onChange={(event) => setApiBaseInput(event.target.value)} placeholder="http://localhost:8000" />
            </label>
            <label>
              <span>Provider label</span>
              <input name="providerLabel" value={assistantConfig.providerLabel} onChange={updateAssistantConfig} placeholder="OpenRouter" />
            </label>
            <label>
              <span>Model endpoint</span>
              <input name="apiBaseUrl" value={assistantConfig.apiBaseUrl} onChange={updateAssistantConfig} placeholder="https://openrouter.ai/api/v1" />
            </label>
            <label>
              <span>Model name</span>
              <input name="model" value={assistantConfig.model} onChange={updateAssistantConfig} placeholder="openai/gpt-4.1-mini" />
            </label>
            <label className="full-width">
              <span>API key</span>
              <input name="apiKey" value={assistantConfig.apiKey} onChange={updateAssistantConfig} placeholder="sk-..." type="password" />
            </label>
            <label className="full-width">
              <span>System prompt</span>
              <textarea name="systemPrompt" value={assistantConfig.systemPrompt} onChange={updateAssistantConfig} rows={4} />
            </label>
            <label>
              <span>Temperature</span>
              <input name="temperature" value={assistantConfig.temperature} onChange={updateAssistantConfig} />
            </label>
            <label>
              <span>Max tokens</span>
              <input name="maxTokens" value={assistantConfig.maxTokens} onChange={updateAssistantConfig} />
            </label>
          </div>
          <div className="drawer-actions">
            <button className="primary-button" type="button" onClick={applyApiBase}>
              Save routing
            </button>
            <span>Typical values: OpenAI, OpenRouter, or a local `v1` gateway such as Ollama.</span>
          </div>
        </aside>
      ) : null}
    </div>
  );
}

export default App;
