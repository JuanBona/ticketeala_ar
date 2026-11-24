"""dHash de 64 bits del comprobante, el que S08 compara con los gastos previos (12.5, D06, D42).

Hecho con OpenCV y numpy, sin librerías de hashing: el hash es parte del motor propio.
"""

import cv2

from verifier.image.base import Image, crop_to_polygon, to_grayscale
from verifier.image.paper import PaperRegion
from verifier.image.preprocess import StraightenedReceipt

# Ajustes del hash. No son parámetros del motor: cambiarlos invalidaría los hashes ya guardados.
HASH_COLUMNS = 9  # 9 columnas dan 8 comparaciones por fila con el vecino de la derecha
HASH_ROWS = 8  # 8 filas × 8 comparaciones = 64 bits (12.5)
HEX_DIGITS = 16  # 64 bits en hexadecimal, como GASTO.dhash char(16) (D06)


def compute_dhash(image: Image) -> str:
    """S08, D42: en gris, reducida a 9 × 8; cada bit dice si un píxel es más claro que el siguiente.

    Achicar con INTER_AREA promedia cada zona: el brillo general y el tamaño de la foto casi no
    mueven el hash, porque cuenta solo qué zona es más clara que su vecina.
    """
    small = cv2.resize(
        to_grayscale(image), (HASH_COLUMNS, HASH_ROWS), interpolation=cv2.INTER_AREA
    )
    brighter_than_right = small[:, :-1] > small[:, 1:]
    hash_value = int("".join("1" if bit else "0" for bit in brighter_than_right.flatten()), 2)
    return f"{hash_value:0{HEX_DIGITS}x}"


def hash_region(
    image: Image, paper: PaperRegion | None, straightened: StraightenedReceipt
) -> Image:
    """D42: el papel enderezado si D39 lo enderezó; si no, el rectángulo del papel; sin papel, todo.

    Sin el fondo, dos fotos del mismo comprobante sobre superficies distintas dan hashes parecidos.
    """
    if straightened.corners is not None:
        return straightened.image
    if paper is None:
        return image
    paper_crop, _ = crop_to_polygon(image, paper.hull)
    return paper_crop
