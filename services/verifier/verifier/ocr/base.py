"""Interfaz del OCR: el pipeline no sabe qué proveedor hay detrás (12.4, D28)."""

from dataclasses import dataclass
from typing import Protocol

from verifier.contract import OcrResponse, ReadFields
from verifier.image.base import Image


class OcrUnavailableError(RuntimeError):
    """El proveedor de OCR no respondió (UC-02 5a). En la cola, el trabajo se reintenta (D30)."""


@dataclass(frozen=True)
class OcrReading:
    """Respuesta cruda del proveedor (va al resultado) y los campos leídos del comprobante.

    En el paso 5 el OCR falso trae los campos ya extraídos; en el paso 6 salen de la extracción
    sobre el texto que devuelva Google Vision.
    """

    raw_response: OcrResponse
    read_fields: ReadFields


class OcrProvider(Protocol):
    """Un proveedor de OCR: Google Vision (paso 6) o el falso con respuestas grabadas."""

    def read(self, image: Image) -> OcrReading:
        """Lee la imagen ya preprocesada; lanza OcrUnavailableError si el proveedor no responde."""
        ...
