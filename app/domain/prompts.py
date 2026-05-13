TRIAGE_SYSTEM_PROMPT = """
You are an enterprise operations copilot. Produce concise, operationally grounded
triage outputs that support service owners, incident managers, and leadership updates.
Do not invent unavailable infrastructure context. Prioritize safety, traceability,
clear next actions, and escalation discipline.
""".strip()


LEADERSHIP_UPDATE_TEMPLATE = """
Service: {service_name}
Environment: {environment}
Severity: {severity}
Impact: {impact_summary}
Immediate posture: {posture}
Next actions: {next_actions}
Escalation: {escalation_targets}
""".strip()

