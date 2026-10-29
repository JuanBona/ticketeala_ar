"""Imágenes sintéticas para los tests: comprobantes dibujados en el código, sin fotos reales."""

import cv2
import numpy as np
import numpy.typing as npt

from verifier.image.base import Image

Quad = npt.NDArray[np.float32]  # esquinas: arriba-izq., arriba-der., abajo-der., abajo-izq.

PAPER_GRAY = 240
INK_GRAY = 20
DARK_GRAY = 50
BACKGROUND_SHAPE = (800, 1000)  # alto, ancho
RECEIPT_SHAPE = (500, 300)
MARGIN = 20
LINE_SPACING = 22
FONT_SCALE = 0.45
FABRIC_BLUE_BGR = (130, 52, 13)  # el color medio de blue_fabric
TOOTH_WIDTH = 12
TOOTH_HEIGHT = 8
SHADOW_FACTOR = 0.6  # sombra con sol: la parte en sombra queda en un 60 % del brillo
BULGE_WIDTH = 40  # cuánto se abomba hacia afuera el lado curvado, en píxeles


def receipt() -> Image:
    """Papel claro con renglones de texto oscuro, como un ticket."""
    height, width = RECEIPT_SHAPE
    paper = np.full((height, width, 3), PAPER_GRAY, np.uint8)
    for line_number, baseline in enumerate(range(2 * MARGIN, height - MARGIN, LINE_SPACING)):
        text = f"ITEM {line_number:02d} ..... $ {line_number * 137:>5},00"
        cv2.putText(
            paper,
            text,
            (MARGIN, baseline),
            cv2.FONT_HERSHEY_SIMPLEX,
            FONT_SCALE,
            (INK_GRAY, INK_GRAY, INK_GRAY),
            1,
            cv2.LINE_AA,
        )
    return paper


def receipt_with_printed_frame() -> Image:
    """Un comprobante con un recuadro impreso adentro, como el de los ítems de una factura."""
    paper = receipt()
    height, width = RECEIPT_SHAPE
    cv2.rectangle(
        paper,
        (MARGIN // 2, height // 4),
        (width - MARGIN // 2, 3 * height // 4),
        (INK_GRAY, INK_GRAY, INK_GRAY),
        2,
    )
    return paper


def uniform(gray: int) -> Image:
    """Fondo parejo del tamaño de la foto."""
    return np.full((*BACKGROUND_SHAPE, 3), gray, np.uint8)


def fabric() -> Image:
    """Fondo con mucho detalle, como una tela tejida: ruido fino y nítido."""
    generator = np.random.default_rng(seed=7)
    texture = generator.integers(40, 160, BACKGROUND_SHAPE, dtype=np.uint8)
    return cv2.cvtColor(texture, cv2.COLOR_GRAY2BGR)


def blue_fabric() -> Image:
    """Fondo de color con mucho detalle, como la tela azul tejida de las fotos de prueba."""
    generator = np.random.default_rng(seed=11)
    blue = generator.integers(90, 170, BACKGROUND_SHAPE, dtype=np.uint8)
    return np.dstack([blue, (blue * 0.4).astype(np.uint8), (blue * 0.1).astype(np.uint8)])


def with_jagged_top(photo: Image, corners: Quad) -> Image:
    """Muerde el borde de arriba del papel en dientes, como un boleto cortado de un rollo.

    Solo para comprobantes derechos (upright_quad). Los dientes se pintan del color de la tela azul.
    """
    jagged = photo.copy()
    (left, top), (right, _) = corners[0], corners[1]
    for tooth_left in range(int(left), int(right), TOOTH_WIDTH):
        notch = np.array(
            [
                [tooth_left, top],
                [tooth_left + TOOTH_WIDTH, top],
                [tooth_left + TOOTH_WIDTH // 2, top + TOOTH_HEIGHT],
            ],
            np.int32,
        )
        cv2.fillConvexPoly(jagged, notch, FABRIC_BLUE_BGR)
    return jagged


def with_curved_left_edge(photo: Image, corners: Quad) -> Image:
    """Abomba hacia afuera la mitad de abajo del lado izquierdo, como una factura curvada.

    Solo para comprobantes derechos (upright_quad).
    """
    curved = photo.copy()
    left, top = corners[0]
    height = RECEIPT_SHAPE[0]
    center = (int(left), int(top + height * 0.7))
    axes = (BULGE_WIDTH, int(height * 0.3))
    paper_color = (PAPER_GRAY, PAPER_GRAY, PAPER_GRAY)
    cv2.ellipse(curved, center, axes, 0, 90, 270, paper_color, cv2.FILLED)
    return curved


def with_diagonal_shadow(photo: Image) -> Image:
    """Oscurece todo lo que queda debajo de la diagonal de la foto, como el sol por una ventana."""
    rows, columns = np.indices(photo.shape[:2])
    shadow = rows * photo.shape[1] > columns * photo.shape[0]
    shaded = photo.copy()
    shaded[shadow] = (shaded[shadow] * SHADOW_FACTOR).astype(np.uint8)
    return shaded


def upright_quad(top: int, left: int) -> Quad:
    """Esquinas del comprobante derecho, con su esquina superior izquierda en (top, left)."""
    height, width = RECEIPT_SHAPE
    return np.array(
        [[left, top], [left + width, top], [left + width, top + height], [left, top + height]],
        np.float32,
    )


def place(image: Image, background: Image, corners: Quad) -> Image:
    """Pega la imagen sobre el fondo deformándola para que sus esquinas caigan en corners."""
    height, width = image.shape[:2]
    source = np.array([[0, 0], [width, 0], [width, height], [0, height]], np.float32)
    transform = cv2.getPerspectiveTransform(source, corners)
    background_size = (background.shape[1], background.shape[0])
    warped = cv2.warpPerspective(image, transform, background_size)
    opaque = np.full((height, width), 255, np.uint8)
    coverage = cv2.warpPerspective(opaque, transform, background_size)
    composed = background.copy()
    composed[coverage > 0] = warped[coverage > 0]
    return composed
