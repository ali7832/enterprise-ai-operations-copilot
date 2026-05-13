from __future__ import annotations

from app.domain.models import RunbookDocument


class OpenSearchRunbookStore:
    def __init__(self, url: str, index_name: str = "runbooks") -> None:
        self.url = url
        self.index_name = index_name

    def index_runbook(self, runbook: RunbookDocument) -> None:
        try:
            from opensearchpy import OpenSearch
        except ImportError as exc:
            raise RuntimeError("opensearch-py is required for OpenSearch integration.") from exc

        client = OpenSearch(self.url)
        client.index(index=self.index_name, id=runbook.runbook_id, body=runbook.__dict__)

