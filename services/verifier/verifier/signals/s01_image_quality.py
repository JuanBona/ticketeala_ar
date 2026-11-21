"""S01: nitidez e iluminación de la foto sobre el mínimo, antes de llamar al OCR (punto 12.5).

Se evalúa con las medidas de la región del papel (D39, D40), no con los campos leídos. Solo da ok
o falla (D30); con falla antes del intento N se pide otra foto (D21).
"""

from dataclasses import replace

from verifier.contract import SignalParameters, SignalResult
from verifier.image.quality import QualityMeasurement
from verifier.signals.base import SignalOutcome

_GOOD_PHOTO = "La foto se ve nítida y con buena luz."
_BLURRY = "La foto está borrosa."
_DARK = "La foto está oscura."
_BLURRY_AND_DARK = "La foto está borrosa y oscura."
_IN_GOOD_LIGHT = "Apoyá el comprobante sobre una superficie con buena luz y sacá otra foto."
_RETAKE_ADVICE = {
    _BLURRY: "Sostené el celular firme, esperá a que enfoque y sacá otra foto.",
    _DARK: _IN_GOOD_LIGHT,
    _BLURRY_AND_DARK: _IN_GOOD_LIGHT,
}
# D21: en el intento N ya no se pide otra foto; se procesa igual y queda como mínimo en revisión.
_PROCESSED_ANYWAY = "Se procesó igual porque es el último intento permitido; la revisa Contaduría."
_FORCED_DETAILS = {
    f"{problem} {advice}": f"{problem} {_PROCESSED_ANYWAY}"
    for problem, advice in _RETAKE_ADVICE.items()
}


def evaluate(measurement: QualityMeasurement, parameters: SignalParameters) -> SignalOutcome:
    """D29: umbral = nitidez mínima, umbral_advertencia = iluminación mínima; el mínimo pasa."""
    if parameters.threshold is None or parameters.warning_threshold is None:
        raise ValueError(
            "S01 sin nitidez o iluminación mínima: evaluate_image_signal tenía que devolver "
            "no_aplica (D29)"
        )
    blurry = measurement.sharpness < parameters.threshold
    dark = measurement.illumination < parameters.warning_threshold
    observed_value = (
        f"nitidez {_shown(measurement.sharpness)} · brillo {_shown(measurement.illumination)}"
    )
    if blurry and dark:
        return _retake(observed_value, _BLURRY_AND_DARK)
    if blurry:
        return _retake(observed_value, _BLURRY)
    if dark:
        return _retake(observed_value, _DARK)
    return SignalOutcome(SignalResult.OK, observed_value, _GOOD_PHOTO)


def processed_anyway(outcome: SignalOutcome) -> SignalOutcome:
    """D21: S01 falló en el intento N; el detalle dice el problema sin pedir otra foto."""
    if outcome.result is not SignalResult.FAIL:
        raise ValueError(f"Solo una S01 en falla se procesa igual; llegó en {outcome.result}")
    forced_detail = _FORCED_DETAILS.get(outcome.detail)
    if forced_detail is None:
        raise ValueError(f"S01 en falla con un detalle desconocido: {outcome.detail!r}")
    return replace(outcome, detail=forced_detail)


def _retake(observed_value: str, problem: str) -> SignalOutcome:
    return SignalOutcome(SignalResult.FAIL, observed_value, f"{problem} {_RETAKE_ADVICE[problem]}")


def _shown(value: float) -> str:
    """Con coma decimal y sin ceros de más: 83.20 → "83,2", 100.00 → "100"."""
    return f"{value:.2f}".rstrip("0").rstrip(".").replace(".", ",")
