from __future__ import annotations

import json


class RedisWorkflowCache:
    def __init__(self, url: str) -> None:
        self.url = url

    def set_json(self, key: str, payload: dict, ttl_seconds: int = 900) -> None:
        try:
            import redis
        except ImportError as exc:
            raise RuntimeError("redis is required for Redis caching.") from exc

        client = redis.from_url(self.url, decode_responses=True)
        client.set(name=key, value=json.dumps(payload), ex=ttl_seconds)

