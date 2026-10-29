"""Mide la nitidez y la iluminación del papel, los valores que compara S01 (12.5, D39, D40)."""

from dataclasses import dataclass

import cv2
import numpy as np
import numpy.typing as npt

from verifier.image.base import Image, fill_polygon, scale_to_long_side, to_grayscale
from verifier.image.paper import PaperRegion

# D39: se mide siempre a este tamaño, así un mismo umbral sirve para cualquier celular y distancia.
QUALITY_LONG_SIDE = 1000
# Deja afuera el borde del papel: el salto de papel a fondo no dice nada de la nitidez del texto.
PAPER_EDGE_MARGIN = np.ones((15, 15), np.uint8)
REBLUR_LENGTH = 9  # el filtro de promedio de 9 píxeles de Crete et al. (2007)
MAXIMUM_SHARPNESS = 100.0  # D40: nitidez = 100 × (1 − desenfoque)
DECIMALS = 2

BoolMask = npt.NDArray[np.bool_]


@dataclass(frozen=True)
class QualityMeasurement:
    """Nitidez (0 a 100, D40) e iluminación (brillo medio, 0 a 255), con dos decimales."""

    sharpness: float
    illumination: float


def measure_quality(image: Image, paper: PaperRegion | None) -> QualityMeasurement:
    """S01 (D39, D40): sobre la región del papel en la foto original; sin papel, la foto entera.

    Se mide sobre la foto original y no sobre el recorte enderezado: enderezar interpola los
    píxeles y suaviza el texto.
    """
    grayscale, inside = _paper_crop(to_grayscale(image), paper)
    blur = _crete_blur(grayscale, inside)
    return QualityMeasurement(
        sharpness=round(MAXIMUM_SHARPNESS * (1 - blur), DECIMALS),
        illumination=round(float(np.mean(grayscale[inside])), DECIMALS),
    )


def _paper_crop(grayscale: Image, paper: PaperRegion | None) -> tuple[Image, BoolMask]:
    """El rectángulo que contiene al papel, llevado a QUALITY_LONG_SIDE, y qué píxeles son papel."""
    if paper is None:
        scaled, _ = scale_to_long_side(grayscale, QUALITY_LONG_SIDE)
        return scaled, np.ones(scaled.shape, bool)
    left, top, width, height = cv2.boundingRect(np.round(paper.hull).astype(np.int32))
    scaled, factor = scale_to_long_side(
        grayscale[top : top + height, left : left + width], QUALITY_LONG_SIDE
    )
    paper_mask = fill_polygon((paper.hull - (left, top)) * factor, scaled.shape)
    inside = cv2.erode(paper_mask.astype(np.uint8), PAPER_EDGE_MARGIN).astype(bool)
    return scaled, inside


def _crete_blur(grayscale: Image, inside: BoolMask) -> float:
    """Desenfoque de Crete et al., de 0 (nítida) a 1 (borrosa), sobre los píxeles de inside (D40).

    F. Crété-Roffet, T. Dolmiere, P. Ladret y M. Nicolas, "The Blur Effect: Perception and
    Estimation with a New No-Reference Perceptual Blur Metric", Proc. SPIE 6492, Human Vision and
    Electronic Imaging XII, 64920I (2007). doi:10.1117/12.702790

    Se vuelve a desenfocar la imagen y se mide cuánta variación entre vecinos se pierde: una foto
    nítida pierde mucha y una borrosa casi nada, porque ya lo estaba. Es un cociente, así que no
    depende del contraste (con poca luz, la varianza del Laplaciano baja aunque el texto se lea).
    Se toma la peor de las dos direcciones: una foto movida en una sola dirección es borrosa.
    """
    values = grayscale.astype(np.float64)
    return max(_directional_blur(values, inside, axis) for axis in (0, 1))


def _directional_blur(values: npt.NDArray[np.float64], inside: BoolMask, axis: int) -> float:
    """axis 0: entre vecinos de arriba y abajo; axis 1: entre vecinos de izquierda y derecha."""
    kernel_size = (1, REBLUR_LENGTH) if axis == 0 else (REBLUR_LENGTH, 1)  # (ancho, alto)
    reblurred = cv2.blur(values, kernel_size)
    variation = np.abs(np.diff(values, axis=axis))
    reblurred_variation = np.abs(np.diff(reblurred, axis=axis))
    pairs = _both_inside(inside, axis)
    total_variation = variation[pairs].sum()
    if total_variation == 0:
        return 1.0  # sin ningún detalle no hay nada nítido que leer
    lost_variation = np.maximum(0, variation - reblurred_variation)[pairs].sum()
    return float((total_variation - lost_variation) / total_variation)


def _both_inside(inside: BoolMask, axis: int) -> BoolMask:
    """Pares de vecinos con los dos píxeles adentro del papel."""
    if axis == 0:
        return inside[1:, :] & inside[:-1, :]
    return inside[:, 1:] & inside[:, :-1]
