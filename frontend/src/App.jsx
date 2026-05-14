import React, { startTransition, useEffect, useMemo, useState } from "react";
import {
  demoIncident,
  demoSnapshot,
  demoTriage,
  loadHealth,
  loadIncidents,
  loadTimeline,
  runAssistant,
  runTriage
} from "./api";

const QUICK_SCENARIOS = [
  {
    id: "checkout",
    label: "Checkout failure",
    problem:
      "Enterprise customers are reporting that checkout fails at payment confirmation after the latest release.",
    impact: "Revenue is at risk and support teams are receiving repeated complaints.",
    urgency: "SEV2"
  },
  {
    id: "support",
    label: "Support surge",
    problem:
      "Support volume jumped after a product update and agents do not yet know the likely root cause or what to tell customers.",
    impact: "Response times are slipping and escalation volume is climbing.",
    urgency: "SEV3"
  },
  {
    id: "internal",
    label: "Internal system outage",
    problem:
      "A finance operations dashboard is unavailable and internal teams cannot access business-critical reporting before a leadership review.",
    impact: "Decision-making is blocked for finance and operations stakeholders.",
    urgency: "SEV2"
  }
];

const VALUE_POINTS = [
  {
    title: "Faster clarity",
    text: "Turn a messy issue report into a structured view of what is happening, who is affected, and what should happen next."
  },
  {
    title: "Aligned response",
    text: "Give technical teams, operations leaders, and customer-facing teams one shared plan instead of disconnected updates."
  },
  {
    title: "Ready-to-share output",
    text: "Generate action steps, likely owners, customer-safe language, and executive-ready updates from the same workflow."
  }
];

const CAPABILITY_PILLARS = [
  {
    title: "Understand the issue",
    text: "The platform reads the situation, organizes the incident, and identifies the most likely problem area."
  },
  {
    title: "Guide the response",
    text: "It turns the issue into a visible action plan with likely owners, follow-up questions, and practical next steps."
  },
  {
    title: "Keep everyone aligned",
    text: "It prepares clear communication for leadership, operations, and customer-facing teams without making users rewrite everything."
  }
];

function buildInitialIssue() {
  return {
    problem:
      "Enterprise customers are reporting failed checkout attempts after a recent release. Teams need fast clarity and a response plan.",
    impact: "Revenue is at risk and support teams are escalating the issue to operations leadership.",
    urgency: "SEV2"
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
  return `severity-pill severity-${(severity || "SEV2").toLowerCase()}`;
}

function extractTitle(problem) {
  const trimmed = problem.trim();
  if (!trimmed) {
    return "Enterprise issue requires review";
  }

  const sentence = trimmed.split(/[.!?]/)[0].trim();
  if (sentence.length <= 72) {
    return sentence;
  }

  return `${sentence.slice(0, 69).trim()}...`;
}

function inferServiceName(problem) {
  const text = problem.toLowerCase();
  if (text.includes("checkout") || text.includes("payment")) {
    return "payments";
  }
  if (text.includes("support")) {
    return "customer support";
  }
  if (text.includes("finance") || text.includes("dashboard")) {
    return "finance dashboard";
  }
  if (text.includes("login") || text.includes("identity") || text.includes("auth")) {
    return "identity";
  }
  return "enterprise operations";
}

function inferRegions(problem) {
  const text = problem.toLowerCase();
  const regions = [];

  if (text.includes("us")) {
    regions.push("US");
  }
  if (text.includes("europe") || text.includes("eu")) {
    regions.push("Europe");
  }
  if (text.includes("global")) {
    regions.push("Global");
  }

  return regions.length ? regions : ["Global"];
}

function inferTags(problem) {
  return Array.from(
    new Set(
      problem
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, " ")
        .split(/\s+/)
        .filter((word) => word.length > 4)
        .slice(0, 6)
    )
  );
}

function buildPayloadFromIssue(issue) {
  return {
    title: extractTitle(issue.problem),
    description: issue.problem,
    service_name: inferServiceName(issue.problem),
    environment: "production",
    reporter: "workspace user",
    severity: issue.urgency,
    impact_summary: issue.impact,
    affected_regions: inferRegions(issue.problem),
    tags: inferTags(issue.problem)
  };
}

function createLocalIncident(issue) {
  const payload = buildPayloadFromIssue(issue);

  return {
    ...payload,
    incident_id: `inc-local-${Date.now()}`,
    dedupe_key: `${payload.service_name}|${payload.environment}|${payload.severity}`,
    created_at: new Date().toISOString()
  };
}

function buildGuidancePrompt(issue, triage) {
  return [
    {
      role: "user",
      content: [
        "Create an enterprise response brief for this issue.",
        "Return valid JSON only.",
        'Use this shape: {"situation":"", "likelySolution":"", "confidence":"high|medium|low", "steps":[{"title":"", "owner":"", "why":""}], "followUps":[""], "customerMessage":"", "leadershipMessage":"", "watchouts":[""]}.',
        `Problem: ${issue.problem}`,
        `Impact: ${issue.impact}`,
        `Urgency: ${issue.urgency}`,
        `Current triage summary: ${triage.incident_summary}`,
        `Likely owners: ${(triage.enriched_context?.likely_owners || []).join(", ")}`,
        `Action plan: ${(triage.action_plan || []).join(" | ")}`
      ].join("\n")
    }
  ];
}

function extractJsonObject(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    return null;
  }

  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

function buildFallbackGuidance(issue, triage) {
  const owners = triage.enriched_context?.likely_owners || [];
  const actionPlan = triage.action_plan || [];

  return {
    situation: triage.incident_summary,
    likelySolution:
      actionPlan[0] ||
      "Stabilize the affected workflow, validate the most critical dependency path, and align the responsible team on a containment plan.",
    confidence: triage.severity === "SEV1" ? "medium" : "high",
    steps: actionPlan.slice(0, 4).map((item, index) => ({
      title: item,
      owner: owners[index] || owners[0] || "Operations lead",
      why: index === 0 ? "This creates immediate control over the situation." : "This keeps the response moving without confusion."
    })),
    followUps: [
      "What changed immediately before the issue started?",
      "Which customer-facing workflows are currently failing?",
      "What should be communicated in the next update?"
    ],
    customerMessage:
      "We are actively investigating the issue, aligning the right teams, and will share another update as soon as the next checkpoint is confirmed.",
    leadershipMessage: triage.leadership_update,
    watchouts: [
      "Do not widen the blast radius while testing fixes.",
      "Avoid sending inconsistent messages across teams.",
      "Keep the next update time explicit."
    ]
  };
}

function normaliseGuidance(payload, fallback) {
  if (!payload || typeof payload !== "object") {
    return fallback;
  }

  const steps = Array.isArray(payload.steps)
    ? payload.steps
        .map((step) => ({
          title: String(step?.title || "").trim(),
          owner: String(step?.owner || "").trim(),
          why: String(step?.why || "").trim()
        }))
        .filter((step) => step.title)
    : [];

  const followUps = Array.isArray(payload.followUps)
    ? payload.followUps.map((item) => String(item).trim()).filter(Boolean)
    : [];

  const watchouts = Array.isArray(payload.watchouts)
    ? payload.watchouts.map((item) => String(item).trim()).filter(Boolean)
    : [];

  return {
    situation: String(payload.situation || fallback.situation).trim(),
    likelySolution: String(payload.likelySolution || fallback.likelySolution).trim(),
    confidence: String(payload.confidence || fallback.confidence).trim().toLowerCase(),
    steps: steps.length ? steps : fallback.steps,
    followUps: followUps.length ? followUps : fallback.followUps,
    customerMessage: String(payload.customerMessage || fallback.customerMessage).trim(),
    leadershipMessage: String(payload.leadershipMessage || fallback.leadershipMessage).trim(),
    watchouts: watchouts.length ? watchouts : fallback.watchouts
  };
}

function InsightStat({ label, value, tone }) {
  return (
    <article className={`insight-stat ${tone || ""}`.trim()}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function CapabilityColumn({ title, text }) {
  return (
    <div className="capability-column">
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}

function App() {
  const [health, setHealth] = useState(null);
  const [liveMode, setLiveMode] = useState(false);
  const [incidents, setIncidents] = useState([]);
  const [selectedIncidentId, setSelectedIncidentId] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [issue, setIssue] = useState(buildInitialIssue);
  const [triageResult, setTriageResult] = useState(null);
  const [guidance, setGuidance] = useState(() => buildFallbackGuidance(buildInitialIssue(), demoTriage));
  const [workspaceStatus, setWorkspaceStatus] = useState("idle");
  const [followUpInput, setFollowUpInput] = useState("");
  const [assistantMessages, setAssistantMessages] = useState([]);
  const [assistantStatus, setAssistantStatus] = useState("idle");

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      try {
        const nextHealth = await loadHealth();
        const nextIncidents = await loadIncidents();
        const firstIncidentId = nextIncidents[0]?.incident_id || null;
        const nextTimeline = await loadTimeline(firstIncidentId);

        if (cancelled) {
          return;
        }

        startTransition(() => {
          setLiveMode(true);
          setHealth(nextHealth);
          setIncidents(nextIncidents);
          setSelectedIncidentId(firstIncidentId);
          setTimeline(nextTimeline);
        });
      } catch {
        if (cancelled) {
          return;
        }

        const snapshot = demoSnapshot();
        startTransition(() => {
          setLiveMode(false);
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
  }, []);

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
          setTimeline(demoSnapshot().timeline);
        }
      }
    }

    refreshTimeline();
    return () => {
      cancelled = true;
    };
  }, [liveMode, selectedIncidentId]);

  const activeIncident =
    incidents.find((incidentItem) => incidentItem.incident_id === selectedIncidentId) || incidents[0] || demoIncident;
  const activeTriage = triageResult || demoTriage;

  const proofStats = useMemo(
    () => [
      { label: "Response mode", value: liveMode ? "Managed AI live" : "Guided workflow" },
      { label: "Likely owners", value: String(activeTriage.enriched_context?.likely_owners?.length || 0) },
      { label: "Action steps", value: String(activeTriage.action_plan?.length || 0) }
    ],
    [activeTriage, liveMode]
  );

  function updateIssue(event) {
    const { name, value } = event.target;
    setIssue((current) => ({ ...current, [name]: value }));
  }

  function applyScenario(scenario) {
    setIssue({
      problem: scenario.problem,
      impact: scenario.impact,
      urgency: scenario.urgency
    });
  }

  async function handleAnalyze(event) {
    event.preventDefault();
    setWorkspaceStatus("loading");
    setAssistantStatus("idle");

    const payload = buildPayloadFromIssue(issue);
    const localIncident = createLocalIncident(issue);

    try {
      const nextTriage = await runTriage(payload);
      const fallbackGuidance = buildFallbackGuidance(issue, nextTriage);
      const nextMessages = buildGuidancePrompt(issue, nextTriage);
      const nextIncident = {
        ...localIncident,
        incident_id: nextTriage.incident_id
      };

      let nextGuidance = fallbackGuidance;
      let nextAssistantMessages = [];
      let nextAssistantStatus = "fallback";

      try {
        const assistantReply = await runAssistant({
          messages: nextMessages,
          incidentContext: nextIncident,
          triageContext: {
            incident_id: nextTriage.incident_id,
            severity: nextTriage.severity,
            incident_summary: nextTriage.incident_summary,
            likely_owners: nextTriage.enriched_context?.likely_owners || [],
            action_plan: nextTriage.action_plan || [],
            leadership_update: nextTriage.leadership_update
          }
        });

        const parsed = extractJsonObject(assistantReply.answer);
        nextGuidance = normaliseGuidance(parsed, fallbackGuidance);
        nextAssistantMessages = [
          { role: "user", content: issue.problem },
          {
            role: "assistant",
            content: `${nextGuidance.situation}\n\nLikely solution: ${nextGuidance.likelySolution}`
          }
        ];
        nextAssistantStatus = assistantReply.used_live_model ? "live" : "fallback";
      } catch {
        nextAssistantMessages = [
          { role: "user", content: issue.problem },
          { role: "assistant", content: fallbackGuidance.situation }
        ];
      }

      startTransition(() => {
        setLiveMode(true);
        setTriageResult(nextTriage);
        setGuidance(nextGuidance);
        setWorkspaceStatus("ready");
        setAssistantMessages(nextAssistantMessages);
        setAssistantStatus(nextAssistantStatus);
        setIncidents((current) => [nextIncident, ...current].slice(0, 8));
        setSelectedIncidentId(nextTriage.incident_id);
        setTimeline((current) => [
          {
            incident_id: nextTriage.incident_id,
            event_type: "analysis",
            actor: "SignalDesk AI",
            summary: "Generated a guided response plan and stakeholder communication draft.",
            created_at: new Date().toISOString()
          },
          ...current
        ]);
      });
    } catch {
      const fallbackGuidance = buildFallbackGuidance(issue, demoTriage);

      startTransition(() => {
        setLiveMode(false);
        setTriageResult(demoTriage);
        setGuidance(fallbackGuidance);
        setWorkspaceStatus("ready");
        setAssistantMessages([
          { role: "user", content: issue.problem },
          { role: "assistant", content: fallbackGuidance.situation }
        ]);
        setAssistantStatus("fallback");
        setIncidents((current) => [localIncident, ...current].slice(0, 8));
        setSelectedIncidentId(localIncident.incident_id);
        setTimeline(demoSnapshot().timeline);
      });
    }
  }

  async function handleFollowUpSubmit(event) {
    event.preventDefault();
    const prompt = followUpInput.trim();

    if (!prompt) {
      return;
    }

    setAssistantStatus("loading");
    setFollowUpInput("");

    const nextMessages = [...assistantMessages, { role: "user", content: prompt }];
    setAssistantMessages(nextMessages);

    try {
      const assistantReply = await runAssistant({
        messages: nextMessages,
        incidentContext: activeIncident,
        triageContext: {
          incident_id: activeTriage.incident_id,
          severity: activeTriage.severity,
          incident_summary: activeTriage.incident_summary,
          likely_owners: activeTriage.enriched_context?.likely_owners || [],
          action_plan: activeTriage.action_plan || [],
          leadership_update: activeTriage.leadership_update
        }
      });

      startTransition(() => {
        setAssistantMessages((current) => [...current, { role: "assistant", content: assistantReply.answer }]);
        setAssistantStatus(assistantReply.used_live_model ? "live" : "fallback");
      });
    } catch {
      startTransition(() => {
        setAssistantMessages((current) => [
          ...current,
          {
            role: "assistant",
            content:
              "The platform could not reach the live assistant service just now, but the response plan remains available and ready to use."
          }
        ]);
        setAssistantStatus("fallback");
      });
    }
  }

  return (
    <div className="site-shell">
      <header className="site-header">
        <a className="brand-lockup" href="#top">
          <span className="brand-mark">S</span>
          <span className="brand-wording">
            <strong>SignalDesk AI</strong>
            <small>Enterprise response intelligence</small>
          </span>
        </a>

        <nav className="site-nav">
          <a href="#platform">Platform</a>
          <a href="#capabilities">Capabilities</a>
          <a href="#workspace">Workspace</a>
        </nav>

        <a className="header-cta" href="#workspace">
          Try The Workspace
        </a>
      </header>

      <main id="top">
        <section className="hero-section">
          <div className="hero-backdrop" aria-hidden="true">
            <span className="hero-orbit hero-orbit-a" />
            <span className="hero-orbit hero-orbit-b" />
            <span className="hero-grid" />
          </div>

          <div className="hero-copy">
            <p className="eyebrow">AI for enterprise issue response</p>
            <h1>Turn fast-moving business problems into clear action, aligned teams, and confident updates.</h1>
            <p className="hero-text">
              SignalDesk AI helps enterprise teams explain a problem in plain language and instantly receive a
              structured response plan, likely owners, likely solution path, and ready-to-share messaging.
            </p>

            <div className="hero-actions">
              <a className="primary-button" href="#workspace">
                Analyze An Issue
              </a>
              <a className="secondary-button" href="#platform">
                See How It Works
              </a>
            </div>

            <div className="proof-row">
              {proofStats.map((stat, index) => (
                <InsightStat key={stat.label} label={stat.label} value={stat.value} tone={index === 0 ? "accent" : ""} />
              ))}
            </div>
          </div>

          <div className="hero-visual">
            <div className="hero-signal">
              <div className="signal-header">
                <span>Live issue intelligence</span>
                <strong>{liveMode ? "Managed AI active" : "Response engine ready"}</strong>
              </div>

              <div className="signal-summary">
                <p>Current platform readout</p>
                <h2>{guidance.situation}</h2>
              </div>

              <div className="signal-columns">
                <div>
                  <span>Likely solution</span>
                  <strong>{guidance.likelySolution}</strong>
                </div>
                <div>
                  <span>Confidence</span>
                  <strong>{guidance.confidence}</strong>
                </div>
              </div>

              <div className="signal-steps">
                {guidance.steps.slice(0, 3).map((step, index) => (
                  <article key={`${step.title}-${index}`}>
                    <span>{`0${index + 1}`}</span>
                    <div>
                      <strong>{step.title}</strong>
                      <p>{step.owner || "Response owner"}</p>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="platform" className="value-section">
          <div className="section-intro">
            <p className="eyebrow">Why teams use it</p>
            <h2>One product for understanding the issue, guiding the response, and keeping the business aligned.</h2>
          </div>

          <div className="value-grid">
            {VALUE_POINTS.map((point) => (
              <article key={point.title} className="value-item">
                <h3>{point.title}</h3>
                <p>{point.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="capabilities" className="capability-section">
          <div className="section-intro">
            <p className="eyebrow">What the AI does</p>
            <h2>It does not just answer questions. It turns an issue into a visible operational plan.</h2>
          </div>

          <div className="capability-layout">
            <div className="capability-story">
              <span className="story-step">01</span>
              <div>
                <h3>The user explains the problem in plain language.</h3>
                <p>
                  No technical prompt writing, no hidden setup, no platform knowledge required. The experience starts
                  with the problem as the user sees it.
                </p>
              </div>
            </div>

            <div className="capability-story">
              <span className="story-step">02</span>
              <div>
                <h3>The platform structures the response.</h3>
                <p>
                  It organizes the issue into situation, likely owners, likely solution path, follow-up questions,
                  communication guidance, and next-step actions.
                </p>
              </div>
            </div>

            <div className="capability-story">
              <span className="story-step">03</span>
              <div>
                <h3>The team acts from one shared view.</h3>
                <p>
                  Operations, support, and leadership all work from the same response plan instead of piecing together
                  updates from scattered messages.
                </p>
              </div>
            </div>
          </div>

          <div className="pillar-grid">
            {CAPABILITY_PILLARS.map((pillar) => (
              <CapabilityColumn key={pillar.title} title={pillar.title} text={pillar.text} />
            ))}
          </div>
        </section>

        <section className="workspace-intro">
          <div className="section-intro">
            <p className="eyebrow">Product workspace</p>
            <h2>See the assistant turn a real issue into a response plan.</h2>
            <p>
              This is the live product surface: describe the issue, run the analysis, review the plan, and ask follow-up
              questions from the same workspace.
            </p>
          </div>
        </section>

        <section id="workspace" className="workspace-section">
          <div className="workspace-compose">
            <div className="compose-header">
              <div>
                <p className="eyebrow">Describe the issue</p>
                <h3>Tell the platform what is going wrong.</h3>
              </div>
              <span className={`status-chip ${liveMode ? "status-live" : "status-guided"}`}>
                {liveMode ? "Managed AI live" : "Guided response mode"}
              </span>
            </div>

            <div className="scenario-row">
              {QUICK_SCENARIOS.map((scenario) => (
                <button key={scenario.id} type="button" className="scenario-chip" onClick={() => applyScenario(scenario)}>
                  {scenario.label}
                </button>
              ))}
            </div>

            <form className="compose-form" onSubmit={handleAnalyze}>
              <label>
                <span>What is happening?</span>
                <textarea
                  name="problem"
                  rows={5}
                  value={issue.problem}
                  onChange={updateIssue}
                  placeholder="Describe the issue in plain language."
                />
              </label>

              <label>
                <span>What is the business impact?</span>
                <textarea
                  name="impact"
                  rows={4}
                  value={issue.impact}
                  onChange={updateIssue}
                  placeholder="Explain what is affected and why it matters."
                />
              </label>

              <label>
                <span>How urgent is it?</span>
                <select name="urgency" value={issue.urgency} onChange={updateIssue}>
                  <option value="SEV1">Critical</option>
                  <option value="SEV2">High</option>
                  <option value="SEV3">Elevated</option>
                  <option value="SEV4">Monitor</option>
                </select>
              </label>

              <button className="primary-button" type="submit">
                {workspaceStatus === "loading" ? "Analyzing..." : "Generate Response Plan"}
              </button>
            </form>
          </div>

          <div className="workspace-results">
            <div className="results-header">
              <div>
                <p className="eyebrow">Response brief</p>
                <h3>{guidance.situation}</h3>
              </div>
              <span className={`confidence-badge confidence-${guidance.confidence || "medium"}`}>
                {`${guidance.confidence || "medium"} confidence`}
              </span>
            </div>

            <div className="results-grid">
              <article className="results-panel panel-strong">
                <span>Likely solution path</span>
                <strong>{guidance.likelySolution}</strong>
              </article>

              <article className="results-panel">
                <span>Primary leadership line</span>
                <p>{guidance.leadershipMessage}</p>
              </article>

              <article className="results-panel">
                <span>Customer-safe message</span>
                <p>{guidance.customerMessage}</p>
              </article>
            </div>

            <div className="action-board">
              <div className="action-column">
                <h4>Recommended next steps</h4>
                <div className="step-list">
                  {guidance.steps.map((step, index) => (
                    <article key={`${step.title}-${index}`} className="step-card">
                      <span>{`0${index + 1}`}</span>
                      <div>
                        <strong>{step.title}</strong>
                        <p>{step.why}</p>
                        <small>{step.owner}</small>
                      </div>
                    </article>
                  ))}
                </div>
              </div>

              <div className="action-column">
                <h4>Follow-up questions</h4>
                <ul className="plain-list">
                  {guidance.followUps.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>

                <h4>Watchouts</h4>
                <ul className="plain-list">
                  {guidance.watchouts.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="assistant-panel">
              <div className="assistant-header">
                <div>
                  <p className="eyebrow">Ask a follow-up</p>
                  <h4>Continue the conversation from the same issue context.</h4>
                </div>
                <span className={`status-chip ${assistantStatus === "live" ? "status-live" : "status-guided"}`}>
                  {assistantStatus === "loading"
                    ? "Responding"
                    : assistantStatus === "live"
                      ? "Live assistant"
                      : "Guided assistant"}
                </span>
              </div>

              <div className="chat-log">
                {assistantMessages.length ? (
                  assistantMessages.map((message, index) => (
                    <article key={`${message.role}-${index}`} className={`chat-bubble chat-${message.role}`}>
                      <span>{message.role === "assistant" ? "SignalDesk AI" : "User"}</span>
                      <p>{message.content}</p>
                    </article>
                  ))
                ) : (
                  <article className="chat-bubble chat-assistant">
                    <span>SignalDesk AI</span>
                    <p>
                      Ask the platform to explain the likely cause, refine the plan, or tailor the next update for a
                      specific audience.
                    </p>
                  </article>
                )}
              </div>

              <form className="follow-up-form" onSubmit={handleFollowUpSubmit}>
                <textarea
                  rows={3}
                  value={followUpInput}
                  onChange={(event) => setFollowUpInput(event.target.value)}
                  placeholder="Ask a follow-up question like: What should support tell customers right now?"
                />
                <button className="secondary-button" type="submit">
                  Send Follow-Up
                </button>
              </form>
            </div>
          </div>
        </section>

        <section className="memory-section">
          <div className="section-intro memory-intro">
            <p className="eyebrow">Operational memory</p>
            <h2>Keep the latest issue context, response activity, and ownership visible.</h2>
          </div>

          <div className="memory-grid">
            <div className="memory-panel">
              <h3>Recent issues</h3>
              <div className="memory-list">
                {incidents.map((incidentItem) => (
                  <button
                    key={incidentItem.incident_id}
                    type="button"
                    className={`memory-item ${incidentItem.incident_id === selectedIncidentId ? "memory-active" : ""}`}
                    onClick={() => setSelectedIncidentId(incidentItem.incident_id)}
                  >
                    <div>
                      <strong>{incidentItem.title}</strong>
                      <span>{incidentItem.service_name}</span>
                    </div>
                    <small>{formatTime(incidentItem.created_at)}</small>
                  </button>
                ))}
              </div>
            </div>

            <div className="memory-panel">
              <h3>Latest activity</h3>
              <div className="timeline-list">
                {timeline.map((item, index) => (
                  <article key={`${item.event_type}-${index}`} className="timeline-item">
                    <span className="timeline-dot" />
                    <div>
                      <strong>{item.summary || item.event_type}</strong>
                      <p>{item.actor}</p>
                      <small>{formatTime(item.created_at)}</small>
                    </div>
                  </article>
                ))}
              </div>
            </div>

            <div className="memory-panel">
              <h3>Selected issue</h3>
              <div className="selected-issue">
                <span className={severityClass(activeIncident.severity)}>{activeIncident.severity}</span>
                <strong>{activeIncident.title}</strong>
                <p>{activeIncident.description || activeIncident.impact_summary}</p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
