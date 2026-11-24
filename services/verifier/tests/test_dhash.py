"""dHash de 64 bits del comprobante, sobre la región del papel y antes de CLAHE (S08, D06, D42)."""

import re

import cv2
from synthetic_images import (
    DARK_GRAY,
    blue_gradient,
    fabric,
    place,
    receipt,
    uniform,
    upright_quad,
)

from verifier.image.base import Image
from verifier.image.dhash import compute_dhash, hash_region
from verifier.image.paper import find_paper
from verifier.image.preprocess import straighten_receipt

# Umbral inicial de S08 (D29): hasta 10 bits distintos, "imagen similar".
SIMILAR_MAXIMUM_DISTANCE = 10
DARKER_FACTOR = 0.7
HALF_SCALE = 0.5
HEX_HASH_PATTERN = re.compile(r"^[0-9a-f]{16}$")


def hamming_distance(first_hash: str, second_hash: str) -> int:
    """Bits distintos entre dos hashes; la comparación de producción llega con S08 (paso 7)."""
    return bin(int(first_hash, 16) ^ int(second_hash, 16)).count("1")


def photo_dhash(photo: Image) -> str:
    """El hash como lo calcula el pipeline: papel, enderezado de D39 y región de D42."""
    paper = find_paper(photo)
    return compute_dhash(hash_region(photo, paper, straighten_receipt(photo, paper)))


def test_same_image_gives_the_same_hash() -> None:
    image = receipt()

    assert compute_dhash(image) == compute_dhash(image.copy())


def test_darker_image_gives_a_small_hamming_distance() -> None:
    image = receipt()
    darker = cv2.convertScaleAbs(image, alpha=DARKER_FACTOR, beta=0)

    distance = hamming_distance(compute_dhash(image), compute_dhash(darker))

    assert distance <= SIMILAR_MAXIMUM_DISTANCE


def test_scaled_image_gives_a_small_hamming_distance() -> None:
    image = receipt()
    smaller = cv2.resize(image, None, fx=HALF_SCALE, fy=HALF_SCALE, interpolation=cv2.INTER_AREA)

    distance = hamming_distance(compute_dhash(image), compute_dhash(smaller))

    assert distance <= SIMILAR_MAXIMUM_DISTANCE


def test_different_images_give_a_large_hamming_distance() -> None:
    distance = hamming_distance(compute_dhash(receipt()), compute_dhash(fabric()))

    assert distance > SIMILAR_MAXIMUM_DISTANCE


def test_hash_is_sixteen_lowercase_hex_digits() -> None:
    assert HEX_HASH_PATTERN.match(compute_dhash(receipt()))


def test_same_receipt_on_different_backgrounds_gives_a_small_distance() -> None:
    corners = upright_quad(top=150, left=350)
    on_dark_floor = place(receipt(), uniform(DARK_GRAY), corners)
    on_blue_gradient = place(receipt(), blue_gradient(), corners)

    distance = hamming_distance(photo_dhash(on_dark_floor), photo_dhash(on_blue_gradient))

    # Con la foto entera la distancia es grande: el degradé del fondo entra en el hash.
    assert hamming_distance(compute_dhash(on_dark_floor), compute_dhash(on_blue_gradient)) > (
        SIMILAR_MAXIMUM_DISTANCE
    )
    assert distance <= SIMILAR_MAXIMUM_DISTANCE
