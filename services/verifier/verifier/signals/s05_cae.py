"""S05: CAE de 14 dígitos y vigente a la fecha del comprobante (punto 12.5).

Sin CAE no aplica (D30). Con CAE pero sin vencimiento o sin fecha, tampoco: no se puede saber si
estaba vigente (D38). El CAE se valida en formato y coherencia, sin consultar a ARCA.
"""

import re
from datetime import date

from verifier.contract import SignalParameters, SignalResult
from verifier.signals.base import (
    SignalInput,
    SignalOutcome,
    not_applicable,
    truncate_observed_value,
)

_CAE = re.compile(r"^[0-9]{14}$")  # [0-9] y no \d: solo dígitos ASCII
_ISO_DATE = re.compile(r"^[0-9]{4}-[0-9]{2}-[0-9]{2}$")


def evaluate(signal_input: SignalInput, parameters: SignalParameters) -> SignalOutcome:
    """Solo usa peso, bloqueante y activa (D29), que se aplican fuera de la señal."""
    fields = signal_input.read_fields
    cae = fields.cae.value
    if cae is None:
        return not_applicable(
            "El comprobante no tiene CAE (por ejemplo, es un ticket o es del exterior), "
            "así que no se controla."
        )
    if not _CAE.fullmatch(cae):
        return SignalOutcome(
            SignalResult.FAIL,
            truncate_observed_value(cae),
            "El CAE leído no tiene 14 dígitos. Revisá que coincida con el de la foto.",
        )
    if fields.cae_expiration.value is None or fields.date.value is None:
        return not_applicable(
            "No se pudo leer la fecha del comprobante o el vencimiento del CAE, "
            "así que no se controla si estaba vigente."
        )
    expiration = _parse_iso_date(fields.cae_expiration.value)
    receipt_date = _parse_iso_date(fields.date.value)
    observed_value = f"vence {_shown(expiration)}"
    if expiration < receipt_date:
        return SignalOutcome(
            SignalResult.FAIL,
            observed_value,
            f"El CAE venció el {_shown(expiration)}, antes de la fecha del comprobante "
            f"({_shown(receipt_date)}).",
        )
    return SignalOutcome(
        SignalResult.OK,
        observed_value,
        "El CAE tiene 14 dígitos y estaba vigente en la fecha del comprobante.",
    )


def _parse_iso_date(text: str) -> date:
    """Los campos llegan normalizados (fecha ISO); otro formato es un error de la extracción."""
    if not _ISO_DATE.fullmatch(text):
        raise ValueError(f"{text!r} no es una fecha ISO (ej.: 2026-10-25)")
    return date.fromisoformat(text)


def _shown(day: date) -> str:
    return day.strftime("%d/%m/%Y")
