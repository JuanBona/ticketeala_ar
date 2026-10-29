"""Tipos de imagen que usan la región del papel, el preprocesamiento y la medición de calidad."""

import cv2
import numpy as np
import numpy.typing as npt

Image = npt.NDArray[np.uint8]  # gris (alto × ancho) o color BGR (alto × ancho × 3), como OpenCV
Polygon = npt.NDArray[np.float32]  # N × 2 puntos (x, y) en píxeles de la foto original

_COLOR_CHANNELS = 3


def to_grayscale(image: Image) -> Image:
    """Las medidas y la búsqueda del papel trabajan en gris; una imagen gris pasa tal cual."""
    if image.ndim == _COLOR_CHANNELS:
        return cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    return image


def to_color(image: Image) -> Image:
    """El color del papel se mira en color; una imagen gris se repite en los 3 canales."""
    if image.ndim == _COLOR_CHANNELS:
        return image
    return cv2.cvtColor(image, cv2.COLOR_GRAY2BGR)


def scale_to_long_side(image: Image, long_side: int) -> tuple[Image, float]:
    """Achica (o agranda) la imagen hasta ese lado largo; devuelve la imagen y el factor usado.

    INTER_AREA promedia al achicar (no inventa bordes); al agrandar, interpolación lineal.
    """
    factor = long_side / max(image.shape[:2])
    if factor == 1:
        return image, factor
    interpolation = cv2.INTER_AREA if factor < 1 else cv2.INTER_LINEAR
    scaled = cv2.resize(image, None, fx=factor, fy=factor, interpolation=interpolation)
    return scaled, factor


def fill_polygon(polygon: Polygon, shape: tuple[int, ...]) -> npt.NDArray[np.bool_]:
    """Máscara del tamaño dado con el polígono relleno."""
    mask = np.zeros(shape[:2], np.uint8)
    cv2.fillPoly(mask, [np.round(polygon).astype(np.int32)], 1)
    return mask.astype(bool)
