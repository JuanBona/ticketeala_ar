"""S04: dígito verificador del CUIT válido (punto 12.5, D06, D30)."""

import json
from collections.abc import Callable
from typing import Any

import pytest

from verifier.contract import Parameters, SignalCode, SignalParameters, SignalResult
from verifier.signals.base import SignalInput
from verifier.signals.evaluation import evaluate_signal
from verifier.signals.s04_cuit import evaluate

BuildSignalInput = Callable[[dict[str, Any]], SignalInput]


def build_parameters(document: dict[str, Any]) -> Parameters:
    """Arma los parámetros desde JSON, como llegan en el pedido."""
    return Parameters.model_validate_json(json.dumps(document))


@pytest.fixture
def s04_parameters(initial_parameters_document: dict[str, Any]) -> SignalParameters:
    return build_parameters(initial_parameters_document).signals[SignalCode.S04]


def test_valid_cuit_is_ok(
    read_fields_document: dict[str, Any],
    build_signal_input: BuildSignalInput,
    s04_parameters: SignalParameters,
) -> None:
    outcome = evaluate(build_signal_input(read_fields_document), s04_parameters)

    assert outcome.result is SignalResult.OK
    assert outcome.observed_value == "30-11111111-8"


def test_altered_check_digit_fails(
    read_fields_document: dict[str, Any],
    build_signal_input: BuildSignalInput,
    s04_parameters: SignalParameters,
) -> None:
    read_fields_document["cuit"]["valor"] = "30111111119"

    outcome = evaluate(build_signal_input(read_fields_document), s04_parameters)

    assert outcome.result is SignalResult.FAIL
    assert outcome.observed_value == "30-11111111-9"


def test_cuit_without_eleven_digits_fails_showing_what_was_read(
    read_fields_document: dict[str, Any],
    build_signal_input: BuildSignalInput,
    s04_parameters: SignalParameters,
) -> None:
    read_fields_document["cuit"]["valor"] = "3011111111"

    outcome = evaluate(build_signal_input(read_fields_document), s04_parameters)

    assert outcome.result is SignalResult.FAIL
    assert outcome.observed_value == "3011111111"


def test_receipt_without_cuit_is_not_applicable(
    read_fields_document: dict[str, Any],
    build_signal_input: BuildSignalInput,
    s04_parameters: SignalParameters,
) -> None:
    read_fields_document["cuit"] = {"valor": None, "confianza": None}

    outcome = evaluate(build_signal_input(read_fields_document), s04_parameters)

    assert outcome.result is SignalResult.NOT_APPLICABLE


def test_disabled_s04_is_not_applicable(
    initial_parameters_document: dict[str, Any],
    read_fields_document: dict[str, Any],
    build_signal_input: BuildSignalInput,
) -> None:
    initial_parameters_document["senales"]["S04"]["activa"] = False
    parameters = build_parameters(initial_parameters_document)

    outcome = evaluate_signal(SignalCode.S04, build_signal_input(read_fields_document), parameters)

    assert outcome.result is SignalResult.NOT_APPLICABLE
