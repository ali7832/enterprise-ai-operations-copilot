import React, { startTransition, useDeferredValue, useEffect, useMemo, useState } from "react";
import {
  demoIncident,
  demoSnapshot,
  demoTriage,
  getApiBase,
  loadHealth,
  loadIncidents,
  loadTimeline,
  runTriage,
  searchRunbooks,
  setApiBase
} from "./api";
import { demoPayload } from "./demoData";

const NAV_ITEMS = [
  { id: "overview", label: "Overview" },
  { id: "triage", label: "Live Triage" },
  { id: "incidents", label: "Incident Registry" },
  { id: "runbooks", label: "Runbook Intel" }
];

const VIEW_TITLES = {
  overview: "Operations Overview",
  triage: "Live Triage Workspace",
  incidents: "Incident Registry",
  runbooks: "Runbook Intelligence"
};

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

function StatCard({ label, value }) {
  return (
    <article className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function App() {
  const [activeView, setActiveView] = useState("overview");
  const [apiBase, setApiBaseState] = useState(getApiBase());
  const [apiBaseInput, setApiBaseInput] = useState(getApiBase());
  const [liveMode, setLiveMode] = useState(false);
  const [health, setHealth] = useState(null);
  const [incidents, setIncidents] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [runbooks, setRunbooks] = useState([]);
  const [selectedIncidentId, setSelectedIncidentId] = useState(null);
  const [triageResult, setTriageResult] = useState(null);
  const [triageMode, setTriageMode] = useState("waiting");
  const [form, setForm] = useState(buildInitialForm);
  const [searchText, setSearchText] = useState("");
  const [runbookQuery, setRunbookQuery] = useState({ service_name: "payments-api", severity: "SEV2" });
  const deferredSearch = useDeferredValue(searchText);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      try {
        const nextHealth = await loadHealth();
        const nextIncidents = await loadIncidents();
        const nextTimeline = await loadTimeline(nextIncidents[0]?.incident_id);
        const nextRunbooks = await searchRunbooks("payments-api", "SEV2");

        if (cancelled) {
          return;
        }

        startTransition(() => {
          setLiveMode(true);
          setHealth(nextHealth);
          setIncidents(nextIncidents);
          setSelectedIncidentId(nextIncidents[0]?.incident_id || null);
          setTimeline(nextTimeline);
          setRunbooks(nextRunbooks);
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
          setRunbooks(snapshot.runbooks);
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
    const query = deferredSearch.trim().toLowerCase();
    if (!query) {
      return incidents;
    }
    return incidents.filter((incident) => {
      const haystack = [
        incident.title,
        incident.service_name,
        incident.severity,
        incident.reporter,
        incident.impact_summary
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [deferredSearch, incidents]);

  const selectedIncident =
    incidents.find((incident) => incident.incident_id === selectedIncidentId) || incidents[0] || demoIncident;

  const metrics = {
    backend: liveMode ? "Connected" : "Demo fallback",
    incidents: filteredIncidents.length,
    runbooks: runbooks.length,
    backendCombo: `${health?.backend_summary?.storage || "demo"} / ${health?.backend_summary?.cache || "disabled"}`
  };

  function refreshAll() {
    const nextBase = apiBaseInput.trim();
    setApiBase(nextBase);
    setApiBaseState(nextBase);
  }

  function updateForm(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
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

  async function handleRunbookSearch(event) {
    event.preventDefault();
    try {
      const items = await searchRunbooks(runbookQuery.service_name, runbookQuery.severity);
      setRunbooks(items);
    } catch {
      setRunbooks(demoTriage.runbooks);
    }
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-mark">
            <span />
            <span />
            <span />
          </div>
          <div>
            <p className="eyebrow">Zones Program</p>
            <h1>Enterprise AI Operations Copilot</h1>
          </div>
        </div>

        <nav className="nav-cluster" aria-label="Primary">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              className={`nav-link ${activeView === item.id ? "active" : ""}`}
              onClick={() => setActiveView(item.id)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </nav>

        <section className="sidebar-section">
          <p className="section-label">Runtime</p>
          <div className="status-stack">
            <div className="status-item"><span>Status</span><strong>{liveMode ? "Live API" : "Demo mode"}</strong></div>
            <div className="status-item"><span>Storage</span><strong>{health?.backend_summary?.storage || "demo"}</strong></div>
            <div className="status-item"><span>Runbooks</span><strong>{health?.backend_summary?.runbooks || "fixtures"}</strong></div>
            <div className="status-item"><span>Cache</span><strong>{health?.backend_summary?.cache || "disabled"}</strong></div>
          </div>
        </section>

        <section className="sidebar-section">
          <p className="section-label">Signal</p>
          <div className="signal-tower">
            <div className="signal-band"><span>Queue Pressure</span><strong>{String(filteredIncidents.length).padStart(2, "0")}</strong></div>
            <div className="signal-band"><span>Escalations</span><strong>{String((triageResult?.escalation_targets || []).length).padStart(2, "0")}</strong></div>
            <div className="signal-band"><span>Operator Mode</span><strong>{liveMode ? "LIVE" : "DEMO"}</strong></div>
          </div>
        </section>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div className="topbar-copy">
            <p className="eyebrow">Command Surface</p>
            <h2>{VIEW_TITLES[activeView]}</h2>
          </div>
          <div className="topbar-actions">
            <label className="endpoint-switch">
              <span>API Base</span>
              <input
                type="text"
                value={apiBaseInput}
                onChange={(event) => setApiBaseInput(event.target.value)}
                placeholder="Leave blank to use the Vite proxy"
              />
            </label>
            <button className="utility-button" onClick={refreshAll} type="button">Refresh Surface</button>
          </div>
        </header>

        <section className="hero-grid">
          <div className="hero-copy">
            <p className="eyebrow">Incident Intelligence</p>
            <h3>A command-grade UI for triage, escalation, and stakeholder coordination.</h3>
            <p className="hero-text">
              This frontend turns the working backend into a real enterprise surface. It is built for
              operators who need signal density, fast actions, and an interface that feels like an internal
              product, not a demo page.
            </p>
          </div>
          <div className="hero-visual">
            <div className="orbital-frame">
              <div className="scan-ring scan-ring-one" />
              <div className="scan-ring scan-ring-two" />
              <div className="scan-sweep" />
              <div className="radar-core"><span>Ops</span></div>
              <div className="beacon beacon-a" />
              <div className="beacon beacon-b" />
              <div className="beacon beacon-c" />
            </div>
          </div>
        </section>

        <section className="metrics-band">
          <StatCard label="Backend State" value={metrics.backend} />
          <StatCard label="Tracked Incidents" value={metrics.incidents} />
          <StatCard label="Runbook Matches" value={metrics.runbooks} />
          <StatCard label="Cache / Storage" value={metrics.backendCombo} />
        </section>

        {activeView === "overview" && (
          <section className="view">
            <div className="three-column">
              <section className="panel panel-emphasis">
                <div className="panel-heading">
                  <div>
                    <p className="section-label">Current Situation</p>
                    <h3>Operational loadout</h3>
                  </div>
                  <span className="panel-chip">{liveMode ? "Healthy" : "Fallback"}</span>
                </div>
                <div className="situation-grid">
                  <div className="situation-block"><span>Environment</span><strong>{health?.environment || "demo"}</strong></div>
                  <div className="situation-block"><span>LangGraph</span><strong>{health?.langgraph_enabled ? "Enabled" : "Deterministic"}</strong></div>
                  <div className="situation-block"><span>Storage</span><strong>{health?.backend_summary?.storage || "demo"}</strong></div>
                  <div className="situation-block"><span>Runbooks</span><strong>{health?.backend_summary?.runbooks || "fixtures"}</strong></div>
                </div>
                <div className="dependency-canvas">
                  <div className="dependency-node center-node">Copilot</div>
                  <div className="dependency-node node-a">Runbooks</div>
                  <div className="dependency-node node-b">Timeline</div>
                  <div className="dependency-node node-c">Stakeholders</div>
                  <div className="dependency-node node-d">Metrics</div>
                </div>
              </section>

              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <p className="section-label">Recent Incidents</p>
                    <h3>Registry snapshot</h3>
                  </div>
                </div>
                <div className="list-stack">
                  {filteredIncidents.slice(0, 4).map((incident) => (
                    <div className="list-card" key={incident.incident_id}>
                      <strong>{incident.title}</strong>
                      <p><span className={severityClass(incident.severity)}>{incident.severity}</span> {incident.service_name} • {incident.environment}</p>
                      <p>{incident.impact_summary}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <p className="section-label">Timeline Pulse</p>
                    <h3>Live response rhythm</h3>
                  </div>
                </div>
                <div className="timeline-stack">
                  {timeline.map((item, index) => (
                    <div className="timeline-item" key={`${item.event_type}-${index}`}>
                      <strong>{item.event_type}</strong>
                      <p>{item.summary || item.message}</p>
                      <p>{item.actor} • {formatTime(item.created_at)}</p>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </section>
        )}

        {activeView === "triage" && (
          <section className="view">
            <div className="two-column">
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <p className="section-label">Incident Intake</p>
                    <h3>Launch a triage run</h3>
                  </div>
                </div>
                <form className="triage-form" onSubmit={handleTriageSubmit}>
                  <div className="field-grid">
                    <label><span>Title</span><input name="title" value={form.title} onChange={updateForm} required /></label>
                    <label><span>Service Name</span><input name="service_name" value={form.service_name} onChange={updateForm} required /></label>
                    <label><span>Environment</span><input name="environment" value={form.environment} onChange={updateForm} required /></label>
                    <label><span>Reporter</span><input name="reporter" value={form.reporter} onChange={updateForm} required /></label>
                    <label>
                      <span>Severity</span>
                      <select name="severity" value={form.severity} onChange={updateForm}>
                        <option value="SEV1">SEV1</option>
                        <option value="SEV2">SEV2</option>
                        <option value="SEV3">SEV3</option>
                        <option value="SEV4">SEV4</option>
                      </select>
                    </label>
                    <label><span>Regions</span><input name="affected_regions" value={form.affected_regions} onChange={updateForm} required /></label>
                  </div>
                  <label className="full-width"><span>Impact Summary</span><textarea name="impact_summary" rows="4" value={form.impact_summary} onChange={updateForm} required /></label>
                  <label className="full-width"><span>Description</span><textarea name="description" rows="5" value={form.description} onChange={updateForm} required /></label>
                  <label className="full-width"><span>Tags</span><input name="tags" value={form.tags} onChange={updateForm} required /></label>
                  <div className="form-actions">
                    <button className="primary-button" type="submit">Run Copilot Triage</button>
                    <button className="utility-button" onClick={() => setForm(buildInitialForm())} type="button">Load Demo Pattern</button>
                  </div>
                </form>
              </section>

              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <p className="section-label">Copilot Output</p>
                    <h3>Triage intelligence</h3>
                  </div>
                  <span className="panel-chip">{triageMode === "waiting" ? "Waiting" : `${triageMode.toUpperCase()} result`}</span>
                </div>

                {!triageResult && <div className="empty-state">Run the copilot to generate an action plan, stakeholder updates, and dependency context.</div>}

                {triageResult && (
                  <div className="results-stack">
                    <div className="result-section">
                      <h4>Incident Summary</h4>
                      <p><span className={severityClass(triageResult.severity)}>{triageResult.severity}</span> {triageResult.incident_summary}</p>
                    </div>
                    <div className="result-grid">
                      <div className="result-section">
                        <h4>Action Plan</h4>
                        <ul>{triageResult.action_plan?.map((item) => <li key={item}>{item}</li>)}</ul>
                      </div>
                      <div className="result-section">
                        <h4>Escalation Targets</h4>
                        <ul>{triageResult.escalation_targets?.map((item) => <li key={item}>{item}</li>)}</ul>
                      </div>
                    </div>
                    <div className="result-grid">
                      <div className="result-section">
                        <h4>Enriched Context</h4>
                        <p><strong>Capability</strong><br />{triageResult.enriched_context?.affected_capability}</p>
                        <p><strong>Blast Radius</strong><br />{triageResult.enriched_context?.blast_radius}</p>
                        <p><strong>Likely Owners</strong><br />{triageResult.enriched_context?.likely_owners?.join(", ")}</p>
                      </div>
                      <div className="result-section">
                        <h4>Dependency Surface</h4>
                        <ul>
                          {triageResult.enriched_context?.dependencies?.map((item) => (
                            <li key={`${item.dependency_name}-${item.criticality}`}>{item.dependency_name} • {item.dependency_type} • {item.criticality}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                    <div className="result-section">
                      <h4>Leadership Update</h4>
                      <p>{triageResult.leadership_update}</p>
                    </div>
                    <div className="result-section">
                      <h4>Stakeholder Updates</h4>
                      {triageResult.stakeholder_updates?.map((update) => (
                        <div className="status-note" key={`${update.audience}-${update.delivery_channel}`}>
                          <strong>{update.audience} • {update.delivery_channel}</strong>
                          <p>{update.title}</p>
                          <p>{update.body}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            </div>
          </section>
        )}

        {activeView === "incidents" && (
          <section className="view">
            <div className="two-column">
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <p className="section-label">Incident Registry</p>
                    <h3>All tracked incidents</h3>
                  </div>
                </div>
                <div className="search-bar">
                  <input value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Search title, service, severity, or reporter" />
                </div>
                <div className="registry-table">
                  {filteredIncidents.map((incident) => (
                    <button
                      className={`row ${selectedIncidentId === incident.incident_id ? "active" : ""}`}
                      key={incident.incident_id}
                      onClick={() => setSelectedIncidentId(incident.incident_id)}
                      type="button"
                    >
                      <strong>{incident.title}</strong>
                      <span><span className={severityClass(incident.severity)}>{incident.severity}</span> {incident.service_name} • {incident.reporter}</span>
                      <span>{formatTime(incident.created_at)}</span>
                    </button>
                  ))}
                </div>
              </section>

              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <p className="section-label">Focus Context</p>
                    <h3>Selected incident detail</h3>
                  </div>
                </div>
                <div className="inspector-panel">
                  <div className="result-section">
                    <h4>{selectedIncident.title}</h4>
                    <p><span className={severityClass(selectedIncident.severity)}>{selectedIncident.severity}</span> {selectedIncident.service_name} • {selectedIncident.environment}</p>
                    <p>{selectedIncident.description || selectedIncident.impact_summary}</p>
                    <p><strong>Reporter</strong><br />{selectedIncident.reporter}</p>
                    <p><strong>Dedupe Key</strong><br />{selectedIncident.dedupe_key}</p>
                    <p><strong>Regions</strong><br />{selectedIncident.affected_regions?.join(", ")}</p>
                    <p><strong>Tags</strong><br />{selectedIncident.tags?.join(", ")}</p>
                  </div>
                </div>
              </section>
            </div>
          </section>
        )}

        {activeView === "runbooks" && (
          <section className="view">
            <div className="two-column">
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <p className="section-label">Runbook Search</p>
                    <h3>Operational guidance retrieval</h3>
                  </div>
                </div>
                <form className="inline-form" onSubmit={handleRunbookSearch}>
                  <label>
                    <span>Service</span>
                    <input
                      value={runbookQuery.service_name}
                      onChange={(event) => setRunbookQuery((current) => ({ ...current, service_name: event.target.value }))}
                    />
                  </label>
                  <label>
                    <span>Severity</span>
                    <input
                      value={runbookQuery.severity}
                      onChange={(event) => setRunbookQuery((current) => ({ ...current, severity: event.target.value }))}
                    />
                  </label>
                  <button className="primary-button" type="submit">Search Runbooks</button>
                </form>
                <div className="results-stack">
                  {runbooks.map((runbook) => (
                    <div className="runbook-card" key={runbook.runbook_id}>
                      <strong>{runbook.title}</strong>
                      <p>{runbook.summary}</p>
                      <p><strong>Actions</strong><br />{runbook.immediate_actions?.join(" • ")}</p>
                      <p><strong>Escalations</strong><br />{runbook.escalation_targets?.join(", ")}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <p className="section-label">Operating Notes</p>
                    <h3>Why this frontend feels real</h3>
                  </div>
                </div>
                <div className="narrative-block">
                  <p>
                    This is designed like an internal command product: dense signal, quiet chrome, controlled
                    animation, and fast operator loops across triage, registry, and communications.
                  </p>
                  <p>
                    The app supports live API mode when your FastAPI backend is running and a demo fallback when
                    the API is unavailable, so it remains usable during interviews, product walkthroughs, and staged demos.
                  </p>
                </div>
              </section>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

export default App;
