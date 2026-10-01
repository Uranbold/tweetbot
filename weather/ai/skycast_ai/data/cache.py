"""Small JSON disk cache with TTL for raw upstream responses."""

from __future__ import annotations

import hashlib
import json
import logging
import time
from pathlib import Path
from typing import Any

log = logging.getLogger(__name__)


class DiskCache:
    def __init__(self, directory: Path):
        self.directory = Path(directory)
        self.directory.mkdir(parents=True, exist_ok=True)
        self.hits = 0
        self.misses = 0

    @staticmethod
    def key_for(url: str, params: dict[str, Any]) -> str:
        canonical = url + "?" + json.dumps(params, sort_keys=True, default=str)
        return hashlib.sha1(canonical.encode("utf-8")).hexdigest()

    def _path(self, key: str) -> Path:
        return self.directory / f"{key}.json"

    def get(self, key: str, ttl_s: float) -> Any | None:
        p = self._path(key)
        if not p.exists():
            self.misses += 1
            return None
        try:
            raw = json.loads(p.read_text("utf-8"))
            if time.time() - float(raw["stored_at"]) > ttl_s:
                self.misses += 1
                return None
            self.hits += 1
            return raw["payload"]
        except Exception as exc:  # corrupt file → treat as miss
            log.warning("cache read failed for %s: %s", p.name, exc)
            self.misses += 1
            return None

    def set(self, key: str, payload: Any) -> None:
        p = self._path(key)
        tmp = p.with_suffix(".tmp")
        try:
            tmp.write_text(json.dumps({"stored_at": time.time(), "payload": payload}), "utf-8")
            tmp.replace(p)
        except Exception as exc:
            log.warning("cache write failed for %s: %s", p.name, exc)
