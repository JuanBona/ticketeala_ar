"""Pipeline del motor: S01, preprocesamiento, OCR, señales y puntaje en el orden de D20."""

import json
import re
from typing import Any

import pytest
from contract_schema import RESULT_DEFINITION, validation_errors
from ocr_doubles import CountingOcr, UnavailableOcr
from synthetic_images import receipt_photo_png

from verifier.contract import RESULT_ADAPTER, Request, Result
from verifier.ocr.base import OcrUnavailableError
from verifier.parameters import InvalidParametersError
from verifier.pipeline import ImageDecodeError, verify
from verifier.signals.evaluation import NOT_IMPLEMENTED_DETAIL

# La nitidez va de 0 a 100 (D40): con mínimo 0 toda foto pasa y con 101 ninguna.
PASSING_MINIMUM = 0.0
FAILING_MINIMUM = 101.0
LAST_ATTEMPT = 3  # intentos_maximos_imagen de pedido-cola.json
UNIMPLEMENTED_SIGNALS = ["S02", "S03", "S07", "S08", "S09", "S10", "S11", "S12"]


def build_request(document: dict[str, Any], sharpness_minimum: float) -> Request:
    """El pedido con la nitidez mínima de S01 dada y sin mínimo de iluminación."""
    document["parametros"]["senales"]["S01"]["umbral"] = sharpness_minimum
    document["parametros"]["senales"]["S01"]["umbral_advertencia"] = PASSING_MINIMUM
    return Request.model_validate_json(json.dumps(document))


def as_document(result: Result) -> dict[str, Any]:
    """El resultado como JSON del contrato, con los nombres en español."""
    return RESULT_ADAPTER.dump_python(result, mode="json")


def signals_by_code(document: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {signal["codigo"]: signal for signal in document["senales"]}


def test_verified_result_matches_the_contract_schema(queue_request_document: dict[str, Any]) -> None:
    request = build_request(queue_request_document, PASSING_MINIMUM)

    document = as_document(verify(request, receipt_photo_png(), CountingOcr()))

    assert document["estado"] == "verificado"
    assert validation_errors(document, RESULT_DEFINITION) == []


def test_verified_result_brings_the_twelve_signals_in_order(
    queue_request_document: dict[str, Any],
) -> None:
    request = build_request(queue_request_document, PASSING_MINIMUM)

    document = as_document(verify(request, receipt_photo_png(), CountingOcr()))

    assert [signal["codigo"] for signal in document["senales"]] == [
        f"S{number:02d}" for number in range(1, 13)
    ]


@pytest.mark.parametrize("code", UNIMPLEMENTED_SIGNALS)
def test_unimplemented_signal_is_not_applicable(
    queue_request_document: dict[str, Any], code: str
) -> None:
    request = build_request(queue_request_document, PASSING_MINIMUM)

    signal = signals_by_code(as_document(verify(request, receipt_photo_png(), CountingOcr())))[code]

    assert signal["resultado"] == "no_aplica"
    assert signal["detalle"] == NOT_IMPLEMENTED_DETAIL


def test_raw_ocr_response_goes_into_the_result(queue_request_document: dict[str, Any]) -> None:
    request = build_request(queue_request_document, PASSING_MINIMUM)

    document = as_document(verify(request, receipt_photo_png(), CountingOcr()))

    assert "COMERCIO SINTETICO SRL" in document["respuesta_ocr"]["fullTextAnnotation"]["text"]


def test_currency_without_qr_is_the_declared_one(queue_request_document: dict[str, Any]) -> None:
    queue_request_document["contexto"]["moneda_declarada"] = "USD"
    request = build_request(queue_request_document, PASSING_MINIMUM)

    document = as_document(verify(request, receipt_photo_png(), CountingOcr()))

    assert document["campos"]["moneda"] == {"valor": "USD", "confianza": None}


def test_failed_s01_before_the_last_attempt_rejects_the_image_without_calling_the_ocr(
    queue_request_document: dict[str, Any],
) -> None:
    request = build_request(queue_request_document, FAILING_MINIMUM)
    ocr = CountingOcr()

    document = as_document(verify(request, receipt_photo_png(), ocr))

    assert document["estado"] == "imagen_rechazada"
    assert ocr.calls == 0
    assert validation_errors(document, RESULT_DEFINITION) == []


def test_failed_s01_on_the_last_attempt_is_processed_and_marked_forced(
    queue_request_document: dict[str, Any],
) -> None:
    queue_request_document["intento"] = LAST_ATTEMPT
    request = build_request(queue_request_document, FAILING_MINIMUM)

    document = as_document(verify(request, receipt_photo_png(), CountingOcr()))

    assert document["estado"] == "verificado"
    assert document["calidad_imagen"]["forzada"] is True
    # Sin la foto forzada daría 100 puntos y aceptado; D21 lo baja a revision.
    assert document["decision"] == "revision"


def test_verified_result_brings_a_dhash_valid_against_the_schema(
    queue_request_document: dict[str, Any],
) -> None:
    request = build_request(queue_request_document, PASSING_MINIMUM)

    document = as_document(verify(request, receipt_photo_png(), CountingOcr()))

    assert re.fullmatch(r"[0-9a-f]{16}", document["dhash"])
    assert validation_errors(document, RESULT_DEFINITION) == []


def test_forced_photo_result_also_brings_a_dhash(queue_request_document: dict[str, Any]) -> None:
    queue_request_document["intento"] = LAST_ATTEMPT
    request = build_request(queue_request_document, FAILING_MINIMUM)

    document = as_document(verify(request, receipt_photo_png(), CountingOcr()))

    assert document["calidad_imagen"]["forzada"] is True
    assert re.fullmatch(r"[0-9a-f]{16}", document["dhash"])


def test_forced_photo_detail_does_not_ask_for_another_photo(
    queue_request_document: dict[str, Any],
) -> None:
    queue_request_document["intento"] = LAST_ATTEMPT
    request = build_request(queue_request_document, FAILING_MINIMUM)

    s01 = signals_by_code(as_document(verify(request, receipt_photo_png(), CountingOcr())))["S01"]

    assert s01["resultado"] == "falla"
    assert "sacá otra foto" not in s01["detalle"]


def test_ocr_failure_is_reported_as_ocr_unavailable(queue_request_document: dict[str, Any]) -> None:
    request = build_request(queue_request_document, PASSING_MINIMUM)

    with pytest.raises(OcrUnavailableError):
        verify(request, receipt_photo_png(), UnavailableOcr())


def test_bytes_that_are_not_an_image_are_rejected(queue_request_document: dict[str, Any]) -> None:
    request = build_request(queue_request_document, PASSING_MINIMUM)

    with pytest.raises(ImageDecodeError, match="11 bytes"):
        verify(request, b"no es foto!", CountingOcr())


def test_parameters_breaking_rn22_are_rejected(queue_request_document: dict[str, Any]) -> None:
    queue_request_document["parametros"]["umbral_aceptacion"] = 50
    request = build_request(queue_request_document, PASSING_MINIMUM)

    with pytest.raises(InvalidParametersError, match="RN22"):
        verify(request, receipt_photo_png(), CountingOcr())
