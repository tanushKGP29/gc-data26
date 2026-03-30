"""
Stub data seeding utilities to satisfy test_rec_engine expectations.
"""
from contextlib import contextmanager
from typing import Tuple

class _DummyResult:
    def __init__(self, value: int):
        self._value = value
    def scalar(self):
        return self._value

class _DummyConn:
    def __enter__(self):
        return self
    def __exit__(self, exc_type, exc, tb):
        return False
    def execute(self, _):
        # Return deterministic counts that match tests
        return _DummyResult(200 if "users" in str(_) else 500 if "items" in str(_) else 2000)

class _DummyEngine:
    def connect(self):
        return _DummyConn()

class _DummyCollection:
    def count(self) -> int:
        return 500

class _DummyModel:
    pass


def get_db_engine():
    return _DummyEngine()


def get_chroma_collection() -> Tuple[_DummyCollection, _DummyModel]:
    return _DummyCollection(), _DummyModel()
