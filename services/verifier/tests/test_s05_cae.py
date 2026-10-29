"""S05: CAE de 14 dígitos y vigente a la fecha del comprobante (punto 12.5, D30, D38)."""

import json
from collections.abc import Callable
from typing import Any

import pytest

from verifier.contract import Parameters, SignalCode, SignalParameters, SignalResult
from verifier.signals.base import SignalInput
from verifier.signals.evaluation import evaluate_signal
from verifier.signals.s05_cae import evaluate

BuildSignalInput = Callable[[dict[str, Any]], SignalInput]
EMPTY_FIELD = {"valor": None, "confianza": None}


def build_parameters(document: dict[str, Any]) -> Parameters:
    """Arma los parámetros desde JSON, como llegan en el pedido."""
    return Parameters.model_validate_json(json.dumps(document))


@pytest.fixture
def s05_parameters(initial_parameters_document: dict[str, Any]) -> SignalParameters:
    return build_parameters(initial_parameters_document).signals[SignalCode.S05]


def test_cae_valid_after_the_receipt_date_is_ok(
    read_fields_document: dict[str, Any],
    build_signal_input: BuildSignalInput,
    s05_parameters: SignalParameters,
) -> None:
    outcome = evaluate(build_signal_input(read_fields_document), s05_parameters)

    assert outcome.result is SignalResult.OK
    assert outcome.observed_value == "vence 04/11/2026"


def test_cae_expiring_on_the_receipt_date_is_ok(
    read_fields_document: dict[str, Any],
    build_signal_input: BuildSignalInput,
    s05_parameters: SignalParameters,
) -> None:
    read_fields_document["cae_vencimiento"]["valor"] = "2026-10-25"

    outcome = evaluate(build_signal_input(read_fields_document), s05_parameters)

    assert outcome.result is SignalResult.OK


def test_cae_expired_before_the_receipt_date_fails(
    read_fields_document: dict[str, Any],
    build_signal_input: BuildSignalInput,
    s05_parameters: SignalParameters,
) -> None:
    read_fields_document["cae_vencimiento"]["valor"] = "2026-10-20"

    outcome = evaluate(build_signal_input(read_fields_document), s05_parameters)

    assert outcome.result is SignalResult.FAIL
    assert outcome.detail == (
        "El CAE venció el 20/10/2026, antes de la fecha del comprobante (25/10/2026)."
    )


def test_cae_with_thirteen_digits_fails(
    read_fields_document: dict[str, Any],
    build_signal_input: BuildSignalInput,
    s05_parameters: SignalParameters,
) -> None:
    read_fields_document["cae"]["valor"] = "7643210987654"

    outcome = evaluate(build_signal_input(read_fields_document), s05_parameters)

    assert outcome.result is SignalResult.FAIL
    assert outcome.observed_value == "7643210987654"


def test_cae_with_letters_fails(
    read_fields_document: dict[str, Any],
    build_signal_input: BuildSignalInput,
    s05_parameters: SignalParameters,
) -> None:
    read_fields_document["cae"]["valor"] = "7643210987654O"

    outcome = evaluate(build_signal_input(read_fields_document), s05_parameters)

    assert outcome.result is SignalResult.FAIL


def test_receipt_without_cae_is_not_applicable(
    read_fields_document: dict[str, Any],
    build_signal_input: BuildSignalInput,
    s05_parameters: SignalParameters,
) -> None:
    read_fields_document["cae"] = EMPTY_FIELD

    outcome = evaluate(build_signal_input(read_fields_document), s05_parameters)

    assert outcome.result is SignalResult.NOT_APPLICABLE


def test_cae_without_expiration_is_not_applicable(
    read_fields_document: dict[str, Any],
    build_signal_input: BuildSignalInput,
    s05_parameters: SignalParameters,
) -> None:
    read_fields_document["cae_vencimiento"] = EMPTY_FIELD

    outcome = evaluate(build_signal_input(read_fields_document), s05_parameters)

    assert outcome.result is SignalResult.NOT_APPLICABLE


def test_cae_without_receipt_date_is_not_applicable(
    read_fields_document: dict[str, Any],
    build_signal_input: BuildSignalInput,
    s05_parameters: SignalParameters,
) -> None:
    read_fields_document["fecha"] = EMPTY_FIELD

    outcome = evaluate(build_signal_input(read_fields_document), s05_parameters)

    assert outcome.result is SignalResult.NOT_APPLICABLE


def test_malformed_date_is_rejected_as_a_normalization_bug(
    read_fields_document: dict[str, Any],
    build_signal_input: BuildSignalInput,
    s05_parameters: SignalParameters,
) -> None:
    read_fields_document["cae_vencimiento"]["valor"] = "04/11/2026"

    with pytest.raises(ValueError):
        evaluate(build_signal_input(read_fields_document), s05_parameters)


def test_disabled_s05_is_not_applicable(
    initial_parameters_document: dict[str, Any],
    read_fields_document: dict[str, Any],
    build_signal_input: BuildSignalInput,
) -> None:
    initial_parameters_document["senales"]["S05"]["activa"] = False
    parameters = build_parameters(initial_parameters_document)

    outcome = evaluate_signal(SignalCode.S05, build_signal_input(read_fields_document), parameters)

    assert outcome.result is SignalResult.NOT_APPLICABLE
