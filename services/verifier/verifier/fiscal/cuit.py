"""Dígito verificador del CUIT (punto 12.5: módulo 11 con pesos 5-4-3-2-7-6-5-4-3-2).

Los pesos salen del documento. No encontramos una fuente oficial de ARCA para los restos 11 y 10,
así que se usa la convención de las implementaciones públicas: 11 − (suma mod 11); si da 11, el
dígito es 0, y si da 10, ningún dígito es válido (ARCA no asigna ese número y lo reemplaza por el
prefijo 23 o 33, que con este mismo cálculo da 9 o 4).
"""

import re

_CUIT = re.compile(r"^[0-9]{11}$")  # sin guiones (D31); [0-9] y no \d, solo dígitos ASCII
_WEIGHTS = (5, 4, 3, 2, 7, 6, 5, 4, 3, 2)


def has_cuit_format(cuit: str) -> bool:
    """11 dígitos sin guiones, sin mirar el dígito verificador."""
    return _CUIT.fullmatch(cuit) is not None


def is_valid_cuit(cuit: str) -> bool:
    """11 dígitos sin guiones y el último coincide con el dígito verificador."""
    return has_cuit_format(cuit) and _check_digit(cuit[:10]) == int(cuit[10])


def format_cuit(cuit: str) -> str:
    """Para mostrarle al empleado: "30111111118" → "30-11111111-8"; otro texto queda igual."""
    if not has_cuit_format(cuit):
        return cuit
    return f"{cuit[:2]}-{cuit[2:10]}-{cuit[10]}"


def _check_digit(first_ten: str) -> int | None:
    """None si el resto da 10: ese número no tiene dígito verificador válido."""
    total = sum(int(digit) * weight for digit, weight in zip(first_ten, _WEIGHTS, strict=True))
    digit = 11 - total % 11
    if digit == 11:
        return 0
    if digit == 10:
        return None
    return digit
