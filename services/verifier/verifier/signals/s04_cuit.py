"""S04: dígito verificador del CUIT válido (punto 12.5). Sin CUIT no aplica (D06, D30)."""

from verifier.contract import SignalParameters, SignalResult
from verifier.fiscal.cuit import format_cuit, is_valid_cuit
from verifier.signals.base import (
    SignalInput,
    SignalOutcome,
    not_applicable,
    truncate_observed_value,
)


def evaluate(signal_input: SignalInput, parameters: SignalParameters) -> SignalOutcome:
    """Solo usa peso, bloqueante y activa (D29), que se aplican fuera de la señal."""
    cuit = signal_input.read_fields.cuit.value
    if cuit is None:
        return not_applicable(
            "El comprobante no tiene CUIT (por ejemplo, es del exterior), así que no se controla."
        )
    if is_valid_cuit(cuit):
        return SignalOutcome(
            SignalResult.OK, format_cuit(cuit), "El CUIT del comercio es válido."
        )
    return SignalOutcome(
        SignalResult.FAIL,
        truncate_observed_value(format_cuit(cuit)),
        "El CUIT del comercio no es válido: no cumple el dígito verificador. "
        "Revisá que coincida con el de la foto.",
    )
