"""API HTTP del motor: GET /health y POST /verify, con el mismo contrato que la cola (D23)."""

import os
from functools import lru_cache
from typing import Annotated

from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse
from pydantic import ValidationError

from verifier.contract import RESULT_ADAPTER, AttachedImage, Request, Result
from verifier.ocr.base import OcrProvider, OcrUnavailableError
from verifier.ocr.fake import FakeOcr
from verifier.parameters import InvalidParametersError
from verifier.pipeline import ImageDecodeError, verify
from verifier.settings import load_ocr_settings
from verifier.transport.error_result import error_result

UNPROCESSABLE = 422

app = FastAPI(title="Verificador de comprobantes de AMR Viajes")


@lru_cache(maxsize=1)
def get_ocr_provider() -> OcrProvider:
    """Paso 5: el OCR falso con la grabación de OCR_FAKE_RECORDING; Google Vision llega en el 6."""
    return FakeOcr(load_ocr_settings(os.environ).fake_recording)


@app.get("/health")
def health() -> dict[str, str]:
    """Responde si el servicio está levantado."""
    return {"status": "ok"}


@app.post("/verify")
def verify_receipt(
    pedido: Annotated[str, Form()],
    archivo: Annotated[UploadFile, File()],
    ocr: Annotated[OcrProvider, Depends(get_ocr_provider)],
) -> JSONResponse:
    """D23: parte 'pedido' con el JSON del contrato y parte 'archivo' con la foto.

    Sin cola no hay reintentos: si el OCR no responde o la foto no se lee, devuelve estado error.
    """
    request = _parse_request(pedido)
    try:
        result: Result = verify(request, archivo.file.read(), ocr)
    except InvalidParametersError as error:
        raise HTTPException(UNPROCESSABLE, str(error)) from error
    except (OcrUnavailableError, ImageDecodeError) as error:
        result = error_result(request.job_id, request.expense_id, str(error))
    return JSONResponse(RESULT_ADAPTER.dump_python(result, mode="json"))


def _parse_request(pedido: str) -> Request:
    """El pedido tiene que cumplir el contrato y traer la foto adjunta, no una clave de S3."""
    try:
        request = Request.model_validate_json(pedido)
    except ValidationError as error:
        raise HTTPException(UNPROCESSABLE, f"El pedido no cumple el contrato: {error}") from error
    if not isinstance(request.image, AttachedImage):
        raise HTTPException(
            UNPROCESSABLE,
            "POST /verify espera la foto en la parte 'archivo' (imagen.origen = adjunto); "
            f"el pedido trae imagen.origen = {request.image.origin}",
        )
    return request
