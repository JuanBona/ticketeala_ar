"""Dobles del OCR para los tests: uno que cuenta las llamadas y otro que no responde."""

from pathlib import Path

from verifier.image.base import Image
from verifier.ocr.base import OcrReading, OcrUnavailableError
from verifier.ocr.fake import FakeOcr

RECORDINGS_DIRECTORY = Path(__file__).resolve().parents[1] / "verifier" / "ocr" / "recordings"
SYNTHETIC_RECORDING = RECORDINGS_DIRECTORY / "factura-a-sintetica.json"


class CountingOcr:
    """El OCR falso con la grabación sintética, que además cuenta cuántas veces se lo llamó."""

    def __init__(self) -> None:
        self._fake = FakeOcr(SYNTHETIC_RECORDING)
        self.calls = 0

    def read(self, image: Image) -> OcrReading:
        self.calls += 1
        return self._fake.read(image)


class UnavailableOcr:
    """Un proveedor caído (UC-02 5a)."""

    def read(self, image: Image) -> OcrReading:
        raise OcrUnavailableError("El OCR no respondió en 30 segundos")
