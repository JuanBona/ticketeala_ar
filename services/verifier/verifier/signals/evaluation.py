"""Evalúa una señal del registro con la versión de parámetros del pedido (D29)."""

from verifier.contract import Parameters, SignalCode
from verifier.image.quality import QualityMeasurement
from verifier.parameters import missing_values
from verifier.signals.base import SignalInput, SignalOutcome, not_applicable
from verifier.signals.registry import SIGNAL_SPECS

# Regla transitoria del ROADMAP: se borra en el paso 7, cuando estén las 12 señales.
NOT_IMPLEMENTED_DETAIL = "Señal todavía no implementada"


def evaluate_signal(
    code: SignalCode, signal_input: SignalInput, parameters: Parameters
) -> SignalOutcome:
    """D29: inactiva o sin un valor que usa, no aplica; si no, corre la función de la señal."""
    if SIGNAL_SPECS[code].evaluate_image is not None:
        raise ValueError(
            f"{code} se evalúa antes del OCR, con las medidas de la foto: usá evaluate_image_signal"
        )
    unavailable = _unavailable_by_configuration(code, parameters)
    if unavailable is not None:
        return unavailable
    evaluate = SIGNAL_SPECS[code].evaluate
    if evaluate is None:
        return not_applicable(NOT_IMPLEMENTED_DETAIL)
    return evaluate(signal_input, parameters.signals[code])


def evaluate_image_signal(
    measurement: QualityMeasurement, parameters: Parameters
) -> SignalOutcome:
    """S01 con las medidas de la foto y las mismas reglas de D29; sin umbrales no aplica (D24)."""
    unavailable = _unavailable_by_configuration(SignalCode.S01, parameters)
    if unavailable is not None:
        return unavailable
    evaluate = SIGNAL_SPECS[SignalCode.S01].evaluate_image
    if evaluate is None:
        raise ValueError("S01 no tiene función de imagen en el registro")
    return evaluate(measurement, parameters.signals[SignalCode.S01])


def _unavailable_by_configuration(code: SignalCode, parameters: Parameters) -> SignalOutcome | None:
    """D29: una señal inactiva, o a la que le falta un valor que usa, no aplica."""
    if not parameters.signals[code].enabled:
        return not_applicable("Este control está desactivado en la configuración vigente.")
    if missing_values(parameters, code):
        return not_applicable("Este control todavía no tiene configurados todos sus valores.")
    return None
