export const demoPayload = {
  title: "Payment gateway latency spike",
  description:
    "Multiple enterprise accounts report checkout failures. Monitoring shows a sharp latency increase on the payments API and partial downstream dependency timeouts.",
  service_name: "payments-api",
  environment: "production",
  reporter: "NOC automation",
  severity: "SEV2",
  impact_summary:
    "Checkout completion is degraded for enterprise tenants. Error rates and response times spiked after a configuration rollout.",
  affected_regions: ["us-east-1", "eu-west-1"],
  tags: ["payments", "latency", "checkout", "enterprise"]
};

export const demoIncident = {
  incident_id: "inc-demo-2049",
  title: demoPayload.title,
  description: demoPayload.description,
  service_name: demoPayload.service_name,
  environment: demoPayload.environment,
  reporter: demoPayload.reporter,
  severity: demoPayload.severity,
  impact_summary: demoPayload.impact_summary,
  affected_regions: demoPayload.affected_regions,
  tags: demoPayload.tags,
  dedupe_key: "payments-api|production|SEV2",
  created_at: "2026-05-14T03:10:00Z"
};

export const demoTimeline = [
  {
    incident_id: "inc-demo-2049",
    event_type: "intake",
    actor: "NOC automation",
    summary: "Incident captured after payment latency threshold breach.",
    created_at: "2026-05-14T03:10:00Z"
  },
  {
    incident_id: "inc-demo-2049",
    event_type: "triage",
    actor: "Copilot",
    summary: "Runbook guidance assembled with likely owners and first response plan.",
    created_at: "2026-05-14T03:12:00Z"
  },
  {
    incident_id: "inc-demo-2049",
    event_type: "stakeholder_update",
    actor: "Ops lead",
    summary: "Leadership and support updates drafted for first response cadence.",
    created_at: "2026-05-14T03:15:00Z"
  }
];

export const demoTriage = {
  incident_id: "inc-demo-2049",
  severity: "SEV2",
  incident_summary:
    "Payments API latency spike is degrading enterprise checkout completion across two production regions after a recent rollout.",
  enriched_context: {
    severity_score: 84,
    affected_capability: "Enterprise checkout",
    blast_radius: "High-value checkout journeys in two production regions",
    likely_owners: ["Payments Platform", "Release Operations", "Edge Reliability"],
    stakeholder_channels: ["#ops-command", "#payments-war-room", "leadership-bridge"],
    dependencies: [
      {
        dependency_name: "auth-gateway",
        dependency_type: "service",
        criticality: "high"
      },
      {
        dependency_name: "regional cache",
        dependency_type: "infra",
        criticality: "high"
      },
      {
        dependency_name: "fraud-eval",
        dependency_type: "service",
        criticality: "medium"
      }
    ]
  },
  runbooks: [
    {
      runbook_id: "rb-001",
      title: "High Severity Incident Response",
      service_name: "payments-api",
      summary: "Validate service health, review rollout state, and assign incident command.",
      immediate_actions: [
        "Freeze further rollout activity",
        "Review downstream dependency health",
        "Establish executive bridge with fifteen-minute updates"
      ],
      escalation_targets: ["SRE Lead", "Payments Director", "Customer Operations Manager"]
    }
  ],
  action_plan: [
    "Halt the active rollout in affected regions.",
    "Validate auth-gateway and cache saturation before broad mitigation.",
    "Open the executive incident bridge and set customer communication cadence.",
    "Review recent deploys and rollback safety conditions."
  ],
  escalation_targets: ["SRE Lead", "Payments Director", "Customer Operations Manager"],
  leadership_update:
    "SEV2 payments degradation is active in two production regions. Rollout activity is frozen, dependency teams are engaged, and the next update will land in fifteen minutes.",
  stakeholder_updates: [
    {
      audience: "leadership",
      title: "Enterprise payments degradation",
      body:
        "Checkout instability is affecting enterprise tenants. Rollout activity has been frozen and mitigation is underway.",
      delivery_channel: "leadership-bridge"
    },
    {
      audience: "support",
      title: "Customer handling guidance",
      body:
        "Acknowledge checkout instability for enterprise customers and confirm engineering mitigation is in progress.",
      delivery_channel: "#support-ops"
    }
  ],
  execution_metadata: {
    mode: "demo",
    cache_hit: "false",
    workflow_duration_ms: "412"
  }
};
