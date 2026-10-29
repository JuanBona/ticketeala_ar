"""Hito de la iteración 1 (ROADMAP, paso 3): el motor valida la aritmética y el CAE.

Con los campos de resultado-verificado.json (el ejemplo de 12.5), S04, S05 y S06 dan las mismas
señales que el ejemplo: resultado, valor observado, penalización y detalle.
"""

import json
from collections.abc import Callable
from typing import Any

import pytest

from verifier.contract import Parameters, Signal, SignalCode
from verifier.scoring import penalty
from verifier.signals.base import SignalInput
from verifier.signals.evaluation import evaluate_signal

BuildSignalInput = Callable[[dict[str, Any]], SignalInput]


@pytest.mark.parametrize("code", [SignalCode.S04, SignalCode.S05, SignalCode.S06])
def test_engine_reproduces_the_fiscal_signals_of_the_example(
    code: SignalCode,
    initial_parameters_document: dict[str, Any],
    verified_result_document: dict[str, Any],
    read_fields_document: dict[str, Any],
    build_signal_input: BuildSignalInput,
) -> None:
    parameters = Parameters.model_validate_json(json.dumps(initial_parameters_document))
    expected = next(
        signal for signal in verified_result_document["senales"] if signal["codigo"] == code
    )

    outcome = evaluate_signal(code, build_signal_input(read_fields_document), parameters)
    signal = Signal(
        code=code,
        result=outcome.result,
        observed_value=outcome.observed_value,
        penalty=penalty(outcome.result, parameters.signals[code].weight),
        detail=outcome.detail,
    )

    assert signal.model_dump(mode="json") == expected
