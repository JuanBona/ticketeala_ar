"""Importes en formato argentino: punto de miles y coma decimal (punto 12.5, D38)."""

from decimal import Decimal

import pytest

from verifier.extraction.argentine_amounts import (
    InvalidAmountError,
    format_argentine_amount,
    from_contract_amount,
    parse_argentine_amount,
    to_contract_amount,
)

# Válidos


def test_amount_with_thousands_point_and_decimal_comma() -> None:
    assert parse_argentine_amount("48.320,00") == Decimal("48320.00")


def test_amount_with_peso_sign_and_space() -> None:
    assert parse_argentine_amount("$ 1.234,56") == Decimal("1234.56")


def test_amount_with_peso_sign_without_space() -> None:
    assert parse_argentine_amount("$1.234,56") == Decimal("1234.56")


def test_surrounding_spaces_are_ignored() -> None:
    assert parse_argentine_amount("  $ 1.234,56 ") == Decimal("1234.56")


def test_amount_without_thousands_point() -> None:
    assert parse_argentine_amount("1234,56") == Decimal("1234.56")


def test_amount_below_one_peso() -> None:
    assert parse_argentine_amount("0,50") == Decimal("0.50")


def test_amount_with_one_decimal_digit() -> None:
    assert parse_argentine_amount("12,5") == Decimal("12.50")


def test_amount_without_decimals() -> None:
    assert parse_argentine_amount("48320") == Decimal("48320.00")


def test_amount_with_several_thousands_groups() -> None:
    assert parse_argentine_amount("1.234.567,89") == Decimal("1234567.89")


def test_amount_with_the_largest_integer_part_of_the_contract() -> None:
    assert parse_argentine_amount("9.999.999.999,99") == Decimal("9999999999.99")


def test_parsed_amount_always_has_two_decimals() -> None:
    assert parse_argentine_amount("48320").as_tuple().exponent == -2


def test_amount_converts_to_the_contract_format() -> None:
    assert to_contract_amount(Decimal("48320")) == "48320.00"


def test_contract_amount_over_ten_integer_digits_is_rejected() -> None:
    with pytest.raises(InvalidAmountError):
        to_contract_amount(Decimal("10000000000.00"))


def test_contract_amount_reads_as_decimal() -> None:
    assert from_contract_amount("39933.88") == Decimal("39933.88")


def test_amount_is_shown_in_argentine_format() -> None:
    assert format_argentine_amount(Decimal("1234567.8")) == "1.234.567,80"


# Inválidos


def test_empty_text_is_not_an_amount() -> None:
    with pytest.raises(InvalidAmountError):
        parse_argentine_amount("   ")


def test_letters_are_not_an_amount() -> None:
    with pytest.raises(InvalidAmountError):
        parse_argentine_amount("$ 12a,00")


def test_negative_amount_is_rejected() -> None:
    with pytest.raises(InvalidAmountError):
        parse_argentine_amount("-1.234,56")


def test_thousands_group_with_two_digits_is_rejected() -> None:
    with pytest.raises(InvalidAmountError):
        parse_argentine_amount("12.34,00")


def test_first_thousands_group_with_four_digits_is_rejected() -> None:
    with pytest.raises(InvalidAmountError):
        parse_argentine_amount("1234.567,00")


def test_amount_with_three_decimals_is_rejected() -> None:
    with pytest.raises(InvalidAmountError):
        parse_argentine_amount("1.234,567")


def test_amount_over_ten_integer_digits_is_rejected() -> None:
    with pytest.raises(InvalidAmountError):
        parse_argentine_amount("10.000.000.000,00")


def test_non_ascii_digits_are_rejected() -> None:
    with pytest.raises(InvalidAmountError):
        parse_argentine_amount("١٢٣,٤٥")


def test_malformed_contract_amount_is_rejected() -> None:
    with pytest.raises(ValueError):
        from_contract_amount("48.320,00")


# Ambiguos (D38)


def test_single_point_with_three_digits_is_thousands() -> None:
    assert parse_argentine_amount("1.234") == Decimal("1234.00")


def test_ticket_total_without_cents_is_thousands() -> None:
    assert parse_argentine_amount("$ 12.500") == Decimal("12500.00")


def test_us_format_is_rejected_naming_it() -> None:
    with pytest.raises(InvalidAmountError, match="EE. UU."):
        parse_argentine_amount("1,234.56")


def test_comma_with_three_digits_is_rejected_naming_us_format() -> None:
    with pytest.raises(InvalidAmountError, match="EE. UU."):
        parse_argentine_amount("1,234")
