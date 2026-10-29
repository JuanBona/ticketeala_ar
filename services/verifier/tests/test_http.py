"""API HTTP del motor: GET /health."""

from fastapi.testclient import TestClient

from verifier.transport.http import app


def test_health_reports_ok() -> None:
    client = TestClient(app)

    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
