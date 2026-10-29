"""S06: en comprobantes clase A, total = neto + no gravado + exento + IVA + otros tributos (D18).

Los conceptos ausentes cuentan 0 y la tolerancia es `umbral` (D29), en la moneda del comprobante.
Fuera de la tolerancia (D18, D38):
- total mayor y algún concepto extra sin leer → advertencia: la diferencia puede ser ese concepto;
- total menor, o mayor con los tres conceptos extra leídos → falla.
Sin total, neto o IVA no se puede controlar: no aplica (D38).
"""

from decimal import Decimal

from verifier.contract import ReadField, SignalParameters, SignalResult
from verifier.extraction.argentine_amounts import format_argentine_amount, from_contract_amount
from verifier.fiscal.receipt_types import CLASS_A_CODES
from verifier.signals.base import SignalInput, SignalOutcome, not_applicable


def evaluate(signal_input: SignalInput, parameters: SignalParameters) -> SignalOutcome:
    """Usa `umbral` como tolerancia; evaluate_signal ya comprobó que no es nulo (D29)."""
    fields = signal_input.read_fields
    if fields.receipt_type.value not in CLASS_A_CODES:
        return not_applicable("Este control solo se hace en facturas A.")
    total = _amount(fields.total)
    net = _amount(fields.net)
    vat = _amount(fields.vat)
    if total is None or net is None or vat is None:
        return not_applicable(
            "No se pudo leer el total, el neto o el IVA de la factura, "
            "así que no se controla que sumen bien."
        )
    if parameters.threshold is None:
        raise ValueError("S06 sin tolerancia: evaluate_signal tenía que devolver no_aplica (D29)")
    extras = [_amount(field) for field in (fields.untaxed, fields.exempt, fields.other_taxes)]
    difference = total - (net + vat + sum(extra for extra in extras if extra is not None))
    tolerance = Decimal(str(parameters.threshold))
    money = _money(abs(difference), fields.currency.value)
    observed_value = f"diferencia {money}"
    if abs(difference) <= tolerance:
        detail = (
            "Neto más IVA da el total de la factura."
            if all(extra is None for extra in extras)
            else "Los importes de la factura suman el total."
        )
        return SignalOutcome(SignalResult.OK, observed_value, detail)
    if difference > 0 and any(extra is None for extra in extras):
        return SignalOutcome(
            SignalResult.WARNING,
            observed_value,
            f"El total supera en {money} la suma de los importes leídos. Puede haber "
            "percepciones o impuestos que no se leyeron.",
        )
    return SignalOutcome(
        SignalResult.FAIL,
        observed_value,
        f"Los importes de la factura no suman el total: hay una diferencia de {money}. "
        "Revisá que coincidan con los de la foto.",
    )


def _amount(field: ReadField) -> Decimal | None:
    return None if field.value is None else from_contract_amount(field.value)


def _money(amount: Decimal, currency: str) -> str:
    symbol = "$" if currency == "ARS" else currency
    return f"{symbol} {format_argentine_amount(amount)}"
