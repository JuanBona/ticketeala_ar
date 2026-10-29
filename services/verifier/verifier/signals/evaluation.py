"""Evalúa una señal del registro con la versión de parámetros del pedido (D29)."""

from verifier.contract import Parameters, SignalCode
from verifier.parameters import missing_values
from verifier.signals.base import SignalInput, SignalOutcome, not_applicable
from verifier.signals.registry import SIGNAL_SPECS

# Regla transitoria del ROADMAP: se borra en el paso 7, cuando estén las 12 señales.
NOT_IMPLEMENTED_DETAIL = "Señal todavía no implementada"


def evaluate_signal(
    code: SignalCode, signal_input: SignalInput, parameters: Parameters
) -> SignalOutcome:
    """D29: inactiva o sin un valor que usa, no aplica; si no, corre la función de la señal."""
    if not parameters.signals[code].enabled:
        return not_applicable("Este control está desactivado en la configuración vigente.")
    if missing_values(parameters, code):
        return not_applicable("Este control todavía no tiene configurados todos sus valores.")
    evaluate = SIGNAL_SPECS[code].evaluate
    if evaluate is None:
        return not_applicable(NOT_IMPLEMENTED_DETAIL)
    return evaluate(signal_input, parameters.signals[code])
