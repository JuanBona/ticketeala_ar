"""OCR falso: devuelve una respuesta grabada con los campos ya extraídos (paso 5, D28)."""

import json
from pathlib import Path
from typing import Any

import numpy as np
import pytest
from ocr_doubles import SYNTHETIC_RECORDING

from verifier.ocr.fake import FakeOcr, InvalidRecordingError

ANY_IMAGE = np.zeros((10, 10), np.uint8)


def write_recording(directory: Path, document: dict[str, Any]) -> Path:
    path = directory / "grabacion.json"
    path.write_text(json.dumps(document), encoding="utf-8")
    return path


def test_fake_ocr_returns_the_recorded_fields() -> None:
    ocr = FakeOcr(SYNTHETIC_RECORDING)

    reading = ocr.read(ANY_IMAGE)

    assert reading.read_fields.cuit.value == "30111111118"
    assert reading.read_fields.total.value == "48320.00"


def test_fake_ocr_returns_the_recorded_raw_response() -> None:
    ocr = FakeOcr(SYNTHETIC_RECORDING)

    reading = ocr.read(ANY_IMAGE)

    assert "COMERCIO SINTETICO SRL" in reading.raw_response["fullTextAnnotation"]["text"]


def test_recording_without_fields_is_rejected_with_its_path(tmp_path: Path) -> None:
    path = write_recording(tmp_path, {"respuesta_ocr": {}})

    with pytest.raises(InvalidRecordingError, match="grabacion.json"):
        FakeOcr(path)


def test_recording_with_invalid_fields_is_rejected(tmp_path: Path) -> None:
    document = json.loads(SYNTHETIC_RECORDING.read_text(encoding="utf-8"))
    document["campos"]["moneda"]["valor"] = None
    path = write_recording(tmp_path, document)

    with pytest.raises(InvalidRecordingError, match="campos"):
        FakeOcr(path)


def test_missing_recording_is_rejected_with_its_path(tmp_path: Path) -> None:
    with pytest.raises(InvalidRecordingError, match="no-existe.json"):
        FakeOcr(tmp_path / "no-existe.json")
