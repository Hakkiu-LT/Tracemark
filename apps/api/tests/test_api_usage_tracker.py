import pytest
from unittest.mock import patch, MagicMock
from datetime import datetime, timezone, timedelta
from tracemark_api.services.api_usage_tracker import tracker, UsageRecord, ApiLimitError, call_with_tracking, API_REGISTRY
from tracemark_api.routes.usage import get_usage_stats

@pytest.fixture(autouse=True)
def mock_supabase():
    db_data = []

    class MockTable:
        def __init__(self, name):
            self.name = name
            self._limit = None

        def insert(self, payload):
            data = payload.copy()
            if "id" not in data:
                data["id"] = "mock-uuid"
            db_data.append(data)
            res = MagicMock()
            res.data = [data]
            return res

        def select(self, fields):
            return self

        def gte(self, field, value):
            return self

        def eq(self, field, value):
            return self

        def order(self, field, desc=False):
            return self

        def limit(self, count):
            self._limit = count
            return self

        def delete(self):
            return self

        def neq(self, field, value):
            db_data.clear()
            res = MagicMock()
            res.data = []
            return res

        def execute(self):
            res = MagicMock()
            res.data = list(db_data)  # return a copy to prevent mutation issues
            if self._limit is not None:
                res.data = res.data[:self._limit]
            return res

    mock_client = MagicMock()
    mock_client.table.side_effect = lambda name: MockTable(name)

    with patch("tracemark_api.services.database.get_supabase", return_value=mock_client):
        # Reset tracker cache for each test
        tracker._cache_counts = {}
        tracker._cache_initialized = False
        yield

def test_tracker_singleton_exists():
    assert tracker is not None
    assert len(API_REGISTRY) > 0

def test_tracker_recording():
    tracker.reset_all()
    assert tracker.get_used_count("google_serp") == 0

    record = UsageRecord(
        api_key="google_serp",
        caller_id="test@user.com",
        called_at=datetime.now(timezone.utc).isoformat(),
        success=True,
        latency_ms=120,
        endpoint="/check-brand",
        credits_used=1
    )
    tracker.record(record)
    assert tracker.get_used_count("google_serp") == 1

def test_tracker_is_blocked():
    tracker.reset_all()
    # Use google_serp (limit=100) to avoid looping 999_999 times for html_scraper
    defn = next(d for d in API_REGISTRY if d.key == "google_serp")
    limit = defn.free_limit

    # Record limit - 1
    for _ in range(limit - 1):
        tracker.record(UsageRecord(
            api_key="google_serp",
            caller_id="test@user.com",
            called_at=datetime.now(timezone.utc).isoformat(),
            success=True,
            latency_ms=10,
            endpoint="/test",
            credits_used=1
        ))
    
    assert not tracker.is_blocked("google_serp")

    # Record one more to hit the limit
    tracker.record(UsageRecord(
        api_key="google_serp",
        caller_id="test@user.com",
        called_at=datetime.now(timezone.utc).isoformat(),
        success=True,
        latency_ms=10,
        endpoint="/test",
        credits_used=1
    ))

    assert tracker.is_blocked("google_serp")

def test_api_limit_error_raised():
    tracker.reset_all()
    # Use google_serp (limit=100) to keep the test fast
    defn = next(d for d in API_REGISTRY if d.key == "google_serp")
    for _ in range(defn.free_limit):
        tracker.record(UsageRecord(
            api_key="google_serp",
            caller_id="test@user.com",
            called_at=datetime.now(timezone.utc).isoformat(),
            success=True,
            latency_ms=5,
            endpoint="/test",
            credits_used=1
        ))

    with pytest.raises(ApiLimitError):
        call_with_tracking(
            "google_serp",
            "test@user.com",
            "/test",
            lambda: "should not be called"
        )

def test_usage_stats_endpoint():
    tracker.reset_all()
    tracker.record(UsageRecord(
        api_key="google_serp",
        caller_id="avery@tracemark.io",
        called_at=datetime.now(timezone.utc).isoformat(),
        success=True,
        latency_ms=80,
        endpoint="/check-brand",
        credits_used=1
    ))

    response = get_usage_stats()
    assert response.generated_at is not None
    assert len(response.summary) == len(API_REGISTRY)
    assert len(response.by_developer) == 1
    assert response.by_developer[0]["caller_id"] == "avery@tracemark.io"
    assert response.by_developer[0]["total_calls_today"] == 1
    assert response.by_developer[0]["by_api"]["google_serp"] == 1
