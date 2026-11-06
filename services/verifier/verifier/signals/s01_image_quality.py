"""S01: nitidez e iluminación de la foto sobre el mínimo, antes de llamar al OCR (punto 12.5).

Se evalúa con las medidas de la región del papel (D39, D40), no con los campos leídos. Solo da ok
o falla (D30); con falla antes del intento N se pide otra foto (D21).
"""

from verifier.contract import SignalParameters, SignalResult
from verifier.image.quality import QualityMeasurement
from verifier.signals.base import SignalOutcome

_GOOD_PHOTO = "La foto se ve nítida y con buena luz."
_BLURRY_PHOTO = (
    "La foto está borrosa. Sostené el celular firme, esperá a que enfoque y sacá otra foto."
)
_DARK_PHOTO = (
    "La foto está oscura. Apoyá el comprobante sobre una superficie con buena luz y sacá otra foto."
)
_BLURRY_AND_DARK_PHOTO = (
    "La foto está borrosa y oscura. Apoyá el comprobante sobre una superficie con buena luz "
    "y sacá otra foto."
)


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
        return SignalOutcome(SignalResult.FAIL, observed_value, _BLURRY_AND_DARK_PHOTO)
    if blurry:
        return SignalOutcome(SignalResult.FAIL, observed_value, _BLURRY_PHOTO)
    if dark:
        return SignalOutcome(SignalResult.FAIL, observed_value, _DARK_PHOTO)
    return SignalOutcome(SignalResult.OK, observed_value, _GOOD_PHOTO)


def _shown(value: float) -> str:
    """Con coma decimal y sin ceros de más: 412.70 → "412,7", 100.00 → "100"."""
    return f"{value:.2f}".rstrip("0").rstrip(".").replace(".", ",")
