from __future__ import annotations

from collections.abc import Mapping

from app.domain.models import RunbookDocument
from app.repositories.memory import FixtureRunbookRepository


class OpenSearchRunbookStore:
    def __init__(self, url: str, index_name: str = "runbooks", fixture_path: str = "fixtures/runbooks.json") -> None:
        self.url = url
        self.index_name = index_name
        self.fixture_repository = FixtureRunbookRepository(fixture_path)

    def _client(self) -> object:
        try:
            from opensearchpy import OpenSearch
        except ImportError as exc:
            raise RuntimeError("opensearch-py is required for OpenSearch integration.") from exc
        return OpenSearch(self.url)

    def index_runbook(self, runbook: RunbookDocument) -> None:
        client = self._client()
        client.index(index=self.index_name, id=runbook.runbook_id, body=runbook.__dict__)

    def seed_from_fixture(self) -> int:
        count = 0
        for runbook in self.fixture_repository.list_all():
            self.index_runbook(runbook)
            count += 1
        return count

    def list_all(self) -> list[RunbookDocument]:
        client = self._client()
        response = client.search(index=self.index_name, body={"size": 1000, "query": {"match_all": {}}})
        hits = response.get("hits", {}).get("hits", [])
        return [self._to_runbook(hit.get("_source", {})) for hit in hits]

    def search(self, incident: object, max_results: int) -> list[RunbookDocument]:
        client = self._client()
        service_name = getattr(incident, "service_name", "")
        severity = getattr(incident, "severity", "")
        title = getattr(incident, "title", "")
        description = getattr(incident, "description", "")
        impact_summary = getattr(incident, "impact_summary", "")
        tags = getattr(incident, "tags", [])
        body = {
            "size": max_results,
            "query": {
                "bool": {
                    "must": [
                        {
                            "multi_match": {
                                "query": " ".join([service_name, title, description, impact_summary]).strip(),
                                "fields": ["title^3", "service_name^4", "summary^2", "keywords"],
                                "type": "best_fields",
                            }
                        }
                    ],
                    "should": [
                        {"term": {"service_name.keyword": {"value": service_name}}},
                        {"term": {"severity_levels.keyword": {"value": severity}}},
                    ]
                    + [{"term": {"keywords.keyword": {"value": str(tag)}}} for tag in tags],
                }
            },
        }
        response = client.search(index=self.index_name, body=body)
        hits = response.get("hits", {}).get("hits", [])
        return [self._to_runbook(hit.get("_source", {})) for hit in hits]

    def _to_runbook(self, source: Mapping[str, object]) -> RunbookDocument:
        return RunbookDocument(
            runbook_id=str(source.get("runbook_id", "")),
            title=str(source.get("title", "")),
            service_name=str(source.get("service_name", "")),
            severity_levels=[str(item) for item in source.get("severity_levels", [])],
            keywords=[str(item) for item in source.get("keywords", [])],
            summary=str(source.get("summary", "")),
            immediate_actions=[str(item) for item in source.get("immediate_actions", [])],
            escalation_targets=[str(item) for item in source.get("escalation_targets", [])],
        )
