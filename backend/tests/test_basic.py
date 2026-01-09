"""Basic tests to verify project setup."""

import pytest
from fastapi.testclient import TestClient


@pytest.mark.unit
def test_app_imports() -> None:
    """Test that main app can be imported."""
    from yardrover.main import app

    assert app is not None
    assert app.title == "YardRover API"
    assert app.version == "2.0.0"


@pytest.mark.unit
def test_health_endpoint(test_client: TestClient) -> None:
    """Test basic health endpoint."""
    response = test_client.get("/api/health")
    assert response.status_code == 200

    data = response.json()
    assert data["status"] == "healthy"
    assert data["version"] == "2.0.0"


@pytest.mark.unit
def test_docs_endpoint(test_client: TestClient) -> None:
    """Test that API docs are accessible."""
    response = test_client.get("/docs")
    assert response.status_code == 200


@pytest.mark.unit
def test_openapi_spec(test_client: TestClient) -> None:
    """Test that OpenAPI spec is available."""
    response = test_client.get("/openapi.json")
    assert response.status_code == 200

    spec = response.json()
    assert spec["info"]["title"] == "YardRover API"
    assert spec["info"]["version"] == "2.0.0"
