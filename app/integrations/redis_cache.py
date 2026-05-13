from __future__ import annotations

import json


class RedisWorkflowCache:
    def __init__(self, url: str) -> None:
        self.url = url

    def _client(self) -> object:
        try:
            import redis
        except ImportError as exc:
            raise RuntimeError("redis is required for Redis caching.") from exc
        return redis.from_url(self.url, decode_responses=True)

    def set_json(self, key: str, payload: dict, ttl_seconds: int = 900) -> None:
        client = self._client()
        client.set(name=key, value=json.dumps(payload), ex=ttl_seconds)

    def get_json(self, key: str) -> dict | None:
        client = self._client()
        value = client.get(name=key)
        if value is None:
            return None
        decoded = json.loads(value)
        return decoded if isinstance(decoded, dict) else None
