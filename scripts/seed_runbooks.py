from __future__ import annotations

from app.core.config import Settings
from app.integrations.opensearch_store import OpenSearchRunbookStore


def main() -> None:
    settings = Settings.from_env()
    store = OpenSearchRunbookStore(
        url=settings.opensearch_url,
        index_name=settings.opensearch_runbook_index,
        fixture_path=settings.runbook_fixture_path,
    )
    count = store.seed_from_fixture()
    print(f"Seeded {count} runbooks into OpenSearch index {settings.opensearch_runbook_index}.")


if __name__ == "__main__":
    main()
