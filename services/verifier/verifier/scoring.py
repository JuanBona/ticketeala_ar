"""Penalización, puntaje y decisión del motor (punto 12.5, D20, D21, D35)."""

from collections.abc import Mapping
from dataclasses import dataclass

from verifier.contract import Decision, Parameters, SignalCode, SignalResult, VerificationStatus

MAXIMUM_SCORE = 100

SignalResults = Mapping[SignalCode, SignalResult]


@dataclass(frozen=True)
class Verdict:
    """Estado del resultado; puntaje y decisión solo cuando el estado es verificado (D21)."""

    status: VerificationStatus
    score: int | None
    decision: Decision | None
    image_forced: bool


def penalty(result: SignalResult, weight: int) -> int:
    """12.5: falla resta el peso y advertencia la mitad, redondeada hacia arriba (D35)."""
    if result is SignalResult.FAIL:
        return weight
    if result is SignalResult.WARNING:
        return (weight + 1) // 2
    return 0


def score(results: SignalResults, parameters: Parameters) -> int:
    """12.5: puntaje = max(0, 100 − Σ penalización)."""
    total_penalty = sum(
        penalty(result, parameters.signals[code].weight) for code, result in results.items()
    )
    return max(0, MAXIMUM_SCORE - total_penalty)


def rejects_image(s01_result: SignalResult, attempt: int, parameters: Parameters) -> bool:
    """D20, fila 1: S01 no pasa y el intento es menor que N (D21); se pide otra foto."""
    return s01_result is SignalResult.FAIL and attempt < parameters.maximum_image_attempts


def decide(results: SignalResults, parameters: Parameters, attempt: int) -> Verdict:
    """D20: gana la primera condición que se cumple; con imagen forzada, mínimo revision (D21)."""
    _require_every_signal(results)
    if rejects_image(results[SignalCode.S01], attempt, parameters):
        return Verdict(VerificationStatus.IMAGE_REJECTED, None, None, image_forced=False)
    if results[SignalCode.S07] is SignalResult.FAIL:
        return Verdict(VerificationStatus.DUPLICATE_REJECTED, None, None, image_forced=False)
    verdict_score = score(results, parameters)
    decision = _decision_for(results, parameters, verdict_score)
    # Si S01 falla y no se rechazó, es el intento N: se procesó igual.
    image_forced = results[SignalCode.S01] is SignalResult.FAIL
    if image_forced and decision is Decision.ACCEPTED:
        decision = Decision.REVIEW
    return Verdict(VerificationStatus.VERIFIED, verdict_score, decision, image_forced)


def _decision_for(results: SignalResults, parameters: Parameters, verdict_score: int) -> Decision:
    """D20, filas 3 a 6, con los umbrales de la versión de parámetros (D24)."""
    if _has_blocking_failure(results, parameters):
        return Decision.ALERT
    if verdict_score >= parameters.acceptance_threshold:
        return Decision.ACCEPTED
    if verdict_score >= parameters.alert_threshold:
        return Decision.REVIEW
    return Decision.ALERT


def _has_blocking_failure(results: SignalResults, parameters: Parameters) -> bool:
    """Solo bloquea una falla: en no_aplica o advertencia, una bloqueante no bloquea (D20)."""
    return any(
        result is SignalResult.FAIL and parameters.signals[code].blocking
        for code, result in results.items()
    )


def _require_every_signal(results: SignalResults) -> None:
    missing = [code.value for code in SignalCode if code not in results]
    if missing:
        raise ValueError(f"Faltan los resultados de las señales: {', '.join(missing)}")
