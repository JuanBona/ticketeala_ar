"""Endereza el papel solo si su cuadrilátero es confiable, y aplica CLAHE (12.5, D39).

Un enderezado con un cuadrilátero falso (que corta el papel o mete fondo) deforma el comprobante y
es peor que no enderezar: ante cualquier duda, la foto queda tal cual.
"""

from dataclasses import dataclass

import cv2
import numpy as np
import numpy.typing as npt

from verifier.image.base import Image, Polygon, fill_polygon, to_grayscale
from verifier.image.paper import PaperRegion

Corners = npt.NDArray[np.float32]  # 4 × 2 (x, y): arriba-izq., arriba-der., abajo-der., abajo-izq.

# Ajustes del procesamiento de imagen. No son parámetros del motor: Contaduría no los cambia.
CORNER_COUNT = 4
# Tolerancias (fracción del perímetro) para reducir la envolvente a 4 vértices, de menor a mayor.
POLYGON_TOLERANCES = tuple(step / 1000 for step in range(10, 151, 5))
# Fracción del papel que puede quedar afuera del cuadrilátero. En las fotos de prueba, las que
# salen completas dejan afuera hasta 2,25 % (borde dentado, pliegues) y una factura curvada que
# perdía texto, 6,53 %. Ante la duda no se endereza: perder texto es peor que no enderezar.
MAX_PAPER_OUTSIDE_QUAD = 0.025
COMPARISON_LONG_SIDE = 800  # tamaño al que se dibujan las dos formas para compararlas
CLAHE_CLIP_LIMIT = 2.0
CLAHE_TILE_GRID = (8, 8)


@dataclass(frozen=True)
class StraightenedReceipt:
    """El comprobante enderezado, o la foto tal cual; reason dice por qué, para diagnosticar."""

    image: Image
    corners: Corners | None
    reason: str


def straighten_receipt(image: Image, paper: PaperRegion | None) -> StraightenedReceipt:
    """12.5, etapa 1: corrige la perspectiva solo con un cuadrilátero confiable (D39)."""
    if paper is None:
        return StraightenedReceipt(image, None, "no se encontró el papel")
    if paper.touches_border:
        return StraightenedReceipt(image, None, "el papel toca el borde de la foto")
    quad = _quadrilateral(paper.hull)
    if quad is None:
        return StraightenedReceipt(image, None, "la envolvente no se reduce a 4 vértices")
    outside = _paper_outside(quad, paper.outline)
    if outside > MAX_PAPER_OUTSIDE_QUAD:
        return StraightenedReceipt(
            image,
            None,
            f"el cuadrilátero deja afuera {_percent(outside)} del papel "
            f"(máximo {_percent(MAX_PAPER_OUTSIDE_QUAD)})",
        )
    corners = _order_corners(quad)
    return StraightenedReceipt(_warp(image, corners), corners, "enderezado")


def enhance_contrast(image: Image) -> Image:
    """12.5, etapa 1: CLAHE ecualiza por zonas, así una sombra fuerte no borra el texto."""
    clahe = cv2.createCLAHE(clipLimit=CLAHE_CLIP_LIMIT, tileGridSize=CLAHE_TILE_GRID)
    return clahe.apply(to_grayscale(image))


def _quadrilateral(hull: Polygon) -> Polygon | None:
    """La aproximación más fiel con 4 vértices: se va subiendo la tolerancia hasta llegar a 4."""
    perimeter = cv2.arcLength(hull, True)
    for tolerance in POLYGON_TOLERANCES:
        polygon = cv2.approxPolyDP(hull, tolerance * perimeter, True)
        if len(polygon) == CORNER_COUNT:
            return polygon.reshape(CORNER_COUNT, 2).astype(np.float32)
        if len(polygon) < CORNER_COUNT:
            return None
    return None


def _paper_outside(quad: Polygon, outline: Polygon) -> float:
    """Fracción del papel que queda afuera del cuadrilátero: lo que el enderezado recortaría."""
    points = np.vstack([quad, outline])
    origin = points.min(axis=0)
    factor = COMPARISON_LONG_SIDE / max(float(np.ptp(points[:, 0])), float(np.ptp(points[:, 1])))
    height, width = (np.ceil(np.ptp(points, axis=0)[::-1] * factor) + 1).astype(int)
    quad_mask = fill_polygon((quad - origin) * factor, (height, width))
    paper_mask = fill_polygon((outline - origin) * factor, (height, width))
    return np.count_nonzero(paper_mask & ~quad_mask) / np.count_nonzero(paper_mask)


def _percent(fraction: float) -> str:
    return f"{fraction * 100:.2f} %".replace(".", ",")


def _order_corners(quad: Polygon) -> Corners:
    """Arriba-izq. tiene la menor x + y; abajo-der., la mayor; arriba-der., la menor y − x."""
    sums = quad.sum(axis=1)
    differences = quad[:, 1] - quad[:, 0]
    return np.array(
        [
            quad[np.argmin(sums)],
            quad[np.argmin(differences)],
            quad[np.argmax(sums)],
            quad[np.argmax(differences)],
        ],
        np.float32,
    )


def _warp(image: Image, corners: Corners) -> Image:
    """Ancho y alto del recorte: los lados más largos del cuadrilátero, en resolución original."""
    top_left, top_right, bottom_right, bottom_left = corners
    width = round(max(_length(top_left, top_right), _length(bottom_left, bottom_right)))
    height = round(max(_length(top_left, bottom_left), _length(top_right, bottom_right)))
    right, bottom = width - 1, height - 1
    target = np.array([[0, 0], [right, 0], [right, bottom], [0, bottom]], np.float32)
    transform = cv2.getPerspectiveTransform(corners, target)
    return cv2.warpPerspective(image, transform, (width, height))


def _length(start: npt.NDArray[np.float32], end: npt.NDArray[np.float32]) -> float:
    return float(np.linalg.norm(end - start))
