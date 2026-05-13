create table if not exists incidents (
  incident_id text primary key,
  title text not null,
  description text not null,
  service_name text not null,
  environment text not null,
  reporter text not null,
  severity text not null,
  impact_summary text not null,
  affected_regions jsonb not null default '[]'::jsonb,
  tags jsonb not null default '[]'::jsonb,
  dedupe_key text not null,
  created_at timestamptz not null
);

create table if not exists copilot_runs (
  run_id bigserial primary key,
  incident_id text not null,
  workflow_mode text not null,
  runbook_count integer not null,
  duration_seconds numeric(10,4) not null,
  created_at timestamptz not null default now()
);

create table if not exists runbook_feedback (
  feedback_id bigserial primary key,
  incident_id text not null,
  runbook_id text not null,
  feedback_label text not null,
  note text,
  created_at timestamptz not null default now()
);

