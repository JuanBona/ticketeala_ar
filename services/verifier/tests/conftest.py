"""Fixtures compartidas: ejemplos del contrato en docs/contratos/ejemplos/verifier."""

import json
from collections.abc import Callable
from pathlib import Path
from typing import Any

import pytest

from verifier.contract import Context, ReadFields
from verifier.signals.base import SignalInput

EXAMPLES_DIRECTORY = (
    Path(__file__).resolve().parents[3] / "docs" / "contratos" / "ejemplos" / "verifier"
)

def read_example_document(file_name: str) -> dict[str, Any]:
    """Devuelve el ejemplo como diccionario, para modificarlo en el test."""
    return json.loads((EXAMPLES_DIRECTORY / file_name).read_text(encoding="utf-8"))


@pytest.fixture
def initial_parameters_document() -> dict[str, Any]:
    """Parámetros de la versión 1 (los de pedido-http.json), para que cada test los modifique."""
    return read_example_document("pedido-http.json")["parametros"]


@pytest.fixture
def verified_result_document() -> dict[str, Any]:
    """resultado-verificado.json: el ejemplo de 12.5 (70 puntos, revision)."""
    return read_example_document("resultado-verificado.json")


@pytest.fixture
def read_fields_document(verified_result_document: dict[str, Any]) -> dict[str, Any]:
    """Campos del ejemplo de 12.5, para que cada test los modifique."""
    return verified_result_document["campos"]


@pytest.fixture
def build_signal_input() -> Callable[[dict[str, Any]], SignalInput]:
    """Arma la entrada de las señales con los campos dados, el QR y el contexto de los ejemplos."""
    qr = read_example_document("resultado-verificado.json")["qr"]
    context = Context.model_validate_json(
        json.dumps(read_example_document("pedido-http.json")["contexto"])
    )

    def build(read_fields: dict[str, Any]) -> SignalInput:
        return SignalInput(
            read_fields=ReadFields.model_validate_json(json.dumps(read_fields)),
            qr=qr,
            context=context,
        )

    return build
