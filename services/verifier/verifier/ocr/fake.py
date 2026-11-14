"""OCR falso: devuelve una respuesta grabada, para probar sin red ni costo (D28).

La grabación es un JSON con "respuesta_ocr" (la respuesta cruda) y "campos" (los campos ya
extraídos, en el formato del contrato). Todavía no hay extracción real: llega en el paso 6.
"""

import json
from pathlib import Path

from pydantic import ValidationError

from verifier.contract import ReadFields
from verifier.image.base import Image
from verifier.ocr.base import OcrReading


class InvalidRecordingError(ValueError):
    """La grabación no existe o no tiene el formato esperado."""


class FakeOcr:
    """Devuelve la misma lectura para cualquier imagen; la grabación se valida al crearlo."""

    def __init__(self, recording_path: Path) -> None:
        self._reading = _load_recording(recording_path)

    def read(self, image: Image) -> OcrReading:
        """La lectura grabada; la imagen no se mira."""
        return self._reading


def _load_recording(path: Path) -> OcrReading:
    try:
        document = json.loads(path.read_text(encoding="utf-8"))
        raw_response = document["respuesta_ocr"]
        read_fields = ReadFields.model_validate_json(json.dumps(document["campos"]))
    except (OSError, json.JSONDecodeError) as error:
        raise InvalidRecordingError(
            f"No se pudo leer la grabación del OCR {path}: {error}"
        ) from error
    except KeyError as error:
        raise InvalidRecordingError(f"A la grabación del OCR {path} le falta {error}") from error
    except ValidationError as error:
        raise InvalidRecordingError(
            f"Los campos de la grabación del OCR {path} no cumplen el contrato: {error}"
        ) from error
    return OcrReading(raw_response=raw_response, read_fields=read_fields)
