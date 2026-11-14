"""Arma el Resultado: S01, preprocesamiento, OCR, señales y puntaje (12.5, D20, D39)."""

from dataclasses import dataclass

import cv2
import numpy as np

from verifier.contract import (
    Context,
    CurrencyField,
    ImageQuality,
    Parameters,
    ReadFields,
    RejectedImageResult,
    Request,
    Result,
    Signal,
    SignalCode,
    SignalResult,
    VerificationStatus,
    VerifiedResult,
)
from verifier.image.base import Image
from verifier.image.paper import PaperRegion, find_paper
from verifier.image.preprocess import enhance_contrast, straighten_receipt
from verifier.image.quality import QualityMeasurement, measure_quality
from verifier.ocr.base import OcrProvider, OcrReading
from verifier.parameters import check_rn22
from verifier.scoring import decide, penalty, rejects_image
from verifier.signals.base import SignalInput, SignalOutcome
from verifier.signals.evaluation import evaluate_image_signal, evaluate_signal
from verifier.signals.s01_image_quality import processed_anyway

SignalOutcomes = dict[SignalCode, SignalOutcome]


class ImageDecodeError(ValueError):
    """Los bytes recibidos no son una imagen que OpenCV pueda leer."""


@dataclass(frozen=True)
class ImageCheck:
    """Medidas de la foto y S01 ya evaluada, antes del OCR (D39)."""

    measurement: QualityMeasurement
    s01: SignalOutcome


def verify(request: Request, image_bytes: bytes, ocr: OcrProvider) -> Result:
    """D20: con S01 en falla antes del intento N se pide otra foto sin llamar al OCR (D21, D39).

    Lanza OcrUnavailableError si el OCR no responde: quien llama decide si reintenta (D30).
    """
    check_rn22(request.parameters)
    image = decode_image(image_bytes)
    paper = find_paper(image)
    measurement = measure_quality(image, paper)
    s01 = evaluate_image_signal(measurement, request.parameters)
    if rejects_image(s01.result, request.attempt, request.parameters):
        return _rejected_image(request, ImageCheck(measurement, s01))
    if s01.result is SignalResult.FAIL:
        s01 = processed_anyway(s01)
    reading = ocr.read(_ocr_image(image, paper))
    return _verified(request, ImageCheck(measurement, s01), reading)


def decode_image(image_bytes: bytes) -> Image:
    """La foto en color BGR, como la usa OpenCV; JPEG, PNG o cualquier formato que OpenCV lea."""
    image = None
    if image_bytes:
        image = cv2.imdecode(np.frombuffer(image_bytes, np.uint8), cv2.IMREAD_COLOR)
    if image is None:
        raise ImageDecodeError(
            f"No se pudo leer la imagen ({len(image_bytes)} bytes): no es JPEG, PNG ni otro "
            "formato de imagen conocido"
        )
    return image


def _ocr_image(image: Image, paper: PaperRegion | None) -> Image:
    """12.5, etapa 1: enderezar si el cuadrilátero es confiable y CLAHE, solo para el OCR (D39)."""
    return enhance_contrast(straighten_receipt(image, paper).image)


def _rejected_image(request: Request, image_check: ImageCheck) -> RejectedImageResult:
    """D21: solo la calidad y el detalle de S01 para el empleado."""
    return RejectedImageResult(
        job_id=request.job_id,
        expense_id=request.expense_id,
        status=VerificationStatus.IMAGE_REJECTED.value,
        parameters_version=request.parameters.version,
        image_quality=_image_quality(image_check.measurement, forced=False),
        detail=image_check.s01.detail,
    )


def _verified(request: Request, image_check: ImageCheck, reading: OcrReading) -> VerifiedResult:
    """D20: las 12 señales, puntaje y decisión; con la foto forzada, mínimo revision (D21)."""
    read_fields = _with_declared_currency(reading.read_fields, request.context)
    # Sin QR hasta el paso 6: S03 todavía no está implementada.
    signal_input = SignalInput(read_fields=read_fields, qr=None, context=request.context)
    outcomes = _signal_outcomes(image_check.s01, signal_input, request.parameters)
    results = {code: outcome.result for code, outcome in outcomes.items()}
    verdict = decide(results, request.parameters, request.attempt)
    if verdict.score is None or verdict.decision is None:
        raise ValueError(
            f"decide devolvió {verdict.status} para el trabajo {request.job_id}: el duplicado "
            "fiscal (S07) llega en el paso 7"
        )
    return VerifiedResult(
        job_id=request.job_id,
        expense_id=request.expense_id,
        status=VerificationStatus.VERIFIED.value,
        parameters_version=request.parameters.version,
        image_quality=_image_quality(image_check.measurement, forced=verdict.image_forced),
        read_fields=read_fields,
        qr=None,
        signals=_signals(outcomes, request.parameters),
        score=verdict.score,
        decision=verdict.decision,
        ocr_response=reading.raw_response,
    )


def _with_declared_currency(read_fields: ReadFields, context: Context) -> ReadFields:
    """D31: sin QR, la moneda del comprobante es la que declaró el empleado."""
    declared = CurrencyField(value=context.declared_currency, confidence=None)
    return read_fields.model_copy(update={"currency": declared})


def _signal_outcomes(
    s01: SignalOutcome, signal_input: SignalInput, parameters: Parameters
) -> SignalOutcomes:
    """S01 ya evaluada y las otras 11 con los campos leídos, en el orden del catálogo."""
    return {
        code: s01 if code is SignalCode.S01 else evaluate_signal(code, signal_input, parameters)
        for code in SignalCode
    }


def _signals(outcomes: SignalOutcomes, parameters: Parameters) -> list[Signal]:
    """Filas de SENAL_VERIFICACION con la penalización de D37."""
    return [
        Signal(
            code=code,
            result=outcome.result,
            observed_value=outcome.observed_value,
            penalty=penalty(outcome.result, parameters.signals[code].weight),
            detail=outcome.detail,
        )
        for code, outcome in outcomes.items()
    ]


def _image_quality(measurement: QualityMeasurement, forced: bool) -> ImageQuality:
    return ImageQuality(
        sharpness=measurement.sharpness, illumination=measurement.illumination, forced=forced
    )
