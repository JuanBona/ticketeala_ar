"""Importes en formato argentino (punto de miles, coma decimal) y en el formato del contrato.

Casos ambiguos (D38): "1.234" es 1234,00, porque el punto siempre separa miles y un importe no
tiene tres decimales. El formato de EE. UU. ("1,234.56" o "1,234") se rechaza sin reinterpretarlo:
un carácter mal leído por el OCR cambiaría el importe mil veces.
"""

import re
from decimal import Decimal

# Los patrones usan [0-9] y no \d: en Python \d también acepta dígitos de otros alfabetos.
_ARGENTINE_AMOUNT = re.compile(
    r"^\$?\s*(?P<integer>[0-9]{1,3}(?:\.[0-9]{3})+|[0-9]+)(?:,(?P<decimals>[0-9]{1,2}))?$"
)
_US_AMOUNT = re.compile(r"^\$?\s*[0-9]{1,3}(?:,[0-9]{3})+(?:\.[0-9]{1,2})?$")
_CONTRACT_AMOUNT = re.compile(r"^-?[0-9]{1,10}\.[0-9]{2}$")

MAXIMUM_INTEGER_DIGITS = 10  # numeric(12,2) del contrato
_CENTS = Decimal("0.01")


class InvalidAmountError(ValueError):
    """El texto no es un importe en formato argentino o no entra en el contrato."""


def parse_argentine_amount(text: str) -> Decimal:
    """Pasa "$ 48.320,00" a Decimal("48320.00"); siempre con dos decimales."""
    stripped = text.strip()
    match = _ARGENTINE_AMOUNT.fullmatch(stripped)
    if match is None:
        if _US_AMOUNT.fullmatch(stripped):
            raise InvalidAmountError(
                f"El importe {text!r} parece estar en formato de EE. UU. (coma de miles, "
                "punto decimal); se espera formato argentino"
            )
        raise InvalidAmountError(f"El importe {text!r} no está en formato argentino")
    integer = match["integer"].replace(".", "")
    decimals = match["decimals"] or "0"
    return _within_contract(Decimal(f"{integer}.{decimals}").quantize(_CENTS), text)


def to_contract_amount(amount: Decimal) -> str:
    """Formato Monto del contrato: punto decimal, dos decimales, sin separador de miles."""
    return f"{_within_contract(amount.quantize(_CENTS), amount):f}"


def from_contract_amount(text: str) -> Decimal:
    """Lee un Monto del contrato ("39933.88"); los campos ya vienen normalizados."""
    if not _CONTRACT_AMOUNT.fullmatch(text):
        raise ValueError(f"{text!r} no es un monto del contrato (ej.: 48320.00)")
    return Decimal(text)


def format_argentine_amount(amount: Decimal) -> str:
    """Para mostrarle al empleado: Decimal("48320") → "48.320,00"."""
    return f"{amount.quantize(_CENTS):,.2f}".replace(",", "_").replace(".", ",").replace("_", ".")


def _within_contract(amount: Decimal, original: object) -> Decimal:
    # adjusted() es la posición del dígito más significativo: 9999999999 → 9.
    if amount.adjusted() >= MAXIMUM_INTEGER_DIGITS:
        raise InvalidAmountError(
            f"El importe {original!r} supera los {MAXIMUM_INTEGER_DIGITS} dígitos enteros "
            "del contrato"
        )
    return amount
