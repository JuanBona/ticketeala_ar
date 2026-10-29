"""Entrada y salida de una señal. Cada señal es una función pura con esta firma."""

from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

from verifier.contract import Context, ReadFields, SignalParameters, SignalResult
from verifier.image.quality import QualityMeasurement

MAXIMUM_OBSERVED_VALUE_LENGTH = 100  # valor_observado del contrato


@dataclass(frozen=True)
class SignalInput:
    """Lo que evalúan las señales: campos leídos, QR fiscal decodificado y contexto del pedido."""

    read_fields: ReadFields
    qr: dict[str, Any] | None
    context: Context


@dataclass(frozen=True)
class SignalOutcome:
    """Resultado de una señal; la penalización la calcula scoring.penalty (D37).

    El detalle va en español llano para el empleado (RNF06), en hasta 255 caracteres.
    """

    result: SignalResult
    observed_value: str | None
    detail: str


SignalFunction = Callable[[SignalInput, SignalParameters], SignalOutcome]
# S01 corre antes del OCR, cuando todavía no hay campos leídos: evalúa las medidas de la foto.
ImageSignalFunction = Callable[[QualityMeasurement, SignalParameters], SignalOutcome]


def not_applicable(detail: str, observed_value: str | None = None) -> SignalOutcome:
    """La señal no aplica: no penaliza y, si es bloqueante, no bloquea (D20)."""
    return SignalOutcome(SignalResult.NOT_APPLICABLE, observed_value, detail)


def truncate_observed_value(value: str) -> str:
    """Lo leído puede venir largo; el contrato admite hasta 100 caracteres."""
    return value[:MAXIMUM_OBSERVED_VALUE_LENGTH]
