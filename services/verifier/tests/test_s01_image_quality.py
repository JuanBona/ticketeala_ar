"""S01: nitidez e iluminación sobre el mínimo, antes del OCR (12.5, D24, D29, D30)."""

import json
from collections.abc import Callable
from typing import Any

import pytest

from verifier.contract import Parameters, Signal, SignalCode, SignalResult
from verifier.image.quality import QualityMeasurement
from verifier.scoring import penalty
from verifier.signals.base import SignalInput
from verifier.signals.evaluation import evaluate_image_signal, evaluate_signal

BuildSignalInput = Callable[[dict[str, Any]], SignalInput]

# Los mínimos de la versión 2 de los ejemplos: nitidez 100 e iluminación 60.
GOOD_PHOTO = QualityMeasurement(sharpness=412.7, illumination=138.2)


def build_parameters(document: dict[str, Any]) -> Parameters:
    """Arma los parámetros desde JSON, como llegan en el pedido."""
    return Parameters.model_validate_json(json.dumps(document))


@pytest.fixture
def calibrated_parameters(calibrated_parameters_document: dict[str, Any]) -> Parameters:
    return build_parameters(calibrated_parameters_document)


def test_engine_reproduces_s01_of_the_verified_example(
    calibrated_parameters: Parameters, verified_result_document: dict[str, Any]
) -> None:
    expected = verified_result_document["senales"][0]

    outcome = evaluate_image_signal(GOOD_PHOTO, calibrated_parameters)
    signal = Signal(
        code=SignalCode.S01,
        result=outcome.result,
        observed_value=outcome.observed_value,
        penalty=penalty(outcome.result, calibrated_parameters.signals[SignalCode.S01].weight),
        detail=outcome.detail,
    )

    assert signal.model_dump(mode="json") == expected


def test_blurry_and_dark_photo_fails_with_the_detail_of_the_rejected_example(
    calibrated_parameters: Parameters,
) -> None:
    rejected_example = QualityMeasurement(sharpness=38.4, illumination=41.0)

    outcome = evaluate_image_signal(rejected_example, calibrated_parameters)

    assert outcome.result is SignalResult.FAIL
    assert outcome.detail == (
        "La foto está borrosa y oscura. Apoyá el comprobante sobre una superficie con buena luz "
        "y sacá otra foto."
    )


def test_blurry_photo_fails_as_blurry(calibrated_parameters: Parameters) -> None:
    blurry = QualityMeasurement(sharpness=99.99, illumination=138.2)

    outcome = evaluate_image_signal(blurry, calibrated_parameters)

    assert outcome.result is SignalResult.FAIL
    assert outcome.detail.startswith("La foto está borrosa.")


def test_dark_photo_fails_as_dark(calibrated_parameters: Parameters) -> None:
    dark = QualityMeasurement(sharpness=412.7, illumination=59.99)

    outcome = evaluate_image_signal(dark, calibrated_parameters)

    assert outcome.result is SignalResult.FAIL
    assert outcome.detail.startswith("La foto está oscura.")


def test_values_equal_to_the_minimums_pass(calibrated_parameters: Parameters) -> None:
    on_the_minimums = QualityMeasurement(sharpness=100.0, illumination=60.0)

    outcome = evaluate_image_signal(on_the_minimums, calibrated_parameters)

    assert outcome.result is SignalResult.OK
    assert outcome.observed_value == "nitidez 100 · brillo 60"


def test_uncalibrated_thresholds_are_not_applicable(
    initial_parameters_document: dict[str, Any],
) -> None:
    parameters = build_parameters(initial_parameters_document)

    outcome = evaluate_image_signal(GOOD_PHOTO, parameters)

    assert outcome.result is SignalResult.NOT_APPLICABLE


def test_inactive_s01_is_not_applicable(calibrated_parameters_document: dict[str, Any]) -> None:
    calibrated_parameters_document["senales"]["S01"]["activa"] = False
    parameters = build_parameters(calibrated_parameters_document)

    outcome = evaluate_image_signal(GOOD_PHOTO, parameters)

    assert outcome.result is SignalResult.NOT_APPLICABLE


def test_s01_is_not_evaluated_with_the_read_fields(
    calibrated_parameters: Parameters,
    read_fields_document: dict[str, Any],
    build_signal_input: BuildSignalInput,
) -> None:
    with pytest.raises(ValueError, match="S01"):
        evaluate_signal(
            SignalCode.S01, build_signal_input(read_fields_document), calibrated_parameters
        )
