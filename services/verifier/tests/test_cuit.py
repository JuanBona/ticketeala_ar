"""Dígito verificador del CUIT: módulo 11 con pesos 5-4-3-2-7-6-5-4-3-2 (punto 12.5)."""

import pytest

from verifier.fiscal.cuit import format_cuit, is_valid_cuit

# Válidos


@pytest.mark.parametrize("cuit", ["30111111118", "30222222229"])
def test_synthetic_cuits_of_the_contract_examples_are_valid(cuit: str) -> None:
    assert is_valid_cuit(cuit) is True


def test_remainder_eleven_gives_check_digit_zero() -> None:
    assert is_valid_cuit("30111111150") is True


def test_prefix_23_reassigned_from_a_remainder_ten_is_valid() -> None:
    # 20-11111118 daría 10; ARCA lo asigna como 23-11111118-9.
    assert is_valid_cuit("23111111189") is True


# Inválidos


def test_altered_check_digit_is_invalid() -> None:
    assert is_valid_cuit("30111111119") is False


def test_remainder_ten_has_no_valid_check_digit() -> None:
    valid = [digit for digit in "0123456789" if is_valid_cuit(f"3011111110{digit}")]

    assert valid == []


def test_cuit_with_ten_digits_is_invalid() -> None:
    assert is_valid_cuit("3011111111") is False


def test_cuit_with_dashes_is_invalid() -> None:
    assert is_valid_cuit("30-11111111-8") is False


def test_cuit_with_letters_is_invalid() -> None:
    assert is_valid_cuit("3011111111A") is False


def test_cuit_with_non_ascii_digits_is_invalid() -> None:
    assert is_valid_cuit("٣٠١١١١١١١١٨") is False


# Formato para mostrar


def test_cuit_is_shown_with_dashes() -> None:
    assert format_cuit("30111111118") == "30-11111111-8"


def test_text_that_is_not_a_cuit_is_shown_as_read() -> None:
    assert format_cuit("3011111111") == "3011111111"
