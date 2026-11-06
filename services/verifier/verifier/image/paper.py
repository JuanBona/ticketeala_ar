"""Encuentra el papel del comprobante por su color: claro y casi sin saturación (12.5, D39).

Se busca por color y no por bordes rectos: el borde dentado de un boleto, los pliegues y una
sombra rompen las líneas rectas, pero no cambian que el papel sea claro y casi gris, y que los
fondos (tela, parquet) tengan color o sean más oscuros.
"""

from dataclasses import dataclass

import cv2
import numpy as np
import numpy.typing as npt

from verifier.image.base import Image, Polygon, fill_polygon, scale_to_long_side, to_color

# Ajustes del procesamiento de imagen. No son parámetros del motor: Contaduría no los cambia.
WORKING_LONG_SIDE = 800  # en una copia chica la búsqueda es más rápida y menos ruidosa
MEDIAN_KERNEL = 7  # borra el texto y la trama de la tela antes de mirar el color
MAX_PAPER_CHROMA = 20.0  # distancia al gris en el plano a/b de Lab: el papel casi no tiene color
CLOSING_KERNEL = np.ones((15, 15), np.uint8)  # rellena pliegues y renglones que quedaron afuera
OPENING_KERNEL = np.ones((9, 9), np.uint8)  # borra manchitas claras sueltas
MIN_LISTED_AREA_FRACTION = 0.005  # regiones más chicas ni se listan como candidatas
MIN_PAPER_AREA_FRACTION = 0.05  # de la foto: descarta zapatillas, reflejos y renglones
MIN_TEXT_DENSITY = 0.03  # fracción de píxeles de tinta adentro: una puerta o una caja lisa no
INK_BLOCK_SIZE = 25  # vecindario del umbral adaptativo que separa la tinta del papel
INK_OFFSET = 15  # cuánto más oscura que su vecindario tiene que ser la tinta
TEXT_MARGIN_KERNEL = np.ones((9, 9), np.uint8)  # sin contar el borde del propio papel
BORDER_MARGIN_PIXELS = 3  # a la escala de trabajo: más cerca, la región toca el borde de la foto


@dataclass(frozen=True)
class PaperRegion:
    """Una región clara y sin color de la foto y lo que se midió para decidir si es el papel.

    El contorno y la envolvente están en píxeles de la foto original. La envolvente convexa cubre
    el borde dentado y los pliegues. rejection es None si la región puede ser el papel.
    """

    outline: Polygon
    hull: Polygon
    area_fraction: float
    text_density: float
    touches_border: bool
    rejection: str | None


def find_paper(image: Image) -> PaperRegion | None:
    """12.5, etapa 1: la región del papel, o None si ninguna parece un comprobante."""
    return choose_paper(find_paper_candidates(image))


def find_paper_candidates(image: Image) -> list[PaperRegion]:
    """Todas las regiones claras y sin color, con el motivo de descarte de cada una."""
    small, factor = scale_to_long_side(to_color(image), WORKING_LONG_SIDE)
    paper_like = _paper_like_pixels(small)
    ink = _ink(small)
    count, labels, stats, _ = cv2.connectedComponentsWithStats(paper_like)
    minimum_area = MIN_LISTED_AREA_FRACTION * paper_like.size
    return [
        _candidate(labels == label, ink, factor)
        for label in range(1, count)
        if stats[label, cv2.CC_STAT_AREA] >= minimum_area
    ]


def choose_paper(candidates: list[PaperRegion]) -> PaperRegion | None:
    """Gana la de más texto por superficie: el comprobante, no la puerta clara de al lado."""
    eligible = [candidate for candidate in candidates if candidate.rejection is None]
    if not eligible:
        return None
    return max(eligible, key=lambda candidate: candidate.text_density)


def _paper_like_pixels(small: Image) -> npt.NDArray[np.uint8]:
    """Claro (sobre el corte de Otsu de la propia foto) y casi sin color."""
    smooth = cv2.medianBlur(small, MEDIAN_KERNEL)
    lab = cv2.cvtColor(smooth, cv2.COLOR_BGR2LAB)
    lightness = lab[:, :, 0]
    chroma = np.hypot(lab[:, :, 1].astype(np.float32) - 128, lab[:, :, 2].astype(np.float32) - 128)
    lightness_cut, _ = cv2.threshold(lightness, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    paper_like = ((chroma < MAX_PAPER_CHROMA) & (lightness > lightness_cut)).astype(np.uint8)
    closed = cv2.morphologyEx(paper_like, cv2.MORPH_CLOSE, CLOSING_KERNEL)
    return cv2.morphologyEx(closed, cv2.MORPH_OPEN, OPENING_KERNEL)


def _ink(small: Image) -> npt.NDArray[np.uint8]:
    """Píxeles bastante más oscuros que su vecindario: el texto impreso."""
    grayscale = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
    return cv2.adaptiveThreshold(
        grayscale,
        1,
        cv2.ADAPTIVE_THRESH_MEAN_C,
        cv2.THRESH_BINARY_INV,
        INK_BLOCK_SIZE,
        INK_OFFSET,
    )


def _candidate(
    component: npt.NDArray[np.bool_], ink: npt.NDArray[np.uint8], factor: float
) -> PaperRegion:
    contours, _ = cv2.findContours(
        component.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
    )
    outline = max(contours, key=cv2.contourArea).reshape(-1, 2).astype(np.float32)
    hull = cv2.convexHull(outline).reshape(-1, 2)
    area_fraction = float(component.mean())
    text_density = _text_density(hull, ink)
    return PaperRegion(
        outline=outline / factor,
        hull=hull / factor,
        area_fraction=area_fraction,
        text_density=text_density,
        touches_border=_touches_border(hull, component.shape),
        rejection=_rejection(area_fraction, text_density),
    )


def _text_density(hull: Polygon, ink: npt.NDArray[np.uint8]) -> float:
    inside = cv2.erode(fill_polygon(hull, ink.shape).astype(np.uint8), TEXT_MARGIN_KERNEL)
    if not inside.any():
        return 0.0
    return float(ink[inside.astype(bool)].mean())


def _touches_border(hull: Polygon, shape: tuple[int, ...]) -> bool:
    """Si toca el borde, el papel puede seguir fuera de la foto: no se ven sus cuatro esquinas."""
    height, width = shape[:2]
    return bool(
        hull[:, 0].min() <= BORDER_MARGIN_PIXELS
        or hull[:, 1].min() <= BORDER_MARGIN_PIXELS
        or hull[:, 0].max() >= width - 1 - BORDER_MARGIN_PIXELS
        or hull[:, 1].max() >= height - 1 - BORDER_MARGIN_PIXELS
    )


def _rejection(area_fraction: float, text_density: float) -> str | None:
    if area_fraction < MIN_PAPER_AREA_FRACTION:
        return (
            f"región chica: {_percent(area_fraction)} de la foto "
            f"(mínimo {_percent(MIN_PAPER_AREA_FRACTION)})"
        )
    if text_density < MIN_TEXT_DENSITY:
        return (
            f"poco texto: {_percent(text_density)} de tinta "
            f"(mínimo {_percent(MIN_TEXT_DENSITY)})"
        )
    return None


def _percent(fraction: float) -> str:
    return f"{fraction * 100:.1f} %".replace(".", ",")
