"""Penalización, puntaje y decisión del motor (punto 12.5, D20, D21, D37)."""

import json
from typing import Any

import pytest

from verifier.contract import Decision, Parameters, SignalCode, SignalResult, VerificationStatus
from verifier.scoring import decide, penalty, score

FIRST_ATTEMPT = 1
LAST_ATTEMPT = 3  # intentos_maximos_imagen de la versión 1 (N de D21)


def build_parameters(document: dict[str, Any]) -> Parameters:
    """Arma los parámetros desde JSON, como llegan en el pedido."""
    return Parameters.model_validate_json(json.dumps(document))


def results_with(**overrides: SignalResult) -> dict[SignalCode, SignalResult]:
    """Las 12 señales en ok, salvo las indicadas (ej.: S04=SignalResult.FAIL)."""
    results = {code: SignalResult.OK for code in SignalCode}
    results.update({SignalCode(code): result for code, result in overrides.items()})
    return results


@pytest.fixture
def parameters(initial_parameters_document: dict[str, Any]) -> Parameters:
    """Versión 1: aceptación 80, alerta 50, N = 3, S04 y S07 bloqueantes."""
    return build_parameters(initial_parameters_document)


def test_failed_signal_penalty_is_its_weight() -> None:
    assert penalty(SignalResult.FAIL, 25) == 25


def test_warning_penalty_with_even_weight_is_half() -> None:
    assert penalty(SignalResult.WARNING, 10) == 5


def test_warning_penalty_with_odd_weight_rounds_up() -> None:
    assert penalty(SignalResult.WARNING, 15) == 8


@pytest.mark.parametrize("result", [SignalResult.OK, SignalResult.NOT_APPLICABLE])
def test_signal_without_failure_or_warning_has_no_penalty(result: SignalResult) -> None:
    assert penalty(result, 40) == 0


def test_score_subtracts_penalties_as_in_the_document_example(parameters: Parameters) -> None:
    results = results_with(S09=SignalResult.FAIL, S10=SignalResult.WARNING)

    assert score(results, parameters) == 70


def test_score_has_a_floor_of_zero(parameters: Parameters) -> None:
    results = results_with(
        S03=SignalResult.FAIL,
        S04=SignalResult.FAIL,
        S05=SignalResult.FAIL,
        S08=SignalResult.FAIL,
    )

    assert score(results, parameters) == 0


def test_poor_image_before_last_attempt_is_rejected(parameters: Parameters) -> None:
    verdict = decide(results_with(S01=SignalResult.FAIL), parameters, FIRST_ATTEMPT)

    assert verdict.status is VerificationStatus.IMAGE_REJECTED
    assert verdict.score is None and verdict.decision is None


def test_image_rejection_takes_precedence_over_duplicate(parameters: Parameters) -> None:
    results = results_with(S01=SignalResult.FAIL, S07=SignalResult.FAIL)

    verdict = decide(results, parameters, FIRST_ATTEMPT)

    assert verdict.status is VerificationStatus.IMAGE_REJECTED


def test_fiscal_duplicate_is_rejected(parameters: Parameters) -> None:
    verdict = decide(results_with(S07=SignalResult.FAIL), parameters, FIRST_ATTEMPT)

    assert verdict.status is VerificationStatus.DUPLICATE_REJECTED
    assert verdict.score is None and verdict.decision is None


def test_duplicate_takes_precedence_over_blocking_failure(parameters: Parameters) -> None:
    results = results_with(S07=SignalResult.FAIL, S04=SignalResult.FAIL)

    verdict = decide(results, parameters, FIRST_ATTEMPT)

    assert verdict.status is VerificationStatus.DUPLICATE_REJECTED


def test_blocking_failure_is_alert(parameters: Parameters) -> None:
    verdict = decide(results_with(S04=SignalResult.FAIL), parameters, FIRST_ATTEMPT)

    assert verdict.status is VerificationStatus.VERIFIED
    assert verdict.decision is Decision.ALERT


def test_blocking_failure_is_alert_even_with_an_accepting_score(
    initial_parameters_document: dict[str, Any],
) -> None:
    initial_parameters_document["senales"]["S02"]["bloqueante"] = True
    parameters = build_parameters(initial_parameters_document)

    verdict = decide(results_with(S02=SignalResult.FAIL), parameters, FIRST_ATTEMPT)

    assert verdict.score == 90
    assert verdict.decision is Decision.ALERT


def test_blocking_signal_not_applicable_does_not_block(parameters: Parameters) -> None:
    verdict = decide(results_with(S04=SignalResult.NOT_APPLICABLE), parameters, FIRST_ATTEMPT)

    assert verdict.decision is Decision.ACCEPTED


def test_score_at_acceptance_threshold_is_accepted(parameters: Parameters) -> None:
    results = results_with(S02=SignalResult.FAIL, S12=SignalResult.FAIL)

    verdict = decide(results, parameters, FIRST_ATTEMPT)

    assert verdict.score == 80
    assert verdict.decision is Decision.ACCEPTED


def test_score_at_alert_threshold_is_review(parameters: Parameters) -> None:
    results = results_with(S08=SignalResult.FAIL, S12=SignalResult.FAIL)

    verdict = decide(results, parameters, FIRST_ATTEMPT)

    assert verdict.score == 50
    assert verdict.decision is Decision.REVIEW


def test_score_below_alert_threshold_is_alert(parameters: Parameters) -> None:
    results = results_with(S08=SignalResult.FAIL, S03=SignalResult.FAIL)

    verdict = decide(results, parameters, FIRST_ATTEMPT)

    assert verdict.score == 35
    assert verdict.decision is Decision.ALERT


def test_acceptance_threshold_comes_from_parameters(
    initial_parameters_document: dict[str, Any],
) -> None:
    initial_parameters_document["umbral_aceptacion"] = 90
    parameters = build_parameters(initial_parameters_document)

    verdict = decide(results_with(S05=SignalResult.FAIL), parameters, FIRST_ATTEMPT)

    assert verdict.score == 85
    assert verdict.decision is Decision.REVIEW


def test_alert_threshold_comes_from_parameters(
    initial_parameters_document: dict[str, Any],
) -> None:
    initial_parameters_document["umbral_alerta"] = 70
    parameters = build_parameters(initial_parameters_document)

    results = results_with(S03=SignalResult.FAIL, S12=SignalResult.FAIL)

    verdict = decide(results, parameters, FIRST_ATTEMPT)

    assert verdict.score == 65
    assert verdict.decision is Decision.ALERT


def test_forced_image_lowers_accepted_to_review(parameters: Parameters) -> None:
    verdict = decide(results_with(S01=SignalResult.FAIL), parameters, LAST_ATTEMPT)

    assert verdict.status is VerificationStatus.VERIFIED
    assert verdict.decision is Decision.REVIEW


def test_forced_image_keeps_alert(parameters: Parameters) -> None:
    results = results_with(S01=SignalResult.FAIL, S08=SignalResult.FAIL, S03=SignalResult.FAIL)

    verdict = decide(results, parameters, LAST_ATTEMPT)

    assert verdict.decision is Decision.ALERT


def test_forced_image_is_flagged(parameters: Parameters) -> None:
    verdict = decide(results_with(S01=SignalResult.FAIL), parameters, LAST_ATTEMPT)

    assert verdict.image_forced is True


def test_decision_requires_every_signal(parameters: Parameters) -> None:
    results = results_with()
    del results[SignalCode.S12]

    with pytest.raises(ValueError, match="S12"):
        decide(results, parameters, FIRST_ATTEMPT)
