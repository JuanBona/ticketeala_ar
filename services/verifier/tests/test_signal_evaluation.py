"""Despacho de las señales del registro con la versión de parámetros (D29, ROADMAP)."""

import json
from collections.abc import Callable
from typing import Any

from verifier.contract import Parameters, SignalCode, SignalResult
from verifier.signals.base import SignalInput
from verifier.signals.evaluation import NOT_IMPLEMENTED_DETAIL, evaluate_signal
from verifier.signals.registry import SIGNAL_SPECS

BuildSignalInput = Callable[[dict[str, Any]], SignalInput]


def test_signal_without_a_function_is_not_applicable_as_not_implemented(
    initial_parameters_document: dict[str, Any],
    read_fields_document: dict[str, Any],
    build_signal_input: BuildSignalInput,
) -> None:
    parameters = Parameters.model_validate_json(json.dumps(initial_parameters_document))

    outcome = evaluate_signal(SignalCode.S08, build_signal_input(read_fields_document), parameters)

    assert outcome.result is SignalResult.NOT_APPLICABLE
    assert outcome.detail == NOT_IMPLEMENTED_DETAIL


def test_fiscal_signals_of_step_3_are_registered() -> None:
    registered = {code for code, spec in SIGNAL_SPECS.items() if spec.evaluate is not None}

    assert registered == {SignalCode.S04, SignalCode.S05, SignalCode.S06}
