"""Carga de parámetros, RN22 y detección de valores faltantes por señal (D24, D29)."""

import json
from pathlib import Path
from typing import Any

import pytest

from verifier.contract import Parameters, SignalCode
from verifier.parameters import (
    INITIAL_PARAMETERS_PATH,
    InvalidParametersError,
    check_rn22,
    is_applicable,
    load_parameters,
    missing_values,
)
from verifier.signals.registry import SIGNAL_SPECS, ParameterValue


def build_parameters(document: dict[str, Any]) -> Parameters:
    """Arma los parámetros desde JSON, como llegan en el pedido."""
    return Parameters.model_validate_json(json.dumps(document))


def test_acceptance_below_alert_message_names_both_thresholds(
    initial_parameters_document: dict[str, Any],
) -> None:
    initial_parameters_document["umbral_aceptacion"] = 40
    initial_parameters_document["umbral_alerta"] = 60
    parameters = build_parameters(initial_parameters_document)

    with pytest.raises(InvalidParametersError, match=r"aceptación \(40\).*alerta \(60\)"):
        check_rn22(parameters)


def test_acceptance_equal_to_alert_breaks_rn22(
    initial_parameters_document: dict[str, Any],
) -> None:
    initial_parameters_document["umbral_aceptacion"] = 50
    initial_parameters_document["umbral_alerta"] = 50
    parameters = build_parameters(initial_parameters_document)

    with pytest.raises(InvalidParametersError):
        check_rn22(parameters)


def test_loading_a_file_that_breaks_rn22_fails(
    initial_parameters_document: dict[str, Any], tmp_path: Path
) -> None:
    initial_parameters_document["umbral_aceptacion"] = 50
    parameters_path = tmp_path / "parametros.json"
    parameters_path.write_text(json.dumps(initial_parameters_document), encoding="utf-8")

    with pytest.raises(InvalidParametersError):
        load_parameters(parameters_path)


def test_initial_parameters_file_loads() -> None:
    parameters = load_parameters(INITIAL_PARAMETERS_PATH)

    assert parameters.version == 1


def test_initial_parameters_file_matches_version_1_of_the_contract_examples(
    initial_parameters_document: dict[str, Any],
) -> None:
    initial_parameters = json.loads(INITIAL_PARAMETERS_PATH.read_text(encoding="utf-8"))

    assert initial_parameters == initial_parameters_document


def test_value_the_signal_uses_is_reported_missing(
    initial_parameters_document: dict[str, Any],
) -> None:
    initial_parameters_document["senales"]["S10"]["factor"] = None
    parameters = build_parameters(initial_parameters_document)

    missing = missing_values(parameters, SignalCode.S10)

    assert missing == (ParameterValue.FACTOR,)


def test_null_value_the_signal_does_not_use_is_not_missing(
    initial_parameters_document: dict[str, Any],
) -> None:
    parameters = build_parameters(initial_parameters_document)

    missing = missing_values(parameters, SignalCode.S03)

    assert missing == ()


def test_signal_with_missing_values_is_not_applicable(
    initial_parameters_document: dict[str, Any],
) -> None:
    parameters = build_parameters(initial_parameters_document)

    applicable = is_applicable(parameters, SignalCode.S01)

    assert applicable is False


def test_disabled_signal_is_not_applicable(initial_parameters_document: dict[str, Any]) -> None:
    initial_parameters_document["senales"]["S04"]["activa"] = False
    parameters = build_parameters(initial_parameters_document)

    applicable = is_applicable(parameters, SignalCode.S04)

    assert applicable is False


def test_enabled_signal_with_every_value_is_applicable(
    initial_parameters_document: dict[str, Any],
) -> None:
    parameters = build_parameters(initial_parameters_document)

    applicable = is_applicable(parameters, SignalCode.S10)

    assert applicable is True


def test_registry_lists_the_twelve_signals() -> None:
    registered = set(SIGNAL_SPECS)

    assert registered == set(SignalCode)
