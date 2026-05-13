from __future__ import annotations

import json
from pathlib import Path


def main() -> None:
    fixture_path = Path("fixtures/runbooks.json")
    data = json.loads(fixture_path.read_text())
    for item in data:
        print(f"{item['runbook_id']}: {item['title']} -> {item['service_name']}")


if __name__ == "__main__":
    main()

