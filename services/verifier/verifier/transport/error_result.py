"""Arma el resultado con estado error (D23), con el detalle cortado a lo que admite el contrato."""

from uuid import UUID

from verifier.contract import ErrorResult, VerificationStatus

MAXIMUM_DETAIL_LENGTH = 255  # Resultado.detalle en verifier.schema.json


def error_result(job_id: UUID, expense_id: int, detail: str) -> ErrorResult:
    """Sin resultado del motor: solo un detalle para soporte."""
    return ErrorResult(
        job_id=job_id,
        expense_id=expense_id,
        status=VerificationStatus.ERROR.value,
        detail=detail[:MAXIMUM_DETAIL_LENGTH],
    )
