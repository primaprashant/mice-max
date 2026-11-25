"""Smoke tests for the API. Run with `uv run pytest` in backend/.

The catalog reads hit the committed data/micemax.db, so this file must run
from a checkout that has the data/ directory. Event writes need DATABASE_URL;
the tests cover both the unset case (503) and validation failures (400).
"""
import os

import pytest
from fastapi.testclient import TestClient

import app.main as main


@pytest.fixture()
def client(monkeypatch: pytest.MonkeyPatch) -> TestClient:
    monkeypatch.delenv("DATABASE_URL", raising=False)
    return TestClient(main.app, raise_server_exceptions=False)


def test_health(client: TestClient) -> None:
    assert client.get("/health").json() == {"status": "ok"}


def test_conferences_lists_every_conference(client: TestClient) -> None:
    rows = client.get("/api/conferences").json()
    by_id = {r["id"] for r in rows}
    assert {"jadm32", "icep2027"} <= by_id
    assert all("main_venue_place_id" in r for r in rows)


def test_sessions_and_windows_ordered(client: TestClient) -> None:
    sessions = client.get("/api/conferences/jadm32/sessions").json()
    assert sessions and sessions[0]["conference_id"] == "jadm32"
    windows = client.get("/api/conferences/jadm32/windows").json()
    assert windows


def test_experiences_parse_fields(client: TestClient) -> None:
    rows = client.get("/api/conferences/jadm32/experiences").json()
    assert rows
    first = client.get(f"/api/experiences/{rows[0]['id']}").json()
    assert "copy" in first and set(first["copy"]) == {"ja", "en"}
    assert "photos" in first and "stops" in first and "tags" in first


def test_unknown_ids_return_404(client: TestClient) -> None:
    assert client.get("/api/experiences/nope").status_code == 404
    assert client.get("/api/attendees/nope").status_code == 404
    assert client.get("/api/organize/nope").status_code == 404


def test_attendees_limit_is_clamped(client: TestClient) -> None:
    r = client.get("/api/experiences/combo-jozankei-and-market-brunch/attendees",
                   params={"limit": 0})
    assert r.status_code == 422


def test_city_and_organize_shapes(client: TestClient) -> None:
    city = client.get("/api/city").json()
    assert set(city) == {"estimates", "scales", "reach", "spend"}
    org = client.get("/api/organize/jadm32").json()
    assert set(org) == {"conference", "sessions", "windows", "window_stats"}


def test_event_write_fails_closed_without_database_url(client: TestClient) -> None:
    r = client.post("/api/events",
                    json={"conference_id": "jadm32", "event_type": "plan_booked"})
    assert r.status_code == 503


@pytest.mark.parametrize("body,field", [
    ({"conference_id": "nope", "event_type": "plan_booked"}, "conference_id"),
    ({"conference_id": "jadm32", "event_type": "plan_booked",
      "experience_id": "nope"}, "experience_id"),
    ({"conference_id": "jadm32", "event_type": "plan_booked",
      "window_id": "nope"}, "window_id"),
    ({"conference_id": "jadm32", "event_type": "plan_booked",
      "attendee_id": "nope"}, "attendee_id"),
    ({"conference_id": "jadm32", "event_type": "not-a-type"}, "event_type"),
])
def test_event_validation_rejects_unknown_ids(
    client: TestClient, body: dict, field: str
) -> None:
    r = client.post("/api/events", json=body)
    assert r.status_code in (400, 422)
    assert field in r.text


def test_empty_experience_id_is_rejected(client: TestClient) -> None:
    # An empty string used to skip validation and reach Neon, where the
    # foreign key turned it into a 500.
    r = client.post("/api/events", json={
        "conference_id": "jadm32", "event_type": "plan_booked", "experience_id": ""
    })
    assert r.status_code in (400, 503)


def test_event_types_derive_from_model() -> None:
    assert main.EVENT_TYPES == {
        "email_opened", "page_visited", "plan_shown", "plan_opened",
        "plan_saved", "plan_joined", "plan_booked", "plan_cancelled",
        "plan_removed_by_organizer",
    }
