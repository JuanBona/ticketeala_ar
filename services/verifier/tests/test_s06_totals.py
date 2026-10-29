"""S06: en comprobantes clase A, el total cierra con sus conceptos ±tolerancia (D18, D29, D38).

El ejemplo de 12.5 trae neto 39933.88 + IVA 8386.12 = total 48320.00, sin conceptos extra.
"""

import json
from collections.abc import Callable
from typing import Any

import pytest

from verifier.contract import Parameters, SignalCode, SignalParameters, SignalResult
from verifier.signals.base import SignalInput
from verifier.signals.evaluation import evaluate_signal
from verifier.signals.s06_totals import evaluate

BuildSignalInput = Callable[[dict[str, Any]], SignalInput]
EMPTY_FIELD = {"valor": None, "confianza": None}


def build_parameters(document: dict[str, Any]) -> Parameters:
    """Arma los parámetros desde JSON, como llegan en el pedido."""
    return Parameters.model_validate_json(json.dumps(document))


@pytest.fixture
def s06_parameters(initial_parameters_document: dict[str, Any]) -> SignalParameters:
    """Versión 1: tolerancia de un peso."""
    return build_parameters(initial_parameters_document).signals[SignalCode.S06]


def set_amount(read_fields: dict[str, Any], field: str, value: str) -> None:
    read_fields[field] = {"valor": value, "confianza": 0.9}


# ok


def test_net_plus_vat_equal_to_total_is_ok(
    read_fields_document: dict[str, Any],
    build_signal_input: BuildSignalInput,
    s06_parameters: SignalParameters,
) -> None:
    outcome = evaluate(build_signal_input(read_fields_document), s06_parameters)

    assert outcome.result is SignalResult.OK
    assert outcome.observed_value == "diferencia $ 0,00"


def test_difference_equal_to_the_tolerance_is_ok(
    read_fields_document: dict[str, Any],
    build_signal_input: BuildSignalInput,
    s06_parameters: SignalParameters,
) -> None:
    set_amount(read_fields_document, "total", "48321.00")

    outcome = evaluate(build_signal_input(read_fields_document), s06_parameters)

    assert outcome.result is SignalResult.OK


def test_extra_concepts_count_in_the_sum(
    read_fields_document: dict[str, Any],
    build_signal_input: BuildSignalInput,
    s06_parameters: SignalParameters,
) -> None:
    set_amount(read_fields_document, "exento", "500.00")
    set_amount(read_fields_document, "total", "48820.00")

    outcome = evaluate(build_signal_input(read_fields_document), s06_parameters)

    assert outcome.result is SignalResult.OK
    assert outcome.detail == "Los importes de la factura suman el total."


def test_tolerance_comes_from_the_parameters(
    initial_parameters_document: dict[str, Any],
    read_fields_document: dict[str, Any],
    build_signal_input: BuildSignalInput,
) -> None:
    initial_parameters_document["senales"]["S06"]["umbral"] = 2
    parameters = build_parameters(initial_parameters_document).signals[SignalCode.S06]
    set_amount(read_fields_document, "total", "48321.50")

    outcome = evaluate(build_signal_input(read_fields_document), parameters)

    assert outcome.result is SignalResult.OK


def test_ticket_invoice_a_is_checked(
    read_fields_document: dict[str, Any],
    build_signal_input: BuildSignalInput,
    s06_parameters: SignalParameters,
) -> None:
    read_fields_document["tipo_comprobante"]["valor"] = "81"

    outcome = evaluate(build_signal_input(read_fields_document), s06_parameters)

    assert outcome.result is SignalResult.OK


def test_difference_in_another_currency_shows_its_code(
    read_fields_document: dict[str, Any],
    build_signal_input: BuildSignalInput,
    s06_parameters: SignalParameters,
) -> None:
    read_fields_document["moneda"]["valor"] = "USD"

    outcome = evaluate(build_signal_input(read_fields_document), s06_parameters)

    assert outcome.observed_value == "diferencia USD 0,00"


# advertencia


def test_total_above_net_plus_vat_without_extras_is_a_warning(
    read_fields_document: dict[str, Any],
    build_signal_input: BuildSignalInput,
    s06_parameters: SignalParameters,
) -> None:
    set_amount(read_fields_document, "total", "49570.00")

    outcome = evaluate(build_signal_input(read_fields_document), s06_parameters)

    assert outcome.result is SignalResult.WARNING
    assert outcome.observed_value == "diferencia $ 1.250,00"


def test_total_above_the_sum_with_some_extras_unread_is_a_warning(
    read_fields_document: dict[str, Any],
    build_signal_input: BuildSignalInput,
    s06_parameters: SignalParameters,
) -> None:
    set_amount(read_fields_document, "exento", "500.00")
    set_amount(read_fields_document, "total", "49570.00")

    outcome = evaluate(build_signal_input(read_fields_document), s06_parameters)

    assert outcome.result is SignalResult.WARNING


# falla


def test_total_below_net_plus_vat_fails(
    read_fields_document: dict[str, Any],
    build_signal_input: BuildSignalInput,
    s06_parameters: SignalParameters,
) -> None:
    set_amount(read_fields_document, "total", "48000.00")

    outcome = evaluate(build_signal_input(read_fields_document), s06_parameters)

    assert outcome.result is SignalResult.FAIL
    assert outcome.observed_value == "diferencia $ 320,00"


def test_total_above_the_sum_with_every_extra_read_fails(
    read_fields_document: dict[str, Any],
    build_signal_input: BuildSignalInput,
    s06_parameters: SignalParameters,
) -> None:
    for field in ("no_gravado", "exento", "otros_tributos"):
        set_amount(read_fields_document, field, "0.00")
    set_amount(read_fields_document, "total", "49570.00")

    outcome = evaluate(build_signal_input(read_fields_document), s06_parameters)

    assert outcome.result is SignalResult.FAIL


# no_aplica


def test_invoice_b_is_not_applicable(
    read_fields_document: dict[str, Any],
    build_signal_input: BuildSignalInput,
    s06_parameters: SignalParameters,
) -> None:
    read_fields_document["tipo_comprobante"]["valor"] = "6"

    outcome = evaluate(build_signal_input(read_fields_document), s06_parameters)

    assert outcome.result is SignalResult.NOT_APPLICABLE


def test_receipt_without_arca_code_is_not_applicable(
    read_fields_document: dict[str, Any],
    build_signal_input: BuildSignalInput,
    s06_parameters: SignalParameters,
) -> None:
    read_fields_document["tipo_comprobante"] = EMPTY_FIELD

    outcome = evaluate(build_signal_input(read_fields_document), s06_parameters)

    assert outcome.result is SignalResult.NOT_APPLICABLE


@pytest.mark.parametrize("field", ["total", "neto", "iva"])
def test_invoice_a_without_a_required_amount_is_not_applicable(
    field: str,
    read_fields_document: dict[str, Any],
    build_signal_input: BuildSignalInput,
    s06_parameters: SignalParameters,
) -> None:
    read_fields_document[field] = EMPTY_FIELD

    outcome = evaluate(build_signal_input(read_fields_document), s06_parameters)

    assert outcome.result is SignalResult.NOT_APPLICABLE


def test_s06_without_tolerance_is_not_applicable(
    initial_parameters_document: dict[str, Any],
    read_fields_document: dict[str, Any],
    build_signal_input: BuildSignalInput,
) -> None:
    initial_parameters_document["senales"]["S06"]["umbral"] = None
    parameters = build_parameters(initial_parameters_document)

    outcome = evaluate_signal(SignalCode.S06, build_signal_input(read_fields_document), parameters)

    assert outcome.result is SignalResult.NOT_APPLICABLE


def test_disabled_s06_is_not_applicable(
    initial_parameters_document: dict[str, Any],
    read_fields_document: dict[str, Any],
    build_signal_input: BuildSignalInput,
) -> None:
    initial_parameters_document["senales"]["S06"]["activa"] = False
    parameters = build_parameters(initial_parameters_document)

    outcome = evaluate_signal(SignalCode.S06, build_signal_input(read_fields_document), parameters)

    assert outcome.result is SignalResult.NOT_APPLICABLE
