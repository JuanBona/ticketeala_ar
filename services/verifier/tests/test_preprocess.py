"""Corrección de perspectiva solo con un cuadrilátero confiable, y CLAHE (12.5, etapa 1; D39)."""

import cv2
import numpy as np

from synthetic_images import (
    DARK_GRAY,
    RECEIPT_SHAPE,
    Quad,
    blue_fabric,
    fabric,
    place,
    receipt,
    receipt_with_printed_frame,
    uniform,
    upright_quad,
    with_curved_left_edge,
    with_diagonal_shadow,
    with_jagged_top,
)
from verifier.image.base import Image
from verifier.image.paper import find_paper
from verifier.image.preprocess import StraightenedReceipt, enhance_contrast, straighten_receipt

CORNER_TOLERANCE_PIXELS = 8
JAGGED_CORNER_TOLERANCE_PIXELS = 12  # las esquinas de arriba pueden caer en un diente
TILTED_CORNERS = np.array([[420, 120], [720, 160], [690, 660], [380, 620]], np.float32)
SHADOW_FACTOR = 0.35
INK_LIMIT = 128


def straighten(photo: Image) -> StraightenedReceipt:
    return straighten_receipt(photo, find_paper(photo))


def assert_corners_near(found: Quad | None, expected: Quad, tolerance: int) -> None:
    assert found is not None
    assert np.abs(found - expected).max() <= tolerance


def test_finds_the_corners_of_a_tilted_receipt() -> None:
    photo = place(receipt(), uniform(DARK_GRAY), TILTED_CORNERS)

    corners = straighten(photo).corners

    assert_corners_near(corners, TILTED_CORNERS, CORNER_TOLERANCE_PIXELS)


def test_straightened_tilted_receipt_keeps_the_paper_proportions() -> None:
    photo = place(receipt(), uniform(DARK_GRAY), TILTED_CORNERS)

    straightened = straighten(photo)

    height, width = straightened.image.shape[:2]
    expected_height, expected_width = RECEIPT_SHAPE
    assert abs(height / width - expected_height / expected_width) < 0.1


def test_straightened_tilted_receipt_leaves_the_background_out() -> None:
    photo = place(receipt(), uniform(DARK_GRAY), TILTED_CORNERS)

    straightened = straighten(photo)

    assert np.mean(straightened.image) > 200


def test_finds_the_corners_of_a_receipt_with_a_jagged_top_edge() -> None:
    corners = upright_quad(150, 350)
    photo = with_jagged_top(place(receipt(), blue_fabric(), corners), corners)

    found = straighten(photo).corners

    assert_corners_near(found, corners, JAGGED_CORNER_TOLERANCE_PIXELS)


def test_diagonal_shadow_does_not_deform_the_straightening() -> None:
    corners = upright_quad(150, 350)
    photo = with_diagonal_shadow(place(receipt(), blue_fabric(), corners))

    found = straighten(photo).corners

    assert_corners_near(found, corners, CORNER_TOLERANCE_PIXELS)


def test_picks_the_paper_over_a_frame_printed_inside_it() -> None:
    corners = upright_quad(150, 350)
    photo = place(receipt_with_printed_frame(), uniform(DARK_GRAY), corners)

    found = straighten(photo).corners

    assert_corners_near(found, corners, CORNER_TOLERANCE_PIXELS)


def test_paper_out_of_the_photo_is_not_straightened() -> None:
    photo = place(receipt(), uniform(DARK_GRAY), upright_quad(450, 350))

    straightened = straighten(photo)

    assert straightened.corners is None
    assert "borde" in straightened.reason
    assert np.array_equal(straightened.image, photo)


def test_photo_without_paper_is_not_straightened() -> None:
    photo = blue_fabric()

    straightened = straighten(photo)

    assert straightened.corners is None
    assert np.array_equal(straightened.image, photo)


def test_paper_that_is_not_a_quadrilateral_is_not_straightened() -> None:
    """Dos comprobantes encimados en escalera: ningún cuadrilátero cubre bien esa forma."""
    photo = place(receipt(), uniform(DARK_GRAY), upright_quad(40, 80))
    photo = place(receipt(), photo, upright_quad(260, 360))

    straightened = straighten(photo)

    assert straightened.corners is None
    assert "afuera" in straightened.reason
    assert np.array_equal(straightened.image, photo)


def test_curved_paper_that_a_quadrilateral_would_cut_is_not_straightened() -> None:
    """Enderezar dejaría afuera el lado curvado y su texto: es peor que no enderezar."""
    corners = upright_quad(150, 350)
    photo = with_curved_left_edge(place(receipt(), blue_fabric(), corners), corners)

    straightened = straighten(photo)

    assert straightened.corners is None
    assert "afuera" in straightened.reason
    assert np.array_equal(straightened.image, photo)


def test_gray_textured_fabric_alone_is_not_straightened() -> None:
    """Sin papel, la tela gris queda como una sola región que toca el borde: la foto no cambia."""
    photo = fabric()

    straightened = straighten(photo)

    assert straightened.corners is None
    assert np.array_equal(straightened.image, photo)


def test_enhanced_image_is_grayscale_with_the_same_size() -> None:
    paper = receipt()

    enhanced = enhance_contrast(paper)

    assert enhanced.shape == paper.shape[:2]


def test_contrast_enhancement_raises_text_contrast_under_a_diagonal_shadow() -> None:
    grayscale = cv2.cvtColor(receipt(), cv2.COLOR_BGR2GRAY)
    rows, columns = np.indices(grayscale.shape)
    shadow = rows * grayscale.shape[1] > columns * grayscale.shape[0]  # debajo de la diagonal
    shadowed = grayscale.copy()
    shadowed[shadow] = (shadowed[shadow] * SHADOW_FACTOR).astype(np.uint8)
    ink = grayscale < INK_LIMIT

    def text_contrast(image: Image) -> float:
        return float(np.mean(image[shadow & ~ink]) - np.mean(image[shadow & ink]))

    assert text_contrast(enhance_contrast(shadowed)) > text_contrast(shadowed)
