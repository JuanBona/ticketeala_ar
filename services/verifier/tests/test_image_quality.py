"""Nitidez (Crete et al., 2007) e iluminación (brillo medio) de S01, sobre el papel (D39, D40)."""

import cv2
import numpy as np

from synthetic_images import DARK_GRAY, fabric, place, receipt, uniform, upright_quad
from verifier.image.paper import find_paper
from verifier.image.quality import MAXIMUM_SHARPNESS, measure_quality

MOTION_LENGTH = 15
CONTRAST_TOLERANCE = 1.0


def test_sharp_receipt_measures_more_sharpness_than_a_blurred_one() -> None:
    sharp = receipt()
    blurred = cv2.GaussianBlur(sharp, (9, 9), 0)

    assert measure_quality(sharp, None).sharpness > measure_quality(blurred, None).sharpness


def test_horizontal_motion_lowers_the_sharpness() -> None:
    sharp = receipt()
    moved = cv2.filter2D(sharp, -1, np.ones((1, MOTION_LENGTH)) / MOTION_LENGTH)

    assert measure_quality(moved, None).sharpness < measure_quality(sharp, None).sharpness


def test_sharpness_does_not_depend_on_the_contrast() -> None:
    grayscale = cv2.cvtColor(receipt(), cv2.COLOR_BGR2GRAY)
    low_contrast = (grayscale * 0.4 + 60).astype(np.uint8)

    full = measure_quality(grayscale, None).sharpness
    reduced = measure_quality(low_contrast, None).sharpness

    assert abs(full - reduced) <= CONTRAST_TOLERANCE


def test_dark_receipt_measures_less_illumination_than_a_bright_one() -> None:
    bright = receipt()
    dark = (bright * 0.3).astype(np.uint8)

    assert measure_quality(dark, None).illumination < measure_quality(bright, None).illumination


def test_uniform_image_has_its_gray_as_illumination_and_no_sharpness() -> None:
    gray_image = np.full((300, 200), 137, np.uint8)

    measurement = measure_quality(gray_image, None)

    assert measurement.illumination == 137.0
    assert measurement.sharpness == 0.0


def test_sharpness_never_exceeds_the_maximum() -> None:
    rows, columns = np.indices((1000, 1000))
    checkerboard = (((rows + columns) % 2) * 255).astype(np.uint8)

    assert 0 < measure_quality(checkerboard, None).sharpness <= MAXIMUM_SHARPNESS


def test_measurements_are_rounded_to_two_decimals() -> None:
    measurement = measure_quality(receipt(), None)

    assert measurement.sharpness == round(measurement.sharpness, 2)
    assert measurement.illumination == round(measurement.illumination, 2)


def test_same_receipt_at_double_resolution_measures_the_same() -> None:
    native = cv2.resize(receipt(), None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC)
    double = cv2.resize(native, None, fx=2, fy=2, interpolation=cv2.INTER_NEAREST)

    assert measure_quality(double, None) == measure_quality(native, None)


def test_color_and_grayscale_versions_measure_the_same() -> None:
    color = receipt()
    grayscale = cv2.cvtColor(color, cv2.COLOR_BGR2GRAY)

    assert measure_quality(color, None) == measure_quality(grayscale, None)


def test_fabric_around_the_paper_does_not_inflate_the_sharpness() -> None:
    photo = place(receipt(), fabric(), upright_quad(150, 350))

    on_paper = measure_quality(photo, find_paper(photo))

    assert on_paper.sharpness < measure_quality(photo, None).sharpness


def test_dark_background_does_not_lower_the_illumination() -> None:
    photo = place(receipt(), uniform(DARK_GRAY), upright_quad(150, 350))

    on_paper = measure_quality(photo, find_paper(photo))

    assert on_paper.illumination > measure_quality(photo, None).illumination


def test_paper_cut_by_the_border_is_measured_on_the_paper() -> None:
    photo = place(receipt(), uniform(DARK_GRAY), upright_quad(450, 350))

    on_paper = measure_quality(photo, find_paper(photo))

    assert on_paper.illumination > 200
