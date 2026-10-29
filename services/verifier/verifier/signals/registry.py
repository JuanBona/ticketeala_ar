"""Registro de las 12 señales: qué valores de PARAMETRO_SENAL usa cada una (D29) y su función."""

from dataclasses import dataclass
from enum import StrEnum

from verifier.contract import SignalCode
from verifier.signals import s04_cuit, s05_cae, s06_totals
from verifier.signals.base import SignalFunction


class ParameterValue(StrEnum):
    """Valores opcionales de PARAMETRO_SENAL; peso, bloqueante y activa están siempre (D24)."""

    THRESHOLD = "umbral"
    WARNING_THRESHOLD = "umbral_advertencia"
    FACTOR = "factor"


@dataclass(frozen=True)
class SignalSpec:
    """Una señal del catálogo de 12.5, los valores que necesita y su función (None si falta)."""

    code: SignalCode
    uses: frozenset[ParameterValue]
    evaluate: SignalFunction | None = None


_THRESHOLD_ONLY = frozenset({ParameterValue.THRESHOLD})
_NO_VALUES: frozenset[ParameterValue] = frozenset()

SIGNAL_SPECS: dict[SignalCode, SignalSpec] = {
    spec.code: spec
    for spec in (
        # Nitidez mínima (umbral) e iluminación mínima (umbral_advertencia).
        SignalSpec(
            SignalCode.S01,
            frozenset({ParameterValue.THRESHOLD, ParameterValue.WARNING_THRESHOLD}),
        ),
        SignalSpec(SignalCode.S02, _THRESHOLD_ONLY),  # confianza mínima por campo
        SignalSpec(SignalCode.S03, _NO_VALUES),
        SignalSpec(SignalCode.S04, _NO_VALUES, s04_cuit.evaluate),
        SignalSpec(SignalCode.S05, _NO_VALUES, s05_cae.evaluate),
        SignalSpec(SignalCode.S06, _THRESHOLD_ONLY, s06_totals.evaluate),  # tolerancia en pesos
        SignalSpec(SignalCode.S07, _NO_VALUES),
        SignalSpec(SignalCode.S08, _THRESHOLD_ONLY),  # distancia de Hamming máxima
        SignalSpec(SignalCode.S09, _THRESHOLD_ONLY),  # días de tolerancia
        # Falla sobre umbral (km), advertencia sobre umbral_advertencia (km), k del trayecto (D19).
        SignalSpec(SignalCode.S10, frozenset(ParameterValue)),
        SignalSpec(SignalCode.S11, _NO_VALUES),
        # Mínimo de gastos previos (umbral) y multiplicador del IQR (factor).
        SignalSpec(SignalCode.S12, frozenset({ParameterValue.THRESHOLD, ParameterValue.FACTOR})),
    )
}
