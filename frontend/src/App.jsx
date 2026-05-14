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

const STACK_BADGES = [
  "AI Guidance",
  "Issue Resolution",
  "Stakeholder Updates",
  "Enterprise Memory",
  "Team Handoffs",
  "Decision Support"
];

const QUICK_PROMPTS = [
  {
    id: "payments",
    label: "Checkout issue",
    form: {
      title: "Customers cannot complete checkout",
      description:
        "Enterprise customers say checkout is failing during payment confirmation. Teams need quick guidance and an update for leadership.",
      service_name: "payments",
      environment: "production",
      reporter: "customer success",
      severity: "SEV2",
      impact_summary: "Revenue-impacting checkout failures are affecting active customers.",
      affected_regions: "US, Europe",
      tags: "checkout, payments, customer-impact"
    }
  },
  {
    id: "support",
    label: "Support spike",
    form: {
      title: "Support team is seeing a sudden spike in complaints",
      description:
        "Customer support is overwhelmed by repeated complaints after a release. The team needs AI help to understand the likely issue and draft a response.",
      service_name: "customer support",
      environment: "production",
      reporter: "support lead",
      severity: "SEV3",
      impact_summary: "Support queues are growing and response times are slipping.",
      affected_regions: "Global",
      tags: "support, complaints, release"
    }
  },
  {
    id: "internal",
    label: "Internal system issue",
    form: {
      title: "Internal finance dashboard is not loading",
      description:
        "Internal stakeholders cannot access a business-critical dashboard and need quick guidance, ownership suggestions, and a clean status message.",
      service_name: "finance dashboard",
      environment: "production",
      reporter: "finance ops",
      severity: "SEV2",
      impact_summary: "Business teams cannot access a core internal reporting system.",
      affected_regions: "HQ, Remote teams",
      tags: "internal-tool, dashboard, finance"
    }
  }
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

function HeroStat({ label, value }) {
  return (
    <article className="hero-stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function FeatureCard({ eyebrow, title, text }) {
  return (
    <article className="feature-card">
      <p className="mini-label">{eyebrow}</p>
      <h3>{title}</h3>
      <p>{text}</p>
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
  const [copiedKey, setCopiedKey] = useState("");

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

  function applyQuickPrompt(prompt) {
    setForm(prompt.form);
    document.getElementById("workspace")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function scrollToWorkspace() {
    document.getElementById("workspace")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function handleCopy(text) {
    if (!text) {
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(text);
      window.setTimeout(() => setCopiedKey(""), 1800);
    } catch {}
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
    <div className="page-shell">
      <header className="site-header">
        <div className="brand-row">
          <div className="brand-mark">
            <span />
            <span />
            <span />
          </div>
          <div>
            <p className="mini-label">AI-Assisted Enterprise Response System</p>
            <strong>Enterprise AI Operations Copilot</strong>
          </div>
        </div>

        <nav className="site-nav">
          <a href="#platform">Platform</a>
          <a href="#workspace">Workspace</a>
          <a href="#memory">Memory</a>
        </nav>

        <div className="header-actions">
          <span className={`status-pill ${liveMode ? "status-live" : "status-demo"}`}>
            {liveMode ? "Live backend" : "Demo mode"}
          </span>
          <button className="secondary-button" onClick={scrollToWorkspace} type="button">
            Open Workspace
          </button>
        </div>
      </header>

      <main className="page-main">
        <section className="hero-section">
          <div className="hero-copy">
            <p className="mini-label">The AI guidance platform for enterprise teams</p>
            <h1>Tell the AI what is going wrong and get clear guidance your team can actually use.</h1>
            <p className="hero-text">
              This is an end-user AI tool for enterprise problems. A user can describe an issue in plain
              language, get AI-assisted guidance, see likely owners and next steps, and instantly prepare
              updates for leaders, support teams, or other stakeholders.
            </p>

            <div className="hero-actions">
              <button className="primary-button" onClick={scrollToWorkspace} type="button">
                Ask The AI
              </button>
              <button className="secondary-button" onClick={applyApiBase} type="button">
                Refresh Connection
              </button>
            </div>

            <div className="prompt-strip">
              {QUICK_PROMPTS.map((prompt) => (
                <button
                  key={prompt.id}
                  className="prompt-pill"
                  onClick={() => applyQuickPrompt(prompt)}
                  type="button"
                >
                  {prompt.label}
                </button>
              ))}
            </div>

            <div className="hero-stats">
              <HeroStat label="Issues tracked" value={recentIncidents.length} />
              <HeroStat label="Teams suggested" value={likelyOwners.length || "0"} />
              <HeroStat label="Updates drafted" value={stakeholderUpdates.length || "0"} />
              <HeroStat label="AI mode" value={liveMode ? "Connected" : "Demo"} />
            </div>
          </div>

          <div className="hero-preview">
            <div className="preview-window">
              <div className="preview-topbar">
                <span>app.enterprise-ai.internal</span>
                <strong>{health?.backend_summary?.storage || "demo"} stack</strong>
              </div>

              <div className="preview-grid">
                <div className="preview-panel preview-panel-main">
                  <p className="mini-label">AI Help Summary</p>
                  <h3>{activeResult.incident_summary}</h3>
                  <div className="preview-tags">
                    {dependencies.slice(0, 3).map((item) => (
                      <span key={`${item.dependency_name}-${item.criticality}`}>
                        {item.dependency_name} • {item.criticality}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="preview-panel">
                  <p className="mini-label">Suggested teams</p>
                  <ul className="clean-list">
                    {likelyOwners.map((owner) => (
                      <li key={owner}>{owner}</li>
                    ))}
                  </ul>
                </div>

                <div className="preview-panel">
                  <p className="mini-label">Ready-to-share update</p>
                  <p>{activeResult.leadership_update}</p>
                </div>

                <div className="preview-panel">
                  <p className="mini-label">Response timeline</p>
                  <div className="mini-timeline">
                    {timeline.slice(0, 3).map((item, index) => (
                      <div className="mini-timeline-item" key={`${item.event_type}-${index}`}>
                        <strong>{item.event_type}</strong>
                        <span>{item.actor}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="stack-strip">
          {STACK_BADGES.map((badge) => (
            <span key={badge} className="stack-badge">
              {badge}
            </span>
          ))}
        </section>

        <section id="platform" className="feature-section">
          <FeatureCard
            eyebrow="Easy Input"
            title="Users can describe problems in plain language."
            text="The product is designed for normal enterprise users, not just technical operators, so people can explain issues without special training."
          />
          <FeatureCard
            eyebrow="AI Guidance"
            title="The AI turns that input into clear next steps."
            text="Instead of giving vague answers, the system suggests what to do next, who should be involved, and how the issue should be communicated."
          />
          <FeatureCard
            eyebrow="Stakeholder Help"
            title="Stakeholder-facing updates are ready in seconds."
            text="Business teams, support leads, and managers can quickly turn AI output into updates they can share across the company."
          />
        </section>

        <section id="workspace" className="workspace-section">
          <div className="section-heading">
            <div>
              <p className="mini-label">Workspace</p>
              <h2>One workspace for incident brief, AI analysis, and action output.</h2>
            </div>
            <div className="connection-card">
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
            </div>
          </div>

          <div className="workspace-panels">
            <section className="surface-card">
              <div className="surface-header">
                <div>
                  <p className="mini-label">Step 01</p>
                  <h3>Tell The AI What Happened</h3>
                </div>
                <button className="secondary-button" onClick={() => setForm(buildInitialForm())} type="button">
                  Use Sample
                </button>
              </div>

              <form className="incident-form" onSubmit={handleTriageSubmit}>
                <div className="field-grid">
                  <label className="field-stack">
                    <span>Short title</span>
                    <input name="title" value={form.title} onChange={updateForm} required />
                  </label>
                  <label className="field-stack">
                    <span>Product, team, or system</span>
                    <input name="service_name" value={form.service_name} onChange={updateForm} required />
                  </label>
                  <label className="field-stack">
                    <span>Where is this happening?</span>
                    <input name="environment" value={form.environment} onChange={updateForm} required />
                  </label>
                  <label className="field-stack">
                    <span>Who reported it?</span>
                    <input name="reporter" value={form.reporter} onChange={updateForm} required />
                  </label>
                  <label className="field-stack">
                    <span>How serious does it feel?</span>
                    <select name="severity" value={form.severity} onChange={updateForm}>
                      <option value="SEV1">SEV1</option>
                      <option value="SEV2">SEV2</option>
                      <option value="SEV3">SEV3</option>
                      <option value="SEV4">SEV4</option>
                    </select>
                  </label>
                  <label className="field-stack">
                    <span>Who or what is affected?</span>
                    <input name="affected_regions" value={form.affected_regions} onChange={updateForm} required />
                  </label>
                </div>

                <label className="field-stack">
                  <span>What is the business impact?</span>
                  <textarea
                    name="impact_summary"
                    rows="3"
                    value={form.impact_summary}
                    onChange={updateForm}
                    required
                  />
                </label>

                <label className="field-stack">
                  <span>Describe the problem in plain language</span>
                  <textarea
                    name="description"
                    rows="4"
                    value={form.description}
                    onChange={updateForm}
                    required
                  />
                </label>

                <label className="field-stack">
                  <span>Keywords</span>
                  <input name="tags" value={form.tags} onChange={updateForm} required />
                </label>

                <div className="button-row">
                  <button className="primary-button" type="submit">
                    Get AI Guidance
                  </button>
                  <div className="run-state">
                    <span>Status</span>
                    <strong>{triageMode === "waiting" ? "Ready" : `${triageMode.toUpperCase()} result`}</strong>
                  </div>
                </div>
              </form>
            </section>

            <section className="surface-card surface-highlight">
              <div className="surface-header">
                <div>
                  <p className="mini-label">Step 02</p>
                  <h3>AI Guidance</h3>
                </div>
                <span className={`status-pill ${liveMode ? "status-live" : "status-demo"}`}>
                  {liveMode ? "Live backend" : "Demo mode"}
                </span>
              </div>

              <article className="analysis-card analysis-hero">
                <p className="mini-label">AI Summary</p>
                <div className="analysis-headline">
                  <span className={severityClass(activeResult.severity)}>{activeResult.severity}</span>
                  <h4>{activeResult.incident_summary}</h4>
                </div>
              </article>

              <div className="analysis-grid">
                <article className="analysis-card">
                  <p className="mini-label">What the AI thinks is affected</p>
                  <h4>{activeResult.enriched_context?.affected_capability}</h4>
                  <p>{activeResult.enriched_context?.blast_radius}</p>
                </article>

                <article className="analysis-card">
                  <p className="mini-label">Who the AI suggests involving</p>
                  <ul className="clean-list">
                    {likelyOwners.map((owner) => (
                      <li key={owner}>{owner}</li>
                    ))}
                  </ul>
                </article>
              </div>

              <article className="analysis-card">
                <p className="mini-label">Recommended next steps</p>
                <ul className="clean-list">
                  {activeResult.action_plan?.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>

              <article className="analysis-card">
                <p className="mini-label">Related systems and dependencies</p>
                <div className="dependency-tags">
                  {dependencies.map((dependency) => (
                    <span key={`${dependency.dependency_name}-${dependency.criticality}`} className="dependency-tag">
                      {dependency.dependency_name} • {dependency.criticality}
                    </span>
                  ))}
                </div>
              </article>
            </section>

            <section className="surface-card">
              <div className="surface-header">
                <div>
                  <p className="mini-label">Step 03</p>
                  <h3>Share And Follow Up</h3>
                </div>
              </div>

              <article className="analysis-card">
                <p className="mini-label">Executive-ready update</p>
                <p>{activeResult.leadership_update}</p>
                <button
                  className="secondary-button button-inline"
                  onClick={() => handleCopy(activeResult.leadership_update)}
                  type="button"
                >
                  {copiedKey === activeResult.leadership_update ? "Copied" : "Copy update"}
                </button>
              </article>

              <article className="analysis-card">
                <p className="mini-label">Ready-to-share drafts</p>
                <div className="stack-tight">
                  {stakeholderUpdates.map((update) => (
                    <div className="message-card" key={`${update.audience}-${update.delivery_channel}`}>
                      <strong>
                        {update.audience} • {update.delivery_channel}
                      </strong>
                      <p>{update.title}</p>
                      <p>{update.body}</p>
                      <button
                        className="secondary-button button-inline"
                        onClick={() => handleCopy(`${update.title}\n\n${update.body}`)}
                        type="button"
                      >
                        {copiedKey === `${update.title}\n\n${update.body}` ? "Copied" : "Copy draft"}
                      </button>
                    </div>
                  ))}
                </div>
              </article>

              <article className="analysis-card">
                <p className="mini-label">Helpful guidance the AI used</p>
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
            </section>
          </div>
        </section>

        <section id="memory" className="memory-section">
          <div className="memory-column">
            <div className="section-heading compact">
              <div>
                <p className="mini-label">Incident Memory</p>
                <h2>Review recent incidents and live response activity.</h2>
              </div>
            </div>

            <label className="field-stack search-field">
              <span>Search incidents</span>
              <input
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="Search title, service, severity, or reporter"
              />
            </label>

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
                    <span className={severityClass(incident.severity)}>{incident.severity}</span> {incident.service_name}
                  </span>
                  <span>{formatTime(incident.created_at)}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="memory-column">
            <article className="surface-card">
              <div className="surface-header">
                <div>
                  <p className="mini-label">Selected issue</p>
                  <h3>{selectedIncident.title}</h3>
                </div>
              </div>

              <p className="support-copy">{selectedIncident.description || selectedIncident.impact_summary}</p>

              <div className="detail-pairs">
                <div>
                  <span>Reported by</span>
                  <strong>{selectedIncident.reporter}</strong>
                </div>
                <div>
                  <span>Tracking key</span>
                  <strong>{selectedIncident.dedupe_key}</strong>
                </div>
              </div>
            </article>

            <article className="surface-card">
              <div className="surface-header">
                <div>
                  <p className="mini-label">Timeline</p>
                  <h3>What happened next</h3>
                </div>
              </div>

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
        </section>
      </main>
    </div>
  );
}

export default App;
