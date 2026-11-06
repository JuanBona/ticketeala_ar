"""Región del papel por su color: clara y casi sin saturación (12.5, etapa 1; D39)."""

import cv2
import numpy as np

from synthetic_images import (
    DARK_GRAY,
    PAPER_GRAY,
    blue_fabric,
    place,
    receipt,
    uniform,
    upright_quad,
)
from verifier.image.paper import find_paper, find_paper_candidates

DOOR_GRAY = 245


def test_finds_the_paper_on_a_dark_background() -> None:
    corners = upright_quad(150, 350)
    photo = place(receipt(), uniform(DARK_GRAY), corners)

    paper = find_paper(photo)

    assert paper is not None
    x, y, width, height = cv2.boundingRect(np.round(paper.hull).astype(np.int32))
    assert abs(x - 350) <= 4 and abs(y - 150) <= 4
    assert abs(width - 300) <= 8 and abs(height - 500) <= 8


def test_finds_the_paper_on_blue_textured_fabric() -> None:
    photo = place(receipt(), blue_fabric(), upright_quad(150, 350))

    assert find_paper(photo) is not None


def test_plain_bright_rectangle_is_rejected_for_having_no_text() -> None:
    photo = uniform(DARK_GRAY)
    cv2.rectangle(photo, (30, 30), (330, 770), (DOOR_GRAY, DOOR_GRAY, DOOR_GRAY), cv2.FILLED)
    photo = place(receipt(), photo, upright_quad(150, 550))

    candidates = find_paper_candidates(photo)

    door = min(candidates, key=lambda candidate: candidate.hull[:, 0].min())
    assert door.rejection is not None and "texto" in door.rejection


def test_picks_the_receipt_over_a_larger_bright_plain_rectangle() -> None:
    photo = uniform(DARK_GRAY)
    cv2.rectangle(photo, (30, 30), (330, 770), (DOOR_GRAY, DOOR_GRAY, DOOR_GRAY), cv2.FILLED)
    photo = place(receipt(), photo, upright_quad(150, 550))

    paper = find_paper(photo)

    assert paper is not None
    assert paper.hull[:, 0].min() >= 540


def test_small_bright_region_is_rejected_as_small() -> None:
    small_paper = cv2.resize(receipt(), None, fx=0.3, fy=0.3)
    photo = uniform(DARK_GRAY)
    photo[100 : 100 + small_paper.shape[0], 100 : 100 + small_paper.shape[1]] = small_paper

    candidates = find_paper_candidates(photo)

    assert len(candidates) == 1
    assert candidates[0].rejection is not None and "chica" in candidates[0].rejection


def test_photo_that_is_all_paper_without_text_has_no_paper() -> None:
    assert find_paper(uniform(PAPER_GRAY)) is None


def test_blue_fabric_alone_has_no_paper() -> None:
    assert find_paper(blue_fabric()) is None


def test_paper_cut_by_the_photo_border_is_found_and_marked() -> None:
    photo = place(receipt(), uniform(DARK_GRAY), upright_quad(450, 350))

    paper = find_paper(photo)

    assert paper is not None
    assert paper.touches_border


def test_paper_inside_the_photo_does_not_touch_the_border() -> None:
    photo = place(receipt(), uniform(DARK_GRAY), upright_quad(150, 350))

    paper = find_paper(photo)

    assert paper is not None
    assert not paper.touches_border
