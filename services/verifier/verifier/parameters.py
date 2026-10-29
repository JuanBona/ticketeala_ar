"""Carga y valida los parámetros del motor y detecta los valores que le faltan a cada señal."""

from pathlib import Path

from verifier.contract import Parameters, SignalCode, SignalParameters
from verifier.signals.registry import SIGNAL_SPECS, ParameterValue

INITIAL_PARAMETERS_PATH = Path(__file__).resolve().parents[1] / "config" / "parametros_v1.json"


class InvalidParametersError(ValueError):
    """La versión de parámetros no cumple una regla de negocio."""


def load_parameters(path: Path) -> Parameters:
    """Lee una versión de parámetros en el formato del contrato y valida RN22."""
    parameters = Parameters.model_validate_json(path.read_text(encoding="utf-8"))
    check_rn22(parameters)
    return parameters


def check_rn22(parameters: Parameters) -> None:
    """RN22: el umbral de aceptación tiene que ser mayor que el de alerta (D24)."""
    if parameters.acceptance_threshold > parameters.alert_threshold:
        return
    raise InvalidParametersError(
        f"RN22: el umbral de aceptación ({parameters.acceptance_threshold}) tiene que ser mayor "
        f"que el umbral de alerta ({parameters.alert_threshold}) "
        f"en la versión {parameters.version} de parámetros"
    )


def missing_values(parameters: Parameters, code: SignalCode) -> tuple[ParameterValue, ...]:
    """Valores que la señal usa y vienen nulos (D29); por ejemplo, S01 y S02 sin calibrar (D24)."""
    signal_parameters = parameters.signals[code]
    return tuple(
        value
        for value in ParameterValue
        if value in SIGNAL_SPECS[code].uses and _value_of(signal_parameters, value) is None
    )


def is_applicable(parameters: Parameters, code: SignalCode) -> bool:
    """D29: la señal da no_aplica si está inactiva o le falta un valor que usa."""
    return parameters.signals[code].enabled and not missing_values(parameters, code)


def _value_of(signal_parameters: SignalParameters, value: ParameterValue) -> float | None:
    match value:
        case ParameterValue.THRESHOLD:
            return signal_parameters.threshold
        case ParameterValue.WARNING_THRESHOLD:
            return signal_parameters.warning_threshold
        case ParameterValue.FACTOR:
            return signal_parameters.factor
