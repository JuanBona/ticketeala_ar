"""API HTTP del motor: GET /health y POST /verify con multipart (D23)."""

import json
from collections.abc import Iterator
from typing import Any

import httpx2
import pytest
from conftest import read_example_document
from contract_schema import RESULT_DEFINITION, validation_errors
from fastapi.testclient import TestClient
from ocr_doubles import CountingOcr, UnavailableOcr
from synthetic_images import receipt_photo_png

from verifier.ocr.base import OcrProvider
from verifier.transport.http import app, get_ocr_provider

PHOTO_NAME = "factura-gasto-205.png"


@pytest.fixture
def client() -> Iterator[TestClient]:
    """Cliente de prueba con el OCR falso de la grabación sintética."""
    app.dependency_overrides[get_ocr_provider] = CountingOcr
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture
def http_request_document() -> dict[str, Any]:
    """pedido-http.json: imagen adjunta, tercer intento, parámetros de la versión 1."""
    return read_example_document("pedido-http.json")


def use_ocr(provider: type[OcrProvider]) -> None:
    app.dependency_overrides[get_ocr_provider] = provider


def post_verify(client: TestClient, request_document: dict[str, Any]) -> httpx2.Response:
    return client.post(
        "/verify",
        data={"pedido": json.dumps(request_document)},
        files={"archivo": (PHOTO_NAME, receipt_photo_png(), "image/png")},
    )


def test_health_reports_ok(client: TestClient) -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_verify_returns_a_verified_result_that_matches_the_schema(
    client: TestClient, http_request_document: dict[str, Any]
) -> None:
    response = post_verify(client, http_request_document)

    assert response.status_code == 200
    assert response.json()["estado"] == "verificado"
    assert validation_errors(response.json(), RESULT_DEFINITION) == []


def test_verify_returns_the_rejected_image_result(
    client: TestClient, http_request_document: dict[str, Any]
) -> None:
    http_request_document["intento"] = 1
    s01 = http_request_document["parametros"]["senales"]["S01"]
    s01["umbral"], s01["umbral_advertencia"] = 101.0, 0.0

    response = post_verify(client, http_request_document)

    assert response.status_code == 200
    assert response.json()["estado"] == "imagen_rechazada"


def test_verify_reports_an_ocr_failure_as_an_error_result(
    client: TestClient, http_request_document: dict[str, Any]
) -> None:
    use_ocr(UnavailableOcr)

    response = post_verify(client, http_request_document)

    assert response.status_code == 200
    assert response.json()["estado"] == "error"
    assert "El OCR no respondió" in response.json()["detalle"]
    assert validation_errors(response.json(), RESULT_DEFINITION) == []


def test_verify_reports_an_unreadable_image_as_an_error_result(
    client: TestClient, http_request_document: dict[str, Any]
) -> None:
    response = client.post(
        "/verify",
        data={"pedido": json.dumps(http_request_document)},
        files={"archivo": (PHOTO_NAME, b"no es foto!", "image/png")},
    )

    assert response.status_code == 200
    assert response.json()["estado"] == "error"
    assert "No se pudo leer la imagen" in response.json()["detalle"]


def test_verify_without_the_photo_is_unprocessable(
    client: TestClient, http_request_document: dict[str, Any]
) -> None:
    response = client.post("/verify", data={"pedido": json.dumps(http_request_document)})

    assert response.status_code == 422


def test_verify_with_a_request_outside_the_contract_is_unprocessable(
    client: TestClient, http_request_document: dict[str, Any]
) -> None:
    del http_request_document["contexto"]["tipo_gasto"]

    response = post_verify(client, http_request_document)

    assert response.status_code == 422
    assert "tipo_gasto" in response.json()["detail"]


def test_verify_with_an_image_in_storage_is_unprocessable(
    client: TestClient, http_request_document: dict[str, Any]
) -> None:
    http_request_document["imagen"] = {"origen": "almacenamiento", "clave": "comprobantes/a.jpg"}

    response = post_verify(client, http_request_document)

    assert response.status_code == 422
    assert "archivo" in response.json()["detail"]


def test_verify_with_parameters_breaking_rn22_is_unprocessable(
    client: TestClient, http_request_document: dict[str, Any]
) -> None:
    http_request_document["parametros"]["umbral_alerta"] = 90

    response = post_verify(client, http_request_document)

    assert response.status_code == 422
    assert "RN22" in response.json()["detail"]
