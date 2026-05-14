import React, { startTransition, useEffect, useMemo, useState } from "react";
import {
  demoIncident,
  demoSnapshot,
  demoTriage,
  getApiBase,
  loadHealth,
  loadIncidents,
  loadTimeline,
  runTriage,
  setApiBase
} from "./api";
import { demoPayload } from "./demoData";

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
  return `severity-pill severity-${severity || "SEV2"}`;
}

function SummaryStat({ label, value, tone = "default" }) {
  return (
    <article className={`summary-stat summary-stat-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function App() {
  const [apiBase, setApiBaseState] = useState(getApiBase());
  const [apiBaseInput, setApiBaseInput] = useState(getApiBase());
  const [liveMode, setLiveMode] = useState(false);
  const [health, setHealth] = useState(null);
  const [incidents, setIncidents] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [selectedIncidentId, setSelectedIncidentId] = useState(null);
  const [triageResult, setTriageResult] = useState(null);
  const [triageMode, setTriageMode] = useState("waiting");
  const [form, setForm] = useState(buildInitialForm);
  const [searchText, setSearchText] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      try {
        const nextHealth = await loadHealth();
        const nextIncidents = await loadIncidents();
        const nextTimeline = await loadTimeline(nextIncidents[0]?.incident_id);

        if (cancelled) {
          return;
        }

        startTransition(() => {
          setLiveMode(true);
          setHealth(nextHealth);
          setIncidents(nextIncidents);
          setSelectedIncidentId(nextIncidents[0]?.incident_id || null);
          setTimeline(nextTimeline);
        });
      } catch {
        if (cancelled) {
          return;
        }
        const snapshot = demoSnapshot();
        startTransition(() => {
          setLiveMode(snapshot.liveMode);
          setHealth(snapshot.health);
          setIncidents(snapshot.incidents);
          setSelectedIncidentId(snapshot.incidents[0]?.incident_id || null);
          setTimeline(snapshot.timeline);
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

    async function hydrateTimeline() {
      if (!selectedIncidentId || !liveMode) {
        return;
      }

      try {
        const items = await loadTimeline(selectedIncidentId);
        if (!cancelled) {
          setTimeline(items);
        }
      } catch {
        if (!cancelled) {
          setTimeline(demoSnapshot().timeline);
        }
      }
    }

    hydrateTimeline();
    return () => {
      cancelled = true;
    };
  }, [selectedIncidentId, liveMode]);

  const filteredIncidents = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    if (!query) {
      return incidents;
    }

    return incidents.filter((incident) =>
      [incident.title, incident.service_name, incident.severity, incident.reporter, incident.impact_summary]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [incidents, searchText]);

  const selectedIncident =
    incidents.find((incident) => incident.incident_id === selectedIncidentId) || incidents[0] || demoIncident;

  const activeResult = triageResult || demoTriage;
  const likelyOwners = activeResult.enriched_context?.likely_owners || [];
  const dependencies = activeResult.enriched_context?.dependencies || [];
  const stakeholderUpdates = activeResult.stakeholder_updates || [];
  const recentIncidents = filteredIncidents.length ? filteredIncidents : [demoIncident];

  function updateForm(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
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
      startTransition(() => {
        setTriageResult(result);
        setTriageMode("live");
        setLiveMode(true);
        setIncidents((current) => [toIncidentFromPayload(form), ...current].slice(0, 12));
      });
    } catch {
      startTransition(() => {
        setTriageResult(demoTriage);
        setTriageMode("demo");
      });
    }
  }

  return (
    <div className="app-shell">
      <aside className="left-rail">
        <div className="product-lockup">
          <p className="mini-label">AI-Assisted Enterprise Response System</p>
          <h1>Enterprise AI Operations Copilot</h1>
          <p className="support-copy">
            A simpler operator workspace focused on what the AI actually does: summarize the issue,
            retrieve relevant guidance, suggest next steps, and draft communications.
          </p>
        </div>

        <section className="rail-section">
          <p className="mini-label">AI Role</p>
          <div className="capability-list">
            <div className="capability-item">
              <strong>1. Understand the incident</strong>
              <span>Turn raw input into a structured operational record.</span>
            </div>
            <div className="capability-item">
              <strong>2. Assist triage</strong>
              <span>Retrieve context, runbooks, dependencies, and likely owners.</span>
            </div>
            <div className="capability-item">
              <strong>3. Draft action output</strong>
              <span>Create next steps and stakeholder-ready updates for human review.</span>
            </div>
          </div>
        </section>

        <section className="rail-section">
          <p className="mini-label">System State</p>
          <div className="state-list">
            <div className="state-row">
              <span>Mode</span>
              <strong>{liveMode ? "Live API" : "Demo fallback"}</strong>
            </div>
            <div className="state-row">
              <span>Storage</span>
              <strong>{health?.backend_summary?.storage || "demo"}</strong>
            </div>
            <div className="state-row">
              <span>Runbooks</span>
              <strong>{health?.backend_summary?.runbooks || "fixtures"}</strong>
            </div>
            <div className="state-row">
              <span>Cache</span>
              <strong>{health?.backend_summary?.cache || "disabled"}</strong>
            </div>
          </div>
        </section>

        <section className="rail-section">
          <p className="mini-label">Connection</p>
          <label className="field-stack">
            <span>API Base</span>
            <input
              type="text"
              value={apiBaseInput}
              onChange={(event) => setApiBaseInput(event.target.value)}
              placeholder="Leave blank to use the Vite proxy"
            />
          </label>
          <button className="secondary-button" onClick={applyApiBase} type="button">
            Apply Connection
          </button>
        </section>
      </aside>

      <main className="main-workspace">
        <header className="top-frame">
          <div>
            <p className="mini-label">Guided Workflow</p>
            <h2>Input incident, review AI output, then take action.</h2>
          </div>
          <div className="workflow-steps">
            <div className="workflow-step active">Incident Brief</div>
            <div className="workflow-step active">AI Analysis</div>
            <div className="workflow-step active">Action Center</div>
          </div>
        </header>

        <section className="summary-band">
          <SummaryStat label="Backend" value={liveMode ? "Connected" : "Demo"} tone="accent" />
          <SummaryStat label="Tracked incidents" value={recentIncidents.length} />
          <SummaryStat
            label="Likely owners surfaced"
            value={likelyOwners.length || "0"}
            tone="cool"
          />
          <SummaryStat
            label="Stakeholder drafts"
            value={stakeholderUpdates.length || "0"}
            tone="warm"
          />
        </section>

        <section className="workspace-grid">
          <section className="surface surface-primary">
            <div className="surface-header">
              <div>
                <p className="mini-label">Step 1</p>
                <h3>Incident Brief</h3>
              </div>
              <button className="secondary-button" onClick={() => setForm(buildInitialForm())} type="button">
                Load Example
              </button>
            </div>

            <form className="incident-form" onSubmit={handleTriageSubmit}>
              <div className="field-grid">
                <label className="field-stack">
                  <span>Title</span>
                  <input name="title" value={form.title} onChange={updateForm} required />
                </label>
                <label className="field-stack">
                  <span>Service</span>
                  <input name="service_name" value={form.service_name} onChange={updateForm} required />
                </label>
                <label className="field-stack">
                  <span>Environment</span>
                  <input name="environment" value={form.environment} onChange={updateForm} required />
                </label>
                <label className="field-stack">
                  <span>Reporter</span>
                  <input name="reporter" value={form.reporter} onChange={updateForm} required />
                </label>
                <label className="field-stack">
                  <span>Severity</span>
                  <select name="severity" value={form.severity} onChange={updateForm}>
                    <option value="SEV1">SEV1</option>
                    <option value="SEV2">SEV2</option>
                    <option value="SEV3">SEV3</option>
                    <option value="SEV4">SEV4</option>
                  </select>
                </label>
                <label className="field-stack">
                  <span>Affected Regions</span>
                  <input name="affected_regions" value={form.affected_regions} onChange={updateForm} required />
                </label>
              </div>

              <label className="field-stack">
                <span>Impact Summary</span>
                <textarea
                  name="impact_summary"
                  rows="3"
                  value={form.impact_summary}
                  onChange={updateForm}
                  required
                />
              </label>

              <label className="field-stack">
                <span>Description</span>
                <textarea
                  name="description"
                  rows="4"
                  value={form.description}
                  onChange={updateForm}
                  required
                />
              </label>

              <label className="field-stack">
                <span>Tags</span>
                <input name="tags" value={form.tags} onChange={updateForm} required />
              </label>

              <div className="button-row">
                <button className="primary-button" type="submit">
                  Run AI Analysis
                </button>
                <div className="run-state">
                  <span>Status</span>
                  <strong>{triageMode === "waiting" ? "Ready" : `${triageMode.toUpperCase()} result`}</strong>
                </div>
              </div>
            </form>
          </section>

          <section className="surface surface-primary">
            <div className="surface-header">
              <div>
                <p className="mini-label">Step 2</p>
                <h3>AI Analysis</h3>
              </div>
              <span className={`mode-pill ${liveMode ? "mode-live" : "mode-demo"}`}>
                {liveMode ? "Live backend" : "Demo mode"}
              </span>
            </div>

            <div className="analysis-stack">
              <article className="analysis-card analysis-highlight">
                <p className="mini-label">AI Incident Summary</p>
                <div className="headline-row">
                  <span className={severityClass(activeResult.severity)}>{activeResult.severity}</span>
                  <strong>{activeResult.incident_summary}</strong>
                </div>
              </article>

              <div className="analysis-grid">
                <article className="analysis-card">
                  <p className="mini-label">AI Context</p>
                  <h4>{activeResult.enriched_context?.affected_capability}</h4>
                  <p>{activeResult.enriched_context?.blast_radius}</p>
                </article>
                <article className="analysis-card">
                  <p className="mini-label">Why AI surfaced these owners</p>
                  <ul className="clean-list">
                    {likelyOwners.map((owner) => (
                      <li key={owner}>{owner}</li>
                    ))}
                  </ul>
                </article>
              </div>

              <article className="analysis-card">
                <p className="mini-label">AI Suggested Next Steps</p>
                <ul className="clean-list">
                  {activeResult.action_plan?.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>

              <article className="analysis-card">
                <p className="mini-label">Retrieved Dependencies</p>
                <div className="dependency-tags">
                  {dependencies.map((dependency) => (
                    <span key={`${dependency.dependency_name}-${dependency.criticality}`} className="dependency-tag">
                      {dependency.dependency_name} • {dependency.criticality}
                    </span>
                  ))}
                </div>
              </article>
            </div>
          </section>
        </section>

        <section className="lower-grid">
          <section className="surface">
            <div className="surface-header">
              <div>
                <p className="mini-label">Step 3</p>
                <h3>Action Center</h3>
              </div>
            </div>

            <div className="action-grid">
              <article className="analysis-card">
                <p className="mini-label">Stakeholder Drafts</p>
                <div className="stack-tight">
                  {stakeholderUpdates.map((update) => (
                    <div className="message-card" key={`${update.audience}-${update.delivery_channel}`}>
                      <strong>
                        {update.audience} • {update.delivery_channel}
                      </strong>
                      <p>{update.title}</p>
                      <p>{update.body}</p>
                    </div>
                  ))}
                </div>
              </article>

              <article className="analysis-card">
                <p className="mini-label">Runbook Guidance</p>
                <div className="stack-tight">
                  {activeResult.runbooks?.map((runbook) => (
                    <div className="message-card" key={runbook.runbook_id}>
                      <strong>{runbook.title}</strong>
                      <p>{runbook.summary}</p>
                      <p>{runbook.immediate_actions?.join(" • ")}</p>
                    </div>
                  ))}
                </div>
              </article>
            </div>
          </section>

          <section className="surface">
            <div className="surface-header">
              <div>
                <p className="mini-label">Incident Memory</p>
                <h3>Recent incidents and activity</h3>
              </div>
            </div>

            <div className="field-stack search-field">
              <span>Search incidents</span>
              <input
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="Search title, service, severity, or reporter"
              />
            </div>

            <div className="incident-memory-grid">
              <div className="incident-list">
                {recentIncidents.map((incident) => (
                  <button
                    key={incident.incident_id}
                    className={`incident-item ${selectedIncidentId === incident.incident_id ? "selected" : ""}`}
                    onClick={() => setSelectedIncidentId(incident.incident_id)}
                    type="button"
                  >
                    <strong>{incident.title}</strong>
                    <span>
                      <span className={severityClass(incident.severity)}>{incident.severity}</span>{" "}
                      {incident.service_name}
                    </span>
                    <span>{formatTime(incident.created_at)}</span>
                  </button>
                ))}
              </div>

              <div className="detail-column">
                <article className="analysis-card">
                  <p className="mini-label">Selected incident</p>
                  <h4>{selectedIncident.title}</h4>
                  <p>{selectedIncident.description || selectedIncident.impact_summary}</p>
                  <div className="detail-pairs">
                    <div>
                      <span>Reporter</span>
                      <strong>{selectedIncident.reporter}</strong>
                    </div>
                    <div>
                      <span>Dedupe Key</span>
                      <strong>{selectedIncident.dedupe_key}</strong>
                    </div>
                  </div>
                </article>

                <article className="analysis-card">
                  <p className="mini-label">Response Timeline</p>
                  <div className="timeline-list">
                    {timeline.map((item, index) => (
                      <div className="timeline-item" key={`${item.event_type}-${index}`}>
                        <strong>{item.event_type}</strong>
                        <p>{item.summary || item.message}</p>
                        <span>
                          {item.actor} • {formatTime(item.created_at)}
                        </span>
                      </div>
                    ))}
                  </div>
                </article>
              </div>
            </div>
          </section>
        </section>
      </main>
    </div>
  );
}

export default App;
