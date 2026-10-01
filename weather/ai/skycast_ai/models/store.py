"""Per-location model cache: in-memory dict backed by joblib files under MODEL_DIR."""

from __future__ import annotations

import logging
import threading
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import joblib

log = logging.getLogger(__name__)


def model_key(lat: float, lon: float) -> str:
    return f"{round(lat, 2):.2f}_{round(lon, 2):.2f}".replace("-", "m")


class ModelStore:
    def __init__(self, directory: Path, ttl_s: int, mock_ttl_s: int = 3600):
        self.directory = Path(directory)
        self.directory.mkdir(parents=True, exist_ok=True)
        self.ttl_s = ttl_s
        self.mock_ttl_s = mock_ttl_s
        self._mem: dict[str, Any] = {}
        self._lock = threading.Lock()
        self._key_locks: dict[str, threading.Lock] = {}

    def lock_for(self, key: str) -> threading.Lock:
        with self._lock:
            return self._key_locks.setdefault(key, threading.Lock())

    def _path(self, key: str) -> Path:
        return self.directory / f"{key}.joblib"

    def _fresh(self, model: Any) -> bool:
        trained_at: datetime = model.trained_at
        if trained_at.tzinfo is None:
            trained_at = trained_at.replace(tzinfo=timezone.utc)
        age = time.time() - trained_at.timestamp()
        ttl = self.mock_ttl_s if getattr(model, "mock", False) else self.ttl_s
        return age < ttl

    def get(self, key: str, allow_stale: bool = False) -> Any | None:
        with self._lock:
            model = self._mem.get(key)
        if model is None:
            p = self._path(key)
            if p.exists():
                try:
                    model = joblib.load(p)
                    with self._lock:
                        self._mem[key] = model
                except Exception as exc:
                    log.warning("failed to load model %s: %s", p.name, exc)
                    return None
        if model is None:
            return None
        if allow_stale or self._fresh(model):
            return model
        return None

    def put(self, key: str, model: Any) -> None:
        with self._lock:
            self._mem[key] = model
        p = self._path(key)
        try:
            tmp = p.with_suffix(".tmp")
            joblib.dump(model, tmp, compress=3)
            tmp.replace(p)
        except Exception as exc:
            log.warning("failed to persist model %s: %s", p.name, exc)

    def __len__(self) -> int:
        with self._lock:
            return len(self._mem)
